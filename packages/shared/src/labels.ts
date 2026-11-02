// Canonical GitHub vocabulary (00 §4). Never rename.
export const TRIGGER_LABEL = "fixie" as const;

export const STATUS_LABELS = {
  working: "fixie:working",
  needsInfo: "fixie:needs-info",
  prReady: "fixie:pr-ready",
  notFixed: "fixie:not-fixed",
  lowConfidence: "fixie:low-confidence",
} as const;

export const CANONICAL_LABELS: readonly string[] = [TRIGGER_LABEL, ...Object.values(STATUS_LABELS)];

export const FIX_BRANCH_PREFIX = "fixie/" as const;
export const fixBranch = (issue: number): string => `fixie/issue-${issue}`;
export const fixRef = (issue: number): string => `refs/heads/${fixBranch(issue)}`;

export const WORKFLOW_PATH = ".github/workflows/fixie.yml" as const;
export const CONFIG_PATH = ".fixie.yml" as const;
export const traceArtifactName = (runId: string): string => `fixie-trace-${runId}.zip`;

export const COMMANDS = ["/fixie fix", "/fixie revise", "/fixie confirm", "/fixie reject"] as const;

export type ParsedCommand =
  | { kind: "fix" }
  | { kind: "revise"; feedback: string }
  | { kind: "confirm" }
  | { kind: "reject"; note: string };

/** A comment is a command only if it *starts* with one (00 §4). */
export function parseCommand(body: string): ParsedCommand | null {
  const text = body.replace(/^\s+/, "");
  const m = /^\/fixie\s+(fix|revise|confirm|reject)\b([\s\S]*)$/.exec(text);
  if (!m) return null;
  const rest = (m[2] ?? "").trim();
  switch (m[1]) {
    case "fix":
      return { kind: "fix" };
    case "confirm":
      return { kind: "confirm" };
    case "revise":
      return rest ? { kind: "revise", feedback: rest } : null;
    case "reject":
      return { kind: "reject", note: rest };
    default:
      return null;
  }
}

/** Repro test file names (00 §4). */
export const reproTestPath = (
  lang: "python" | "node",
  issue: number,
  testDir: string,
  ext: "ts" | "js" = "ts",
): string =>
  lang === "python"
    ? `${testDir.replace(/\/$/, "")}/test_fixie_issue_${issue}.py`
    : `${testDir.replace(/\/$/, "")}/fixie-issue-${issue}.test.${ext}`;
