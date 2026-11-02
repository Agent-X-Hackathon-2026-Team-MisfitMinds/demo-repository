// SEARCH/REPLACE protocol for LLM T4 (TRD §3.2). Parse strictly; apply exactly-once; enforce path policy.
import { isSafeRelativePath, matchesAny } from "./paths.ts";

export interface EditBlock {
  path: string;
  search: string;
  replace: string;
}

export class EditProtocolError extends Error {
  constructor(message: string, readonly code: "parse" | "path" | "no_match" | "ambiguous" | "blocked" | "missing_file" | "no_blocks") {
    super(message);
    this.name = "EditProtocolError";
  }
}

const SEARCH = /^<{5,9} SEARCH\s*$/;
const DIVIDER = /^={5,9}\s*$/;
const REPLACE = /^>{5,9} REPLACE\s*$/;

export function parseEditBlocks(text: string): EditBlock[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: EditBlock[] = [];
  let i = 0;
  while (i < lines.length) {
    if (!SEARCH.test(lines[i] ?? "")) { i++; continue; }
    // path = nearest previous non-empty, non-fence line
    let j = i - 1;
    while (j >= 0 && (/^\s*$/.test(lines[j] ?? "") || /^\s*```/.test(lines[j] ?? ""))) j--;
    const path = (lines[j] ?? "").trim().replace(/^`+|`+$/g, "").replace(/^(?:a|b)\//, "");
    if (j < 0 || !path) throw new EditProtocolError(`SEARCH block at line ${i + 1} has no file path`, "parse");
    const search: string[] = [];
    const replace: string[] = [];
    i++;
    while (i < lines.length && !DIVIDER.test(lines[i] ?? "")) search.push(lines[i++] ?? "");
    if (i >= lines.length) throw new EditProtocolError("unterminated SEARCH block (missing =======)", "parse");
    i++;
    while (i < lines.length && !REPLACE.test(lines[i] ?? "")) replace.push(lines[i++] ?? "");
    if (i >= lines.length) throw new EditProtocolError("unterminated block (missing >>>>>>> REPLACE)", "parse");
    i++;
    blocks.push({ path, search: search.join("\n"), replace: replace.join("\n") });
  }
  if (blocks.length === 0) throw new EditProtocolError("no SEARCH/REPLACE blocks found", "no_blocks");
  return blocks;
}

const countOccurrences = (hay: string, needle: string): number[] => {
  const at: number[] = [];
  if (!needle) return at;
  for (let k = hay.indexOf(needle); k !== -1; k = hay.indexOf(needle, k + 1)) at.push(k);
  return at;
};

/** Whitespace-normalised line match: compare trimmed lines; returns [startLine, endLine) matches. */
function fuzzyLineMatches(content: string, search: string): [number, number][] {
  const hay = content.split("\n");
  const needle = search.split("\n").map((l) => l.trim());
  while (needle.length && needle[needle.length - 1] === "") needle.pop();
  while (needle.length && needle[0] === "") needle.shift();
  if (!needle.length) return [];
  const out: [number, number][] = [];
  for (let s = 0; s + needle.length <= hay.length; s++) {
    let ok = true;
    for (let k = 0; k < needle.length; k++) if ((hay[s + k] ?? "").trim() !== needle[k]) { ok = false; break; }
    if (ok) out.push([s, s + needle.length]);
  }
  return out;
}

/** Re-indent replacement by the indentation delta between the matched text and the SEARCH text. */
function reindent(replace: string, searchFirst: string, matchedFirst: string): string {
  const ind = (s: string) => /^\s*/.exec(s)?.[0] ?? "";
  const from = ind(searchFirst);
  const to = ind(matchedFirst);
  if (from === to) return replace;
  return replace
    .split("\n")
    .map((l) => (l.startsWith(from) ? to + l.slice(from.length) : l))
    .join("\n");
}

export function applyEditBlock(content: string, b: EditBlock): { content: string; mode: "exact" | "normalised" } {
  const exact = countOccurrences(content, b.search);
  if (exact.length === 1) {
    const k = exact[0] as number;
    return { content: content.slice(0, k) + b.replace + content.slice(k + b.search.length), mode: "exact" };
  }
  if (exact.length > 1) throw new EditProtocolError(`SEARCH text matches ${exact.length} times in ${b.path}`, "ambiguous");
  const fuzzy = fuzzyLineMatches(content, b.search);
  if (fuzzy.length === 1) {
    const [s, e] = fuzzy[0] as [number, number];
    const lines = content.split("\n");
    const firstSearch = b.search.split("\n").find((l) => l.trim() !== "") ?? "";
    const repl = reindent(b.replace, firstSearch, lines[s] ?? "");
    return { content: [...lines.slice(0, s), ...(repl === "" ? [] : repl.split("\n")), ...lines.slice(e)].join("\n"), mode: "normalised" };
  }
  if (fuzzy.length > 1) throw new EditProtocolError(`SEARCH text matches ${fuzzy.length} times in ${b.path}`, "ambiguous");
  throw new EditProtocolError(`SEARCH text not found in ${b.path}`, "no_match");
}

export interface FileAccess {
  read(path: string): string | null; // null = file does not exist
}

export interface EditPolicy {
  blockedGlobs: readonly string[];
  /** Files the hypothesis allowed; empty = any non-blocked file. */
  allowedFiles?: readonly string[];
}

/** Apply all blocks atomically in memory; returns new contents per path. Throws on the first violation. */
export function applyEditBlocks(blocks: EditBlock[], fs: FileAccess, policy: EditPolicy): Map<string, string> {
  const next = new Map<string, string>();
  for (const b of blocks) {
    if (!isSafeRelativePath(b.path)) throw new EditProtocolError(`unsafe path: ${b.path}`, "path");
    if (matchesAny(b.path, policy.blockedGlobs)) throw new EditProtocolError(`blocked path: ${b.path}`, "blocked");
    if (policy.allowedFiles?.length && !policy.allowedFiles.includes(b.path))
      throw new EditProtocolError(`path not in hypothesis files: ${b.path}`, "path");
    const current = next.get(b.path) ?? fs.read(b.path);
    if (current === null) {
      if (b.search.trim() !== "") throw new EditProtocolError(`file does not exist: ${b.path}`, "missing_file");
      next.set(b.path, b.replace.endsWith("\n") ? b.replace : `${b.replace}\n`);
      continue;
    }
    next.set(b.path, applyEditBlock(current, b).content);
  }
  return next;
}
