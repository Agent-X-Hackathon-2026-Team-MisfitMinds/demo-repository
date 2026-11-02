// Error signature (TRD §3.5): sha1(normalise(exceptionType + first assertion line + deepest in-repo frame)).
import { createHash } from "node:crypto";

export function normaliseForSignature(s: string): string {
  return s
    .replace(/0x[0-9a-fA-F]+/g, "0x?")
    .replace(/\/(?:tmp|var\/folders|private\/var)\/[^\s:'"]*/g, "/tmp/?")
    .replace(/\b\d+(?:\.\d+)?\b/g, "N")
    .replace(/\s+/g, " ")
    .trim();
}

export interface SignatureParts {
  exceptionType: string;
  firstAssertionLine: string;
  deepestFrame: string; // "file:function"
}

export function extractSignatureParts(failureText: string, isInRepo: (file: string) => boolean): SignatureParts {
  const lines = failureText.split("\n");
  const exc =
    /\b([A-Z][A-Za-z0-9_]*(?:Error|Exception|Failure|Warning))\b/.exec(failureText)?.[1] ??
    (/\bexpected\b/i.test(failureText) ? "AssertionError" : "UnknownError");
  const assertLine =
    lines.find((l) => /^\s*E\s+/.test(l))?.replace(/^\s*E\s+/, "") ??
    lines.find((l) => /assert|expect/i.test(l))?.trim() ??
    lines.find((l) => l.trim())?.trim() ?? "";
  let deepest = "";
  // Python: File "path", line N, in func   |   Node: at func (path:line:col)  /  at path:line:col
  for (const l of lines) {
    const py = /File "([^"]+)", line \d+, in (\S+)/.exec(l);
    const js = /at (?:(\S+) \()?([^\s()]+):\d+:\d+\)?/.exec(l);
    const file = py?.[1] ?? js?.[2];
    const fn = py?.[2] ?? js?.[1] ?? "<anonymous>";
    if (file && isInRepo(file)) {
      if (py) deepest = `${file}:${fn}`; // Python: last in-repo frame is deepest
      else if (!deepest) deepest = `${file}:${fn}`; // Node: first in-repo frame is deepest
    }
  }
  return { exceptionType: exc, firstAssertionLine: assertLine.slice(0, 300), deepestFrame: deepest };
}

export function errorSignature(parts: SignatureParts): string {
  const n = normaliseForSignature(`${parts.exceptionType}|${parts.firstAssertionLine}|${parts.deepestFrame}`);
  return createHash("sha1").update(n).digest("hex").slice(0, 16);
}
