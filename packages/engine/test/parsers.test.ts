import { describe, expect, it } from "vitest";
import type { EditProtocolError} from "../src/index.ts";
import {
  applyEditBlocks, confidence, errorSignature, extractSignatureParts, isSafeRelativePath,
  outcomesById, parseEditBlocks, parseJUnit, Redactor,
} from "../src/index.ts";

const PYTEST = `<?xml version="1.0" encoding="utf-8"?><testsuites><testsuite name="pytest" tests="4">
<testcase classname="tests.test_dates" name="test_ok" time="0.010"/>
<testcase classname="tests.test_dates" name="test_leap" time="0.002"><failure message="ValueError: invalid day">Traceback (most recent call last):
  File "/work/src/dates.py", line 11, in parse
    raise ValueError("invalid day")
E   ValueError: invalid day</failure></testcase>
<testcase classname="tests.test_x" name="test_skip" time="0"><skipped message="nope"/></testcase>
<testcase classname="" name="tests/test_broken.py" time="0"><error message="collection failure">ModuleNotFoundError: No module named 'foo'</error></testcase>
</testsuite></testsuites>`;

const VITEST = `<?xml version="1.0" encoding="UTF-8" ?>
<testsuites name="vitest tests" tests="2"><testsuite name="src/sum.test.ts" tests="2">
<testcase classname="src/sum.test.ts" name="sum &gt; adds" time="0.001"></testcase>
<testcase classname="src/sum.test.ts" name="sum &gt; negatives" time="0.003"><failure message="expected 3 to be -1 // Object.is equality" type="AssertionError">AssertionError: expected 3 to be -1
 ❯ src/sum.test.ts:9:22</failure></testcase></testsuite></testsuites>`;

describe("parseJUnit", () => {
  it("pytest", () => {
    const c = parseJUnit(PYTEST);
    expect(outcomesById(c)).toEqual({
      "tests.test_dates::test_ok": "passed", "tests.test_dates::test_leap": "failed",
      "tests.test_x::test_skip": "skipped", "tests/test_broken.py": "error",
    });
    expect(c[1]).toMatchObject({ failureKind: "runtime", failureMessage: "ValueError: invalid day", durationMs: 2 });
    expect(c[3]?.failureKind).toBe("import");
  });
  it("vitest, entities decoded, assertion kind", () => {
    const c = parseJUnit(VITEST);
    expect(c.map((x) => x.testId)).toEqual(["src/sum.test.ts::sum > adds", "src/sum.test.ts::sum > negatives"]);
    expect(c[1]?.failureKind).toBe("assertion");
  });
});

describe("error signature", () => {
  it("stable across numbers/addresses, differs across exceptions", () => {
    const inRepo = (f: string) => f.startsWith("/work/src");
    const a = extractSignatureParts(`File "/work/src/dates.py", line 11, in parse\nE   ValueError: day 30 invalid at 0xdeadbeef`, inRepo);
    const b = extractSignatureParts(`File "/work/src/dates.py", line 12, in parse\nE   ValueError: day 31 invalid at 0xcafe`, inRepo);
    const c = extractSignatureParts(`File "/work/src/dates.py", line 11, in parse\nE   KeyError: day`, inRepo);
    expect(a.deepestFrame).toBe("/work/src/dates.py:parse");
    expect(errorSignature(a)).toBe(errorSignature(b));
    expect(errorSignature(a)).not.toBe(errorSignature(c));
  });
});

describe("SEARCH/REPLACE", () => {
  const files: Record<string, string> = {
    "src/dates.py": "def parse(y, m, d):\n    if m == 2 and d > 28:\n        raise ValueError(\"invalid day\")\n    return (y, m, d)\n",
  };
  const fs = { read: (p: string) => files[p] ?? null };
  const policy = { blockedGlobs: [".github/**", ".fixie.yml", ".fixie/**"] };

  it("exact apply", () => {
    const blocks = parseEditBlocks("src/dates.py\n<<<<<<< SEARCH\n    if m == 2 and d > 28:\n=======\n    if m == 2 and d > (29 if leap(y) else 28):\n>>>>>>> REPLACE\n");
    expect(applyEditBlocks(blocks, fs, policy).get("src/dates.py")).toContain("29 if leap(y)");
  });
  it("whitespace-normalised apply re-indents", () => {
    const blocks = parseEditBlocks("```\nsrc/dates.py\n<<<<<<< SEARCH\nif m == 2 and d > 28:\n    raise ValueError(\"invalid day\")\n=======\nif m == 2 and d > 29:\n    raise ValueError(\"invalid day\")\n>>>>>>> REPLACE\n```");
    const out = applyEditBlocks(blocks, fs, policy).get("src/dates.py") ?? "";
    expect(out).toContain("    if m == 2 and d > 29:\n        raise");
  });
  it("rejects blocked, traversal, missing, ambiguous, empty", () => {
    const mk = (p: string, s = "x") => parseEditBlocks(`${p}\n<<<<<<< SEARCH\n${s}\n=======\ny\n>>>>>>> REPLACE`);
    const code = (f: () => unknown) => { try { f(); } catch (e) { return (e as EditProtocolError).code; } return "ok"; };
    expect(code(() => applyEditBlocks(mk(".github/workflows/x.yml"), fs, policy))).toBe("blocked");
    expect(code(() => applyEditBlocks(mk("../etc/passwd"), fs, policy))).toBe("path");
    expect(code(() => applyEditBlocks(mk("src/nope.py"), fs, policy))).toBe("missing_file");
    expect(code(() => applyEditBlocks(mk("src/dates.py", "    "), { read: () => "a\n    \n    \n" }, policy))).not.toBe("ok");
    expect(code(() => applyEditBlocks(mk("src/dates.py", "nothing here"), fs, policy))).toBe("no_match");
    expect(code(() => parseEditBlocks("just prose"))).toBe("no_blocks");
  });
  it("safe paths", () => {
    expect(isSafeRelativePath("src/a.py")).toBe(true);
    for (const p of ["/etc/x", "a/../b", "./a", ".git/config", "a\\b", "C:/x", ""]) expect(isSafeRelativePath(p)).toBe(false);
  });
});

describe("redaction", () => {
  it("redacts runtime values and known token formats", () => {
    const r = new Redactor(["s3cr3t-value-123", "short"]);
    const { text, count } = r.redact(`token=s3cr3t-value-123 gh=ghp_${"b".repeat(36)} short`);
    expect(text).toBe("token=*** gh=*** short");
    expect(count).toBe(2);
  });
});

describe("confidence", () => {
  it("max case is high; levels", () => {
    const hi = confidence({ reproMatchedSpec: true, changedLineInTopRegions: true, bisect: "touched_changed_file", diffLines: 4,
      winningAttempt: 1, stress: "stable", existingTestModified: false });
    expect(hi).toMatchObject({ score: 100, level: "high" });
    const lo = confidence({ reproMatchedSpec: false, changedLineInTopRegions: false, bisect: "other", diffLines: 250,
      winningAttempt: 5, stress: "unstable", existingTestModified: true });
    expect(lo).toMatchObject({ score: 25, level: "low" });
  });
});
