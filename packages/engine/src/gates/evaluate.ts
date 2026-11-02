// The nine gates (TRD §3.6). Pure function of evidence + config; the model never decides a gate (D-08).
import { blockedGlobs, GATE_KINDS, type FixieConfig, type GateKind, type TestOutcome } from "@fixie/shared";
import { type DiffFile, diffStats, touchedPaths } from "../diff.ts";
import { isTestFile, matchesAny } from "../paths.ts";
import type { Redactor } from "../secrets.ts";

export type FailureKind = "assertion" | "runtime" | "collection" | "import" | "syntax" | "timeout";

export interface ToolCounts {
  /** e.g. "ruff", "eslint", "mypy", "tsc"; null when no tool is configured/detected (D-09). */
  tool: string | null;
  /** Error counts per repo-relative file. */
  before: Record<string, number>;
  after: Record<string, number>;
}

export interface GateEvidenceInput {
  reproTestId: string;
  reproTestPath: string;
  reproBefore: { outcome: TestOutcome; failureKind: FailureKind | null; message: string; signature: string | null };
  reproAfter: { outcome: TestOutcome; durationMs: number | null } | null;
  /** testId → outcome. Must not include the repro test. */
  baseline: Record<string, TestOutcome>;
  final: Record<string, TestOutcome> | null;
  lint: ToolCounts;
  typecheck: ToolCounts;
  /** Parsed diff of the attempt vs c0, repro test file included. */
  diff: DiffFile[];
  /** Paths that existed at c0 (needed to tell pre-existing test files from new ones). */
  existedAtBaseline: (path: string) => boolean;
  /** Outgoing text that will leave the host with the PR: PR body, comments. */
  outgoingText: string[];
}

export interface GateResult {
  gate: GateKind;
  passed: boolean;
  evidence: Record<string, unknown>;
}

const isFail = (o: TestOutcome) => o === "failed" || o === "error";

function reproFailsBefore(e: GateEvidenceInput): GateResult {
  const real = e.reproBefore.failureKind === "assertion" || e.reproBefore.failureKind === "runtime";
  return {
    gate: "repro_fails_before",
    passed: isFail(e.reproBefore.outcome) && real,
    evidence: {
      testId: e.reproTestId,
      outcome: e.reproBefore.outcome,
      failureKind: e.reproBefore.failureKind,
      message: e.reproBefore.message.slice(0, 1000),
      signature: e.reproBefore.signature,
    },
  };
}

function reproPassesAfter(e: GateEvidenceInput): GateResult {
  return {
    gate: "repro_passes_after",
    passed: e.reproAfter?.outcome === "passed",
    evidence: { testId: e.reproTestId, outcome: e.reproAfter?.outcome ?? null, durationMs: e.reproAfter?.durationMs ?? null },
  };
}

function noNewFailures(e: GateEvidenceInput): GateResult {
  if (!e.final) return { gate: "no_new_failures", passed: false, evidence: { reason: "final suite did not run" } };
  const newly: string[] = [];
  let missing = 0;
  for (const [id, before] of Object.entries(e.baseline)) {
    if (before !== "passed") continue;
    const after = e.final[id];
    if (after === undefined) missing++; // a passing test vanished: treat as a failure (deleted or uncollectable)
    if (after === undefined || isFail(after)) newly.push(id);
  }
  const finals = Object.entries(e.final).filter(([id]) => id !== e.reproTestId);
  return {
    gate: "no_new_failures",
    passed: newly.length === 0,
    evidence: {
      baselinePassed: Object.values(e.baseline).filter((o) => o === "passed").length,
      baselineFailed: Object.values(e.baseline).filter(isFail).length,
      finalPassed: finals.filter(([, o]) => o === "passed").length,
      finalFailed: finals.filter(([, o]) => isFail(o)).length,
      newlyFailing: newly.slice(0, 50),
      newlyFailingCount: newly.length,
      missingCount: missing,
    },
  };
}

/** D-09: pass with notConfigured when no tool; fail only on NEW errors in changed files. */
function toolGate(gate: "lint_clean" | "typecheck_clean", t: ToolCounts, changed: string[]): GateResult {
  if (!t.tool) return { gate, passed: true, evidence: { tool: null, notConfigured: true } };
  let before = 0;
  let after = 0;
  const files: Record<string, { before: number; after: number }> = {};
  for (const f of changed) {
    const b = t.before[f] ?? 0;
    const a = t.after[f] ?? 0;
    before += b;
    after += a;
    if (a > b) files[f] = { before: b, after: a };
  }
  return { gate, passed: Object.keys(files).length === 0, evidence: { tool: t.tool, before, after, notConfigured: false, newErrors: files } };
}

function diffSize(e: GateEvidenceInput, cfg: FixieConfig): GateResult {
  const s = diffStats(e.diff, [e.reproTestPath]);
  const lines = s.added + s.removed;
  const { max_changed_files: maxFiles, max_changed_lines: maxLines } = cfg.limits;
  return {
    gate: "diff_size",
    passed: s.files >= 1 && s.files <= maxFiles && lines <= maxLines,
    evidence: { files: s.files, lines, added: s.added, removed: s.removed, limits: { files: maxFiles, lines: maxLines } },
  };
}

function blockedPaths(e: GateEvidenceInput, cfg: FixieConfig): GateResult {
  const globs = blockedGlobs(cfg);
  const offending = touchedPaths(e.diff).filter((p) => matchesAny(p, globs));
  return { gate: "blocked_paths", passed: offending.length === 0, evidence: { offending, globs } };
}

// Added lines that weaken tests. Kept deliberately broad; false positives only cost a retry.
const WEAKENING: { id: string; re: RegExp }[] = [
  { id: "pytest.skip", re: /\bpytest\.(?:mark\.)?skip(?:if)?\b/ },
  { id: "pytest.xfail", re: /\bpytest\.(?:mark\.)?xfail\b/ },
  { id: "unittest.skip", re: /\bunittest\.(?:skip|skipIf|skipUnless|expectedFailure)\b|@skip\b/ },
  { id: "js.only", re: /\b(?:it|test|describe|context)\.only\s*\(|\bf(?:it|describe)\s*\(/ },
  { id: "js.skip", re: /\b(?:it|test|describe|context|suite)\.skip(?:If)?\s*\(|\bx(?:it|test|describe)\s*\(/ },
  { id: "js.todo", re: /\b(?:it|test|describe)\.todo\s*\(/ },
  { id: "timeout", re: /\b(?:jest\.setTimeout|this\.timeout|testTimeout|hookTimeout)\b|@pytest\.mark\.timeout\b|\btimeout\s*:\s*\d/ },
];

function testIntegrity(e: GateEvidenceInput): GateResult {
  const findings: { file: string; line: number; rule: string }[] = [];
  const editedTests: string[] = [];
  for (const f of e.diff) {
    const preExisting = f.status !== "added" && (f.oldPath ? e.existedAtBaseline(f.oldPath) : e.existedAtBaseline(f.path));
    if (preExisting && (isTestFile(f.path) || (f.oldPath !== null && isTestFile(f.oldPath)))) {
      if (f.removed.length > 0 || f.status === "deleted" || f.status === "renamed") editedTests.push(f.path);
    }
    for (const a of f.added) {
      for (const w of WEAKENING) if (w.re.test(a.text)) findings.push({ file: f.path, line: a.line, rule: w.id });
    }
  }
  return {
    gate: "test_integrity",
    passed: editedTests.length === 0 && findings.length === 0,
    evidence: { editedTestFiles: editedTests, findings: findings.slice(0, 50) },
  };
}

function secretScan(e: GateEvidenceInput, redactor: Redactor): GateResult {
  const diffText = e.diff.flatMap((f) => f.added.map((a) => a.text)).join("\n");
  const rules = new Set<string>(redactor.scan(diffText));
  for (const t of e.outgoingText) for (const r of redactor.scan(t)) rules.add(r);
  return { gate: "secret_scan", passed: rules.size === 0, evidence: { rules: [...rules].sort() } };
}

export function evaluateGates(e: GateEvidenceInput, cfg: FixieConfig, redactor: Redactor): GateResult[] {
  const changed = touchedPaths(e.diff).filter((p) => p !== e.reproTestPath);
  const results: GateResult[] = [
    reproFailsBefore(e),
    reproPassesAfter(e),
    noNewFailures(e),
    toolGate("lint_clean", e.lint, changed),
    toolGate("typecheck_clean", e.typecheck, changed),
    diffSize(e, cfg),
    blockedPaths(e, cfg),
    testIntegrity(e),
    secretScan(e, redactor),
  ];
  // Invariant: exactly the nine canonical gates, in canonical order.
  if (results.map((r) => r.gate).join() !== GATE_KINDS.join()) throw new Error("gate set mismatch");
  return results;
}

export const allGatesPassed = (results: readonly GateResult[]): boolean =>
  results.length === GATE_KINDS.length &&
  GATE_KINDS.every((g) => results.some((r) => r.gate === g && r.passed));
