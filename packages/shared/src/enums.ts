// Canonical enum values. Source of truth: supabase/migrations/20261101000100_core.sql (05 Schema)
// and 00_START_HERE.md §4. Never add a value here without an additive migration first.
import { z } from "zod";

export const RUN_STATUSES = [
  "queued",
  "awaiting_info",
  "awaiting_confirmation",
  "provisioning",
  "baseline",
  "reproducing",
  "diagnosing",
  "fixing",
  "verifying",
  "opening_pr",
  "succeeded",
  "failed",
  "cancelled",
] as const;
export const RunStatus = z.enum(RUN_STATUSES);
export type RunStatus = z.infer<typeof RunStatus>;

export const TERMINAL_STATUSES = ["succeeded", "failed", "cancelled"] as const satisfies readonly RunStatus[];
export const isTerminalStatus = (s: RunStatus): boolean => (TERMINAL_STATUSES as readonly string[]).includes(s);

export const RUN_OUTCOMES = [
  "pr_opened",
  "pr_updated",
  "could_not_reproduce",
  "could_not_fix",
  "fix_plan",
  "not_our_code",
  "info_timeout",
  "environment_error",
  "gate_violation",
  "blocked_path",
  "budget_exceeded",
  "infra_error",
  "cancelled",
] as const;
export const RunOutcome = z.enum(RUN_OUTCOMES);
export type RunOutcome = z.infer<typeof RunOutcome>;

export const RUN_STEPS = [
  "bug_spec",
  "triage",
  "provision",
  "install",
  "baseline",
  "reproduce",
  "confirm_intent",
  "bisect",
  "localize",
  "hypothesize",
  "fix",
  "verify",
  "stress",
  "explain",
  "open_pr",
  "report",
  "teardown",
] as const;
export const RunStep = z.enum(RUN_STEPS);
export type RunStep = z.infer<typeof RunStep>;

export const RunTrigger = z.enum(["label", "comment", "dashboard", "revise", "cli"]);
export type RunTrigger = z.infer<typeof RunTrigger>;

export const RunMode = z.enum(["action", "cli"]);
export type RunMode = z.infer<typeof RunMode>;

export const RunTier = z.enum(["t0_autofix", "t1_fix", "t2_plan", "t3_report"]);
export type RunTier = z.infer<typeof RunTier>;

/** The nine gates, in the order the UI lists them (03 §10 Tests & checks). */
export const GATE_KINDS = [
  "repro_fails_before",
  "repro_passes_after",
  "no_new_failures",
  "lint_clean",
  "typecheck_clean",
  "diff_size",
  "blocked_paths",
  "test_integrity",
  "secret_scan",
] as const;
export const GateKind = z.enum(GATE_KINDS);
export type GateKind = z.infer<typeof GateKind>;

export const TestPhase = z.enum(["baseline", "repro_before", "repro_after", "final", "stress"]);
export type TestPhase = z.infer<typeof TestPhase>;

export const TestFramework = z.enum(["pytest", "jest", "vitest"]);
export type TestFramework = z.infer<typeof TestFramework>;

export const TestOutcome = z.enum(["passed", "failed", "error", "skipped"]);
export type TestOutcome = z.infer<typeof TestOutcome>;

export const StepStatus = z.enum(["running", "passed", "failed", "skipped"]);
export type StepStatus = z.infer<typeof StepStatus>;

export const EventLevel = z.enum(["debug", "info", "warn", "error"]);
export type EventLevel = z.infer<typeof EventLevel>;

export const ProtectionStatus = z.enum(["unknown", "ok", "weak", "missing", "bypass"]);
export type ProtectionStatus = z.infer<typeof ProtectionStatus>;

export const WorkflowStatus = z.enum(["unknown", "missing", "present", "outdated", "invalid"]);
export type WorkflowStatus = z.infer<typeof WorkflowStatus>;

export const ConfigStatus = z.enum(["unknown", "missing", "valid", "invalid"]);
export type ConfigStatus = z.infer<typeof ConfigStatus>;

export const ConfidenceLevel = z.enum(["high", "medium", "low"]);
export type ConfidenceLevel = z.infer<typeof ConfidenceLevel>;

/** high ≥ 75, medium 50–74, low < 50 (TRD §3.7). */
export const confidenceLevelOf = (score: number): ConfidenceLevel =>
  score >= 75 ? "high" : score >= 50 ? "medium" : "low";

export const HypothesisStatus = z.enum(["proposed", "trying", "accepted", "rejected", "abandoned", "skipped"]);
export type HypothesisStatus = z.infer<typeof HypothesisStatus>;

export const CheckpointKind = z.enum(["baseline", "repro", "attempt", "revert"]);
export type CheckpointKind = z.infer<typeof CheckpointKind>;

export const CheckpointResult = z.enum([
  "pending",
  "passed",
  "rolled_back",
  "no_progress",
  "patch_failed",
  "gate_failed",
]);
export type CheckpointResult = z.infer<typeof CheckpointResult>;

export const LlmPurpose = z.enum(["bug_spec", "repro_test", "hypotheses", "patch", "explain"]);
export type LlmPurpose = z.infer<typeof LlmPurpose>;

export const ArtifactKind = z.enum(["patch", "junit_xml", "command_log", "trace", "proof_card", "report"]);
export type ArtifactKind = z.infer<typeof ArtifactKind>;

export const PrState = z.enum(["draft", "open", "closed", "merged"]);
export type PrState = z.infer<typeof PrState>;

export const IncidentKind = z.enum([
  "secret_exposure",
  "unapproved_egress",
  "unexpected_push",
  "app_merge",
  "ungated_pr",
  "sandbox_escape",
]);
export type IncidentKind = z.infer<typeof IncidentKind>;

export const BisectStatus = z.enum(["found", "no_good_commit", "dependency_boundary", "timeout", "not_applicable"]);
export type BisectStatus = z.infer<typeof BisectStatus>;

export const MembershipRole = z.enum(["admin", "member"]);
export type MembershipRole = z.infer<typeof MembershipRole>;

export const GithubPermission = z.enum(["read", "triage", "write", "maintain", "admin"]);
export type GithubPermission = z.infer<typeof GithubPermission>;
