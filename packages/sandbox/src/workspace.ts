// Host-side work tree (TRD §4): repo files at <root>/work (mounted into the sandbox), .git at <root>/git (never mounted).
// Host git runs with hooks and fsmonitor disabled; host file reads are realpath-confined (SEC-05).
import { cpSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";
import { type CommandRunner, spawnRunner } from "./runner.ts";
import { SandboxError } from "./types.ts";

export const MAX_HOST_READ_BYTES = 1 << 20;

export const SAFE_GIT_FLAGS = [
  "-c", "core.hooksPath=/dev/null",
  "-c", "core.fsmonitor=false",
  "-c", "protocol.file.allow=never",
  "-c", "core.symlinks=true",
  "-c", "advice.detachedHead=false",
  "-c", "user.name=fixie",
  "-c", "user.email=fixie@users.noreply.github.com",
  "-c", "commit.gpgsign=false",
];

export interface Workspace {
  root: string;
  work: string;
  gitDir: string;
}

/** Copy `checkout` (files) to <root>/work and its .git to <root>/git. The checkout itself is not modified. */
export function prepareWorkspace(checkout: string, root: string): Workspace {
  const work = join(root, "work");
  const gitDir = join(root, "git");
  mkdirSync(root, { recursive: true });
  if (!existsSync(join(checkout, ".git"))) throw new SandboxError("checkout has no .git directory", "environment");
  if (lstatSync(join(checkout, ".git")).isFile())
    throw new SandboxError(".git is a file (worktree/submodule checkouts are not supported)", "environment");
  cpSync(checkout, work, {
    recursive: true,
    verbatimSymlinks: true,
    filter: (src) => relative(checkout, src).split(sep)[0] !== ".git",
  });
  cpSync(join(checkout, ".git"), gitDir, { recursive: true, verbatimSymlinks: true });
  return { root, work, gitDir };
}

export class HostGit {
  constructor(
    private readonly ws: Workspace,
    private readonly runner: CommandRunner = spawnRunner,
    private readonly env: Record<string, string> = { PATH: process.env.PATH ?? "/usr/bin:/bin", GIT_TERMINAL_PROMPT: "0" },
  ) {}

  async git(args: string[], timeoutMs = 60_000): Promise<string> {
    const res = await this.runner("git", [...SAFE_GIT_FLAGS, `--git-dir=${this.ws.gitDir}`, `--work-tree=${this.ws.work}`, ...args], {
      timeoutMs,
      cwd: this.ws.work,
      env: { ...this.env, GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" },
      maxBufferBytes: 8 << 20,
    });
    if (res.exitCode !== 0) throw new Error(`git ${args[0]} failed (${res.exitCode}): ${res.stderr.trim().slice(0, 500)}`);
    return res.stdout;
  }

  async tryGit(args: string[], timeoutMs = 60_000): Promise<{ ok: boolean; out: string }> {
    try {
      return { ok: true, out: await this.git(args, timeoutMs) };
    } catch (e) {
      return { ok: false, out: String(e) };
    }
  }

  head = async () => (await this.git(["rev-parse", "HEAD"])).trim();
}

/** Resolve a repo-relative path inside the work tree, refusing escapes and symlinks pointing outside. */
export function resolveInWorkTree(work: string, rel: string): string {
  const root = realpathSync(work);
  const target = resolve(root, rel);
  if (target !== root && !target.startsWith(root + sep)) throw new SandboxError(`path escapes work tree: ${rel}`, "policy");
  if (existsSync(target)) {
    const real = realpathSync(target);
    if (real !== root && !real.startsWith(root + sep)) throw new SandboxError(`symlink escapes work tree: ${rel}`, "policy");
  } else {
    const parent = realpathSync(existingAncestor(dirname(target)));
    if (parent !== root && !parent.startsWith(root + sep)) throw new SandboxError(`path escapes work tree: ${rel}`, "policy");
  }
  return target;
}

function existingAncestor(p: string): string {
  let cur = p;
  while (!existsSync(cur)) cur = dirname(cur);
  return cur;
}

/** Host-side read: confined, ≤ 1 MB, regular files only. Returns null if missing. */
export function safeReadFile(work: string, rel: string): string | null {
  const p = resolveInWorkTree(work, rel);
  if (!existsSync(p)) return null;
  const st = statSync(p);
  if (!st.isFile()) throw new SandboxError(`not a regular file: ${rel}`, "policy");
  if (st.size > MAX_HOST_READ_BYTES) throw new SandboxError(`file over 1 MB: ${rel}`, "policy");
  return readFileSync(p, "utf8");
}

export function safeWriteFile(work: string, rel: string, content: string): void {
  const p = resolveInWorkTree(work, rel);
  if (existsSync(p) && lstatSync(p).isSymbolicLink()) throw new SandboxError(`refusing to write through symlink: ${rel}`, "policy");
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, content, "utf8");
}

