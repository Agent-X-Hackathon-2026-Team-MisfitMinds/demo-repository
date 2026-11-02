// Host process runner. No shell: argv only, so nothing from repo/issue text is interpreted by a host shell.
import { spawn } from "node:child_process";

export interface RunOptions {
  timeoutMs: number;
  cwd?: string;
  /** Full environment for the child. Never pass process.env wholesale to anything touching repo code. */
  env?: Record<string, string>;
  onOutput?: (chunk: string, stream: "stdout" | "stderr") => void;
  /** Keep at most this many bytes of output in memory (tail). Default 1 MiB. */
  maxBufferBytes?: number;
}

export interface RunResult {
  exitCode: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
  outputBytes: number;
}

export type CommandRunner = (file: string, args: readonly string[], o: RunOptions) => Promise<RunResult>;

const tail = (s: string, max: number) => (s.length > max ? s.slice(s.length - max) : s);

export const spawnRunner: CommandRunner = (file, args, o) =>
  new Promise((resolve) => {
    const started = Date.now();
    const max = o.maxBufferBytes ?? 1 << 20;
    let stdout = "";
    let stderr = "";
    let bytes = 0;
    let timedOut = false;
    const child = spawn(file, [...args], {
      cwd: o.cwd,
      env: o.env ?? { PATH: process.env.PATH ?? "/usr/bin:/bin" },
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    });
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill("SIGKILL");
    }, o.timeoutMs);
    child.stdout.setEncoding("utf8").on("data", (c: string) => {
      bytes += Buffer.byteLength(c);
      stdout = tail(stdout + c, max);
      o.onOutput?.(c, "stdout");
    });
    child.stderr.setEncoding("utf8").on("data", (c: string) => {
      bytes += Buffer.byteLength(c);
      stderr = tail(stderr + c, max);
      o.onOutput?.(c, "stderr");
    });
    const done = (exitCode: number | null) => {
      clearTimeout(timer);
      resolve({ exitCode, stdout, stderr, timedOut, durationMs: Date.now() - started, outputBytes: bytes });
    };
    child.on("error", (e) => {
      stderr += String(e);
      done(null);
    });
    child.on("close", (code) => done(timedOut ? null : code));
  });
