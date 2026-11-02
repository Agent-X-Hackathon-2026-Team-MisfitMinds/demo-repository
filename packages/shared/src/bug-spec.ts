// BugSpec (D-22) and the readiness rule.
import { z } from "zod";

export const BugSpec = z.object({
  title: z.string().max(300),
  expected: z.string().max(2000).nullable(),
  actual: z.string().max(2000).nullable(),
  repro_steps: z.string().max(4000).nullable(),
  environment: z.string().max(1000).nullable(),
  version: z.string().max(200).nullable(),
  last_good: z.string().max(200).nullable(),
  stack_traces: z.array(z.string().max(8000)).max(5),
  suspected_files: z.array(z.string().max(500)).max(20),
  error_messages: z.array(z.string().max(1000)).max(10),
});
export type BugSpec = z.infer<typeof BugSpec>;

export type MissingField = "actual" | "repro_steps" | "expected";

/**
 * Ask for clarification only if `actual` is missing, or both `repro_steps` and `expected` are missing (D-22).
 * A stack trace or error message counts as `actual`.
 */
export function missingBugSpecFields(spec: BugSpec): MissingField[] {
  const blank = (s: string | null) => s === null || s.trim() === "";
  const missing: MissingField[] = [];
  const hasActual = !blank(spec.actual) || spec.stack_traces.length > 0 || spec.error_messages.length > 0;
  if (!hasActual) missing.push("actual");
  if (blank(spec.repro_steps) && blank(spec.expected)) missing.push("repro_steps", "expected");
  return missing;
}
