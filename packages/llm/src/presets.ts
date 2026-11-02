// Model presets: the single source for base URLs, default models, context budgets and prices (D-25, TRD §6).
// Prices are USD per 1M tokens. Free presets cost 0. Check provider catalogs (`gh models list`, pricing pages) before releases.

export interface Preset {
  id: string;
  baseUrl: string;
  auth: "github-token" | "api-key" | "optional-key" | "none";
  defaultModel: string;
  contextTokens: number;
  maxOutputTokens: number;
  free: boolean;
  local: boolean;
  /** Per-model prices; unknown models on paid presets use `defaultPrice`. */
  prices?: Record<string, { in: number; out: number }>;
  defaultPrice?: { in: number; out: number };
  extraHeaders?: Record<string, string>;
}

export const PRICES_CHECKED_AT = "2026-11-02";

export const PRESETS: Record<string, Preset> = {
  "github-models": {
    id: "github-models",
    baseUrl: "https://models.github.ai/inference",
    auth: "github-token",
    defaultModel: "openai/gpt-4.1-mini",
    contextTokens: 7_000,
    maxOutputTokens: 3_000,
    free: true,
    local: false,
  },
  ollama: {
    id: "ollama",
    baseUrl: "http://localhost:11434/v1",
    auth: "none",
    defaultModel: "qwen3-coder:30b",
    contextTokens: 14_000,
    maxOutputTokens: 4_000,
    free: true,
    local: true,
  },
  gemini: {
    id: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    auth: "api-key",
    defaultModel: "gemini-2.5-flash",
    contextTokens: 24_000,
    maxOutputTokens: 4_000,
    free: true,
    local: false,
  },
  groq: {
    id: "groq",
    baseUrl: "https://api.groq.com/openai/v1",
    auth: "api-key",
    defaultModel: "llama-3.3-70b-versatile",
    contextTokens: 12_000,
    maxOutputTokens: 4_000,
    free: true,
    local: false,
  },
  openrouter: {
    id: "openrouter",
    baseUrl: "https://openrouter.ai/api/v1",
    auth: "api-key",
    defaultModel: "qwen/qwen3-coder:free",
    contextTokens: 12_000,
    maxOutputTokens: 4_000,
    free: true,
    local: false,
    extraHeaders: { "X-Title": "Fixie" },
  },
  openai: {
    id: "openai",
    baseUrl: "https://api.openai.com/v1",
    auth: "api-key",
    defaultModel: "gpt-4.1-mini",
    contextTokens: 48_000,
    maxOutputTokens: 8_000,
    free: false,
    local: false,
    prices: { "gpt-4.1-mini": { in: 0.4, out: 1.6 }, "gpt-4.1": { in: 2, out: 8 } },
    defaultPrice: { in: 2, out: 8 },
  },
  anthropic: {
    id: "anthropic",
    baseUrl: "https://api.anthropic.com/v1",
    auth: "api-key",
    defaultModel: "claude-haiku-4-5",
    contextTokens: 48_000,
    maxOutputTokens: 8_000,
    free: false,
    local: false,
    prices: { "claude-haiku-4-5": { in: 1, out: 5 }, "claude-sonnet-4-5": { in: 3, out: 15 } },
    defaultPrice: { in: 3, out: 15 },
  },
  "openai-compatible": {
    id: "openai-compatible",
    baseUrl: "",
    auth: "optional-key",
    defaultModel: "",
    contextTokens: 12_000,
    maxOutputTokens: 4_000,
    free: true,
    local: false,
  },
};

export interface ResolvedModel {
  preset: Preset;
  model: string;
  baseUrl: string;
  ref: string; // "<preset>/<model>"
}

/** "github-models/openai/gpt-4.1-mini" → preset github-models, model openai/gpt-4.1-mini. */
export function resolveModel(ref: string, opts: { baseUrl?: string; ollamaHost?: string } = {}): ResolvedModel {
  const slash = ref.indexOf("/");
  if (slash <= 0) throw new Error(`model must look like "<preset>/<model id>", got "${ref}"`);
  const id = ref.slice(0, slash);
  const preset = PRESETS[id];
  if (!preset) throw new Error(`unknown model preset "${id}" (known: ${Object.keys(PRESETS).join(", ")})`);
  const model = ref.slice(slash + 1) || preset.defaultModel;
  let baseUrl = opts.baseUrl || preset.baseUrl;
  if (id === "ollama" && !opts.baseUrl && opts.ollamaHost) baseUrl = `${opts.ollamaHost.replace(/\/$/, "")}/v1`;
  if (!baseUrl) throw new Error(`preset "${id}" needs model.base_url`);
  return { preset, model, baseUrl: baseUrl.replace(/\/$/, ""), ref: `${id}/${model}` };
}

export function costUsd(r: ResolvedModel, inputTokens: number, outputTokens: number): number {
  if (r.preset.free) return 0;
  const p = r.preset.prices?.[r.model] ?? r.preset.defaultPrice ?? { in: 0, out: 0 };
  return (inputTokens * p.in + outputTokens * p.out) / 1e6;
}
