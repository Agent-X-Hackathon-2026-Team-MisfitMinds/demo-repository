// Protection check from branch rulesets (TRD §5.4, D-10, D-11).
import type { ProtectionStatus } from "@fixie/shared";
import type { BranchRule } from "./client.ts";

export interface ProtectionResult {
  status: Exclude<ProtectionStatus, "unknown">;
  approvals: number;
  lastPushApproval: boolean;
  rulesetIds: number[];
}

export function classifyProtection(rules: readonly BranchRule[], bypassByFixie = false): ProtectionResult {
  const pr = rules.filter((r) => r.type === "pull_request");
  const approvals = Math.max(0, ...pr.map((r) => r.parameters?.required_approving_review_count ?? 0));
  const ok = pr.some((r) => (r.parameters?.required_approving_review_count ?? 0) >= 1 && r.parameters?.require_last_push_approval === true);
  const status = bypassByFixie && approvals >= 1 ? "bypass" : ok ? "ok" : approvals >= 1 ? "weak" : "missing";
  return {
    status,
    approvals,
    lastPushApproval: pr.some((r) => r.parameters?.require_last_push_approval === true),
    rulesetIds: [...new Set(pr.map((r) => r.ruleset_id).filter((x): x is number => typeof x === "number"))],
  };
}
