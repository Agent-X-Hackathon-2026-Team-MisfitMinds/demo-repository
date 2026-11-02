// Proof Card table for PR bodies and job summaries (03 §14 GH-05). Copy is fixed by the flow spec.
import type { ProofCard } from "@fixie/shared";
import { escapeMarkdown, inlineCode, truncate } from "./markdown.ts";

export interface ProofCardLinks {
  commitUrl: (sha: string) => string;
  bisectNotRunReason?: string;
  lintConfigured: boolean;
  typecheckConfigured: boolean;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const money = (usd: number) => (usd === 0 ? "$0" : `$${usd < 0.01 ? usd.toFixed(4) : usd.toFixed(2)}`);

export function renderProofCardTable(c: ProofCard, l: ProofCardLinks): string {
  const passedGates = c.gates.filter((g) => g.passed).length;
  const rows: [string, string][] = [];
  rows.push([
    "Reproduction",
    `${inlineCode(c.repro.testId)} (new) **${c.repro.beforeOutcome === "error" ? "failed" : c.repro.beforeOutcome}** before the fix → **${c.repro.afterOutcome}** after`,
  ]);
  rows.push([
    "Full suite",
    `${c.suite.baselinePassed} passed, ${c.suite.baselineFailed} failing → ${c.suite.finalPassed} passed, ${c.suite.finalFailed} failing · **${c.suite.newlyFailing} newly failing**`,
  ]);
  if (c.bisect.status === "found" && c.bisect.firstBadSha && c.bisect.commit) {
    const sha = c.bisect.firstBadSha;
    rows.push([
      "Breaking commit",
      `[${inlineCode(sha.slice(0, 7))}](${l.commitUrl(sha)}) ${escapeMarkdown(truncate(c.bisect.commit.message.split("\n")[0] ?? "", 60))} by @${escapeMarkdown(c.bisect.commit.author)}, found by git bisect in ${c.bisect.steps} steps`,
    ]);
  } else {
    rows.push(["Breaking commit", `Not searched: ${escapeMarkdown(l.bisectNotRunReason ?? c.bisect.status.replace(/_/g, " "))}`]);
  }
  rows.push([
    "Fix attempts",
    `${c.hypotheses.length} hypotheses, ${c.attempts.total} attempts, ${c.attempts.reverted} rolled back automatically`,
  ]);
  rows.push([
    "Checks",
    `${passedGates} of ${c.gates.length} passed · lint: ${l.lintConfigured ? "clean" : "not configured"} · type-check: ${l.typecheckConfigured ? "clean" : "not configured"}`,
  ]);
  rows.push(["Sandbox", `${inlineCode(c.sandbox.image)} · network locked after install`]);
  rows.push([
    "Confidence",
    `**${cap(c.confidence.level)}** (${c.confidence.score}/100): ${c.confidence.reasons.slice(0, 2).map(escapeMarkdown).join("; ")}`,
  ]);
  rows.push(["Model", `${inlineCode(`${c.model.preset}/${c.model.name}`)} · ${c.model.calls} calls · ${money(c.model.costUsd)}`]);
  return ["| Check | Result |", "| --- | --- |", ...rows.map(([k, v]) => `| ${k} | ${v.replace(/(?<!\\)\|/g, "\\|")} |`)].join("\n");
}
