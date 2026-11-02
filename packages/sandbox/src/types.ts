// SandboxProvider interface (TRD §4).
export interface SandboxCreateOptions {
  runId: string;
  image: string;
  cpus: number;
  memoryMb: number;
  pids: number;
  /** Host path of the work tree (no .git inside). Mounted rw at /work. */
  workdir: string;
}

export interface ExecOptions {
  cwd?: string; // inside the container, default /work
  timeoutMs: number;
  env?: Record<string, string>;
  /** Receives redacted output chunks (for log files / live log events). */
  onOutput?: (chunk: string) => void;
}

export interface ExecResult {
  exitCode: number | null;
  output: string; // redacted, combined stdout+stderr tail
  timedOut: boolean;
  durationMs: number;
  outputBytes: number;
  redactionCount: number;
}

export interface Sandbox {
  readonly id: string;
  readonly image: string;
  exec(cmd: string, o: ExecOptions): Promise<ExecResult>;
  lockNetwork(): Promise<{ lockedAt: string; probe: "blocked" | "reachable" }>;
  destroy(reason: "completed" | "timeout" | "cancelled" | "error"): Promise<void>;
}

export interface SandboxProvider {
  create(opts: SandboxCreateOptions): Promise<Sandbox>;
}

export class SandboxError extends Error {
  constructor(message: string, readonly kind: "infra" | "environment" | "policy") {
    super(message);
    this.name = "SandboxError";
  }
}
