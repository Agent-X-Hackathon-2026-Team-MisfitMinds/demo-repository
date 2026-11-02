// Prompt budgeting (TRD §3.2): tokens ≈ ceil(chars / 3.5); drop lowest-priority sections first; never cut inside code.

export const estimateTokens = (s: string): number => Math.ceil(s.length / 3.5);

export interface Section {
  /** Higher = more important. Required sections are never dropped. */
  priority: number;
  text: string;
  required?: boolean;
  /** Allowed to be truncated (head kept) instead of dropped; never set for code regions. */
  truncatable?: boolean;
  id: string;
}

export interface Budgeted {
  text: string;
  tokens: number;
  dropped: string[];
  truncated: string[];
}

/** Keep sections in their original order; remove (or truncate) lowest-priority ones until the budget fits. */
export function fitSections(sections: Section[], budgetTokens: number, sep = "\n\n"): Budgeted {
  const kept = sections.map((s) => ({ ...s }));
  const dropped: string[] = [];
  const truncated: string[] = [];
  const total = () => estimateTokens(kept.map((s) => s.text).join(sep));
  const order = [...kept].filter((s) => !s.required).sort((a, b) => a.priority - b.priority);
  for (const s of order) {
    if (total() <= budgetTokens) break;
    const idx = kept.findIndex((k) => k.id === s.id);
    const cur = kept[idx];
    if (!cur) continue;
    if (cur.truncatable) {
      const overChars = Math.ceil((total() - budgetTokens) * 3.5) + 32;
      const keep = cur.text.length - overChars;
      if (keep > 200) {
        cur.text = `${cur.text.slice(0, keep)}\n[… truncated]`;
        truncated.push(cur.id);
        continue;
      }
    }
    kept.splice(idx, 1);
    dropped.push(s.id);
  }
  const text = kept.map((s) => s.text).join(sep);
  if (estimateTokens(text) > budgetTokens) throw new BudgetError(`required prompt sections exceed the ${budgetTokens}-token budget`);
  return { text, tokens: estimateTokens(text), dropped, truncated };
}

export class BudgetError extends Error {}

/** Wrap untrusted text (issue, comments, files, test output) as data (TRD §3.2, SEC-09). */
export function untrusted(source: "issue" | "comment" | "file" | "test_output", text: string): string {
  const safe = text.replace(/<\/?untrusted\b[^>]*>/gi, "[tag removed]");
  return `<untrusted source="${source}">\n${safe}\n</untrusted>`;
}
