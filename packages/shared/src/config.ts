// `.fixie.yml` v1 schema (TRD §7). Unknown keys are errors; out-of-range values report the allowed range.
import { z } from "zod";

const int = (min: number, max: number, def: number) =>
  z
    .number({ error: `must be a number between ${min} and ${max}` })
    .int({ error: `must be a whole number between ${min} and ${max}` })
    .min(min, { error: `must be between ${min} and ${max}` })
    .max(max, { error: `must be between ${min} and ${max}` })
    .default(def);

const autoOr = <T extends z.ZodType>(inner: T) => z.union([z.literal("auto"), inner]).default("auto");

/** Paths Fixie never edits, whatever `paths.blocked` says (TRD §3.6). */
export const ALWAYS_BLOCKED_PATHS = [".github/**", ".fixie.yml", ".fixie/**"] as const;

export const DEFAULT_MODEL = "github-models/openai/gpt-4.1-mini";

/** "<preset>/<model id>", e.g. "github-models/openai/gpt-4.1-mini" or "ollama/qwen3-coder:30b". */
export const ModelRef = z
  .string()
  .regex(/^[a-z][a-z0-9-]*\/\S+$/, { error: 'must look like "<preset>/<model id>"' });

export const FixieConfig = z.strictObject({
  version: z.literal(1, { error: "must be 1" }),
  model: z
    .strictObject({
      name: ModelRef.default(DEFAULT_MODEL),
      base_url: z.union([z.literal(""), z.url()]).default(""),
      fallback: z.array(ModelRef).max(3).default([]),
    })
    .prefault({}),
  project: z
    .strictObject({
      language: z.enum(["auto", "python", "node"]).default("auto"),
      image: autoOr(z.string().min(1)),
      install: autoOr(z.string().min(1)),
      test: autoOr(z.string().min(1)),
      lint: z.union([z.literal("auto"), z.literal("off"), z.string().min(1)]).default("auto"),
      typecheck: z.union([z.literal("auto"), z.literal("off"), z.string().min(1)]).default("auto"),
    })
    .prefault({}),
  limits: z
    .strictObject({
      max_repro_attempts: int(1, 5, 3),
      max_fix_attempts: int(1, 10, 6),
      max_changed_files: int(1, 50, 10),
      max_changed_lines: int(1, 2000, 300),
      max_run_minutes: int(10, 40, 40),
      max_llm_calls: int(5, 100, 40),
      max_cost_usd: z
        .number({ error: "must be a number between 0 and 20" })
        .min(0, { error: "must be between 0 and 20" })
        .max(20, { error: "must be between 0 and 20" })
        .default(0.5),
    })
    .prefault({}),
  sandbox: z
    .strictObject({
      cpus: autoOr(z.number().int().min(1).max(64)),
      memory_mb: autoOr(z.number().int().min(512).max(262144)),
    })
    .prefault({}),
  paths: z.strictObject({ blocked: z.array(z.string().min(1)).max(100).default([]) }).prefault({}),
  bisect: z
    .strictObject({
      enabled: z.boolean().default(true),
      good: z.string().min(1).default("auto"),
      max_steps: int(1, 30, 12),
      max_minutes: int(1, 30, 6),
    })
    .prefault({}),
  features: z
    .strictObject({
      intent_lock: z.boolean().default(false),
      stress_runs: int(0, 10, 0),
      memory_file: z.boolean().default(true),
    })
    .prefault({}),
  hub: z.strictObject({ upload_trace: z.boolean().default(false) }).prefault({}),
});
export type FixieConfig = z.infer<typeof FixieConfig>;
export type FixieConfigInput = z.input<typeof FixieConfig>;

export interface ConfigError {
  path: string;
  message: string;
}

/** Validate a parsed `.fixie.yml` object (or `undefined` when the file is missing → all defaults). */
export function parseFixieConfig(
  raw: unknown,
): { ok: true; config: FixieConfig } | { ok: false; errors: ConfigError[] } {
  const res = FixieConfig.safeParse(raw ?? { version: 1 });
  if (res.success) return { ok: true, config: res.data };
  return {
    ok: false,
    errors: res.error.issues.map((i) => {
      const keys = i.code === "unrecognized_keys" ? i.keys : [];
      const base = i.path.map(String).join(".");
      if (keys.length) {
        return {
          path: [base, keys[0]].filter(Boolean).join("."),
          message: `unknown key${keys.length > 1 ? "s" : ""}: ${keys.join(", ")}`,
        };
      }
      return { path: base || "(root)", message: i.message };
    }),
  };
}

export const defaultFixieConfig = (): FixieConfig => FixieConfig.parse({ version: 1 });

/** Effective blocked globs = always-blocked ∪ configured. */
export const blockedGlobs = (cfg: FixieConfig): string[] => [
  ...ALWAYS_BLOCKED_PATHS,
  ...cfg.paths.blocked.filter((g) => !(ALWAYS_BLOCKED_PATHS as readonly string[]).includes(g)),
];
