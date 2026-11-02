// OpenAI-compatible Chat Completions client over fetch (TRD §6). No tool calling, no JSON mode dependency.
import { createHash } from "node:crypto";
import type { LlmPurpose, RunStep } from "@fixie/shared";
import { estimateTokens } from "./budget.ts";
import { costUsd, type ResolvedModel } from "./presets.ts";

export interface ChatMessage { role: "system" | "user" | "assistant"; content: string }

export interface ChatRequest {
  purpose: LlmPurpose;
  step: RunStep;
  messages: ChatMessage[];
  temperature: number;
  maxTokens?: number;
}

export interface ChatResponse {
  text: string;
  model: ResolvedModel;
  inputTokens: number;
  outputTokens: number;
  latencyMs: number;
  costUsd: number;
}

export interface LlmCallEvent {
  purpose: LlmPurpose; step: RunStep; preset: string; model: string; inputTokens: number; outputTokens: number;
  costUsd: number; latencyMs: number; ok: boolean; error?: string;
}

/** Recorded-response mode for tests and replay: responses keyed by request hash. */
export interface Recorder {
  get(key: string): string | undefined;
  put?(key: string, text: string): void;
}

export class LlmBudgetExceeded extends Error {
  constructor(readonly kind: "calls" | "cost") { super(`LLM ${kind} budget exceeded`); this.name = "LlmBudgetExceeded"; }
}
export class LlmError extends Error {
  constructor(message: string, readonly status: number | null) { super(message); this.name = "LlmError"; }
}

export interface LlmClientOptions {
  models: ResolvedModel[]; // primary first, then fallbacks
  /** Secret per auth kind; never logged. */
  credentials: { githubToken?: string; apiKey?: string };
  maxCalls: number;
  maxCostUsd: number;
  onCall?: (e: LlmCallEvent) => void;
  recorder?: Recorder;
  /** "replay" = only recorded answers, never network. */
  mode?: "live" | "record" | "replay";
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  retries?: number;
  timeoutMs?: number;
}

export const requestKey = (r: ChatRequest): string =>
  createHash("sha256").update(JSON.stringify([r.purpose, r.messages])).digest("hex").slice(0, 32);

export class LlmClient {
  private calls = 0;
  private spent = 0;
  private modelIdx = 0;
  constructor(private readonly o: LlmClientOptions) {
    if (!o.models.length) throw new Error("no model configured");
  }

  get stats() { return { calls: this.calls, costUsd: this.spent, model: this.o.models[this.modelIdx] }; }

  async chat(req: ChatRequest): Promise<ChatResponse> {
    if (this.calls >= this.o.maxCalls) throw new LlmBudgetExceeded("calls");
    if (this.spent > this.o.maxCostUsd) throw new LlmBudgetExceeded("cost");
    const key = requestKey(req);
    const mode = this.o.mode ?? "live";
    if (mode === "replay") {
      const text = this.o.recorder?.get(key);
      if (text === undefined) throw new LlmError(`no recorded response for ${req.purpose} (${key})`, null);
      this.calls++;
      const m = this.o.models[0] as ResolvedModel;
      const res = { text, model: m, inputTokens: estimateTokens(req.messages.map((x) => x.content).join("")), outputTokens: estimateTokens(text), latencyMs: 0, costUsd: 0 };
      this.emit(req, res, true);
      return res;
    }
    let lastErr: unknown;
    while (this.modelIdx < this.o.models.length) {
      const model = this.o.models[this.modelIdx] as ResolvedModel;
      try {
        const res = await this.withRetries(model, req);
        this.o.recorder?.put?.(key, res.text);
        return res;
      } catch (e) {
        lastErr = e;
        // Persistent 429 (or auth/model-not-found on a fallback-able error) → next model in model.fallback.
        if (e instanceof LlmError && (e.status === 429 || e.status === 404 || e.status === 403) && this.modelIdx < this.o.models.length - 1) {
          this.modelIdx++;
          continue;
        }
        throw e;
      }
    }
    throw lastErr;
  }

  private async withRetries(model: ResolvedModel, req: ChatRequest): Promise<ChatResponse> {
    const retries = this.o.retries ?? 3;
    const sleep = this.o.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.once(model, req);
      } catch (e) {
        const status = e instanceof LlmError ? e.status : null;
        const retryable = status === null || status === 429 || status >= 500;
        if (!retryable || attempt >= retries) throw e;
        const ra = e instanceof RetryAfter ? e.seconds * 1000 : 0;
        const backoff = Math.min(30_000, 1000 * 2 ** attempt) * (0.5 + Math.random() * 0.5);
        await sleep(Math.min(60_000, Math.max(ra, backoff)));
      }
    }
  }

  private headers(model: ResolvedModel): Record<string, string> {
    const h: Record<string, string> = { "content-type": "application/json", accept: "application/json", ...model.preset.extraHeaders };
    const { githubToken, apiKey } = this.o.credentials;
    switch (model.preset.auth) {
      case "github-token":
        if (!githubToken) throw new LlmError("GitHub Models needs GITHUB_TOKEN with `models: read`", 401);
        h.authorization = `Bearer ${githubToken}`;
        break;
      case "api-key":
        if (!apiKey) throw new LlmError(`preset ${model.preset.id} needs FIXIE_LLM_API_KEY`, 401);
        h.authorization = `Bearer ${apiKey}`;
        break;
      case "optional-key":
        if (apiKey) h.authorization = `Bearer ${apiKey}`;
        break;
      case "none":
        break;
    }
    return h;
  }

  private async once(model: ResolvedModel, req: ChatRequest): Promise<ChatResponse> {
    const started = Date.now();
    const f = this.o.fetchImpl ?? fetch;
    this.calls++;
    let res: Response;
    try {
      res = await f(`${model.baseUrl}/chat/completions`, {
        method: "POST",
        headers: this.headers(model),
        body: JSON.stringify({
          model: model.model,
          messages: req.messages,
          temperature: req.temperature,
          max_tokens: Math.min(req.maxTokens ?? model.preset.maxOutputTokens, model.preset.maxOutputTokens),
          stream: false,
        }),
        signal: AbortSignal.timeout(this.o.timeoutMs ?? 120_000),
      });
    } catch (e) {
      const err = new LlmError(`network error calling ${model.preset.id}: ${(e as Error).name}`, null);
      this.emitErr(req, model, started, err.message);
      throw err;
    }
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 300).replace(/\s+/g, " ");
      const err = res.status === 429 && res.headers.get("retry-after")
        ? new RetryAfter(Number(res.headers.get("retry-after")) || 1, `${model.preset.id} rate limited`)
        : new LlmError(`${model.preset.id} returned ${res.status}: ${body}`, res.status);
      this.emitErr(req, model, started, `HTTP ${res.status}`);
      throw err;
    }
    const json = (await res.json()) as {
      choices?: { message?: { content?: string | null; reasoning_content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const text = json.choices?.[0]?.message?.content ?? "";
    if (!text) {
      const err = new LlmError(`${model.preset.id} returned an empty message`, 502);
      this.emitErr(req, model, started, "empty response");
      throw err;
    }
    const inputTokens = json.usage?.prompt_tokens ?? estimateTokens(req.messages.map((m) => m.content).join(""));
    const outputTokens = json.usage?.completion_tokens ?? estimateTokens(text);
    const cost = costUsd(model, inputTokens, outputTokens);
    this.spent += cost;
    const out: ChatResponse = { text, model, inputTokens, outputTokens, latencyMs: Date.now() - started, costUsd: cost };
    this.emit(req, out, true);
    return out;
  }

  private emit(req: ChatRequest, r: ChatResponse, ok: boolean) {
    this.o.onCall?.({ purpose: req.purpose, step: req.step, preset: r.model.preset.id, model: r.model.model,
      inputTokens: r.inputTokens, outputTokens: r.outputTokens, costUsd: r.costUsd, latencyMs: r.latencyMs, ok });
  }
  private emitErr(req: ChatRequest, m: ResolvedModel, started: number, error: string) {
    this.o.onCall?.({ purpose: req.purpose, step: req.step, preset: m.preset.id, model: m.model, inputTokens: 0, outputTokens: 0,
      costUsd: 0, latencyMs: Date.now() - started, ok: false, error: error.slice(0, 500) });
  }
}

class RetryAfter extends LlmError {
  constructor(readonly seconds: number, message: string) { super(message, 429); }
}
