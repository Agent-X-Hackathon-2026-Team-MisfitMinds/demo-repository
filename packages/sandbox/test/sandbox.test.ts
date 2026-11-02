import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { defaultFixieConfig, parseFixieConfig } from "@fixie/shared";
import {
  type CommandRunner, DockerProvider, dockerRunArgs, HostGit, planProject, prepareWorkspace, resolveInWorkTree,
  safeReadFile, SandboxError, spawnRunner,
} from "../src/index.ts";

const fakeRunner = (handler: (args: readonly string[]) => Partial<Awaited<ReturnType<CommandRunner>>>) => {
  const calls: string[][] = [];
  const run: CommandRunner = async (_f, args) => {
    calls.push([...args]);
    return { exitCode: 0, stdout: "", stderr: "", timedOut: false, durationMs: 1, outputBytes: 0, ...handler(args) };
  };
  return { run, calls };
};

describe("docker run flags (SEC-02/03)", () => {
  const args = dockerRunArgs(
    { runId: "r1", image: "python:3.12-bookworm", cpus: 3, memoryMb: 14000, pids: 1024, workdir: "/tmp/w" },
    { container: "fixie-r1", network: "fixie-r1" }, "/tmp/d");
  const s = args.join(" ");
  it("locks the container down", () => {
    for (const f of ["--user 1001:1001", "--cap-drop ALL", "--security-opt no-new-privileges", "--pids-limit 1024", "--read-only", "--network fixie-r1", "--memory 14000m"])
      expect(s).toContain(f);
  });
  it("mounts only work and deps; never .git or the docker socket; no host env", () => {
    const mounts = args.filter((a, i) => args[i - 1] === "--mount" || args[i - 1] === "-v");
    expect(mounts).toEqual(["type=bind,source=/tmp/w,target=/work", "type=bind,source=/tmp/d,target=/deps"]);
    expect(s).not.toMatch(/docker\.sock|\.git|GITHUB_TOKEN|--env-file|--privileged/);
  });
  it("rejects odd image refs", () => {
    expect(() => dockerRunArgs({ runId: "r", image: "x; rm -rf /", cpus: 1, memoryMb: 512, pids: 10, workdir: "/w" },
      { container: "c", network: "n" }, "/d")).toThrow(SandboxError);
  });
});

describe("DockerSandbox", () => {
  const make = async (handler: Parameters<typeof fakeRunner>[0]) => {
    const f = fakeRunner(handler);
    const p = new DockerProvider({ runner: f.run, tempRoot: mkdtempSync(join(tmpdir(), "fx-")),
      redact: (t) => ({ text: t.replaceAll("hunter2hunter2", "***"), count: t.includes("hunter2hunter2") ? 1 : 0 }) });
    const sb = await p.create({ runId: "abc", image: "node:22-bookworm", cpus: 1, memoryMb: 1024, pids: 100, workdir: "/w" });
    return { sb, calls: f.calls };
  };
  it("exec: wraps in timeout, redacts, rejects non-allow-listed env", async () => {
    const { sb, calls } = await make((a) => (a[0] === "exec" ? { stdout: "pw=hunter2hunter2\n" } : {}));
    const r = await sb.exec("npm test", { timeoutMs: 30_000 });
    expect(r.output).toBe("pw=***\n");
    expect(r.redactionCount).toBe(1);
    expect(calls.at(-1)).toEqual(["exec", "--user", "1001:1001", "--workdir", "/work", "fixie-abc", "timeout", "--kill-after=5", "30", "bash", "-c", "npm test"]);
    await expect(sb.exec("x", { timeoutMs: 1000, env: { GITHUB_TOKEN: "t" } })).rejects.toThrow(/not allowed/);
  });
  it("exec: exit 124 is a timeout", async () => {
    const { sb } = await make((a) => (a[0] === "exec" ? { exitCode: 124 } : {}));
    expect(await sb.exec("sleep 99", { timeoutMs: 1000 })).toMatchObject({ timedOut: true, exitCode: null });
  });
  it("lockNetwork: disconnect then probe; probe success = reachable", async () => {
    const blocked = await make((a) => (a[0] === "exec" ? { exitCode: 7 } : {}));
    expect((await blocked.sb.lockNetwork()).probe).toBe("blocked");
    expect(blocked.calls.some((c) => c.join(" ") === "network disconnect --force fixie-abc fixie-abc")).toBe(true);
    const leaky = await make(() => ({}));
    expect((await leaky.sb.lockNetwork()).probe).toBe("reachable");
  });
  it("destroy is idempotent and removes container + network", async () => {
    const { sb, calls } = await make(() => ({}));
    await sb.destroy("completed");
    await sb.destroy("completed");
    expect(calls.filter((c) => c[0] === "rm" || (c[0] === "network" && c[1] === "rm"))).toHaveLength(2);
    await expect(sb.exec("x", { timeoutMs: 1 })).rejects.toThrow(/destroyed/);
  });
});

describe("workspace (SEC-05)", () => {
  const setup = () => {
    const dir = mkdtempSync(join(tmpdir(), "fx-repo-"));
    const repo = join(dir, "checkout");
    mkdirSync(repo);
    const g = (...a: string[]) => execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...a], { cwd: repo });
    g("init", "-q", "-b", "main");
    writeFileSync(join(repo, "a.py"), "x = 1\n");
    symlinkSync("/etc/passwd", join(repo, "evil"));
    // a hook that would prove hooks run
    mkdirSync(join(repo, ".git", "hooks"), { recursive: true });
    writeFileSync(join(repo, ".git", "hooks", "pre-commit"), `#!/bin/sh\ntouch ${join(dir, "PWNED")}\n`);
    chmodSync(join(repo, ".git", "hooks", "pre-commit"), 0o755);
    g("add", "."); g("commit", "-q", "--no-verify", "-m", "init");
    return { dir, ws: prepareWorkspace(repo, join(dir, "run")) };
  };

  it("splits work and git dir; .git not in work", () => {
    const { ws } = setup();
    expect(existsSync(join(ws.work, ".git"))).toBe(false);
    expect(existsSync(join(ws.gitDir, "HEAD"))).toBe(true);
  });
  it("refuses traversal and symlink escapes; reads normal files", () => {
    const { ws } = setup();
    expect(safeReadFile(ws.work, "a.py")).toBe("x = 1\n");
    expect(() => safeReadFile(ws.work, "evil")).toThrow(/escapes/);
    expect(() => resolveInWorkTree(ws.work, "../git/config")).toThrow(/escapes/);
    expect(safeReadFile(ws.work, "missing.py")).toBeNull();
  });
  it("host git never runs repo hooks", async () => {
    const { dir, ws } = setup();
    const git = new HostGit(ws, spawnRunner);
    writeFileSync(join(ws.work, "a.py"), "x = 2\n");
    await git.git(["commit", "-qam", "change"]);
    expect(existsSync(join(dir, "PWNED"))).toBe(false);
    expect((await git.head()).length).toBe(40);
  });
});

describe("planProject", () => {
  const files = (m: Record<string, string>) => ({ exists: (p: string) => p in m, read: (p: string) => m[p] ?? null });
  it("python + uv + ruff + .python-version", () => {
    const p = planProject(files({ "pyproject.toml": "[tool.ruff]\n", "uv.lock": "", ".python-version": "3.11.9\n", tests: "" }), defaultFixieConfig());
    expect(p).toMatchObject({ language: "python", framework: "pytest", image: "python:3.11-bookworm", testDir: "tests" });
    expect(p.install).toContain("uv sync --frozen");
    expect(p.lint?.tool).toBe("ruff");
    expect(p.typecheck).toBeNull();
    expect(p.test("baseline").cmd).toContain("--junitxml=/tmp/fx/junit-baseline.xml");
    expect(p.test("repro_before", ["tests/test_fixie_issue_3.py"]).cmd).toMatch(/'tests\/test_fixie_issue_3\.py'$/);
  });
  it("node: pnpm + vitest + tsc, .nvmrc", () => {
    const p = planProject(files({ "package.json": JSON.stringify({ devDependencies: { vitest: "3", typescript: "5" } }),
      "pnpm-lock.yaml": "", "tsconfig.json": "{}", ".nvmrc": "v20.11.0" }), defaultFixieConfig());
    expect(p).toMatchObject({ language: "node", framework: "vitest", image: "node:20-bookworm" });
    expect(p.install).toContain("pnpm install --frozen-lockfile");
    expect(p.typecheck?.tool).toBe("tsc");
  });
  it("node: jest without jest-junit installs it into /deps", () => {
    const p = planProject(files({ "package.json": JSON.stringify({ devDependencies: { jest: "29" } }), "package-lock.json": "" }), defaultFixieConfig());
    expect(p.install).toContain("npm ci");
    expect(p.install).toContain("/deps/jestjunit");
    expect(p.test("final")).toMatchObject({ env: { JEST_JUNIT_OUTPUT_NAME: "junit-final.xml" } });
  });
  it("config overrides win", () => {
    const c = parseFixieConfig({ version: 1, project: { install: "make deps", lint: "off", image: "python:3.10-slim" } });
    if (!c.ok) throw new Error("bad");
    const p = planProject(files({ "requirements.txt": "", ".flake8": "" }), c.config);
    expect(p).toMatchObject({ install: "make deps", lint: null, image: "python:3.10-slim" });
    expect(p.sources).toMatchObject({ install: "config", image: "config" });
  });
  it("no framework → clear error", () => {
    expect(() => planProject(files({ "package.json": "{}" }), defaultFixieConfig())).toThrow(/Vitest or Jest/);
    expect(() => planProject(files({}), defaultFixieConfig())).toThrow(/Couldn't detect/);
  });
});
