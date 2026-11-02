# Fixie — Product Requirements Document (v2.0)

Oct 31, 2026 · @Mahajan Sarthak Dileep · Team MisfitMinds · Agent X Hackathon 2026 · Status: Build-ready · Supersedes "PRD — PatchPilot v1.0" · Vocabulary and decisions: `00_START_HERE.md`

## 1. Webapp overview

Fixie is a free, open-source bug-fix agent for GitHub repositories. Label an issue `fixie` and Fixie reproduces the bug in a locked sandbox, proves it with a test that fails, finds the commit that broke it, writes the smallest fix that passes nine deterministic checks, and opens a **draft** pull request with a **Proof Card**. A person always reviews and merges. When Fixie can't fix a bug safely, it still posts a diagnosis (reproduction, suspicious lines, breaking commit) that saves the maintainer an hour.

**Vision.** Every well-described bug reaches a maintainer with a working reproduction, a root cause and a verified fix already attached, and it costs nothing to get there. Fixie wins not by claiming to fix everything, but by knowing what kind of bug it faces, using the right strategy, never spiralling, and always leaving evidence a reviewer can trust.

**The product has three surfaces, one engine.**

| Surface | Who uses it | What it does | Required |
| --- | --- | --- | --- |
| **Fixie Action** (`.github/workflows/fixie.yml`) | Repo maintainers | Runs the engine on the repo's own GitHub Actions runner when an issue is labelled `fixie`, someone comments `/fixie fix`, or the Hub dispatches a run | Yes, or the CLI |
| **Fixie CLI** (`fixie`) | Individual developers, self-hosters, offline users | `fixie init` writes the workflow and config; `fixie doctor` checks setup; `fixie run` fixes an issue locally with Docker and Ollama (fully offline); `fixie replay` opens a trace | Optional |
| **Fixie Hub** (the webapp) | Teams, leads, reviewers, hackathon judges | Sign in with GitHub, one-page setup checker per repo, live run view with all evidence, start and cancel runs, Proof Cards, metrics, trace replay | Optional, free, self-hostable on Vercel + Supabase free tiers |

**How a run works.**

1. A person with write access labels an issue `fixie`, comments `/fixie fix`, or clicks **Fix an issue** in the Hub.
2. Fixie posts one status comment on the issue and keeps editing it as it works.
3. It turns the issue into a structured bug spec. If the actual behaviour, or both the steps and the expected behaviour, are missing, it asks once and pauses until someone replies.
4. It starts a Docker sandbox on the runner, installs dependencies with network on, then **cuts the network**. No token or key ever enters the sandbox.
5. It runs the full test suite to record a baseline.
6. It writes a reproduction test. **No failing repro means no fix**: after three attempts it stops and posts a diagnosis instead.
7. It finds the cause with tools, not guesses: `git bisect` over dependency-stable commits, coverage-based fault localisation, and the stack trace.
8. It writes a hypothesis and the smallest patch, checkpoints it, and runs the gates. Anything that adds failures is rolled back automatically; the same error twice ends that hypothesis; after two failures it tries alternative hypotheses.
9. When all nine gates pass, it opens a draft PR on `fixie/issue-<n>` with a Proof Card. Reviewers can ask for changes with `/fixie revise`.
10. A person approves and merges on GitHub. Fixie cannot merge, approve or mark its PR ready.

**Guiding principles.** Prove before you patch. Tools think, the model writes. Never spiral: every attempt is a checkpoint, and worse means revert. Smallest correct diff. Evidence over logs. A person owns every merge. Free by default, offline by choice. Configuration lives in the repo.

## 2. Problem statement

Developers lose hours per bug before writing a line of fix: reading vague reports, setting up environments, reproducing, bisecting and localising. The work is repetitive and interrupt-driven, and it is done by the most expensive people on the team. In open source, where nobody is paid to triage, small well-defined bugs sit for weeks.

**Where the time goes.** Clarifying issues that lack versions, steps or logs. Matching the reporter's environment, where "cannot reproduce" closes valid bugs. Finding the faulty line in unfamiliar code. Finding which commit broke it. Context switching away from planned work.

**Why current tools fall short.**

| Tool class | Examples | What's missing |
| --- | --- | --- |
| Dependency bots | Dependabot, Renovate | Only bump versions; can't fix logic bugs; no repro tests; PR noise |
| Static analysers | Semgrep CE | Pattern findings, single-file analysis, no runtime evidence, no PRs in the free tier |
| Program-repair research | Repairnator | Java only, narrow bug classes, heavy setup, low success rate |
| Open-source coding agents | OpenHands, SWE-agent, Aider, Cline | Strong only with paid frontier models; weak models spiral ("40 new errors"); blind to runtime and async behaviour; context fragments across files; no notion of business intent; rewrite working code for problems in dependencies or the environment; output is a wall of logs |
| Hosted paid agents | Commercial coding agents | Cost per seat or run; code leaves your infrastructure; not self-hostable |

**The gap.** No free tool combines (1) isolated execution with no secrets, (2) proof that the bug existed and is gone, (3) deterministic tools that compensate for small free models, (4) a review-first workflow, and (5) useful output even when the fix fails.

**Fixie's bet.** A PR backed by a failing-then-passing test, the breaking commit, a rollback-disciplined process and a one-screen Proof Card is cheap to review and easy to trust, even when a small free model wrote the patch.

## 3. Target users

The v1 user is a maintainer of a Python or JavaScript/TypeScript repository on GitHub with a test suite; the v1 adopter installs Fixie with one workflow file and no budget.

| Persona | Who | Core need | Success looks like |
| --- | --- | --- | --- |
| **Priya, OSS maintainer** (primary) | Owns a public repo and its issue queue; no budget | Clear small, well-scoped bugs without losing focus time | Labels an issue, reviews a Proof Card PR in under 10 minutes, merges with confidence |
| **Arjun, student / indie developer** | Works alone, often offline or on a laptop GPU | Free and private bug fixing | `fixie run` with Ollama fixes a bug with no network and no account |
| **Meera, team lead** | Leads 5–30 engineers, private repos, may hold a paid API key | Visibility and control | Hub shows runs, fix rate, time to PR and any spend; setup checker shows every repo is safe |
| **Rohan, security / platform admin** | Owns GitHub org settings | Isolation and least privilege | Sandbox has no secrets and no network after install; branch rules require a human; App is read-only on code |
| **Sara, issue reporter** | User or teammate who files bugs | Know someone is on it; answer questions easily | Sees one status comment, answers one clarifying question, sees the linked PR |
| **Kabir, self-hoster / contributor** | Runs his own Hub, contributes to Fixie | Easy to deploy, easy to debug | Deploys the Hub on free tiers in 30 minutes; replays any run from its trace |

**Best-fit repositories for v1.** Python with pytest, or JS/TS with Vitest or Jest; dependencies install without secrets; the suite runs in under 15 minutes on a GitHub runner; bugs are deterministic and reproducible from the issue text.

**Not targeted in v1.** Monorepos with several packages, mobile apps, code that needs external services or databases beyond SQLite to reproduce, GPU workloads, Windows-only code.

## 4. Core features

Priorities: **P0** = hackathon demo and v1 must-have; **P1** = v1 if time allows (strongly wanted); **P2** = roadmap. The three problem-statement must-haves (sandboxed execution, tests that pass after the fix, human review before merging) are hard gates, not settings.

### F1. One-file install and setup checks (P0)

- Install = add `.github/workflows/fixie.yml` (template in TRD §5.2). `fixie init` (P0) writes it plus a commented `.fixie.yml`; with a flag it also writes a bug-report issue template so reports arrive "fix-ready" (P1).
- Configuration is optional: Fixie auto-detects pytest, Vitest and Jest, the install command, linters and type-checkers. `.fixie.yml` only overrides.
- `fixie doctor` (P1) checks workflow, permissions, branch ruleset, test detection and model connectivity in one command; the Hub can dispatch the same check.
- Hub setup checker (P0) shows per repo: workflow, Actions-can-open-PRs setting, branch ruleset, `.fixie.yml` validity, Hub reporting, detected framework.

### F2. Triggers and gating (P0)

- Triggers: `fixie` label, a comment starting with `/fixie fix`, or the Hub's **Fix an issue** (workflow dispatch).
- Before any work, in order: actor has write access; issue is open and not a PR; no run is active on the issue; no open Fixie PR exists for it; the default branch has a ruleset requiring ≥ 1 approval and last-push approval; (Hub mode) installation not paused and spend cap not reached. The first failing rule posts one short reply (at most once per issue per 24 h).
- One status comment per run, edited in place; labels show state (`fixie:working`, `fixie:needs-info`, `fixie:pr-ready`, `fixie:not-fixed`).

### F3. Bug spec and readiness (P0)

- A stack-trace parser runs first; the model then fills the bug spec (fields in D-22).
- If information is missing, Fixie asks one clarifying comment, labels `fixie:needs-info` and ends the job. A reply from the reporter or anyone with write access resumes the run. No reply in 7 days ends it as `info_timeout`.

### F4. Locked sandbox (P0, must-have)

- One Docker container per run on the runner (or the local machine for the CLI): non-root, all capabilities dropped, read-only root filesystem, CPU, memory and PID limits.
- Network on only for dependency install, then disconnected; an egress probe must fail and is shown in the Proof Card.
- No token, key or secret enters the container. The repo's `.git` directory stays on the host; the container sees only the working tree.
- Every command, exit code, duration and (redacted) output is recorded.

### F5. Baseline and reproduction (P0, must-have)

- Full suite with JUnit output records which tests already pass or fail.
- Fixie writes a new test file that encodes the reported behaviour. Gate: it must fail on current code for a real assertion or exception, not an import or syntax error. Up to 3 attempts, then a diagnosis report.
- **Intent lock (P1, opt-in):** Fixie posts the repro test's assertion in plain English ("Expected: a 10% coupon never deducts more than 10%") and waits for a 👍 or `/fixie confirm` from the reporter or a maintainer before fixing.

### F6. Evidence engine (P0 core, P1 extensions)

- **Auto git-bisect (P0):** if a known-good commit exists (from the issue, a release tag, or stepping back), Fixie bisects with the repro test over dependency-stable commits and names the exact breaking commit. No model involved.
- **Fault localisation (P0):** ranks suspicious lines by combining stack-trace frames, spectrum-based scores (Ochiai over coverage of the failing repro vs related passing tests), lines touched by the breaking commit, and identifier search.
- **Repo graph and blast radius (P1):** a tree-sitter call/import graph built once and cached; before an edit Fixie lists callers of the changed functions and runs impacted tests first.
- **Stress runner (P1):** repeats the repro and impacted tests 5 times with random order and seeds to catch flaky and order-dependent behaviour; feeds the confidence score.
- **Failure-source classifier (P1):** decides whether the cause is the repo's code, a dependency change, an external API or the environment; if not the repo's code, Fixie edits nothing and posts a `not_our_code` report.
- **Debugger snapshots (P2):** scripted pdb / `node inspect` dumps of local variables at the failure.

### F7. Fix loop with checkpoints and rollback (P0)

- Every attempt is a git checkpoint inside the run. If failing tests or lint/type errors rise above baseline, Fixie reverts to the last good checkpoint automatically.
- **No-progress detector:** the same error signature on two consecutive attempts ends that hypothesis.
- **Hypothesis switching:** after two failed attempts, Fixie asks for three distinct hypotheses and tries each from the clean checkpoint (sequentially in P0, on parallel branches in P1); the gates pick the winner, smallest diff breaks ties.
- Hard caps on attempts, model calls, minutes and (for priced models) dollars.

### F8. Deterministic gates (P0, must-have)

Nine gates, computed by code: repro fails before · repro passes after · no previously passing test fails · no new lint errors in changed files · no new type errors · diff within size limits · no blocked paths touched · existing tests not weakened · no secrets in the patch or outputs. Missing linters or type-checkers pass with "not configured". A PR opens only when all nine pass on the same attempt.

### F9. Draft PR with Proof Card and review loop (P0; revise P1)

- Draft PR on `fixie/issue-<n>`, title "Fix #n: …", linked to the issue.
- **Proof Card** at the top of the body: repro test failed → passed, full-suite counts before and after with zero new failures, breaking commit from bisect, blast radius, hypotheses tried and rejected, deterministic confidence score with reasons, model used and cost, and "sandbox network locked ✓".
- Plain-English summary, root cause with file:line references, changes, risk. Under 400 words excluding tables.
- `/fixie revise <feedback>` (P1) pushes a new gated commit to the same branch.
- Fixie never merges, approves or marks the PR ready for review.

### F10. Diagnosis-only and fix-plan reports (P0; sub-issues P2)

- When Fixie can't reproduce or can't fix, it posts what it learned: attempts and why each failed, the repro if any, top suspicious lines, the breaking commit, and what information would help.
- **Tier 3 (P0 report, P2 sub-issues):** for bugs that are architectural, runtime-only or would exceed size limits, Fixie writes a Fix Plan (root cause, affected modules, proposed breakdown into small issues) instead of a patch; in P2 it can create those sub-issues.

### F11. Model-agnostic layer (P0)

- One OpenAI-compatible client with presets: `github-models` (keyless in Actions; default), `ollama` (offline; default for CLI), `gemini`, `groq`, `openrouter`, `openai`, `anthropic`, `openai-compatible` (vLLM, LM Studio, LiteLLM proxy).
- Per-preset context budget so prompts fit free tiers; optional fallback model list.
- Every call logged with tokens, latency and cost (0 for free presets).

### F12. Replayable runs (P0 export; P1 replay)

- Every run writes `fixie-trace-<runId>.zip`: events, model requests and responses (redacted), command logs, checkpoints, JUnit, Proof Card.
- `fixie replay <file>` (P1) steps through the run in the terminal; the Hub's `/replay` page (P1) renders it in the browser without uploading it. `fixie replay --rerun` (P2) re-executes with the recorded model outputs.

### F13. Triage router (P0 Tier 1 and 3; P1 Tier 0; P2 Tier 2)

Before work starts, each issue is routed: **Tier 0** lint/type/format errors fixed by autofixers with no model (P1); **Tier 1** the normal reproduce → localise → fix loop (P0); **Tier 2** multi-file plan-then-execute with gates after each step (P2; in v1 multi-file fixes run as Tier 1 within size limits); **Tier 3** report-only fix plan (P0).

### F14. Repo memory and rules (P1 read; P2 write-back)

`.fixie/memory.md` (lessons from merged and rejected PRs) and `.fixie/rules.md` (team invariants) are read as context. P2: Fixie proposes memory updates in its PRs and turns rules into property-based tests (Hypothesis / fast-check). Versioned, reviewable, model-independent; no hidden vendor database.

### F15. Fixie Hub webapp (P0 core; P1 extras; P2 notifications)

- **P0:** sign in with GitHub; install the Hub App; repositories with setup status; per-repo setup page (one-click workflow file, model choice guide, ruleset check, config explainer, enable); runs list with live status; run detail with step tracker, proof strip, evidence, attempts, timeline, logs, diff, tests and checks; start and cancel runs; basic overview metrics.
- **P1:** trace replay viewer, overview charts, installation settings (optional spend cap, retention), audit log, account sessions, members list, PR explanation feedback.
- **P2:** Slack/email notifications, CLI runs reporting to the Hub.

## 5. User stories

| ID | As a… | I want to… | So that… | Acceptance criteria | Pri |
| --- | --- | --- | --- | --- | --- |
| US-01 | Maintainer | install Fixie by adding one workflow file | I need no server, account or key | With only `fixie.yml` committed (default model `github-models`), labelling a seeded bug produces a status comment within 60 s and a draft PR or report | P0 |
| US-02 | Maintainer | run `fixie init` | the files are written correctly for my repo | Writes `fixie.yml` with pinned action version and correct permissions, and a commented `.fixie.yml`; refuses to overwrite without `--force` | P0 |
| US-03 | Maintainer | start a fix by labelling an issue | I stay in GitHub | Label → run starts; `fixie` label removed; `fixie:working` added; one status comment with current step | P0 |
| US-04 | Maintainer | be asked for missing details instead of a guess | I don't review fixes for the wrong bug | One clarifying comment lists only missing items; label `fixie:needs-info`; a reply resumes from "Understand issue"; 7 days of silence ends as `info_timeout` | P0 |
| US-05 | Security admin | know repo code runs isolated with no secrets | untrusted code can't reach tokens or the network | Container env contains no token or key; egress probe after install fails and is recorded; `.git` not mounted; canary test that reads env and calls the network finds nothing | P0 |
| US-06 | Reviewer | see a test that fails before the fix and passes after | I trust the bug is real and fixed | No PR opens without `repro_fails_before` and `repro_passes_after` passing on the same attempt; both shown in the Proof Card with the failure message | P0 |
| US-07 | Reviewer | see nothing else broke | I don't trade one bug for another | Full-suite counts before/after in the Proof Card; zero tests that passed at baseline fail at final, or no PR | P0 |
| US-08 | Reviewer | see the breaking commit | I understand when and why it broke | When bisect runs, the Proof Card shows the first bad commit (SHA link, message, author) and step count; when skipped, the reason | P0 |
| US-09 | Maintainer | be sure Fixie can never merge | a human owns every change | Allow-listed client has no merge/approve/ready methods (unit test proves a call throws); PRs are drafts; Fixie refuses to open a PR unless the ruleset requires ≥ 1 approval and last-push approval | P0 |
| US-10 | Maintainer | see that Fixie didn't spiral | I can trust a small model | Attempts that add failures are reverted (visible in the Attempts tab and Proof Card); same error twice stops the hypothesis; run never exceeds its caps | P0 |
| US-11 | Maintainer | get a useful report when Fixie can't fix | the investigation still saves me time | Report comment includes attempts and why each failed, repro status, top 5 suspicious lines, bisect result if any, and a request for specific missing information | P0 |
| US-12 | Developer | run Fixie fully offline | my code never leaves my machine | `fixie run --issue <url> --model ollama/<model> --offline` completes with no outbound connection except to GitHub when publishing is requested; without `--publish` nothing is posted | P0 |
| US-13 | Developer | switch models without code changes | I can use whatever is free or available | Changing `model` in `.fixie.yml` or the action input switches provider; unsupported preset fails fast with a clear message | P0 |
| US-14 | Team lead | sign in to the Hub and see every repo's setup status | I know which repos are safe to use | Repos page shows workflow, ruleset, Actions-PR setting, config and reporting status; each problem links to its fix | P0 |
| US-15 | Team lead | watch a run live | I can demo and debug | Run detail updates within 2 s of an engine event; step tracker, proof strip, timeline and logs update in place | P0 |
| US-16 | Maintainer | start and cancel a fix from the Hub | I don't need to touch labels | **Fix an issue** dispatches the workflow and opens the run page; **Cancel run** cancels the workflow run; status becomes Cancelled and the issue comment says so | P0 |
| US-17 | Reviewer | ask for changes with a comment | the agent iterates like a teammate | `/fixie revise <feedback>` from a writer pushes a new gated commit within 15 min and replies with a summary; failures leave the previous commit untouched | P1 |
| US-18 | Reporter | confirm what "fixed" means before the fix | the agent fixes the right behaviour | With `intent_lock: true`, Fixie posts the plain-English assertion; 👍 or `/fixie confirm` continues; 👎 or `/fixie reject` makes it rewrite the repro | P1 |
| US-19 | Contributor | replay any run | I can understand or debug Fixie | Dropping a trace zip on `/replay` renders the run detail with no upload; `fixie replay` prints the timeline | P1 |
| US-20 | Team lead | see fix rate, time to PR and spend | I can judge value | Overview shows the 8 KPIs and 3 charts for a chosen period | P1 |
| US-21 | Maintainer | have trivial lint/type issues fixed without a model | it's instant and free | Tier 0 issues are fixed by ruff/eslint/prettier autofix and gated like any other run | P1 |
| US-22 | Maintainer | block sensitive paths | the agent stays out of sensitive code | Paths in `paths.blocked` plus `.github/**`, `.fixie.yml`, `.fixie/**` can't be edited; a needed edit ends the run as `blocked_path` | P0 |

## 6. MVP scope

The MVP proves one loop end to end on free infrastructure: a GitHub issue in a Python or JS/TS repo becomes a draft PR with a Proof Card, produced in a locked sandbox by a free model, and merged only by a person, plus the Hub showing it live.

| Area | In MVP (v1) | Out of MVP |
| --- | --- | --- |
| Platform | GitHub.com, GitHub-hosted `ubuntu-latest` runners, local Docker for CLI | GitLab, Bitbucket, GHES, Windows/macOS runners |
| Languages | Python (pytest), JS/TS (Vitest, Jest) | Java, Go, Rust, C/C++, mobile |
| Triggers | Label, `/fixie fix`, Hub dispatch, `/fixie revise` (P1) | Auto-picking issues, scheduled backlog sweeps |
| Models | Presets in F11; GitHub Models default; Ollama offline | Fine-tuning, hosted model service |
| Sandbox | Docker, network cut after install, limits, no secrets | Network during tests, Docker-in-Docker, service containers, GPUs |
| Evidence | Bisect, SBFL + stack trace localisation, checkpoints, rollback | Debugger snapshots, property tests (P2) |
| Output | Draft PR + Proof Card, diagnosis report, fix plan report, status comment, workflow summary | Auto-merge, ready-for-review, release notes, backports |
| Hub | Screens in F15 P0 | Notifications, billing, SSO/SAML, custom RBAC |

**Hackathon demo cut (must work live).** GitHub Action packaging · model-agnostic run demoed on Ollama via the CLI and on GitHub Models via the Action · auto git-bisect · checkpoint and rollback loop · Proof Card on the PR · diagnosis-only report · Hub: sign-in, setup checker, live run detail, dispatch and cancel. Pitch: **"Free, works offline, finds the exact breaking commit, never spirals."** Roadmap slides: failure-source classifier, property-based tests, Tier 2, parallel hypotheses, sub-issues.

**Roadmap after v1.** v1.1: intent lock, stress runner, repo graph and blast radius, Tier 0, revise loop if slipped, replay viewer. v1.2: failure-source classifier, parallel hypotheses, memory write-back. v1.3: Tier 2 plans and sub-issues, property-based tests from rules, E2B provider, CLI runs in the Hub, notifications.

## 7. Success metrics

The north-star metric is **verified Fixie PRs merged by a person per week**; it moves only when a fix is real, gated and accepted.

**Hackathon benchmark** (10 seeded bugs: 5 pytest, 5 Vitest, in two public demo repos, each with a breaking commit in history).

| Metric | Definition | Target |
| --- | --- | --- |
| Reproduction rate | Runs with `repro_fails_before` passed ÷ runs past setup | ≥ 80% (GitHub Models default), ≥ 70% (Ollama 16–24 GB model) |
| Fix rate | Runs ending `pr_opened` ÷ reproduced runs | ≥ 60% default model, ≥ 40% local model |
| Bisect accuracy | Runs where the named commit is the seeded breaking commit ÷ runs where bisect ran | ≥ 90% |
| Spiral rate | Runs whose final diff contains a change that added failures | 0 (rollback must catch all) |
| Ungated PRs | PRs opened with any gate not passed | 0 (hard) |
| Sandbox leaks | Canary test finds a token, key or network access | 0 (hard) |
| Time to PR | Median trigger → draft PR on demo repos | < 12 min |
| Cost per fix | Model spend on the default path | $0.00 |
| Install time | New user, zero to first run (timed) | < 5 min |
| Report usefulness | Failed runs whose report includes a repro or ranked suspicious lines | ≥ 90% |

**Product metrics after launch** (Hub instances report only their own data; no telemetry leaves a self-hosted Hub).

| Category | Metric | Target at 3 months |
| --- | --- | --- |
| North star | Fixie PRs merged per week (public demo Hub) | 50 |
| Quality | Merge rate (merged ÷ opened) | ≥ 40% |
| Quality | Post-merge revert rate within 30 days | < 5% |
| Quality | Median review time (PR ready → first human decision) | < 15 min |
| Quality | Reviewer CSAT on explanations (thumbs) | ≥ 80% positive |
| Adoption | Repositories with `fixie.yml` (GitHub code search) | 200 |
| Adoption | GitHub stars | 1,000 |
| Community | External contributors with merged PRs | 10 |

**Guardrails.** Any ungated PR, secret exposure or bot merge pauses the installation in the Hub and blocks release of the Action until root-caused. A merge rate below 25% for two consecutive weeks triggers a review of which bug types to route to Tier 3.

## 8. Features to avoid in version 1

| Feature | Why not in v1 |
| --- | --- |
| Auto-merge, approving, or marking PRs ready | Breaks the human-review must-have; one bad merge destroys trust |
| Autonomous issue picking or backlog sweeps | Floods reviewers; opt-in per issue keeps volume and quality controlled |
| Feature development and refactors | No failing test defines "done"; scope creep |
| Fixes without a failing check | A PR without proof is a guess that moves work to the reviewer |
| Network or secrets during tests | Biggest security risk; most v1-worthy bugs don't need them |
| Production debugging (logs, APM, live data) | Privacy and access risk |
| Languages beyond Python and JS/TS; monorepos | Each adds detection and runner work; depth beats breadth |
| GitLab, Bitbucket, self-hosted Git | Multiplies integration and auth work |
| UI/visual bugs | Needs browsers and visual diffing; hard to gate |
| CVE remediation | Higher stakes, disclosure policy needed |
| Chat or IDE assistant | Crowded, different workflow; Fixie's edge is async, verified PRs |
| Billing, paid plans, usage metering for sale | Fixie is free; spend caps exist only to protect users with paid keys |
| Hub writing to repositories (config edits, workflow commits) | Keeps the Hub App read-only on code; deep-links to GitHub's editor instead |
| Hidden vendor memory or default telemetry | Memory lives in the repo; self-hosted Hubs send nothing anywhere |
| Docker-in-Docker, service containers, databases beyond SQLite | Complex isolation; out of the free-runner budget |
| Custom trigger labels | Workflow filter and engine must agree without a sync step (D-20) |
| Free-form "agent with shell" mode | Defeats the tools-think principle and the gates' guarantees |

## 9. Risks and open questions

| Risk | Impact | Mitigation |
| --- | --- | --- |
| Free-tier model limits (context, requests per day) | Runs fail midway | Per-preset context budgets, fallback model list, narrow prompts, clear `budget_exceeded`/`infra_error` messages naming the limit |
| Agent edits the test instead of the code | False confidence | `test_integrity` gate; repro test is a new file; existing test files may only gain lines |
| Bot approval satisfies required reviews | Unreviewed merge | Ruleset must require last-push approval (D-10); Fixie never calls approve; allow-list tests |
| Malicious repo code attacks the host | Token theft | `.git` and secrets stay on host; symlink-safe host reads; hooks disabled; network cut; runner VM is ephemeral |
| Prompt injection through issue text | Bad patch | Model has no tools; strict parsers; path policy; gates; human review |
| Bisect blocked by dependency changes | No breaking commit | Skip dependency-changing commits; report the bounding range; P1 classifier flags dependency updates |
| PRs opened with `GITHUB_TOKEN` don't trigger the repo's CI | Reviewers miss CI signal | Proof Card shows the full suite ran; docs show how to use a GitHub App token in the workflow to trigger CI |
| Low reproduction on vague issues | Few PRs | Readiness check, issue template, diagnosis report |
| Supabase free project pauses after inactivity | Demo Hub down | Keep-alive cron during the hackathon; demo checklist |

**Open questions.** See `00_START_HERE.md` §7 (deadline, org name, demo laptop, region, npm name, owners, Hub URL).
