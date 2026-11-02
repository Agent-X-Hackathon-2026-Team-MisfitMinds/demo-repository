// JUnit XML → per-test outcomes (pytest --junitxml, vitest --reporter=junit, jest-junit).
import { XMLParser } from "fast-xml-parser";
import type { TestOutcome } from "@fixie/shared";
import type { FailureKind } from "../gates/evaluate.ts";

export interface JUnitCase {
  testId: string;
  file: string | null;
  outcome: TestOutcome;
  durationMs: number | null;
  failureMessage: string | null;
  failureText: string | null;
  failureKind: FailureKind | null;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  textNodeName: "#text",
  isArray: (name) => ["testsuite", "testcase", "failure", "error", "skipped"].includes(name),
  processEntities: true,
  htmlEntities: true,
});

const arr = <T>(v: T | T[] | undefined): T[] => (v === undefined ? [] : Array.isArray(v) ? v : [v]);
const text = (n: unknown): string => {
  if (n == null) return "";
  if (typeof n === "string") return n;
  if (typeof n === "object" && "#text" in (n as Record<string, unknown>)) return String((n as Record<string, unknown>)["#text"]);
  return "";
};
const attr = (n: unknown, k: string): string | undefined =>
  n && typeof n === "object" ? ((n as Record<string, unknown>)[k] as string | undefined) : undefined;

export function classifyFailure(message: string, body: string, isError: boolean): FailureKind {
  const s = `${message}\n${body}`;
  if (/\b(?:SyntaxError|IndentationError|TabError)\b/.test(s)) return "syntax";
  if (/\b(?:ModuleNotFoundError|ImportError|Cannot find module|Failed to (?:load|resolve) (?:url|import))\b/.test(s)) return "import";
  if (/collection failure|errors? during collection|failed to collect|No test suite found/i.test(s)) return "collection";
  if (/\b(?:timed? ?out|TimeoutError|Exceeded timeout)\b/i.test(s)) return "timeout";
  if (/\bAssertionError\b|\bexpect(?:ed)?\b.*\b(?:to|but)\b|\bassert\b/.test(s) && !isError) return "assertion";
  if (/\bAssertionError\b/.test(s)) return "assertion";
  return "runtime";
}

export function parseJUnit(xml: string): JUnitCase[] {
  const doc = parser.parse(xml) as Record<string, unknown>;
  const roots = doc.testsuites ? arr((doc.testsuites as Record<string, unknown>).testsuite) : arr(doc.testsuite as unknown);
  const out: JUnitCase[] = [];
  const walk = (suite: unknown) => {
    for (const child of arr((suite as Record<string, unknown>)?.testsuite)) walk(child);
    for (const tc of arr((suite as Record<string, unknown>)?.testcase)) {
      const classname = attr(tc, "classname") ?? attr(suite, "name") ?? "";
      const name = attr(tc, "name") ?? "";
      const file = attr(tc, "file") ?? null;
      const t = Number(attr(tc, "time"));
      const failures = arr((tc as Record<string, unknown>).failure);
      const errors = arr((tc as Record<string, unknown>).error);
      const skipped = arr((tc as Record<string, unknown>).skipped);
      const bad = failures[0] ?? errors[0];
      const outcome: TestOutcome = failures.length ? "failed" : errors.length ? "error" : skipped.length ? "skipped" : "passed";
      const msg = bad ? attr(bad, "message") ?? "" : "";
      const body = bad ? text(bad) : "";
      out.push({
        testId: classname ? `${classname}::${name}` : name,
        file,
        outcome,
        durationMs: Number.isFinite(t) ? Math.round(t * 1000) : null,
        failureMessage: bad ? (msg || body.split("\n")[0] || "").slice(0, 4000) : null,
        failureText: bad ? body.slice(0, 20000) : null,
        failureKind: bad ? classifyFailure(msg, body, !failures.length) : null,
      });
    }
  };
  for (const r of roots) walk(r);
  return out;
}

export const outcomesById = (cases: JUnitCase[]): Record<string, TestOutcome> =>
  Object.fromEntries(cases.map((c) => [c.testId, c.outcome]));
