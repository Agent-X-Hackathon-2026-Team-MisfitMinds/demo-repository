// Hidden state markers (00 §4, TRD §3.8). Only Fixie's own code writes them; resume trusts nothing else.
import { z } from "zod";
import { RunStatus, RunStep } from "./enums.ts";

export const StateMarker = z.object({
  v: z.literal(1),
  runId: z.string(),
  status: RunStatus,
  step: RunStep.nullable(),
  askedAt: z.string().nullable(),
  expiresAt: z.string().nullable(),
  missing: z.array(z.string()),
  hubRunUrl: z.string().nullable(),
});
export type StateMarker = z.infer<typeof StateMarker>;

export const PrMarker = z.object({ runId: z.string(), issue: z.number().int().min(1) });
export type PrMarker = z.infer<typeof PrMarker>;

const encode = (json: unknown) => JSON.stringify(json).replace(/--/g, "\\u002d\\u002d").replace(/>/g, "\\u003e");

export const renderStateMarker = (m: StateMarker): string => `<!-- fixie:state ${encode(StateMarker.parse(m))} -->`;
export const renderPrMarker = (m: PrMarker): string => `<!-- fixie:pr ${encode(PrMarker.parse(m))} -->`;

function read<T>(kind: "state" | "pr", schema: z.ZodType<T>, body: string): T | null {
  const re = new RegExp(`<!-- fixie:${kind} (\\{[^\\n]*?\\}) -->`, "g");
  let last: string | undefined;
  for (const m of body.matchAll(re)) last = m[1];
  if (!last) return null;
  try {
    const r = schema.safeParse(JSON.parse(last));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}
export const readStateMarker = (body: string) => read("state", StateMarker, body);
export const readPrMarker = (body: string) => read("pr", PrMarker, body);
