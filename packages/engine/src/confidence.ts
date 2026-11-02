// Deterministic confidence score (TRD §3.7).
import { confidenceLevelOf, type ConfidenceLevel } from "@fixie/shared";

export interface ConfidenceInput {
  reproMatchedSpec: boolean; // repro failed with the exception/assertion named in the bug spec
  changedLineInTopRegions: boolean;
  bisect: "touched_changed_file" | "other" | "not_run";
  diffLines: number; // excluding repro test
  winningAttempt: number; // 1-based
  stress: "stable" | "unstable" | "not_run";
  existingTestModified: boolean;
}

export function confidence(i: ConfidenceInput): { score: number; level: ConfidenceLevel; reasons: string[] } {
  const parts: [number, string][] = [];
  parts.push(i.reproMatchedSpec ? [30, "repro fails with the error named in the issue"] : [20, "repro fails with a different error than the issue names"]);
  if (i.changedLineInTopRegions) parts.push([15, "the fix touches a top-5 suspicious region"]);
  if (i.bisect === "touched_changed_file") parts.push([10, "the breaking commit touched a changed file"]);
  else if (i.bisect === "not_run") parts.push([5, "bisect did not run"]);
  if (i.diffLines <= 30) parts.push([15, `small diff (${i.diffLines} lines)`]);
  else if (i.diffLines <= 100) parts.push([8, `moderate diff (${i.diffLines} lines)`]);
  parts.push(i.winningAttempt <= 2 ? [10, `fixed on attempt ${i.winningAttempt}`] : [5, `fixed on attempt ${i.winningAttempt}`]);
  if (i.stress === "stable") parts.push([10, "stress runs 5/5 stable"]);
  else if (i.stress === "not_run") parts.push([5, "stress runs not run"]);
  if (!i.existingTestModified) parts.push([10, "no existing test modified"]);
  const score = Math.max(0, Math.min(100, parts.reduce((n, [p]) => n + p, 0)));
  const reasons = [...parts].sort((a, b) => b[0] - a[0]).map(([, r]) => r);
  return { score, level: confidenceLevelOf(score), reasons };
}
