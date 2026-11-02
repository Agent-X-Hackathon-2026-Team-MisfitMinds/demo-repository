// Where Fixie itself lives (D-39). Use these constants; never hard-code the slug.
export const FIXIE_GITHUB_ORG = "Agent-X-Hackathon-2026-Team-MisfitMinds" as const;
export const FIXIE_REPO = "Agent-X-Hackathon-2026-Team-MisfitMinds/demo-repository" as const;
export const FIXIE_REPO_URL = `https://github.com/${FIXIE_REPO}` as const;
/** `uses:` value for the Action (users should pin the full SHA; this is the human-readable major tag). */
export const FIXIE_ACTION_REF = `${FIXIE_REPO}@v1` as const;
export const RULESET_HELP_URL = `${FIXIE_REPO_URL}#ruleset` as const;
export const DEMO_REPOS = {
  python: `${FIXIE_GITHUB_ORG}/fixie-demo-python`,
  ts: `${FIXIE_GITHUB_ORG}/fixie-demo-ts`,
} as const;
/** npm package for the CLI (Q5). */
export const CLI_NPM_PACKAGE = "@misfitminds/fixie" as const;

/** True when a workflow `uses:` value points at the Fixie Action (any ref, case-insensitive owner/repo). */
export function isFixieActionRef(uses: string): boolean {
  const at = uses.indexOf("@");
  const slug = (at === -1 ? uses : uses.slice(0, at)).trim().toLowerCase();
  return slug === FIXIE_REPO.toLowerCase() && at > 0 && uses.length > at + 1;
}
