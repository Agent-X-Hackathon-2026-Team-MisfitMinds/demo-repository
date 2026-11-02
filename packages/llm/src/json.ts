// Strict JSON output protocol with one repair retry (TRD §3.2).
import type { z } from "zod";
import type { ChatMessage, ChatRequest, LlmClient } from "./client.ts";

/** Pull the first JSON object/array out of model text (fenced or bare). */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?\s*\n([\s\S]*?)\n```/.exec(text)?.[1];
  const candidates = [fenced, text].filter((x): x is string => !!x);
  for (const c of candidates) {
    const t = c.trim();
    try { return JSON.parse(t); } catch { /* fall through */ }
    for (const [open, close] of [["{", "}"], ["[", "]"]] as const) {
      const s = t.indexOf(open);
      const e = t.lastIndexOf(close);
      if (s !== -1 && e > s) {
        try { return JSON.parse(t.slice(s, e + 1)); } catch { /* next */ }
      }
    }
  }
  throw new SyntaxError("no JSON found in model output");
}

export async function chatJson<T>(
  client: LlmClient,
  req: ChatRequest,
  schema: z.ZodType<T>,
): Promise<{ value: T; repaired: boolean } | { value: null; error: string }> {
  const first = await client.chat(req);
  const tryParse = (text: string): { ok: true; v: T } | { ok: false; err: string } => {
    try {
      const r = schema.safeParse(extractJson(text));
      return r.success ? { ok: true, v: r.data } : { ok: false, err: r.error.issues.slice(0, 5).map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ") };
    } catch (e) {
      return { ok: false, err: (e as Error).message };
    }
  };
  const a = tryParse(first.text);
  if (a.ok) return { value: a.v, repaired: false };
  const repair: ChatMessage[] = [
    ...req.messages,
    { role: "assistant", content: first.text.slice(0, 8000) },
    { role: "user", content: `That output was invalid: ${a.err}. Reply again with only the corrected JSON, nothing else.` },
  ];
  const second = await client.chat({ ...req, messages: repair, temperature: 0 });
  const b = tryParse(second.text);
  return b.ok ? { value: b.v, repaired: true } : { value: null, error: b.err };
}
