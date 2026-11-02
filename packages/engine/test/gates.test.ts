import { describe, expect, it } from "vitest";
import { defaultFixieConfig, parseFixieConfig } from "@fixie/shared";
import { allGatesPassed, evaluateGates, parseUnifiedDiff, Redactor, type GateEvidenceInput } from "../src/index.ts";

const REPRO = "tests/test_fixie_issue_7.py";
const okDiff = `diff --git a/src/dates.py b/src/dates.py
--- a/src/dates.py
+++ b/src/dates.py
@@ -10,2 +10,2 @@ def parse(y, m, d):
-    if m == 2 and d > 28:
+    if m == 2 and d > (29 if is_leap(y) else 28):
         raise ValueError("invalid day")
diff --git a/${REPRO} b/${REPRO}
new file mode 100644
--- /dev/null
+++ b/${REPRO}
@@ -0,0 +1,3 @@
+from src.dates import parse
+def test_leap():
+    assert parse(2024, 2, 29)
`;

const base = (over: Partial<GateEvidenceInput> = {}): GateEvidenceInput => ({
  reproTestId: "tests.test_fixie_issue_7::test_leap",
  reproTestPath: REPRO,
  reproBefore: { outcome: "failed", failureKind: "runtime", message: "ValueError: invalid day", signature: "abc" },
  reproAfter: { outcome: "passed", durationMs: 12 },
  baseline: { "t::a": "passed", "t::b": "passed", "t::c": "failed" },
  final: { "t::a": "passed", "t::b": "passed", "t::c": "failed", "tests.test_fixie_issue_7::test_leap": "passed" },
  lint: { tool: null, before: {}, after: {} },
  typecheck: { tool: "mypy", before: { "src/dates.py": 1 }, after: { "src/dates.py": 1 } },
  diff: parseUnifiedDiff(okDiff),
  existedAtBaseline: (p) => p !== REPRO,
  outgoingText: ["Fixes #7"],
  ...over,
});
const run = (e: GateEvidenceInput, cfg = defaultFixieConfig(), secrets: string[] = []) =>
  Object.fromEntries(evaluateGates(e, cfg, new Redactor(secrets)).map((g) => [g.gate, g]));

describe("evaluateGates", () => {
  it("happy path: 9/9", () => {
    const res = evaluateGates(base(), defaultFixieConfig(), new Redactor());
    expect(res.map((r) => [r.gate, r.passed])).toEqual([
      ["repro_fails_before", true], ["repro_passes_after", true], ["no_new_failures", true], ["lint_clean", true],
      ["typecheck_clean", true], ["diff_size", true], ["blocked_paths", true], ["test_integrity", true], ["secret_scan", true],
    ]);
    expect(allGatesPassed(res)).toBe(true);
    expect(res[3]?.evidence).toMatchObject({ notConfigured: true });
  });

  it.each([
    ["collection error is not a real repro", { reproBefore: { outcome: "error", failureKind: "collection", message: "", signature: null } }],
    ["import error is not a real repro", { reproBefore: { outcome: "error", failureKind: "import", message: "", signature: null } }],
    ["repro passing before is not a repro", { reproBefore: { outcome: "passed", failureKind: null, message: "", signature: null } }],
  ] as const)("repro_fails_before: %s", (_n, over) => {
    expect(run(base(over as Partial<GateEvidenceInput>)).repro_fails_before?.passed).toBe(false);
  });

  it("repro still failing after", () => {
    expect(run(base({ reproAfter: { outcome: "failed", durationMs: 1 } })).repro_passes_after?.passed).toBe(false);
    expect(run(base({ reproAfter: null })).repro_passes_after?.passed).toBe(false);
  });

  it("no_new_failures: newly failing and vanished tests fail; already-failing ok", () => {
    const g = run(base({ final: { "t::a": "failed", "t::c": "failed" } })).no_new_failures;
    expect(g?.passed).toBe(false);
    expect(g?.evidence).toMatchObject({ newlyFailing: ["t::a", "t::b"], missingCount: 1 });
    expect(run(base({ final: null })).no_new_failures?.passed).toBe(false);
  });

  it("lint/type: only NEW errors in changed files fail (D-09)", () => {
    const lint = { tool: "ruff", before: { "src/dates.py": 2, "other.py": 0 }, after: { "src/dates.py": 2, "other.py": 9 } };
    expect(run(base({ lint })).lint_clean?.passed).toBe(true); // other.py not changed
    const worse = { tool: "ruff", before: { "src/dates.py": 2 }, after: { "src/dates.py": 3 } };
    expect(run(base({ lint: worse })).lint_clean?.passed).toBe(false);
  });

  it("diff_size excludes the repro test and respects limits", () => {
    const g = run(base()).diff_size;
    expect(g?.evidence).toMatchObject({ files: 1, lines: 2 });
    const tight = parseFixieConfig({ version: 1, limits: { max_changed_lines: 1 } });
    expect(tight.ok && run(base(), tight.config).diff_size?.passed).toBe(false);
  });

  it("diff_size fails on an empty change", () => {
    const onlyRepro = parseUnifiedDiff(okDiff.split("diff --git").slice(2).map((s) => `diff --git${s}`).join(""));
    expect(run(base({ diff: onlyRepro })).diff_size?.passed).toBe(false);
  });

  it("blocked_paths: .github/** always blocked, plus configured globs, renames both sides", () => {
    const wf = parseUnifiedDiff(`diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1 +1 @@
-on: push
+on: pull_request
`);
    expect(run(base({ diff: [...base().diff, ...wf] })).blocked_paths?.passed).toBe(false);
    const rename = parseUnifiedDiff(`diff --git a/migrations/1.sql b/src/1.sql
similarity index 100%
rename from migrations/1.sql
rename to src/1.sql
`);
    const cfg = parseFixieConfig({ version: 1, paths: { blocked: ["migrations/**"] } });
    expect(cfg.ok && run(base({ diff: [...base().diff, ...rename] }), cfg.config).blocked_paths?.passed).toBe(false);
  });

  it("test_integrity: editing an existing test or adding skip/only fails", () => {
    const edit = parseUnifiedDiff(`diff --git a/tests/test_dates.py b/tests/test_dates.py
--- a/tests/test_dates.py
+++ b/tests/test_dates.py
@@ -3,1 +3,1 @@
-    assert parse(2023, 2, 29) is None
+    assert True
`);
    expect(run(base({ diff: [...base().diff, ...edit] })).test_integrity?.passed).toBe(false);
    const addOnly = parseUnifiedDiff(`diff --git a/tests/test_dates.py b/tests/test_dates.py
--- a/tests/test_dates.py
+++ b/tests/test_dates.py
@@ -3,0 +4,2 @@
+def test_extra():
+    assert parse(2024, 1, 1)
`);
    expect(run(base({ diff: [...base().diff, ...addOnly] })).test_integrity?.passed).toBe(true);
    const skip = parseUnifiedDiff(`diff --git a/src/a.test.ts b/src/a.test.ts
new file mode 100644
--- /dev/null
+++ b/src/a.test.ts
@@ -0,0 +1 @@
+it.skip("x", () => {});
`);
    const g = run(base({ diff: [...base().diff, ...skip], existedAtBaseline: (p) => p === "src/dates.py" })).test_integrity;
    expect(g?.passed).toBe(false);
    expect(g?.evidence).toMatchObject({ findings: [{ file: "src/a.test.ts", rule: "js.skip" }] });
  });

  it("secret_scan: tokens in diff or PR text fail; values never in evidence", () => {
    const tok = "ghp_" + "A".repeat(36);
    const leak = parseUnifiedDiff(`diff --git a/src/c.py b/src/c.py
--- a/src/c.py
+++ b/src/c.py
@@ -1 +1 @@
-x = 1
+TOKEN = "${tok}"
`);
    const g = run(base({ diff: [...base().diff, ...leak] })).secret_scan;
    expect(g?.passed).toBe(false);
    expect(JSON.stringify(g?.evidence)).not.toContain(tok);
    const rt = "super-secret-runtime-value";
    expect(run(base({ outgoingText: [`body ${rt}`] }), defaultFixieConfig(), [rt]).secret_scan?.evidence).toEqual({ rules: ["runtime-secret"] });
  });

  it("allGatesPassed needs all nine", () => {
    const res = evaluateGates(base(), defaultFixieConfig(), new Redactor());
    expect(allGatesPassed(res.slice(0, 8))).toBe(false);
    expect(allGatesPassed(res.map((r, i) => (i === 4 ? { ...r, passed: false } : r)))).toBe(false);
  });
});
