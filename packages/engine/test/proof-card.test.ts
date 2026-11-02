import { describe, expect, it } from "vitest";
import { GATE_KINDS, ProofCard } from "@fixie/shared";
import { renderProofCardTable } from "../src/index.ts";

const card = ProofCard.parse({
  repro: { testId: "tests.test_fixie_issue_7::test_leap", beforeMessage: "ValueError", beforeOutcome: "failed", afterOutcome: "passed" },
  suite: { baselinePassed: 40, baselineFailed: 0, finalPassed: 41, finalFailed: 0, newlyFailing: 0 },
  bisect: { status: "found", goodSha: "a".repeat(40), firstBadSha: "b".repeat(40), steps: 4, skipped: 0,
    commit: { message: "Tighten | date checks\n\nbody", author: "octocat", date: "2026-10-01", files: ["src/dates.py"] } },
  blastRadius: null,
  hypotheses: [{ ordinal: 1, summary: "leap year", status: "accepted", reason: null }],
  attempts: { total: 3, reverted: 1 },
  confidence: { score: 85, level: "high", reasons: ["repro fails with the error named in the issue", "small diff (2 lines)", "x"] },
  sandbox: { image: "python:3.12-bookworm", networkLockedAt: "2026-11-02T00:00:00Z", egressProbe: "blocked" },
  model: { preset: "github-models", name: "openai/gpt-4.1-mini", calls: 7, costUsd: 0 },
  gates: GATE_KINDS.map((gate) => ({ gate, passed: true })),
});

describe("renderProofCardTable", () => {
  it("matches GH-05 rows", () => {
    const md = renderProofCardTable(card, { commitUrl: (s) => `https://github.com/o/r/commit/${s}`, lintConfigured: false, typecheckConfigured: true });
    expect(md).toContain("| Reproduction | `tests.test_fixie_issue_7::test_leap` (new) **failed** before the fix → **passed** after |");
    expect(md).toContain("40 passed, 0 failing → 41 passed, 0 failing · **0 newly failing**");
    expect(md).toContain("[`bbbbbbb`](https://github.com/o/r/commit/" + "b".repeat(40) + ") Tighten \\| date checks by @octocat, found by git bisect in 4 steps");
    expect(md).toContain("| Fix attempts | 1 hypotheses, 3 attempts, 1 rolled back automatically |");
    expect(md).toContain("9 of 9 passed · lint: not configured · type-check: clean");
    expect(md).toContain("**High** (85/100)");
    expect(md).toContain("`github-models/openai/gpt-4.1-mini` · 7 calls · $0");
    // each row has exactly 2 unescaped cell separators + edges
    for (const line of md.split("\n").slice(2)) expect(line.split(/(?<!\\)\|/).length).toBe(4);
  });
});
