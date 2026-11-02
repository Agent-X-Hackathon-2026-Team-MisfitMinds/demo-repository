// DockerProvider (TRD §4, SEC-01..04). Repo code runs only in here; no secrets, no .git, no Docker socket.
import { randomBytes } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { type CommandRunner, spawnRunner } from "./runner.ts";
import { type ExecOptions, type ExecResult, type Sandbox, type SandboxCreateOptions, SandboxError, type SandboxProvider } from "./types.ts";

/** Env keys a command may set inside the container. Values are still redacted on the way out. */
export const CONTAINER_ENV_ALLOWLIST = new Set([
  "CI", "HOME", "PATH", "LANG", "LC_ALL", "TZ", "PYTHONHASHSEED", "PYTHONDONTWRITEBYTECODE", "PYTHONPATH",
  "PIP_DISABLE_PIP_VERSION_CHECK", "PIP_NO_INPUT", "PIP_CACHE_DIR", "VIRTUAL_ENV", "NODE_ENV", "NODE_OPTIONS",
  "npm_config_cache", "COREPACK_HOME", "COREPACK_ENABLE_DOWNLOAD_PROMPT", "JEST_JUNIT_OUTPUT_DIR",
  "JEST_JUNIT_OUTPUT_NAME", "FORCE_COLOR", "NO_COLOR", "COVERAGE_FILE",
]);

export const BASE_ENV: Record<string, string> = {
  HOME: "/tmp",
  CI: "true",
  PIP_DISABLE_PIP_VERSION_CHECK: "1",
  PIP_NO_INPUT: "1",
  PYTHONDONTWRITEBYTECODE: "1",
  npm_config_cache: "/tmp/.npm",
  COREPACK_HOME: "/deps/corepack",
  COREPACK_ENABLE_DOWNLOAD_PROMPT: "0",
  PATH: "/deps/venv/bin:/deps/node/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin",
};

const NAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$/;
const IMAGE_RE = /^[a-z0-9]+(?:[._/-][a-z0-9]+)*(?::[A-Za-z0-9_.-]{1,128})?(?:@sha256:[a-f0-9]{64})?$/;

/** Probe run after the network is cut; must FAIL to reach the internet (exit 0 = reachable). */
export const EGRESS_PROBE = [
  "if command -v python3 >/dev/null 2>&1; then",
  `  python3 -c "import urllib.request,sys; urllib.request.urlopen('https://pypi.org/simple/', timeout=3); sys.exit(0)" 2>/dev/null && exit 0;`,
  "fi;",
  "if command -v node >/dev/null 2>&1; then",
  `  node -e "fetch('https://registry.npmjs.org/',{signal:AbortSignal.timeout(3000)}).then(()=>process.exit(0),()=>process.exit(1))" 2>/dev/null && exit 0;`,
  "fi;",
  "exit 7",
].join("\n");

export interface DockerProviderOptions {
  runner?: CommandRunner;
  docker?: string; // docker binary
  /** Host directory for per-run deps (mounted at /deps). */
  tempRoot: string;
  redact?: (s: string) => { text: string; count: number };
  /** Env for the docker CLI process itself (needs PATH, DOCKER_HOST at most; never tokens). */
  dockerEnv?: Record<string, string>;
}

export function dockerRunArgs(o: SandboxCreateOptions, names: { container: string; network: string }, depsDir: string): string[] {
  if (!IMAGE_RE.test(o.image)) throw new SandboxError(`invalid image reference: ${o.image}`, "policy");
  const env = Object.entries(BASE_ENV).flatMap(([k, v]) => ["-e", `${k}=${v}`]);
  return [
    "run", "-d",
    "--name", names.container,
    "--network", names.network,
    "--user", "1001:1001",
    "--cap-drop", "ALL",
    "--security-opt", "no-new-privileges",
    "--pids-limit", String(o.pids),
    "--cpus", String(o.cpus),
    "--memory", `${o.memoryMb}m`,
    "--memory-swap", `${o.memoryMb}m`,
    "--read-only",
    "--tmpfs", "/tmp:rw,exec,size=1g,uid=1001,gid=1001",
    "--mount", `type=bind,source=${o.workdir},target=/work`,
    "--mount", `type=bind,source=${depsDir},target=/deps`,
    "--workdir", "/work",
    "--label", "fixie=1",
    ...env,
    "--entrypoint", "sleep",
    o.image,
    "infinity",
  ];
}

export class DockerProvider implements SandboxProvider {
  private readonly run: CommandRunner;
  private readonly bin: string;
  constructor(private readonly opts: DockerProviderOptions) {
    this.run = opts.runner ?? spawnRunner;
    this.bin = opts.docker ?? "docker";
  }

  private docker(args: string[], timeoutMs = 120_000) {
    return this.run(this.bin, args, { timeoutMs, env: this.opts.dockerEnv ?? { PATH: process.env.PATH ?? "/usr/bin:/bin" } });
  }

  async create(o: SandboxCreateOptions): Promise<Sandbox> {
    const suffix = NAME_RE.test(`fixie-${o.runId}`) ? o.runId : randomBytes(6).toString("hex");
    const names = { container: `fixie-${suffix}`, network: `fixie-${suffix}` };
    const depsDir = join(this.opts.tempRoot, suffix, "deps");
    mkdirSync(depsDir, { recursive: true, mode: 0o755 });

    const net = await this.docker(["network", "create", "--label", "fixie=1", names.network]);
    if (net.exitCode !== 0) throw new SandboxError(`docker network create failed: ${net.stderr.trim().slice(0, 300)}`, "infra");
    const pull = await this.docker(["pull", "--quiet", o.image], 600_000);
    if (pull.exitCode !== 0) {
      await this.docker(["network", "rm", names.network]);
      throw new SandboxError(`docker pull ${o.image} failed: ${pull.stderr.trim().slice(0, 300)}`, "environment");
    }
    const started = await this.docker(dockerRunArgs(o, names, depsDir));
    if (started.exitCode !== 0) {
      await this.docker(["network", "rm", names.network]);
      throw new SandboxError(`docker run failed: ${started.stderr.trim().slice(0, 300)}`, "infra");
    }
    return new DockerSandbox(names, o.image, (a, t) => this.docker(a, t), this.opts.redact ?? ((s) => ({ text: s, count: 0 })));
  }
}

export class DockerSandbox implements Sandbox {
  private destroyed = false;
  private locked = false;
  constructor(
    private readonly names: { container: string; network: string },
    readonly image: string,
    private readonly docker: (args: string[], timeoutMs?: number) => ReturnType<CommandRunner>,
    private readonly redact: (s: string) => { text: string; count: number } = (s) => ({ text: s, count: 0 }),
  ) {}

  get id() { return this.names.container; }
  get networkLocked() { return this.locked; }

  async exec(cmd: string, o: ExecOptions): Promise<ExecResult> {
    if (this.destroyed) throw new SandboxError("sandbox already destroyed", "infra");
    const env: string[] = [];
    for (const [k, v] of Object.entries(o.env ?? {})) {
      if (!CONTAINER_ENV_ALLOWLIST.has(k)) throw new SandboxError(`env ${k} is not allowed in the sandbox`, "policy");
      env.push("-e", `${k}=${v}`);
    }
    const secs = Math.max(1, Math.ceil(o.timeoutMs / 1000));
    const args = [
      "exec", "--user", "1001:1001", "--workdir", o.cwd ?? "/work", ...env, this.names.container,
      "timeout", "--kill-after=5", String(secs), "bash", "-c", cmd,
    ];
    let redactions = 0;
    const res = await this.docker(args, o.timeoutMs + 20_000);
    const combined = this.redact(`${res.stdout}${res.stderr ? `\n${res.stderr}` : ""}`);
    redactions += combined.count;
    if (o.onOutput && combined.text) o.onOutput(combined.text);
    // coreutils timeout exits 124 (TERM) or 137 (KILL) on timeout
    const timedOut = res.timedOut || res.exitCode === 124 || res.exitCode === 137;
    return {
      exitCode: timedOut ? null : res.exitCode,
      output: combined.text,
      timedOut,
      durationMs: res.durationMs,
      outputBytes: res.outputBytes,
      redactionCount: redactions,
    };
  }

  async lockNetwork(): Promise<{ lockedAt: string; probe: "blocked" | "reachable" }> {
    const dis = await this.docker(["network", "disconnect", "--force", this.names.network, this.names.container]);
    if (dis.exitCode !== 0) throw new SandboxError(`network disconnect failed: ${dis.stderr.trim().slice(0, 300)}`, "infra");
    this.locked = true;
    const lockedAt = new Date().toISOString();
    const probe = await this.exec(EGRESS_PROBE, { timeoutMs: 15_000 });
    return { lockedAt, probe: probe.exitCode === 0 ? "reachable" : "blocked" };
  }

  async destroy(_reason: "completed" | "timeout" | "cancelled" | "error"): Promise<void> {
    if (this.destroyed) return;
    this.destroyed = true;
    await this.docker(["rm", "-f", "-v", this.names.container], 60_000);
    await this.docker(["network", "rm", this.names.network], 60_000);
  }
}
