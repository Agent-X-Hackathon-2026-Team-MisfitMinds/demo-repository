# Fixie — Webapp Flow Specification (v2.0)

Oct 31, 2026 · @Mahajan Sarthak Dileep · Team MisfitMinds · Companion to PRD v2.0, TRD v2.0, Backend Schema v2.0 · Vocabulary: `00_START_HERE.md` §4

## 1. How to use this spec

This spec defines every Fixie Hub screen, modal, button, navigation path and state, plus the GitHub-side and CLI interactions that are part of the user experience. A coding agent must build from it without inventing behaviour or copy. Order of authority: Schema > TRD > PRD > this spec > Design Brief, except that **this spec owns all user-facing copy**.

**Notation.**

- `SCR-xx` = routed screen · `M-XXX` = modal · `GH-xx` = GitHub-side interaction · `CLI-xx` = terminal output.
- Text in quotes is final copy. `{curly}` = value filled at render. `[Button]` = button label. "(external)" = opens a new tab with `rel="noopener noreferrer"` and an external-link icon.
- Every screen lists: route, access, data, layout, actions (element → behaviour → result), and loading, empty, error and success states.
- API paths are relative to `/api/v1` unless they start with `/api/ingest` or `/auth`. Errors are RFC 9457 problem+json; the `type` values are in §16.
- Priority tags: unmarked = P0; "(P1)" and "(P2)" mark later items. P1 items must still be built exactly as written when they are built.

**Decisions made in this spec** (change here first if the team disagrees).

1. URLs are scoped by installation: `/o/{org}/…`, where `{org}` is `installations.account_login`.
2. Repo-write actions stay visible but disabled with a tooltip for users without write; admin-only pages are hidden from the sidebar for members, and a direct URL shows the 403 page.
3. The Hub never writes to repositories. Every "fix this on GitHub" action is a deep link to the right GitHub page (external).
4. During the `bug_spec` and `triage` steps the run status is `queued`; the UI labels it "Understanding issue" by reading `run_steps`.
5. Run detail opens on the **Timeline** tab while the run is active and on the **Evidence** tab once it is terminal, unless `?tab=` is set.
6. `could_not_reproduce`, `could_not_fix`, `fix_plan`, `not_our_code`, `info_timeout` and `environment_error` are amber ("Not fixed"): expected outcomes with a useful report, not errors.
7. Turning a repo off in the Hub does not cancel active runs unless the admin ticks "Also cancel active runs".
8. A repo can be turned on only when the workflow, Actions-PR permission, ruleset and Hub-reporting checks pass (D-26).
9. If the Hub refuses a run at ingest because the repo is off in the Hub, the engine continues without reporting (the Hub is optional). If the refusal is a pause, a spend cap or a safety incident, the engine stops and replies on GitHub.

## 2. Roles, permissions and global gating rules

**Actors.**

| Actor | Where | Identified by |
| --- | --- | --- |
| Visitor | Sign-in page, replay page | No session |
| Member (read) | Hub, view-only for that repo | Session + `repo_access.permission` ≥ read |
| Member (write) | Hub, can start, cancel and re-run on that repo | `repo_access.permission` ≥ write |
| Installation admin | Hub, everything in the installation | `memberships.role = admin` (D-24) |
| Staff | Hub, read-only support, audited | `profiles.is_staff`; no staff screens in v1 |
| Reporter | GitHub only: files issues, answers clarifications | Issue author |
| Writer | GitHub only: labels, `/fixie fix`, `/fixie revise` | GitHub permission ≥ write on the repo |

**Permission matrix (Hub).** "Hidden" = not rendered. "Disabled" = rendered, disabled, tooltip shown.

| Action | Member (read) | Member (write) | Admin | UI when not allowed |
| --- | --- | --- | --- | --- |
| View repos, setup, runs, evidence, logs, diff, metrics | Yes | Yes | Yes | Repo not listed; direct URL → 404 |
| [Fix an issue], [Run again], [Run doctor] | No | Yes | Yes (needs repo write) | Disabled: "You need write access to {repo} on GitHub to start runs." |
| [Cancel run] | No | Yes | Yes | Hidden |
| Turn a repo on/off in the Hub | No | No | Yes | Toggle hidden; badge only |
| Installation settings | No | No | Yes | Sidebar item hidden; URL → 403 |
| Audit log (P1), Members (P1) | No | No | Yes | Hidden; URL → 403 |
| Rate a PR explanation (P1) | Yes | Yes | Yes | — |
| Own account and sessions | Yes | Yes | Yes | — |

**Global gating rules for starting a run from the Hub** (server-checked in this order; the first failing rule decides the message; the UI mirrors them to disable buttons).

1. Session valid → else redirect to sign-in.
2. Installation not uninstalled → else write actions hidden and the uninstall banner shown.
3. Installation not suspended on GitHub → "Fixie Hub is suspended on GitHub for {org}."
4. Installation not paused → "New runs are paused for {org}: {pause_reason}."
5. Dashboard triggers allowed (`allow_dashboard_runs`) → "Starting runs from the Hub is turned off for {org}."
6. Spend cap not reached (only if a cap is set) → "Model spend cap reached. New runs resume on {first of next month}."
7. Repo enabled in the Hub → "Fixie is off for {repo} in this Hub."
8. User has write on the repo.
9. Issue exists, is open, is not a pull request.
10. No active run on the issue, and no open Fixie PR for it.

**Freshness.** On any 403 from a write, show the error toast, then refetch `GET /me` and the page's data so buttons re-render correctly.

## 3. Sitemap, routes and navigation

**Routes.**

| ID | Route | Screen | Access | Notes |
| --- | --- | --- | --- | --- |
| SCR-01 | `/` | Welcome and sign in | Public | Signed in → last installation's overview |
| SCR-02 | `/auth/callback` | Signing you in (transient) | Public | Server only |
| SCR-03 | `/onboarding` | Install Fixie Hub on GitHub | Signed in, 0 installations | ≥ 1 installation → overview |
| SCR-04 | `/onboarding/complete` | Connecting installation | Signed in | GitHub App setup URL returns here |
| SCR-05 | `/o/{org}/overview` | Overview | Member | `/o/{org}` redirects here; `?period=month\|30d\|90d` |
| SCR-06 | `/o/{org}/repos` | Repositories | Member | `?q=&filter=all\|ready\|setup\|on\|off&welcome=1` |
| SCR-07 | `/o/{org}/repos/{repo}` | Repository | Repo read | `{repo}` = name without owner |
| SCR-08 | `/o/{org}/repos/{repo}/setup` | Repository setup | Repo read | Turning on/off: admin |
| SCR-09 | `/o/{org}/runs` | Runs | Member | `?repo=&status=active\|needs_info\|pr\|not_fixed\|failed\|cancelled` |
| SCR-10 | `/o/{org}/runs/{runId}` | Run detail | Repo read | `?tab=evidence\|attempts\|timeline\|logs\|diff\|tests&cmd={seq}&phase={phase}` |
| SCR-11 | `/o/{org}/settings` | Installation settings | Admin | Tabs: General, Members (P1) at `/settings/members` |
| SCR-12 | `/o/{org}/audit` | Audit log (P1) | Admin | `?actorType=&area=` |
| SCR-13 | `/account` | Account and sessions | Signed in | Not installation-scoped |
| SCR-14 | `/replay` | Replay a trace (P1) | Public | `?runId=` loads a Hub-stored trace when signed in |
| — | `/403`, `/404`, `/500` | Error pages | Anyone | Rendered in place |

**Modals.**

| ID | Modal | Opened from |
| --- | --- | --- |
| M-TRIGGER | Fix an issue | SCR-05 empty state, SCR-06 row menu, SCR-07, SCR-09 |
| M-ENABLE | Turn on Fixie for a repo in this Hub | SCR-06 toggle, SCR-08 |
| M-DISABLE | Turn off Fixie for a repo in this Hub | SCR-06 toggle, SCR-08 |
| M-CANCEL | Cancel this run | SCR-10 |
| M-DOCTOR | Run a setup check on GitHub | SCR-08 |
| M-CONFLICT | Settings changed by someone else | SCR-11 save |
| M-DISCARD | Discard unsaved changes | Leaving SCR-11 while dirty |
| M-REVOKE | Sign out sessions (P1) | SCR-11 Members, SCR-13 |
| M-DELETE-ACCOUNT | Delete my Fixie Hub account (P1) | SCR-13 |

**Navigation model.**

- Sidebar (installation screens): Overview, Repositories, Runs, divider, Settings (admin), Audit log (admin, P1). The item for the current route and its children is highlighted (`/repos/{repo}/setup` highlights Repositories).
- Breadcrumbs on SCR-07 "Repositories / {repo}", SCR-08 "Repositories / {repo} / Setup", SCR-10 "Runs / {repo} / #{issue}". Each crumb links except the last.
- Filters typing uses `router.replace` (debounced 300 ms); tab changes and row clicks use `router.push`. Every list row is a real `<a>`.
- Unknown `{org}`, or one the user isn't a member of → 404 (never 403).

## 4. Global shell and shared patterns

**Top bar (56 px, sticky).**

| Element | Behaviour | Result |
| --- | --- | --- |
| Wordmark "fixie" | Click | `/o/{current org}/overview` |
| Installation switcher | Avatar, `account_login`, role chip ("Admin"/"Member"); menu lists every installation from `GET /me` (with "Paused"/"Suspended" tags), divider, "Install on another account" | Selecting navigates to the same screen type in the other installation; detail pages fall back to that installation's list page. "Install on another account" opens `https://github.com/apps/{GITHUB_APP_SLUG}/installations/new` (external). Hidden with one installation (login shown as text) |
| Live runs indicator | Shows "{n} running" with a pulsing 6 px slate dot when non-terminal runs exist (refresh 30 s); hidden at 0 | Click → SCR-09 `?status=active` |
| User menu | Avatar → login and name, "Account and sessions", "Replay a trace" (P1), "Docs" (external, repo README), "GitHub repository" (external), "Sign out" | "Sign out" → §5 |

**Sidebar** (240 px; 64 px icon rail below 1280 px; drawer below 768 px). Runs shows a count of non-terminal runs (refresh 30 s, hidden at 0).

**Banner slot** (above content, highest severity first, max 2 visible + "{n} more").

| Condition (from `GET /me`) | Severity | Copy | Action |
| --- | --- | --- | --- |
| `paused_at` set | Critical | "New runs are paused for {org}: {pause_reason}. Open pull requests are not affected." | Admin: [View incident] → SCR-12 (P1) |
| `suspended_at` set | Critical | "The Fixie Hub app is suspended on GitHub for {org}. An org owner can unsuspend it in GitHub settings." | [Open GitHub settings] (external) |
| `uninstalled_at` set | Critical | "Fixie Hub was uninstalled from {org} on {date}. Data is deleted on {date + 30 days}. Reinstall before then to keep your history." | [Reinstall] (external) |
| Spend cap set and reached | Critical | "Model spend cap reached (${spend} of ${cap}). Runs that use paid models are blocked until {first of next month}." | Admin: [Edit cap] → SCR-11 |
| Spend ≥ alert % of cap | Warning, dismissible per session | "{pct}% of this month's model spend cap used (${spend} of ${cap})." | Admin: [Edit cap] |
| A repo was turned off because its ruleset changed (last 7 days) | Warning, dismissible | "{n} repositories were turned off because their branch ruleset no longer requires a human approval." | [Review repositories] → SCR-06 `?filter=setup` |
| Browser offline | Warning | "You're offline. Changes won't save until you reconnect." | Auto-hides |

**Toasts.** Bottom-right (top on mobile), max 3, newest on top. Success/info auto-dismiss after 4 s; errors stay until closed. `aria-live="polite"` (errors `assertive`).

**Modals.** Max width 560 px (M-TRIGGER 480 px). Focus moves to the first field, or the safest button in confirms; focus trapped; Esc and backdrop close except while a request is in flight. Primary button shows a spinner and the modal is inert while submitting. Destructive confirms use a red primary button with [Cancel] on its left.

**Buttons and forms.** A button that sends a request is disabled with a spinner until the response; double submits are impossible. Field errors appear under the field with an icon; focus moves to the first invalid field. Optional fields are labelled "(optional)"; no asterisks.

**Loading.** First load: skeletons matching the final layout, never a full-page spinner. Route change: 2 px progress bar under the top bar. Refetch: keep old data. Any request over 10 s adds "Still loading…".

**Formatting.** Relative time ("3 min ago") with absolute local time in a tooltip ("31 Oct 2026, 14:05 IST"). Durations "4m 12s", "1h 03m". Money "$1.42"; under $0.01 shows "< $0.01"; exactly 0 shows "$0.00 (free model)" where a cost is the focus, else "$0.00". Rates as whole percent; denominator 0 → "—" with tooltip "Not enough runs yet." SHAs: 7 characters, monospace, linked to the commit. Test ids, paths, commands, labels, model ids: monospace.

**Error pages** (inside the shell when signed in).

| Page | Heading | Body | Actions |
| --- | --- | --- | --- |
| 403 | "You don't have access to this page" | "Only admins of {org} can open {page name}." | [Go to overview] |
| 404 | "We couldn't find that" | "It may have been deleted, or you may not have access to it on GitHub." | [Go to overview] |
| 500 | "Something went wrong on our side" | "Try again. If it keeps happening, open an issue on GitHub with this reference: {requestId}." | [Try again], [Go to overview] |

**Accessibility.** WCAG 2.1 AA; every action keyboard-reachable with a visible focus ring; status never by colour alone (icon + word); live regions announce run status changes on SCR-10.

## 5. Sign-in, sign-out and session flows

The only way in is "Sign in with GitHub" (Supabase Auth, GitHub provider). There is no email login or password anywhere.

### SCR-01 Welcome and sign in — `/`

**Access.** Public. A valid session redirects before paint to a safe `next`, else the last installation's overview (cookie `fx_last_org`, 1 year), else `/onboarding`.

**Layout.** No shell. Left-aligned hero on wide screens, single column on mobile:

- Wordmark (large) and the headline "Bug reports in. Tested pull requests out."
- Body: "Fixie is a free, open-source agent that reproduces a bug in a locked sandbox, proves it with a failing test, finds the commit that broke it, and opens a draft pull request. A person always merges."
- A static **proof strip demo** (the Run detail proof strip component with sample data: `tests/test_dates.py::test_leap_day` "Failed" → "Passed"). It animates once on first view (400 ms) and is static with reduced motion.
- Three facts in a row: "Free models, or fully offline" · "Finds the breaking commit" · "Never merges on its own".
- Primary [Sign in with GitHub] (GitHub mark), secondary [Read the docs] (external), text link "Replay a trace without signing in" → SCR-14 (P1).
- Small print: "Fixie Hub only sees the repositories you choose on GitHub. You can use Fixie without the Hub: add one workflow file."

**Actions.**

| Element | Behaviour | Success | Failure |
| --- | --- | --- | --- |
| [Sign in with GitHub] | Full-page navigation to `/auth/sign-in?next={next}`; label becomes spinner + "Redirecting to GitHub…" | GitHub authorize page | Not navigated after 10 s → button resets and inline error "GitHub didn't respond. Try again." |

**`next` rule.** Accept `next` only if it starts with `/`, not `//`, and not `/auth`; otherwise ignore it.

**Messages above the button** (from `?error=` / `?notice=`, shown once, then removed with `router.replace`).

| Query | Style | Copy |
| --- | --- | --- |
| `error=oauth_denied` | Info | "Sign-in was cancelled on GitHub." |
| `error=state_mismatch` | Error | "Your sign-in link expired. Please try again." |
| `error=github_unavailable` | Error | "GitHub didn't respond. Try again in a minute." |
| `error=access_lost` | Error | "You no longer have access to any Fixie Hub installation. Ask an admin to add you on GitHub, or install Fixie Hub yourself." |
| `error=account_deleted` | Info | "Your Fixie Hub account was deleted. Sign in again to start fresh." |
| `notice=session_expired` | Info | "Your session expired. Sign in again to continue." |
| `notice=signed_out` | Success | "You're signed out." |

### SCR-02 Auth callback — `/auth/callback`

Server-only (TRD §10.3): exchange the code, read `provider_token` once, sync profile, memberships and repo access, write audit `session.created`, discard the token. If HTML renders, it is only a spinner and "Signing you in…".

| Outcome | Redirect |
| --- | --- |
| ≥ 1 installation | Safe `next`, else `fx_last_org`, else first installation A→Z → `/o/{org}/overview` |
| 0 installations | `/onboarding` |
| User cancelled on GitHub | `/?error=oauth_denied` |
| Code/PKCE invalid or expired | `/?error=state_mismatch` |
| GitHub API error or timeout during sync | `/?error=github_unavailable` (the Supabase session is signed out first) |

### Sign out

User menu → "Sign out". No confirmation. `POST /auth/sign-out` (same-origin). Server signs out (scope local). Client clears the TanStack Query cache and navigates to `/?notice=signed_out`, even if the request failed.

### Session expiry and loss of access

- Any 401 `unauthenticated`: clear the cache and navigate to `/?notice=session_expired&next={current path}`. A dirty form first saves its draft in `sessionStorage` under `fx_draft:{route}`; after sign-in it is restored with the info toast "We restored your unsaved changes."
- Losing every installation on refresh → server signs the user out and redirects with `error=access_lost`.
- Losing access to one repo: its pages return 404 on the next load or refetch.

## 6. Onboarding

Sign in → install the Fixie Hub App on GitHub → back to the Hub → set up one repo. The installation row is created by the `installation.created` webhook, so SCR-04 waits for it.

### SCR-03 Install Fixie Hub — `/onboarding`

**Access.** Signed in with 0 installations; others are redirected to their overview.

**Layout.** Minimal top bar (wordmark, user menu). Left-aligned column (max 640 px): heading "Connect Fixie Hub to GitHub"; body "The Hub app can read your code, issues and pull requests to show setup and runs, and it can start or cancel Fixie workflow runs. It can't change code, comment, or merge. Fixie itself runs in your repository's GitHub Actions."; numbered list (static):

1. "Install the Fixie Hub app on your account or organization."
2. "Choose the repositories it may see. We recommend 'Only select repositories'."
3. "Come back here and follow the setup checklist for one repository."

**Actions.**

| Element | Behaviour | Result |
| --- | --- | --- |
| [Install on GitHub] (primary) | Same-tab navigation to `https://github.com/apps/{GITHUB_APP_SLUG}/installations/new` | GitHub returns to `/onboarding/complete?installation_id={id}&setup_action={install\|request\|update}` |
| "Already installed? Refresh" (link) | `GET /me?refresh=1` | Found → overview + toast "Found {org}."; none → inline "We still can't see an installation you belong to. If an owner installed Fixie Hub, ask them to add you to the organization on GitHub." |
| "Prefer no Hub? Use the Action only" (link) | External to the README "Quick start" | — |

### SCR-04 Connecting — `/onboarding/complete`

| `setup_action` | Behaviour | Copy | Exit |
| --- | --- | --- | --- |
| `install`, `update` | Poll `GET /me?refresh=1` every 2 s for up to 30 s until the installation appears | Spinner + "Connecting to GitHub…"; after 10 s add "This usually takes a few seconds." | Found → `/o/{org}/repos?welcome=1` |
| `request` | No polling | Heading "Install requested"; body "An owner of the organization needs to approve Fixie Hub on GitHub. Once they do, sign in again and it will appear here." | [Back] → `/onboarding` |
| missing / unknown | Redirect to `/onboarding` | — | — |

**Timeout (30 s).** Heading "We haven't heard from GitHub yet"; body "The installation can take up to a minute to reach us."; [Check again] (restart polling), [Back to install].
**Error** (`GET /me` fails 3 times in a row): "We couldn't reach Fixie Hub. Check your connection and try again." [Check again].

### First-run callout

On SCR-06 with `welcome=1`, a dismissible callout above the table: heading "Next: set up one repository"; body "Pick a Python or JavaScript/TypeScript repository with tests that run in under 15 minutes. The setup page tells you exactly what to add on GitHub."; [Got it] removes `welcome=1`. Members see: "An admin of {org} turns repositories on. You can still view setup status and runs."

All repos arrive with `enabled = false`.

## 7. Repositories

### SCR-06 Repositories — `/o/{org}/repos`

**Data.** `GET /repos?installationId=` → per repo: `id, fullName, name, isPrivate, primaryLanguage, framework (pytest|vitest|jest|null), enabled, setup {passed, total, blocking[]}, protectionStatus, workflowStatus, lastRun {id, status, outcome, createdAt} | null, userPermission`. Removed repos are not returned.

**Header.** "Repositories ({n})". Admin: [Choose repositories on GitHub] (secondary, external) → org: `https://github.com/organizations/{org}/settings/installations/{githubInstallationId}`; user: `https://github.com/settings/installations/{githubInstallationId}`.

**Toolbar.** Search "Filter repositories" (client-side on name, debounce 150 ms, `?q=`); segmented filter All · Ready · Needs setup · On · Off (`?filter=`). Ready = all blocking checks passed; Needs setup = any blocking check failed.

**Table** (sorted: On first, then Ready, then name A→Z).

| Column | Content |
| --- | --- |
| Repository | Name (600 weight) + lock icon if private + language chip (+ framework chip if detected) |
| Setup | "Ready" (success, check) · "{k} steps left" (warning) · "Not checked" (muted). Tooltip lists failing checks by name |
| Branch ruleset | "Requires approval" (success) · "Weak" (warning, tooltip "Turn on 'Require approval of the most recent reviewable push'.") · "Missing" (warning) · "Bot can bypass" (warning) · "Not checked" (muted) |
| In this Hub | Admin: toggle (opens M-ENABLE/M-DISABLE, never flips optimistically; disabled with tooltip "Finish setup first: {list}." when not Ready). Others: badge "On"/"Off" |
| Last run | Status badge + relative time → SCR-10; "—" if none |
| ⋯ | [Fix an issue] (write + On), [Setup], [View on GitHub] (external) |

Row click → SCR-07. Language hint: if the language is not Python, JavaScript or TypeScript, the chip shows a warning icon with tooltip "Fixie v1 supports Python (pytest) and JavaScript/TypeScript (Vitest, Jest)."

**States.** Loading: 6 skeleton rows. Empty (no repos): heading "No repositories shared with Fixie Hub yet"; admin body "Choose which repositories the Hub may see on GitHub, then come back." + [Choose repositories on GitHub]; member body "Ask an admin of {org} to add repositories to the Fixie Hub app." Filter empty: "No repositories match these filters." + [Clear filters]. Error: inline "We couldn't load repositories." + [Try again].

### SCR-07 Repository — `/o/{org}/repos/{repo}`

**Data.** `GET /repos/:id`; `GET /metrics?repoId=&from={first of month}&to={now}`; `GET /runs?repoId=` (25).

**Header.** Breadcrumb. Title `{owner}/{repo}` + GitHub link icon (external). Badges: private, In this Hub On/Off, Setup (Ready / "{k} steps left"). Buttons: [Fix an issue] (primary; disabled per §2 with tooltip), [Setup] (secondary).

**Setup callout** (when not Ready): "Fixie isn't fully set up for this repository yet. {k} steps left." + [Open setup]. When Ready but Off and the user is admin: "Setup is complete. Turn Fixie on in this Hub to start runs from here and see them live." + [Turn on] (M-ENABLE).

**Start a fix from GitHub card** (when the workflow is present). Title "Start a fix from GitHub". Rows with copy buttons: "Add the label `fixie` to an issue" · "Comment `/fixie fix` on an issue" · "Ask for changes on a Fixie PR: `/fixie revise <what to change>`" (P1). Footer: "Only people with write access can start Fixie. One run per issue at a time." Copy → toast "Copied."

**This month strip.** Runs · PRs opened · PRs merged · Fix rate · Breaking commits found · Model spend.

**Runs.** The SCR-09 table without the Repository column; "View all runs" → `/o/{org}/runs?repo={id}`.

**States.** Loading skeletons. Not found → 404. Runs empty: "No runs yet. Label an issue `fixie` on GitHub, or click Fix an issue." Metrics error: tiles "—" and "Couldn't load stats. Retry".

## 8. Repository setup and turning Fixie on or off

### SCR-08 Repository setup — `/o/{org}/repos/{repo}/setup`

**Purpose.** One page that tells a maintainer exactly what to add on GitHub, checks it live, and explains the effective configuration. The Hub never writes to the repo; every fix is a link to GitHub.

**Data.** `GET /repos/:id` → `setup.checks[]` (each `{id, status: pass | fail | warn | unknown, detail}`), `workflow {status, actionRef, model, hubUrl, permissionsMissing[], triggersMissing[]}`, `actionsCanCreatePrs`, `protection {status, rulesetNames[], approvals, lastPushApproval, bypassActors[]}`, `config {status, sha, errors[{path, message}], effective[{key, value, source: default | file | input}]}`, `framework`, `lastDoctor {at, workflowRunUrl, results[]}`.

**Layout.** Breadcrumb. Title "Set up Fixie for {repo}". Summary line "{k} of 6 checks passed" + "Checked {relative time}" + [Check again] (secondary; `POST /repos/:id/setup-check`; spinner on the button; success toast "Checks updated."; error toast "Couldn't reach GitHub. Try again."). Then six numbered check cards in a single column (max 760 px), then the "In this Hub" card. Each card: status icon + title + one-line state, expandable body (failed cards open by default, passed cards collapsed).

| # | Check | Pass when | Fail body and actions |
| --- | --- | --- | --- |
| 1 | Workflow file | `.github/workflows/fixie.yml` exists on the default branch, uses `Agent-X-Hackathon-2026-Team-MisfitMinds/demo-repository@…`, has the five triggers and five permissions in TRD §5.2 | **Missing:** "Add the Fixie workflow to `{defaultBranch}`." + **Workflow builder** (below) + [Add workflow on GitHub] (external; GitHub new-file URL with `filename` and `value` pre-filled) + [Copy YAML]. **Outdated:** "This workflow uses `{actionRef}`. The current release is `{latest}`." + [Edit on GitHub] (external). **Invalid:** list each problem ("Missing permission `models: read`.", "Missing trigger `workflow_dispatch`.") + [Edit on GitHub] |
| 2 | Actions can open pull requests | Repository workflow setting allows GitHub Actions to create pull requests | "Turn on 'Allow GitHub Actions to create and approve pull requests' in Settings → Actions → General → Workflow permissions. Fixie still can't approve its own PRs because check 3 requires approval of the latest push." + [Open Actions settings] (external `https://github.com/{fullName}/settings/actions`) |
| 3 | Branch ruleset | `protection.status = ok` | **Missing:** "Add a branch ruleset for `{defaultBranch}` that requires a pull request with at least 1 approval and 'Require approval of the most recent reviewable push'." Steps 1–3: "Open Settings → Rules → Rulesets → New branch ruleset." "Target `{defaultBranch}`, enable 'Require a pull request before merging', set approvals to 1 or more." "Tick 'Require approval of the most recent reviewable push'. Don't add GitHub Actions to the bypass list." **Weak:** "Your ruleset requires approvals but not approval of the most recent push, so a bot could approve its own change." **Bypass:** "GitHub Actions or the Fixie Hub app is on the bypass list of `{rulesetName}`. Remove it." Actions: [Open rulesets] (external `https://github.com/{fullName}/settings/rules`), [Check again] |
| 4 | Configuration | `.fixie.yml` missing (defaults used) or valid | **Invalid:** "`.fixie.yml` has {n} problems. Fixie stops before doing any work until they're fixed." + table Path · Problem + [Edit on GitHub] (external). Passed body (always available): **Effective configuration** table (Key · Value · From: "Default"/"`.fixie.yml`"/"Workflow input") + [Create `.fixie.yml` on GitHub] when missing (external; commented template) |
| 5 | Reporting to this Hub | Workflow has `hub-url` equal to this Hub's URL and `id-token: write` | "Set `hub-url: {APP_URL}` in the workflow so runs appear here live. Turn on 'Report runs to this Hub' in the workflow builder above to get the right YAML." + [Edit on GitHub] |
| 6 | Tests detected | A pytest, Vitest or Jest setup is found | Warning (not blocking): "Fixie couldn't find pytest, Vitest or Jest. Set `project.test` in `.fixie.yml`, or Fixie will stop with 'Couldn't set up the project'." |

Checks 1, 2, 3 and 5 are **blocking** for turning the repo on (D-26); 4 is blocking only when invalid; 6 is a warning.

**Workflow builder** (inside check 1; also opens from "Change model" on a passed check 1).

| Control | Options | Effect on YAML |
| --- | --- | --- |
| Model | Radio: "GitHub Models — free, no key (recommended)" · "Free tier with a key (Gemini, Groq, OpenRouter)" + preset select · "Paid key (OpenAI, Anthropic)" + preset select · "Your own OpenAI-compatible endpoint" + base URL input | Sets `model:`; keyed options add `llm-api-key: ${{ secrets.FIXIE_LLM_API_KEY }}` and show the note "Add a repository secret named `FIXIE_LLM_API_KEY`." + [Open Actions secrets] (external `https://github.com/{fullName}/settings/secrets/actions/new`) |
| Report runs to this Hub | Toggle, default on | Sets `hub-url: {APP_URL}`; off sets `hub-url: ""` |
| YAML preview | Read-only code block with line numbers; [Copy YAML] → toast "Copied." | — |

Model ids in the selects come from `packages/llm/presets.ts`. URL-encoded YAML longer than 7,000 characters makes [Add workflow on GitHub] fall back to opening the empty new-file page with a toast "Paste the YAML you just copied." (the YAML is copied automatically).

**Run a setup check (doctor).** Card below the checks: "Run Fixie's own check inside GitHub Actions: it tests the model, the ruleset, Docker and your test command." [Run doctor] (write access, workflow present) → M-DOCTOR. Shows the last result: time, overall "Passed"/"{n} problems", each line with status and message, and "View workflow run" (external).

**M-DOCTOR.** Title "Run a setup check?"; body "This starts the Fixie workflow on `{defaultBranch}` in doctor mode. It doesn't touch issues or code and takes about 2 minutes."; [Cancel], [Run doctor] → `POST /repos/:id/runs {mode: "doctor"}`. Success (202): modal closes, card shows "Running… View workflow run" (external) and polls `GET /repos/:id` every 5 s for up to 5 minutes until `lastDoctor.at` is newer than the dispatch; toast "Doctor started." After 5 minutes without a result: "No result yet. Check the workflow run on GitHub." Errors per §16 (`workflow_missing`: "Add the workflow first (check 1).").

**In this Hub card.** Title "Fixie in this Hub". Admin: toggle "On"/"Off" (disabled with the tooltip "Finish setup first: {blocking check names}." when blocked) → M-ENABLE / M-DISABLE. Text: "When on, runs on this repository appear here live and members with write access can start and cancel them from the Hub. Labels and commands on GitHub work either way." Non-admins see the state and "Only admins of {org} can change this."

**States.** Loading: summary + 6 card skeletons. Error loading: "We couldn't load setup for {repo}." + [Try again]. Live check failure: affected cards show "Couldn't check: GitHub didn't respond." with status `unknown` and [Check again].

### M-ENABLE Turn on Fixie in this Hub

On open, run `POST /repos/:id/setup-check` and show "Checking setup…".

| Result | Body | Buttons |
| --- | --- | --- |
| All blocking checks pass | Checklist with success icons for checks 1, 2, 3, 5. Then "Once on, members with write access can start and cancel runs on `{repo}` from this Hub, and every run appears here live." | [Cancel], [Turn on] |
| A blocking check fails | Heading "Finish setup first". List of failing checks, each linking to its card on SCR-08 | [Close], [Open setup] |
| Check failed (502/timeout) | "We couldn't check setup. GitHub didn't respond." | [Cancel], [Try again] |

[Turn on] → `PATCH /repos/:id {enabled: true}`. Success: modal closes, toggle On, toast "Fixie is on for {repo} in this Hub.", audit `repo.enabled`. 422 `setup_incomplete` → switches to the "Finish setup first" body with the returned list.

### M-DISABLE Turn off Fixie in this Hub

Title "Turn off Fixie for {repo} in this Hub?" Body "The Hub will stop starting runs and stop showing new runs for this repository. Labels and commands on GitHub keep working; to stop those, remove the workflow file." If active runs exist: checkbox "Also cancel {n} active runs" (unchecked). [Cancel], [Turn off] (red) → `PATCH /repos/:id {enabled: false, cancelActiveRuns}`. Toast "Fixie is off for {repo} in this Hub."; audit `repo.disabled`.

**Automatic turn-off.** When a ruleset re-check (webhook or hourly cron) finds an enabled repo below `ok`, the server sets `enabled = false`; SCR-06 shows "Off" with amber note "Turned off: ruleset changed {relative time}" and the installation banner appears.

## 9. Runs list and starting a fix

### SCR-09 Runs — `/o/{org}/runs`

**Data.** `GET /runs?installationId=&repoId=&status=&cursor=` (25, keyset). Row: `id, repo {id, name}, issue {number, title}, trigger, triggeredByLogin, status, outcome, currentStep, revisionNumber, modelLabel, startedAt, finishedAt, durationS, costUsd, bisectFound, confidenceLevel, pr {number, state} | null`.

**Header.** "Runs"; [Fix an issue] (primary; disabled with the §2 tooltip when the user has write on no enabled repo).

**Filters** (URL-synced, reset pagination): Repository ("All repositories" + readable repos); Status: All · Active · Needs info · PR ready · Not fixed · Failed · Cancelled. Active = non-terminal except `awaiting_info`/`awaiting_confirmation`; Needs info = `awaiting_info` or `awaiting_confirmation`; PR ready = outcome `pr_opened`/`pr_updated`; Not fixed = `could_not_reproduce`, `could_not_fix`, `fix_plan`, `not_our_code`, `info_timeout`, `environment_error`; Failed = `gate_violation`, `blocked_path`, `budget_exceeded`, `infra_error`; Cancelled = `cancelled`.

**Columns.**

| Column | Content |
| --- | --- |
| Issue | "#{number} {title}" (truncate at 80 chars, full title in tooltip); "Revision {k}" chip for revise runs |
| Repository | Name |
| Status | Status badge (§15), live; under it in `small` muted: current step label while active |
| Evidence | Compact icons with tooltips: bisect found ("Breaking commit found"), confidence chip (High/Medium/Low) when a PR exists |
| Pull request | "#{n}" + PR state chip (external link); "—" |
| Started by | Avatar + login + trigger icon (tag = label, chat = comment, cursor = dashboard, loop = revise) |
| Model | `{preset}/{model}` truncated, monospace, full in tooltip |
| Started · Duration · Cost | Relative time · live ticking while active · total (LLM) |

Row → SCR-10. **Live refresh:** Realtime on `runs` for the installation (filter by `installation_id`) updates rows in place; fallback refetch of the first page every 10 s while any visible row is active and the tab is visible; never move the user's scroll. [Load more] below the table (spinner; hidden without a next cursor); footer "Showing {n} runs".

**States.** Loading: 8 skeleton rows. Empty (no runs ever): heading "No runs yet"; body "Label an issue `fixie` on GitHub, or start one here."; [Fix an issue] if allowed; if no repo is On: admin [Set up a repository] → SCR-06 `?filter=setup`; members "An admin needs to turn on Fixie for a repository first." Filtered empty: "No runs match these filters." + [Clear filters]. Error: "We couldn't load runs." + [Try again] (keeps loaded rows). Load-more error: "Couldn't load more runs." + [Try again].

### M-TRIGGER Fix an issue

| Field | Control | Rules |
| --- | --- | --- |
| Repository | Select of repos that are On and where the user has write; preselected and locked when opened from a repo | Required |
| Issue | Text input, placeholder "Issue number or GitHub URL" | Accepts `123`, `#123`, `https://github.com/{owner}/{repo}/issues/{n}`; a URL selects the matching repo. Errors: "Enter an issue number or a GitHub issue URL."; "That issue is in a repository that isn't on in this Hub." |

Helper: "Fixie reads the issue and its comments. Bugs with steps, versions and a stack trace work best." Note under the button: "This starts the Fixie workflow in GitHub Actions. It can take up to a minute to begin."

[Start fix] → `POST /repos/:id/runs {issueNumber}`.

| Response | UI |
| --- | --- |
| 201 `{runId}` | Close, navigate to `/o/{org}/runs/{runId}`, toast "Fixie started on #{n}." |
| 404 `issue_not_found` | Inline under Issue: "Issue #{n} doesn't exist in {repo}." |
| 422 `issue_closed` | Inline: "Issue #{n} is closed. Reopen it on GitHub to run Fixie." |
| 422 `issue_is_pull_request` | Inline: "#{n} is a pull request, not an issue." |
| 409 `run_already_active` | Inline: "Fixie is already working on #{n}." + "View run" link |
| 409 `pr_already_open` | Inline: "Fixie already opened PR #{pr} for #{n}. Ask for changes there with `/fixie revise`." + "View PR" (external) |
| 409 `repo_not_enabled`, `dashboard_triggers_off`, `installation_paused`, `installation_suspended`, `spend_cap_reached`, `workflow_missing` | Banner inside the modal with the §16 copy; [Start fix] stays disabled until reopened |
| 502 `github_dispatch_failed` | Inline: "GitHub didn't start the workflow: {detail}." |
| 403 `forbidden` | Inline: "You need write access to {repo} on GitHub to start runs."; refetch `GET /me` |
| 429 `rate_limited` | Inline: "Too many requests. Try again in {retryAfter} seconds." |
| 5xx / network | Inline: "Couldn't start the fix. Try again."; inputs kept |

## 10. Run detail

Run detail is the product's core screen: it shows live what Fixie is doing and, when done, the proof, the cause, every attempt and the patch. It must reflect an engine event within 2 s (FE-01).

### SCR-10 Run detail — `/o/{org}/runs/{runId}`

**Data.**

- `GET /runs/:id` → `run` (status, outcome, failureDetail, tier, trigger, triggeredByLogin, mode, issue, repo, headSha, githubRunUrl, bugSpec, diagnosis, effectiveConfig, reproAttempts, fixAttempts, llmCostUsd, model, confidence, bisect, suspicious[], blastRadius, sandbox, proofCard, timestamps, cancelRequestedAt), `steps[]`, `gates[]` (latest attempt per gate), `pr | null`, `parentRun | null`, `childRuns[]`, `clarification | null`, `traceAvailable`.
- Realtime: subscribe on mount when non-terminal to `run_events` INSERT `run_id=eq.{id}` and `runs` UPDATE `id=eq.{id}`; unsubscribe when terminal.
- Lazily per tab: `/runs/:id/attempts`, `/runs/:id/commands`, `/runs/:id/logs/:seq`, `/runs/:id/patch`, `/runs/:id/tests?phase=`.

**Layout (≥ 1280 px).** Header → outcome banner → step tracker → proof strip (full width) → tabs (left, flexible) + 320 px sidebar (right). Below 1280 px the sidebar cards move under the proof strip, above the tabs.

### Header

- Breadcrumb "Runs / {repo} / #{issue}".
- Title "#{issue} {issue title}" (links to the issue, external).
- Large status badge (`aria-live="polite"`).
- Meta: trigger sentence · started {relative} · duration (ticks each second while active) · model `{preset}/{model}` · cost · head SHA. Trigger sentences: label → "Started by @{login} with the `fixie` label"; comment → "Started by @{login} with `/fixie fix`"; dashboard → "Started by @{login} from the Hub"; revise → "Revision {k} requested by @{login}".
- Revision chain: "Revision of run {short id}" and/or "Later revisions: {k} ›".
- Live indicator (only while active): "Live" (slate pulsing dot); "Reconnecting…" (amber); "Refreshing every 5 s" (muted).

**Header actions.**

| Button | Shown when | Behaviour | Result |
| --- | --- | --- | --- |
| [Review PR #{n} on GitHub] (primary) | `pr` exists | External | — |
| [Cancel run] (secondary, danger text) | Non-terminal and user has write | Opens M-CANCEL | — |
| [Run again] | Terminal, outcome not `pr_opened`/`pr_updated`, no active run on the issue, no open Fixie PR, user has write, repo On | `POST /runs/:id/rerun` | Navigate to the new run; toast "Started a new run on #{n}."; errors as M-TRIGGER, shown as toasts |
| ⋯ | Always | "Copy run link" (toast "Link copied."), "View workflow run" (external), "View issue" (external), "Download trace" (when available), "Open in replay viewer" (P1), "Copy run id" | — |

### Outcome banner

| Status / outcome | Style | Copy | Buttons |
| --- | --- | --- | --- |
| `queued` (no ingest yet, dispatched) | Info | "Waiting for GitHub Actions to start the workflow. This usually takes under a minute." | [View workflow run] (when known) |
| `awaiting_info` | Warning | "Waiting for details. Fixie asked for {fields} on #{issue}. It stops on {expires date} if nobody replies." | [View the question] (external) |
| `awaiting_confirmation` (P1) | Warning | "Waiting for a 👍. Fixie asked the reporter to confirm what 'fixed' means before it changes code." | [View the question] |
| `pr_opened` | Success | "Draft PR #{n} is ready for review. The new test failed before the fix and passes after it, and no other test broke." | [Review on GitHub], [View diff] |
| `pr_updated` | Success | "Revision {k} pushed to PR #{n}. All checks pass again." | [Review on GitHub] |
| `could_not_reproduce` | Warning | "Fixie couldn't reproduce this bug after {reproAttempts} attempts, so it didn't try a fix. It posted what it tried on the issue." Tip: "Exact steps, versions and a stack trace usually help." | [View report] (external), [Run again] |
| `could_not_fix` | Warning | "Fixie reproduced the bug but no fix passed every check after {fixAttempts} attempts. The evidence below may still help." | [See evidence] (Evidence tab), [Run again] |
| `fix_plan` | Warning | "This looks bigger than one safe fix, so Fixie wrote a fix plan instead of a patch." | [View plan] (external), [See evidence] |
| `not_our_code` (P1) | Warning | "The cause looks outside this repository ({source}), so Fixie didn't change any code." | [View report] |
| `info_timeout` | Warning | "Nobody answered Fixie's question within 7 days, so the run stopped." | [Run again] |
| `environment_error` | Warning | "Fixie couldn't set up the project: {failureDetail}. Check the install and test commands." | [Open setup], [See logs] |
| `gate_violation` | Error | "Fixie stopped because a safety check failed: {gate friendly name}. No PR was opened." | [See checks] |
| `blocked_path` | Error | "Fixie stopped because the fix needed to edit `{path}`, which is blocked for this repository." | [See config] (→ SCR-08 check 4) |
| `budget_exceeded` | Error | "Run stopped: {limit name} was reached ({detail})." | [See config] |
| `infra_error` | Error | "The run hit an error in Fixie or GitHub Actions, not in your code: {failureDetail}." | [View workflow run], [Run again] |
| `cancelled` | Neutral | "Cancelled by @{login} {relative time}. The sandbox was deleted and nothing was pushed." | [Run again] |

### Step tracker

Eight steps, horizontal (vertical below 768 px). A step's state is the state of the latest attempt of its `run_step` values.

| # | Label | `run_step` values | Extra text |
| --- | --- | --- | --- |
| 1 | Understand issue | `bug_spec`, `triage` | "Waiting for reply" when `awaiting_info`; tier chip when known ("Tier 1") |
| 2 | Set up sandbox | `provision`, `install` | "Network locked" when the lock event arrives |
| 3 | Baseline tests | `baseline` | "{passed} passed, {failed} failing" |
| 4 | Reproduce | `reproduce`, `confirm_intent` | "Attempt {a} of {max}"; "Waiting for 👍" |
| 5 | Find the cause | `bisect`, `localize`, `hypothesize` | "Breaking commit `{sha7}`" when found |
| 6 | Fix and verify | `fix`, `verify`, `stress` | "Attempt {a} of {max}"; "{r} rolled back" when > 0 |
| 7 | Open PR / Write report | `explain`, `open_pr`, `report` | Label is "Write report" when the run ends without a PR; "Revision {k}" for revise runs |
| 8 | Clean up | `teardown` | — |

States: not started, running, passed, failed, skipped. When the repro is confirmed, step 4 shows a small signal-red dot (the bug, pinned); when `repro_passes_after` passes it fades as step 6 turns green (the proof moment, once per run). Clicking a step switches to Timeline and scrolls to its first event.

### Proof strip

Two cells joined by an arrow, plus a facts row. **Before fix:** "Failed", repro test id (mono), first line of the failure message. **After fix:** "Passed" with duration; until then a dashed outline "Waiting for a fix that passes". **Facts row** (each a chip, shown when known): "Full suite {bp} → {fp} passed · 0 new failures" · "Breaking commit `{sha7}`" (→ Evidence) · "Confidence {Level} ({score})" (tooltip lists reasons) · "{r} attempts rolled back". Hidden entirely until step 4 starts; for runs that never reproduce, the before cell shows "Not reproduced" (muted) and the after cell is hidden.

### Tab: Evidence (default when terminal)

Cards in this order:

1. **What Fixie understood** — Expected, Actual, Steps, Environment, Version, Last known good, Suspected files (from `bugSpec`); missing fields show "Not given".
2. **Diagnosis** (when present) — Markdown, HTML-escaped. After retention: "The diagnosis was deleted after {retentionDays} days."
3. **Breaking commit** — bisect strip: good commit ● … ✕ first bad commit, with step count; first bad commit card: SHA (link), message, author, date, files changed. Status texts: `no_good_commit` "Fixie couldn't find an earlier commit where the test passes."; `dependency_boundary` "The bug appears across a dependency change ({range}), so bisect stopped there."; `timeout` "Bisect stopped after {minutes} minutes."; `not_applicable` "Bisect didn't run: {reason}."
4. **Suspicious code** — top 5 regions: `path:line-range`, score bar (0–100), source chips ("Coverage", "Stack trace", "Breaking commit", "Search"), code snippet in the dark viewer with a heat gutter (line suspicion). "Changed by the fix" chip on regions the patch touched.
5. **Blast radius** (P1) — "{callers} callers in {files} files; {impacted} impacted tests ran first, {passed} passed." List of callers.
6. **Sandbox** — image, CPU and memory, "Network locked at {time}", egress probe "Blocked", commands run, total time.
7. **Model** — preset and model, calls by purpose (bug spec, repro test, hypotheses, patch, explain), tokens in/out, cost.

Empty (run still early): "Evidence appears here as Fixie works."

### Tab: Attempts

The hypothesis ledger: one card per hypothesis in order. Card: "Hypothesis {k}" + status chip (Accepted · Rejected · Abandoned · Trying · Proposed · Skipped), summary, collapsible rationale, files (mono). Under it, its attempts as rows: "Attempt {n}" · result ("Passed all checks" success · "Rolled back: {reason}" warning, e.g. "added 2 failing tests" · "No progress: same error as attempt {m}" muted · "Patch didn't apply" muted · "Failed check: {gate}" warning) · failing tests count · `+{a} −{d}` · short error signature (mono, 8 chars). [View diff] on the accepted attempt (opens Diff tab); on others only when the trace is available (opens a side panel with the checkpoint diff). Summary at the top: "{h} hypotheses · {a} attempts · {r} rolled back automatically". Empty: "No fix attempts yet."

### Tab: Timeline (default while active)

- Event feed grouped under step headings, time-ordered. Each event: level icon, time (hh:mm:ss), message. Kinds: `command.started/finished` → "Ran `{command}`" + exit chip + [View log]; `gate.evaluated` → "Check passed/failed: {gate friendly name}" + expandable evidence; `checkpoint.created` → "Checkpoint {n}: {result}"; `bisect.finished` → "Breaking commit found: `{sha7}`"; `comment.posted` → "Posted on #{issue}" + link; others → message. `log.line` events at `debug` level are hidden unless "Show debug events" (persisted in `localStorage`).
- Auto-scroll when within 80 px of the bottom; otherwise a pill "{n} new events ↓".
- **Live connection:** Realtime subscription; on channel error retry after 1, 2, 4, 8, 16, 30 s; after 3 consecutive failures poll `GET /runs/:id` and `GET /runs/:id/events?after={lastId}` every 5 s with indicator "Refreshing every 5 s", and retry Realtime every 60 s.
- Empty: "Fixie is reading the issue. Events appear here as it works."

### Tab: Logs

Command list (left, 320 px) + log viewer (right). Rows grouped by step: command (mono, truncated), exit chip ("0" success, "{code}" danger, "Timed out" warning, spinner "Running"), duration. `?cmd={seq}`; default selection = latest failed command, else latest. Viewer: fetch signed URL, then gzip text; virtualised; ANSI colours; line numbers; toolbar: search ("{i} of {n}", Enter/Shift+Enter), "Wrap lines", [Copy command], [Download log]. If `redactionCount > 0`: "{n} secrets were hidden from this log." States: running → "Output appears when this command finishes."; none → "No commands have run yet."; expired → "Logs are deleted after {retentionDays} days."; signed URL 403 → request a new URL once silently, then "Couldn't load this log." + [Try again]; > 50 MB → last 10,000 lines + "Showing the last 10,000 lines." + [Download log]; Hub reporting without log upload → "This run didn't upload logs. Open the workflow run on GitHub." + [View workflow run].

### Tab: Diff

Header "{files} files changed, +{added} −{removed}" and "Limit: {maxFiles} files, {maxLines} lines" (amber over 80%). Unified/Split toggle (`localStorage`). File list with badges: "Repro test" (new test file), "Existing test changed" (warning), "New file". `react-diff-view`; files over 400 changed lines collapsed with [Show file]. States: before step 6 → "The fix appears here once Fixie writes a patch."; no patch → "No patch. The run ended at {step label}."; expired → "The patch was deleted after {retentionDays} days. It is still on the PR branch if a PR was opened."; error → "Couldn't load the diff." + [Try again].

### Tab: Tests & checks

- **Checks** (always all nine, in order): "Repro test fails on the current code" · "Repro test passes after the fix" · "No test that passed before now fails" · "No new lint errors" · "No new type errors" · "Diff is within size limits" · "No blocked paths touched" · "Existing tests not weakened" · "No secrets in the patch or messages". Each: Passed / Failed / Not run yet / "Passed (not configured)" for lint and type, attempt number, expandable evidence as a readable list with [Show raw].
- **Repro proof** at top once both repro gates exist: "`{repro test id}`: failed before the fix → passed after the fix" + the failure message.
- **Test results** with phase tabs Baseline · Repro before · Repro after · Final · Stress (P1): Test id, Outcome, Duration, Failure message (expandable); repro test pinned with a "Repro" badge; on Final, "Only tests that changed since baseline" toggle (on by default); search by id. Empty phase: "This phase hasn't run."

### Sidebar cards

| Card | Content and states |
| --- | --- |
| Pull request | None: "A draft PR opens only after all nine checks pass." Opened: "#{n}" (external), state chip, branch `fixie/issue-{n}` + copy, "Revisions: {count}", then "To ask for changes, comment on the PR:" + `/fixie revise <what to change>` + copy. Merged: "Merged by @{login} {date}". Closed: "Closed without merging {date}". |
| Issue and trigger | Issue link, reporter, labels (as GitHub-style chips), trigger sentence, workflow run link |
| Cost and model | Model, calls, tokens, cost; if a cap exists: "This month for {org}: ${spend} of ${cap}" bar |
| Settings used | Collapsed list from `effectiveConfig` (limits, blocked paths, bisect, features) + "Values in effect when the run started." |
| Trace | "fixie-trace-{runId}.zip" + [Download from GitHub] (external, workflow run artifacts) or [Download] (Hub-stored); [Open in replay viewer] (P1) |
| Was this helpful? (P1) | Only with a PR: thumbs up/down → `PUT /prs/:id/feedback`; second click on the same thumb clears (`DELETE`); optional comment (≤ 1000 chars) + [Send]; toast "Thanks for the feedback." Anchor `#feedback`. |

### M-CANCEL Cancel this run

Title "Cancel this run?" Body "Fixie stops the workflow run, deletes the sandbox and pushes nothing. You can start a new run on #{issue} afterwards." [Keep running], [Cancel run] (red) → `POST /runs/:id/cancel`. Header button shows "Cancelling…" (disabled) until status becomes `cancelled` (Realtime or polling). Success toast "Run cancelled." 409 `run_already_finished` → toast "This run already finished." + refetch. Audit `run.cancelled`.

### Access

Unknown run, another installation's run, or a repo the user can't read → 404.

## 11. Overview

The Overview answers a lead's questions at a glance: is Fixie producing merged fixes, how good is the evidence, what does it cost, and what needs attention now.

### SCR-05 Overview — `/o/{org}/overview`

**Data.** `GET /metrics?installationId=&from=&to=`; `GET /runs?status=active` (5); `GET /repos` (cached); `GET /runs?status=needs_info` (5); `GET /runs?status=failed&from={7 days ago}` (5).

**Title row.** "Overview" + period selector (This month · Last 30 days · Last 90 days; `?period=`).

**KPI tiles** (one surface, 4 × 2 on desktop, 2 per row on mobile; each has an info icon with the definition).

| Tile | Value | Definition |
| --- | --- | --- |
| Merged PRs | Count, with "{n} this week" | "Fixie pull requests merged by a person." |
| Runs | Count | "Every run, including revisions." |
| Reproduction rate | % | "Runs with a confirmed failing repro test ÷ runs that got past setup." |
| Fix rate | % | "Runs that opened a PR passing all nine checks ÷ reproduced runs." |
| Merge rate | % | "PRs merged ÷ PRs opened." |
| Median time to PR | Duration | "From trigger to draft PR, median." |
| Breaking commits found | Count + "{pct}% of bisected runs" | "Runs where git bisect named the first bad commit." |
| Model spend | "$0.00" + "Free models" when all runs used free presets; else "${spend}" (+ " of ${cap}" with bar when a cap is set) | "Model cost this calendar month." |

**Charts** (P1; each with a reading title, an empty state, and a screen-reader table): "Runs by outcome, per week" (stacked bars: PR ready, Not fixed, Failed, Cancelled) · "Median time to PR, per week" (line) · "Fix rate by model" (horizontal bars per `{preset}/{model}` with run counts).

**Lists.**

| Card | Rows | Row click | Empty |
| --- | --- | --- | --- |
| Active now | Up to 5 active runs: issue, repo, live badge + step, duration | SCR-10 | "Nothing running right now." |
| Needs attention | Up to 8 in this order: repos On but a check now fails ("Setup needs attention on {repo}"), repos with an invalid `.fixie.yml`, runs waiting for info ("#{n} is waiting for the reporter"), runs failed in the last 7 days ("#{n}: {outcome label}") | Repo → SCR-08; run → SCR-10 | "All clear." with the butterfly motif |

Footer links: "View all runs" → SCR-09; "View repositories" → SCR-06.

**States.** Cards load independently with skeletons. First use (no runs ever): tiles show "—"; charts replaced by one card "Your first fix starts with a label" with steps "1. Set up a repository. 2. Add the `fixie` label to a reproducible bug. 3. Review the draft PR." and buttons [Set up a repository] (admin) and [Fix an issue] (if allowed). Period with no data: "No runs in this period." Card error: "Couldn't load this." + [Retry]. Active-now refetches every 10 s while visible (Realtime when available).

## 12. Installation settings

### SCR-11 Settings — `/o/{org}/settings` (General)

**Access.** Admin. **Data.** `GET /installations/:id/settings` (with `version`) + this month's spend.

| Card | Field | Control | Stored as | Default | Validation |
| --- | --- | --- | --- | --- | --- |
| Starting runs | Allow starting runs from this Hub | Toggle | `allow_dashboard_runs` | On | — |
| Model spend | Limit spend on paid models | Toggle; when on, amount input (USD) | `monthly_spend_cap_usd` (null = no cap) | Off | ≥ 1, ≤ 10,000, max 2 decimals ("Enter an amount like 25 or 25.50.") |
| Model spend | Alert at | Number + "%" (shown when capped) | `spend_alert_pct` | 80 | 1–100 |
| Data | Keep logs and diagnoses for | Select 7 / 14 / 30 / 60 / 90 days | `retention_days` | 30 | — |
| Safety | Require a branch ruleset with human approval | Toggle locked on with lock icon | `require_ruleset` | On | Tooltip: "Always on in Fixie v1. Fixie can't merge, and the ruleset makes sure a person approves every fix." |

The spend card shows "Spent this month: ${spend}" and "Resets on {first of next month}", and the note "Free models (GitHub Models, Ollama and free tiers) always cost $0.00."

**Save bar** (sticky bottom, when dirty): "You have unsaved changes" + [Discard] + [Save changes] (disabled while invalid). `PATCH /installations/:id/settings` with changed fields + `version`. Pre-save confirm when a new cap ≤ this month's spend: "This month's spend (${spend}) is already above ${newCap}. Runs that use paid models will be blocked until {first of next month}. Save anyway?" [Cancel] [Save]. Success toast "Settings saved."; audit `settings.updated` with before/after. 422 → field errors; 409 `version_conflict` → M-CONFLICT; other → toast "Couldn't save settings. Try again." (edits kept). Leaving while dirty → M-DISCARD (in-app) or the browser's `beforeunload` prompt.

**M-CONFLICT.** "These settings changed" / "{actor} saved changes {relative time} while you were editing." [Keep my edits] (closes; next save overwrites using the new `version`) · [Load their version] (discard and reload).
**M-DISCARD.** "Discard unsaved changes?" [Keep editing] · [Discard] (red; continues navigation).

### Members tab (P1) — `/o/{org}/settings/members`

Note: "Roles come from GitHub. Organization owners are admins here." Table: avatar, login, role chip, last sign-in. Row action "Sign out everywhere" (hidden on own row) → M-REVOKE: "Sign @{login} out of Fixie Hub on every device? They can sign in again if they still have access on GitHub." [Cancel] [Sign out] → toast "@{login} was signed out."; audit `session.revoked`.

## 13. Audit log, account and replay

### SCR-12 Audit log (P1) — `/o/{org}/audit`

`GET /audit?installationId=&actorType=&area=&cursor=` (50 per page). Filters: Actor (All, People, GitHub users, Fixie engine, System) and Area (All, Repositories `repo.`, Settings `settings.`, Runs `run.`, Pull requests `pr.`, Sessions `session.`, Safety `incident.`). Columns: Time (absolute) · Actor (avatar/icon + label + type chip) · Action (friendly label + raw code in small mono) · Target (link when resolvable) · Details (expand: `settings.updated` as "{field}: {old} → {new}", else key–value pairs; [Show raw]).

Friendly labels: `repo.enabled` "Turned on Fixie in the Hub" · `repo.disabled` "Turned off Fixie in the Hub" · `settings.updated` "Changed settings" · `run.dispatched` "Started a run from the Hub" · `run.rerun` "Ran again" · `run.cancelled` "Cancelled a run" · `pr.opened` "Opened a pull request" · `session.created` "Signed in" · `session.revoked` "Signed out a session" · `incident.raised` "Safety incident" · `installation.paused` "Paused new runs". Unknown codes: dots → spaces, first letter capitalised.

States: 10 skeleton rows; "No activity yet."; "No activity matches these filters." + [Clear filters]; "Couldn't load the audit log." + [Try again]; [Load more]; footer "Audit entries are kept for 1 year."

### SCR-13 Account — `/account`

- **Profile:** avatar, login, name, email (read-only from GitHub) + "Edit your profile on GitHub" (external).
- **Installations:** each with avatar, org, role chip, [Open]; footer "Install Fixie Hub on another account" (external).
- **Sessions (P1):** rows "Chrome on macOS", IP, signed in, last active, "This device" chip. "Sign out" on another row → `DELETE /me/sessions/:id` (no confirm) → toast "Session signed out." [Sign out of all other sessions] (when > 1) → M-REVOKE "Sign out of every other device?" → `POST /me/sessions/revoke-others` → toast "Signed out of {n} other sessions." "Sign out" on the current row = normal sign-out. Note: "Signed-out devices may keep access for up to one hour until their token expires."
- **Danger zone (P1):** [Delete my Fixie Hub account] → M-DELETE-ACCOUNT: "This deletes your Fixie Hub sign-in, memberships and sessions and anonymises your name. Runs you started stay in your organization's history. Your GitHub account and repositories are not affected." Input "Type your GitHub username to confirm" (case-insensitive match). [Cancel] [Delete account] (red, disabled until match) → `DELETE /me` → `/?error=account_deleted`.

States: per-card skeletons; per-card error with [Retry].

### SCR-14 Replay a trace (P1) — `/replay`

**Access.** Public (no shell when signed out; shell when signed in). **Purpose:** open any `fixie-trace-*.zip` and see it exactly like Run detail, entirely in the browser.

**Layout.** Title "Replay a Fixie run"; drop zone "Drop a fixie-trace zip here" + [Choose file]; note "Your file stays in this browser. Nothing is uploaded." When `?runId=` is present and the user can read the run, the Hub-stored trace loads automatically.

**After loading.** A banner "Replaying {repo} #{issue} from {date} · Fixie {fixieVersion} · trace v{traceVersion}" + [Open another]. Then the Run detail layout (header, banner, tracker, proof strip, all tabs) in read-only mode (no actions). A playback bar under the tracker: [Play]/[Pause], speed 1× / 4× / 16×, a scrubber over event time, "Jump to end". Playing replays events into the Timeline and tracker in time order (the proof moment plays once when reached).

**Errors.** "That file isn't a zip." · "This zip has no `manifest.json`, so it isn't a Fixie trace." · "This trace was made by a newer Fixie (trace v{n}). Update the Hub to open it." · "Files over 100 MB can't be opened here. Use `fixie replay` instead." · "Some parts of this trace are damaged: {list}. Showing what we could read." (warning banner).

## 14. GitHub-side and CLI flows

Most users meet Fixie on GitHub. All text below is fixed template copy (TRD §5.5): model text is Markdown-escaped, links point only to the repo, its workflow runs or the configured Hub, and no @-mention appears unless the template names one. `{hubLink}` renders as " · [Live view]({hub run url})" only when the run reports to a Hub.

### GH-01 Gating replies

The workflow `if:` filters events; the engine then checks in order. Only the first failing rule replies, at most once per issue per 24 h (tracked in the status-comment marker).

| Check fails | Reply on the issue |
| --- | --- |
| Actor lacks write | "Only people with write access to this repository can start Fixie." |
| Issue closed | "This issue is closed. Reopen it and add the `fixie` label again to run Fixie." |
| Trigger on a pull request (not `/fixie revise`) | No reply (ignored) |
| A run is active | "Fixie is already working on this issue: [workflow run]({url})." |
| Open Fixie PR exists | "Fixie already opened #{pr} for this issue. Comment `/fixie revise <what to change>` there, or close it to start over." |
| Ruleset not `ok` | "Fixie needs a branch ruleset on `{defaultBranch}` that requires at least one approval and approval of the most recent push before it can open pull requests. [How to set it up](https://github.com/Agent-X-Hackathon-2026-Team-MisfitMinds/demo-repository#ruleset)" |
| `.fixie.yml` invalid | "`.fixie.yml` has problems, so Fixie didn't start:\n{bulleted path: message}" |
| Hub says paused / spend cap / incident | "Fixie can't start new runs for {org} right now: {reason}. An admin can see why in Fixie Hub." |
| Actions can't create PRs (detected at `open_pr`) | "I found a fix, but GitHub Actions isn't allowed to open pull requests in this repository. An admin can turn on 'Allow GitHub Actions to create and approve pull requests' in Settings → Actions → General. The tested patch is in the [workflow run]({url}) artifacts." |

### GH-02 Status comment (one per run, edited in place)

```markdown
**Fixie is on it.** I'm reproducing this bug in a locked sandbox before I try a fix.

Status: {step label} · [Workflow run]({workflow run url}){hubLink}

<sub>Fixie opens a draft pull request only if a new test fails before the fix, passes after it, and every check passes. A person always merges.</sub>
<!-- fixie:state {json} -->
```

The status line is updated at each step change. When the run ends it becomes one of: "Draft PR ready: #{n}" · "Couldn't reproduce — see the report below" · "Couldn't find a fix that passes every check — see the report below" · "Wrote a fix plan instead of a patch — see below" · "Stopped: {outcome label}" · "Cancelled" · "Stopped: no reply within 7 days. Add the `fixie` label again once the details are here."

### GH-03 Clarification

```markdown
@{reporter} before I start, I need a few details:

- {question per missing field}

Reply on this issue and I'll continue automatically. If there's no reply by {expires date}, I'll stop.
```

Questions: `actual` "What happened instead? Please paste the error or stack trace." · `repro_steps` "What are the exact steps to reproduce it?" · `expected` "What did you expect to happen?" · `version` "Which version are you using?" · `environment` "Which OS, Python/Node version and relevant package versions?" Labels: add `fixie:needs-info`, remove `fixie:working`. A reply by the reporter or a writer resumes (status returns to "Understand issue").

### GH-04 Reports (new comment, so watchers are notified)

**Couldn't reproduce:**

```markdown
**I couldn't reproduce this bug** after {k} attempts, so I didn't try a fix.

What I tried:
- {one line per attempt: the test and why it passed or errored}

Code I'd look at first:
- `{path}:{lines}` — {sources, e.g. "stack trace, search"}

Steps, versions or a stack trace would help. [Workflow run]({url}){hubLink}
```

**Couldn't fix:** heading "**I reproduced this bug but couldn't find a fix that passes every check.**", then "Reproduction: `{test id}` fails with: {first failure line}", "Breaking commit: `{sha7}` {message} (found by git bisect)" when found, "Most likely cause:" (diagnosis summary), "What I tried:" (one line per hypothesis with its result), "Code I'd look at first:" (top 5), and the links line. Label `fixie:not-fixed`.

**Fix plan (Tier 3):** heading "**This looks bigger than one safe fix, so here's a plan instead of a patch.**", then "Root cause:", "Affected modules:", "Suggested steps (each small enough for Fixie or a person):" numbered, links line.

**Couldn't set up the project (`environment_error`):** heading "**I couldn't install or run this project's tests**, so I stopped before trying a fix.", "Command: `{command}` exited with {code}", last 20 log lines in a fenced block (redacted), "You can set `project.install` and `project.test` in `.fixie.yml`.", links line.

**Not our code (P1):** heading "**The cause looks outside this repository**: {dependency `name` changed from x to y | the external API response no longer matches | the environment}. I didn't change any code.", evidence bullets, links line.

### GH-05 Draft pull request

Branch `fixie/issue-{n}` (one GitHub-signed commit via the Git Data API), base = default branch, **draft**, title "Fix #{n}: {issue title ≤ 72 chars}". Body (under 400 words excluding tables):

```markdown
Fixes #{n}

> [!NOTE]
> Draft opened by Fixie. A person must review, mark it ready and merge.

## Proof Card
| Check | Result |
| --- | --- |
| Reproduction | `{repro test id}` (new) **failed** before the fix → **passed** after |
| Full suite | {bp} passed, {bf} failing → {fp} passed, {ff} failing · **0 newly failing** |
| Breaking commit | [`{sha7}`]({commit url}) {message ≤ 60} by @{author}, found by git bisect in {steps} steps |
| Fix attempts | {h} hypotheses, {a} attempts, {r} rolled back automatically |
| Checks | 9 of 9 passed · lint: {clean \| not configured} · type-check: {clean \| not configured} |
| Sandbox | `{image}` · network locked after install |
| Confidence | **{High \| Medium \| Low}** ({score}/100): {top 2 reasons} |
| Model | `{preset}/{model}` · {calls} calls · {cost} |

## Summary
{1–3 sentences}

## Root cause
{diagnosis summary with `file:line` references}

## Changes
- `{file}`: {what changed and why}

## Risk
{risk notes}

---
[Workflow run]({url}) · [Trace]({artifact url}){hubLink} · To ask for changes, comment `/fixie revise <what to change>`.
<!-- fixie:pr {json} -->
```

Rows are omitted when their data doesn't exist (e.g. no bisect → "Breaking commit | Not searched: {reason}"). Low confidence adds the `fixie:low-confidence` label and the line "> [!WARNING]\n> Low confidence: {reasons}. Review carefully." under the note. The issue gets `fixie:pr-ready`; the status comment links the PR. Inline review comments on non-obvious lines (P1).

### GH-06 Revise loop (P1)

Input: a comment starting `/fixie revise` on a Fixie PR.

| Case | Reply on the PR |
| --- | --- |
| Actor lacks write | "Only people with write access can request a revision." |
| No feedback text | "Tell me what to change, for example: `/fixie revise also handle negative numbers`." |
| PR closed or merged | "This pull request is {closed \| merged}, so I won't revise it. Start a new run on the issue instead." |
| Revision already running | "I'm already working on revision {k}: [workflow run]({url})." |
| Accepted | "Working on revision {k}. [Workflow run]({url}){hubLink}" |
| Succeeded | New commit on the branch; PR body gets "## Revision {k}" above the footer; reply "Pushed revision {k}: {one-line summary}. All checks pass. [Evidence]({url})" |
| Failed | "I couldn't complete revision {k}: {outcome label}. The PR still has revision {k−1}. [Details]({url})" |

### GH-07 PR lifecycle (Hub only, read)

`pull_request.ready_for_review`, `pull_request_review.submitted`, `pull_request.closed` update the Hub's PR card and metrics. A merge by a bot or app account raises `app_merge`, pauses the installation, and shows the paused banner.

### GH-08 Intent lock (P1)

```markdown
Before I change any code, please confirm this is the behaviour you expect. My test checks:

> {assertion in plain English}

React with 👍 or reply `/fixie confirm` to continue, or reply `/fixie reject <what's wrong>` and I'll rewrite the test.
```

Fixie polls for 👍 (reporter or writer) for 15 minutes in-job; after that the run waits as `awaiting_confirmation` and `/fixie confirm` resumes it.

### GH-09 Labels

| Label | Added | Removed |
| --- | --- | --- |
| `fixie` | By people (trigger) | By Fixie when a run starts |
| `fixie:working` | Run starts or resumes | Run ends or waits |
| `fixie:needs-info` | Clarification asked | Reply resumes, or timeout |
| `fixie:pr-ready` | PR opened | Never by Fixie |
| `fixie:not-fixed` | Report posted | Next run starts |
| `fixie:low-confidence` (PR) | Low confidence | Never by Fixie |

Colours: `fixie` `#030B18`, `fixie:working` `#313E60`, `fixie:needs-info` `#8A5200`, `fixie:pr-ready` `#2E6B4F`, `fixie:not-fixed` `#8A5200`, `fixie:low-confidence` `#C8002A`. Missing labels are created on first use.

### GH-10 Job summary

Every run writes `$GITHUB_STEP_SUMMARY`: title "Fixie run for #{n}: {outcome label}", the Proof Card table (or the report), the attempts table (hypothesis · attempt · result), and links to the PR, issue and Hub.

### CLI flows

**CLI-01 `fixie init`.** Prompts (or flags): model preset (default GitHub Models), report to a Hub (URL or skip), write an issue template (y/N, P1). Writes `.github/workflows/fixie.yml`, `.fixie.yml` (commented defaults), optional `.github/ISSUE_TEMPLATE/fixie-bug.yml`. Output ends with the three manual steps: "1. Commit and push these files. 2. Turn on 'Allow GitHub Actions to create and approve pull requests'. 3. Add a branch ruleset requiring 1 approval and approval of the most recent push." Existing files → "`{path}` exists. Re-run with `--force` to overwrite." (exit 1).

**CLI-02 `fixie doctor`** (P1 locally; in Actions via the Hub). Checks with ✓/✗/! and one-line fixes: Node version, Docker running, git, workflow file, `.fixie.yml` validity, test framework detection, model connectivity (one tiny completion), Ollama context length (≥ 16384), ruleset (needs `GITHUB_TOKEN`). Exit code = number of ✗.

**CLI-03 `fixie run --issue <url|n> [--repo <path>] [--model <preset/model>] [--offline] [--publish]`.** Prints the eight steps live with timings, attempt lines ("Attempt 2 · rolled back: added 1 failing test"), then the Proof Card as a terminal table and the path of the trace. Without `--publish` it ends with "Nothing was posted to GitHub. Patch: {path}/patch.diff". `--offline` with a non-local model → "Offline mode needs a local model (ollama/… or openai-compatible on localhost)." (exit 2).

**CLI-04 `fixie replay <trace.zip> [--speed 4]`.** Replays events in the terminal; `--json` prints the manifest and Proof Card.

**CLI-05 `fixie sweep`.** Used by the scheduled job; prints each expired clarification and repaired status comment.

## 15. Run states and how the UI shows them

The UI derives state only from `runs.status`, `runs.outcome` and `run_steps`.

**Status badge** (one component everywhere).

| `status` | Label | Colour | Icon | Actions |
| --- | --- | --- | --- | --- |
| `queued` | "Queued", "Starting on GitHub" (dispatched, no ingest), or "Understanding issue" (step 1 running) | Info | Clock / spinner | Cancel |
| `awaiting_info` | "Needs info" | Warning | Speech bubble | Cancel |
| `awaiting_confirmation` | "Needs a 👍" | Warning | Speech bubble | Cancel |
| `provisioning` | "Setting up" | Info | Spinner | Cancel |
| `baseline` | "Running baseline" | Info | Spinner | Cancel |
| `reproducing` | "Reproducing" | Info | Spinner | Cancel |
| `diagnosing` | "Finding the cause" | Info | Spinner | Cancel |
| `fixing` | "Fixing" | Info | Spinner | Cancel |
| `verifying` | "Verifying" | Info | Spinner | Cancel |
| `opening_pr` | "Opening PR" | Info | Spinner | Cancel |
| `succeeded` | Outcome label | Success | Check | — |
| `failed` | Outcome label | Warning or danger (below) | Warning / cross | Run again |
| `cancelled` | "Cancelled" | Neutral | Slash | Run again |

**Outcome labels.**

| `outcome` | Label | Colour | Filter group |
| --- | --- | --- | --- |
| `pr_opened` | "PR ready" | Success | PR ready |
| `pr_updated` | "PR updated" | Success | PR ready |
| `could_not_reproduce` | "Couldn't reproduce" | Warning | Not fixed |
| `could_not_fix` | "Couldn't fix" | Warning | Not fixed |
| `fix_plan` | "Fix plan" | Warning | Not fixed |
| `not_our_code` | "Not our code" | Warning | Not fixed |
| `info_timeout` | "No reply" | Warning | Not fixed |
| `environment_error` | "Setup failed" | Warning | Not fixed |
| `gate_violation` | "Check failed" | Danger | Failed |
| `blocked_path` | "Blocked path" | Danger | Failed |
| `budget_exceeded` | "Limit reached" | Danger | Failed |
| `infra_error` | "System error" | Danger | Failed |
| `cancelled` | "Cancelled" | Neutral | Cancelled |

**Gate friendly names** are the nine check labels in §10 Tests & checks. **PR chips:** `draft` "Draft" (neutral) · `open` "Open" (success outline) · `merged` "Merged" (success fill) · `closed` "Closed" (danger outline); `reverted_at` adds "Reverted" (danger). **Hypothesis chips:** Accepted (success) · Rejected (warning) · Abandoned (neutral) · Trying (info, spinner) · Proposed (neutral) · Skipped (neutral). **Step states:** running spinner · passed check · failed cross · skipped dash · not started empty circle.

## 16. Global state catalog

One handler maps problem `type` to UI; screens override only where stated.

| `type` | HTTP | Default UI | Copy |
| --- | --- | --- | --- |
| `unauthenticated` | 401 | Redirect to sign-in | "Your session expired. Sign in again to continue." |
| `csrf_invalid` | 403 | Error toast with [Refresh] | "This request came from another site or tab. Refresh the page and try again." |
| `forbidden` | 403 | Page → 403 page; action → toast, refetch `GET /me` | "You don't have permission to do that." |
| `not_found` | 404 | Page → 404; action → toast | "That no longer exists." |
| `validation_failed` | 422 | Inline field errors from `errors[{field, message}]` | Server message per field |
| `version_conflict` | 409 | M-CONFLICT | §12 |
| `setup_incomplete` | 422 | M-ENABLE "Finish setup first" | §8 |
| `workflow_missing` | 409 | Toast / modal banner | "Add the Fixie workflow to this repository first." |
| `run_already_active` | 409 | Inline/toast with link | "Fixie is already working on #{n}." |
| `run_already_finished` | 409 | Toast + refetch | "This run already finished." |
| `pr_already_open` | 409 | Inline/toast with link | "Fixie already opened PR #{pr} for #{n}." |
| `issue_not_found` | 404 | Inline in M-TRIGGER | "Issue #{n} doesn't exist in {repo}." |
| `issue_closed` | 422 | Inline | "Issue #{n} is closed. Reopen it on GitHub to run Fixie." |
| `issue_is_pull_request` | 422 | Inline | "#{n} is a pull request, not an issue." |
| `repo_not_enabled` | 409 | Toast | "Fixie is off for {repo} in this Hub." |
| `dashboard_triggers_off` | 409 | Toast | "Starting runs from the Hub is turned off for {org}." |
| `installation_paused` | 409 | Toast + banner | "New runs are paused for {org}." |
| `installation_suspended` | 409 | Toast + banner | "Fixie Hub is suspended on GitHub for {org}." |
| `spend_cap_reached` | 409 | Toast + banner | "Model spend cap reached. Paid-model runs resume on {date}." |
| `github_dispatch_failed` | 502 | Inline/toast | "GitHub didn't start the workflow: {detail}." |
| `rate_limited` | 429 | Toast; button disabled for `Retry-After` | "Too many requests. Try again in {n} seconds." |
| `github_unavailable` | 502 | Toast | "GitHub didn't respond. Try again in a minute." |
| `internal` | 500 | Page → 500; action → toast with id | "Something went wrong on our side. Reference: {requestId}." |
| Network failure | — | Toast; reads retry 3× | "Can't reach Fixie Hub. Check your connection." |

Unknown types fall back by status (4xx → toast with problem `title`; 5xx → `internal`).

**Success toasts.** Start: "Fixie started on #{n}." / "Started a new run on #{n}." · Doctor: "Doctor started." · Cancel: "Run cancelled." · Repo on/off: "Fixie is on for {repo} in this Hub." / "Fixie is off for {repo} in this Hub." · Checks: "Checks updated." · Settings: "Settings saved." · Sessions: "Session signed out." / "Signed out of {n} other sessions." / "@{login} was signed out." · Feedback: "Thanks for the feedback." · Copy: "Copied." ("Link copied." for run links).

**Empty-state index.** SCR-03 "Connect Fixie Hub to GitHub" · SCR-05 "Your first fix starts with a label" / "Nothing running right now." / "All clear." · SCR-06 "No repositories shared with Fixie Hub yet" / "No repositories match these filters." · SCR-07 "No runs yet." · SCR-09 "No runs yet" / "No runs match these filters." · SCR-10 tabs per §10 · SCR-12 "No activity yet." · SCR-14 drop zone.

**Data that expires.** Logs, patches, traces in Storage and code-bearing columns (diagnosis, event messages, commands, failure messages, suspicious snippets) after `retention_days`: show the expiry message, never a broken viewer. Runs older than 13 months are deleted (404).

## 17. Journeys and build checklist

**J1 — Action only, no Hub (US-01, US-02, US-06, US-09).** `fixie init` → commit → turn on Actions-PR setting → add ruleset → label a seeded bug `fixie` → GH-02 within 60 s → GH-05 draft PR with Proof Card → a person approves (last-push approval satisfied) and merges.

**J2 — Hub onboarding (US-14).** SCR-01 → GitHub → SCR-03 → install App (select repos) → SCR-04 → SCR-06 welcome → SCR-08: [Add workflow on GitHub] with the builder → commit on GitHub → [Check again] → check 2 and 3 fixed via external links → all pass → M-ENABLE → On.

**J3 — Live fix (US-15).** Label on GitHub → SCR-10 updates live through all steps; bisect names the seeded commit; proof moment plays; banner "Draft PR #{n} is ready" → reviewer merges → PR card shows Merged; SCR-05 Merged PRs increments.

**J4 — Vague issue (US-04).** Label → GH-03 → SCR-10 "Needs info" with expiry → reporter replies → run resumes from "Understand issue" with the same run id.

**J5 — Can't reproduce (US-11).** Run ends `could_not_reproduce` → GH-04 → amber banner → reporter adds a stack trace → member clicks [Run again].

**J6 — Dashboard trigger and cancel (US-16).** SCR-09 [Fix an issue] → issue URL → SCR-10 "Starting on GitHub" → steps begin → [Cancel run] → M-CANCEL → "Cancelling…" → Cancelled banner; GH-02 "Cancelled".

**J7 — Rollback (US-10).** A seeded bug where the obvious patch breaks another test → Attempts tab shows attempt 1 "Rolled back: added 1 failing test", hypothesis switch, attempt 3 accepted → Proof Card "1 rolled back automatically".

**J8 — Offline (US-12).** Laptop with Wi-Fi off after `ollama pull`: `fixie run --issue <n> --model ollama/<model> --offline` → patch and Proof Card in the terminal; nothing posted.

**J9 — Replay (US-19, P1).** Download the trace from J3 → `/replay` → drop → playback at 4× reproduces the run detail.

**J10 — Revise (US-17, P1).** `/fixie revise also handle empty strings` → GH-06 → child run → `pr_updated` → new commit within 15 min.

**Build checklist.**

- [ ] Canonical names from `00_START_HERE.md` §4 everywhere (labels, commands, branch, files, enums).
- [ ] Shell: switcher, sidebar role gating, live-runs indicator, all banners, toasts, modals, skeletons, error pages.
- [ ] Sign-in with safe `next`, all 7 messages, 401 redirect with draft restore.
- [ ] Onboarding: install, request and timeout paths.
- [ ] Repos list: filters, setup and ruleset columns, toggle rules, language hint.
- [ ] Setup page: six checks with every fail body, workflow builder (all model options, Hub toggle, long-URL fallback), effective config table, doctor, M-ENABLE/M-DISABLE, automatic turn-off.
- [ ] Runs list: filters, evidence and model columns, Realtime + fallback refresh, keyset load-more, all states.
- [ ] M-TRIGGER: number, `#n` and URL parsing; every response row.
- [ ] Run detail: Realtime with backoff and polling fallback (< 2 s), 8-step tracker, proof strip and proof moment, all outcome banners, six tabs with empty and expired states, sidebar cards, M-CANCEL.
- [ ] Badges, outcome labels, PR and hypothesis chips match §15 exactly.
- [ ] Overview tiles with the "—" rule and free-model spend copy; charts (P1) with screen-reader tables.
- [ ] Settings: spend cap, retention, dashboard toggle, locked ruleset toggle, save bar, conflict and discard.
- [ ] GH-01…GH-10 verbatim; one status comment edited in place; gating replies ≤ once per issue per 24 h.
- [ ] CLI-01…CLI-05 output strings.
- [ ] FE-01…FE-05 (TRD §9).
