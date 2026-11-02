# Fixie — Start Here (Build Pack v2.0)

Oct 31, 2026 · @Mahajan Sarthak Dileep · Team MisfitMinds · Agent X Hackathon 2026

This file is the entry point for people and AI coding agents. It fixes the vocabulary, the order of authority between documents, and every decision taken while merging the v1.0 docs (PatchPilot PRD/TRD/Schema, Fixie Flow Spec, Design Brief, Implementation Plan, Build Plan workbook) with the "Free, Open-Source Bug-Fix Agent Stand Out" strategy. Read it before any other file.

## 1. Fixie in 60 seconds

Fixie is a free, open-source (Apache-2.0) bug-fix agent for GitHub repositories. A maintainer labels an issue `fixie`. Fixie's GitHub Action reads the issue, starts a locked Docker sandbox on the repo's own GitHub Actions runner, records the baseline test results, writes a test that fails because of the bug, finds the breaking commit with `git bisect`, ranks suspicious lines from coverage and the stack trace, writes the smallest patch, and checks it against nine deterministic gates. Every attempt is a git checkpoint that is rolled back automatically if it makes things worse. If every gate passes, Fixie opens a **draft** pull request with a **Proof Card**; a person always reviews and merges. If it cannot fix the bug, it posts a diagnosis (repro, suspicious lines, breaking commit) instead.

Fixie works with any OpenAI-compatible model. Inside GitHub Actions the default is GitHub Models through the built-in `GITHUB_TOKEN` (no API key at all); on a laptop the CLI runs fully offline with Ollama. The design rule is **"tools think, the model writes"**: coverage, bisect, parsers and gates do the reasoning that can be done deterministically, and the model only writes a bug spec, a test, hypotheses, a patch and an explanation.

**Fixie Hub** is the optional, free, self-hostable web app (Next.js on Vercel + Supabase): sign in with GitHub, check each repo's setup, watch runs live with their evidence, start or cancel runs from the dashboard, see metrics, and replay trace files.

The three hard gates never change: **no failing repro, no fix · no passing gates, no PR · no human approval, no merge.**

## 2. Document map and order of authority

| # | File | Owns |
| --- | --- | --- |
| 00 | `00_START_HERE.md` | Vocabulary, decisions, open questions, changelog |
| 01 | `01_PRD_Fixie.md` | Why, who, scope, priorities, metrics, what not to build |
| 02 | `02_TRD_Fixie.md` | Architecture, engine pipeline, gates, model layer, sandbox, APIs, security, deployment |
| 03 | `03_Webapp_Flow_Spec_Fixie.md` | Every Hub screen, modal, button, state and the exact UI copy; GitHub-side and CLI flows |
| 04 | `04_UI_Design_Brief_Fixie.md` | Visual system, tokens, components, responsive rules |
| 05 | `05_Backend_Schema_Fixie.md` | Tables, enums, constraints, RLS, functions, full SQL migration |
| 06 | `06_Implementation_Plan_Fixie.md` | Phases, steps, deliverables, lanes, demo cut |
| — | `supabase/migrations/*.sql`, `supabase/tests/*.sql` | The tested schema (copy into the repo as-is) and its smoke tests |
| — | `Fixie_Build_Plan.xlsx` | Living tracker: phases, deliverables, owners, open questions, gap decisions, spikes, benchmark |

When two documents disagree, the higher one wins: **05 Schema (names, enums, constraints) > 02 TRD (security, gates, engine, APIs) > 01 PRD (intent, scope) > 03 Flow Spec (UX behaviour) > 04 Design Brief (visuals) > 06 Plan (sequence)**. One exception: user-facing copy is owned by 03 Flow Spec. Anything none of them covers is decided in §6 of this file; add new decisions there, never silently in code.

## 3. Rules for AI coding agents

1. Do not invent behaviour, copy, names or enum values. If something is missing, apply the matching default in §6, then append a line to §6 "Decisions log".
2. Never weaken a hard gate. The gate engine, the GitHub allow-list and the protection check must have unit tests before any PR-opening code is merged.
3. Use the canonical names in §4 exactly (labels, commands, branch prefix, file names, env vars, enum values).
4. The Supabase **secret key**, the GitHub App private key and any LLM key are server-side only. Nothing secret is ever passed into the sandbox container, rendered in the browser, or written to a log, comment, PR body or trace.
5. Repo code executes only inside the sandbox container. The host process may run `git` (hooks disabled), parse files and call APIs; it never runs the repo's install, build or test commands.
6. Every phase in 06 ends with its deliverables checklist green, including tests. Do not start a later phase's code inside an earlier phase's PR.
7. Versions: Node 24 LTS, TypeScript 5.9+ strict, Next.js 16 (App Router, `proxy.ts`), React 19, Tailwind CSS v4, Zod 4, Supabase JS v2 with `@supabase/ssr`, pnpm + Turborepo, Vitest, Playwright. Pin exact versions in lockfiles; pin every third-party GitHub Action by commit SHA.

## 4. Canonical vocabulary

**Product surfaces.** Fixie Action (`action.yml` at the repo root of `Agent-X-Hackathon-2026-Team-MisfitMinds/demo-repository`, used as `Agent-X-Hackathon-2026-Team-MisfitMinds/demo-repository@v1`) · Fixie CLI (binary `fixie`, npm package `@misfitminds/fixie`; see Q5) · Fixie Hub (the web app) · the engine (`packages/engine`, shared by Action and CLI).

**On GitHub.**

| Concept | Canonical value |
| --- | --- |
| Trigger label | `fixie` (fixed in v1; Fixie removes it when a run starts so it can be re-added) |
| Status labels | `fixie:working`, `fixie:needs-info`, `fixie:pr-ready`, `fixie:not-fixed` (issues); `fixie:low-confidence` (PRs) |
| Commands (comment must start with them) | `/fixie fix`, `/fixie revise <feedback>`, `/fixie confirm` and `/fixie reject <note>` (P1, intent lock) |
| Fix branch | `fixie/issue-<n>` |
| Workflow file | `.github/workflows/fixie.yml` |
| Repo config | `.fixie.yml` (optional; defaults apply when missing) |
| Repo knowledge files | `.fixie/memory.md` (P1, read as context), `.fixie/rules.md` (P2, invariants) |
| Repro test file | Python: `tests/test_fixie_issue_<n>.py` (or the repo's test dir); JS/TS: `<testDir>/fixie-issue-<n>.test.<ts|js>` |
| Hidden state markers | `<!-- fixie:state {json} -->` in the status comment; `<!-- fixie:pr {json} -->` in the PR body |
| Trace artifact | `fixie-trace-<runId>.zip` (workflow artifact, 14-day retention) |
| Hub GitHub App slug | `fixie-hub` (prod), `fixie-hub-dev` (dev); read from env `GITHUB_APP_SLUG` |

**Run vocabulary (enum values; the schema in 05 is the source).**

| Enum | Values |
| --- | --- |
| `run_status` | `queued`, `awaiting_info`, `awaiting_confirmation`, `provisioning`, `baseline`, `reproducing`, `diagnosing`, `fixing`, `verifying`, `opening_pr`, `succeeded`, `failed`, `cancelled` |
| `run_outcome` | `pr_opened`, `pr_updated`, `could_not_reproduce`, `could_not_fix`, `fix_plan`, `not_our_code`, `info_timeout`, `environment_error`, `gate_violation`, `blocked_path`, `budget_exceeded`, `infra_error`, `cancelled` |
| `run_step` | `bug_spec`, `triage`, `provision`, `install`, `baseline`, `reproduce`, `confirm_intent`, `bisect`, `localize`, `hypothesize`, `fix`, `verify`, `stress`, `explain`, `open_pr`, `report`, `teardown` |
| `run_trigger` | `label`, `comment`, `dashboard`, `revise`, `cli` |
| `run_tier` | `t0_autofix`, `t1_fix`, `t2_plan`, `t3_report` |
| `gate_kind` (9) | `repro_fails_before`, `repro_passes_after`, `no_new_failures`, `lint_clean`, `typecheck_clean`, `diff_size`, `blocked_paths`, `test_integrity`, `secret_scan` |
| `test_phase` | `baseline`, `repro_before`, `repro_after`, `final`, `stress` |
| `protection_status` | `unknown`, `ok`, `weak`, `missing`, `bypass` |
| `confidence_level` | `high` (≥ 75), `medium` (50–74), `low` (< 50) |

**User-facing step names (8-step tracker).** 1 Understand issue · 2 Set up sandbox · 3 Baseline tests · 4 Reproduce · 5 Find the cause · 6 Fix and verify · 7 Open PR (or "Write report" when the run ends without a PR) · 8 Clean up. Mapping to `run_step` is in 03 §10.

**Environment variables.** Hub: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY` (base64 PEM), `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_WEBHOOK_SECRET`, `FIXIE_OIDC_AUDIENCE` (defaults to `NEXT_PUBLIC_APP_URL`), `CRON_SECRET`, `SENTRY_DSN` (optional). Action/CLI: `GITHUB_TOKEN`, `FIXIE_LLM_API_KEY` (only for keyed providers), `FIXIE_HUB_URL` (optional), `OLLAMA_HOST` (CLI).

## 5. Architecture at a glance

```text
 GitHub issue ──label `fixie` / `/fixie fix`──▶ GitHub Actions runner (ephemeral VM, user's repo)
                                                 │  host: Fixie engine (Node 24) holds GITHUB_TOKEN + LLM key
                                                 │   ├─ git (hooks off), parsers, tree-sitter, gate engine
                                                 │   ├─ LLM client ──▶ GitHub Models / Ollama / any OpenAI-compatible API
                                                 │   └─ docker ──▶ sandbox container (no secrets, network cut after install)
                                                 │                  └─ install · tests · coverage · bisect runs
                                                 ├──▶ GitHub: status comment, labels, draft PR + Proof Card (allow-listed client)
                                                 ├──▶ workflow artifact: fixie-trace-<runId>.zip
                                                 └──▶ (optional) Fixie Hub ingest API  (GitHub OIDC → run token)

 Fixie Hub (optional) = Next.js 16 on Vercel + Supabase (Postgres, Auth, Realtime, Storage, pg_cron)
   browser ◀─Realtime── run_events │ GitHub App (read-only + Actions write) for setup checks, dispatch, cancel, webhooks
```

## 6. Decisions and defaults (v2.0)

Each line is final unless the team changes it here first.

| ID | Decision | Reason (short) |
| --- | --- | --- |
| D-01 | Fixie is free and open source under Apache-2.0; there is no billing, plan or paid tier in v1 | Team goal; explicit patent grant helps adoption |
| D-02 | The GitHub Action is the primary product; the CLI is second; the Hub is optional | Zero-infra install; GitHub's runner is a free ephemeral VM |
| D-03 | Sandbox = Docker container on the runner (or local Docker for the CLI) behind a `SandboxProvider` interface; E2B is a P2 provider | Free, available on every `ubuntu-latest` runner |
| D-04 | Network is open only during dependency install, then cut with `docker network disconnect`; an egress probe proves it | Must-have "sandboxed execution" with installable deps |
| D-05 | No Temporal, Trigger.dev, GKE, Redis or Drizzle. Actions jobs are the durable runners; long waits end the job and resume on the next GitHub event; scheduled sweeps use a daily workflow job and Supabase `pg_cron` | Fewer moving parts for a team of four; all free |
| D-06 | Model-agnostic through OpenAI-compatible Chat Completions with presets (§02 TRD §6); default `github-models` in Actions, `ollama` in the CLI | Free by default, offline possible |
| D-07 | Engine is a fixed pipeline with five narrow LLM tasks and strict text protocols (JSON validated by Zod; SEARCH/REPLACE edit blocks), not a free-roaming tool-calling loop | Small and free models are reliable at narrow tasks; prevents spirals |
| D-08 | Gates are computed by code from JUnit XML, the diff, lint/type output and scanners; never from model text | Zero ungated PRs becomes a code property |
| D-09 | Lint and type-check gates pass with evidence `{notConfigured: true}` when no tool is detected, and only fail on **new** errors in changed files (resolves gap G1) | Repos without linters must still get PRs |
| D-10 | Human review is enforced by: draft PRs only, an allow-listed GitHub client with no merge/approve/ready calls, and a branch **ruleset** that requires ≥ 1 approval **and** approval of the most recent push; Fixie refuses to open a PR otherwise | `GITHUB_TOKEN` can approve PRs when "Allow GitHub Actions to create and approve pull requests" is on; last-push approval makes GitHub reject a bot approving its own push |
| D-11 | v1 reads branch **rulesets** only (`GET /repos/{o}/{r}/rules/branches/{branch}`); classic branch protection is reported as `missing` with guidance to add a ruleset (resolves G5) | Rulesets are readable with metadata access from Actions; classic details need admin |
| D-12 | Config as code: `.fixie.yml` is the only source of engine settings. The Hub reads, validates and explains it, and deep-links to GitHub's editor; the Hub never writes to repos | One source of truth; Hub App stays read-only on code |
| D-13 | Hub auth = Supabase Auth (GitHub provider) with RLS on `auth.uid()`; the GitHub App's client credentials are used as the provider (spike S3; fallback: separate OAuth App + installation-token membership checks) | Battle-tested sessions, Realtime with RLS, less custom security code |
| D-14 | Hub GitHub App permissions: Metadata R, Contents R, Issues R, Pull requests R, Actions R/W, Administration R, Members R (org). Events: installation, installation_repositories, workflow_run, pull_request, pull_request_review, push, repository_ruleset, repository | Actions write is needed only for dispatch and cancel; the App cannot write code |
| D-15 | Hub ingest auth: GitHub Actions OIDC token (audience `FIXIE_OIDC_AUDIENCE`) exchanged for a run-scoped ingest token (random 32 bytes, hash stored, 6 h expiry) | No shared secret to configure |
| D-16 | Live updates use Supabase Realtime Postgres Changes on `run_events` (INSERT) and `runs` (UPDATE); polling fallback every 5 s | Meets "under 2 s" with no SSE server |
| D-17 | Schema lives in `public` with RLS on every table and explicit grants; no table partitioning in v1 (resolves G3) | Conventional Supabase setup; volumes are small |
| D-18 | The `pull_requests` DB trigger no longer blocks inserts (the PR already exists on GitHub); it records `ungated = true`, opens a `safety_incidents` row and pauses the installation | Gate enforcement moved into the engine; Hub monitors |
| D-19 | Languages v1: Python (pytest) and JS/TS (Vitest, Jest). Default images `python:3.12-bookworm`, `node:22-bookworm`, chosen from `.python-version`/`requires-python` and `.nvmrc`/`engines` | Depth over breadth |
| D-20 | Trigger label is fixed to `fixie` in v1 (no custom labels) | The workflow `if:` and the engine must agree without a sync step |
| D-21 | Bisect only tests commits whose dependency manifests and lockfiles match HEAD (others are skipped with exit 125); max 12 steps, 6 minutes | Network is locked after install; avoids reinstalling per commit |
| D-22 | Bug-spec fields: `title, expected, actual, repro_steps, environment, version, last_good, stack_traces[], suspected_files[], error_messages[]`. Ask for clarification only if `actual` is missing, or both `repro_steps` and `expected` are missing (resolves G9) | Ask rarely, ask once |
| D-23 | Intent lock (P1) waits for a 👍 reaction by polling for up to 15 minutes inside the job, or for a `/fixie confirm` comment at any time (Actions cannot trigger on reactions) | Keeps the stand-out feature buildable |
| D-24 | Admin in the Hub = org membership role `admin`, or the account owner for user installations (resolves G12) | Exact GitHub API source |
| D-25 | Model ids, prices and context budgets live in one file `packages/llm/presets.ts`; cost is 0 for free presets (resolves G11) | One place to update |
| D-26 | A repo can be **enabled** in the Hub only when: workflow present and current, Hub reporting configured, Actions may create PRs, and protection is `ok` | Dispatch must not create runs that can never report or open a PR |
| D-27 | Re-labelling an issue that already has an open Fixie PR does not start a new run; Fixie points to the PR and `/fixie revise` | One fix per issue at a time |
| D-28 | Demo repos are public (rulesets on private repos need a paid GitHub plan) (resolves G7) | Free plan constraint |

**Decisions log** (append below; format `D-xx · date · decision · reason`).

## 7. Open questions for the team

Defaults in brackets are what the build uses until you answer.

| ID | Question | Default |
| --- | --- | --- |
| Q1 | Submission deadline and demo format (live or recorded)? | Plan assumes ~12 working days; live demo with a recorded backup |
| Q2 | GitHub org name for the project and demo repos? | **Answered:** org `Agent-X-Hackathon-2026-Team-MisfitMinds`, Fixie repo `Agent-X-Hackathon-2026-Team-MisfitMinds/demo-repository` (D-39) |
| Q3 | Which laptop runs the offline (Ollama) demo, and how much RAM/VRAM? | `qwen3-coder:30b` if ≥ 24 GB, `gpt-oss:20b` at 16 GB, `qwen2.5-coder:7b` at 8 GB |
| Q4 | Supabase project region for Whiteroom → Fixie (Vercel functions must match)? | Mumbai `ap-south-1` ↔ Vercel `bom1` |
| Q5 | Is the npm name `fixie` available? | Publish as `@misfitminds/fixie`, binary `fixie` |
| Q6 | Lane owners for Engine, Sandbox+GitHub+Action, Hub backend, Hub frontend? | Fill in the workbook |
| Q7 | Public demo Hub URL? | `https://fixie-hub.vercel.app` (placeholder) |

## 8. What changed from the v1.0 documents

| Area | v1.0 | v2.0 |
| --- | --- | --- |
| Name | PatchPilot (PRD/TRD/Schema) and Fixie (others) | Fixie everywhere |
| Business model | Paid SaaS, $2 per run target, budgets | Free and open source; optional spend caps only for paid keys |
| Execution | GKE gVisor (TRD) or E2B (Plan) | User's GitHub Actions runner + locked Docker container; local Docker for CLI |
| Orchestration | Temporal Cloud or Trigger.dev | GitHub Actions jobs, event-driven resume, scheduled sweep |
| Models | Claude only, two tiers | Any OpenAI-compatible model; GitHub Models (keyless) and Ollama (offline) presets |
| Engine | LLM tool-use loop | Deterministic pipeline + 5 narrow LLM tasks; bisect, SBFL, checkpoints, rollback |
| PR | Explanation body | Proof Card with bisect result, hypotheses, blast radius, confidence |
| Failure | "Couldn't fix" comment | Diagnosis-only report and Tier-3 fix plan |
| Dashboard | Required; system of record for settings | Optional Fixie Hub; config lives in `.fixie.yml`; replay viewer |
| Auth | Custom sessions, CSRF tokens | Supabase Auth + RLS; Origin checks on mutations |
| Live updates | SSE from API | Supabase Realtime |
| DB | Cloud SQL/Supabase schema `app`, partitions, Drizzle | Supabase `public` schema, RLS, SQL migrations via Supabase CLI, generated types |
| Frontend | Next.js 15, Tailwind v3 config | Next.js 16 (`proxy.ts`), Tailwind v4 `@theme` tokens |

D-29 · 2026-11-02 · Internal workspace packages are named `@fixie/*` (`@fixie/shared`, `@fixie/engine`, `@fixie/github`, …), private, and export TypeScript source directly (`exports: ./src/index.ts`); only the Action (esbuild) and CLI (npm `@misfitminds/fixie`) are bundled · No per-package build step to keep in sync during the hackathon
D-30 · 2026-11-02 · Canonical test id = `<junit classname>::<name>` (or `<name>` when classname is empty) for all frameworks; the same id is used across baseline, repro and final phases · Stable join key for `no_new_failures`
D-31 · 2026-11-02 · `no_new_failures` treats a baseline-passing test that is missing from the final run as newly failing · Deleting or breaking collection of a test must not pass the gate
D-32 · 2026-11-02 · `diff_size` fails when the attempt changes no file besides the repro test · A PR with no fix is not a fix
D-33 · 2026-11-02 · Proof Card cost renders `$0` for free presets, otherwise `$0.0012` (< 1¢) or `$0.42` · GH-05 leaves `{cost}` format open
D-34 · 2026-11-02 · `packages/llm` calls `/chat/completions` with `fetch` instead of the `openai` npm SDK (TRD §6) · Same OpenAI-compatible wire format, no SDK major-version churn, smaller Action bundle, trivial to fake in tests
D-35 · 2026-11-02 · Sandbox `/deps` is a per-run host directory (`$RUNNER_TEMP/fixie/<runId>/deps`) bind-mounted rw, not a named Docker volume · Owned by the runner user (UID 1001), so the non-root container can write to it without a root chown step
D-36 · 2026-11-02 · A custom `project.test` command may contain `{junit}`, replaced with the phase's JUnit output path; test file targets are appended · Lets custom commands still feed the gates
D-37 · 2026-11-02 · Preset default models: gemini `gemini-2.5-flash`, groq `llama-3.3-70b-versatile`, openrouter `qwen/qwen3-coder:free`, openai `gpt-4.1-mini` ($0.40/$1.60 per 1M), anthropic `claude-haiku-4-5` ($1/$5 per 1M); `PRICES_CHECKED_AT` in `presets.ts` · TRD §6 left them "set in presets"; re-check catalogs before release
D-38 · 2026-11-02 · Persistent HTTP 429, 403 or 404 from a model moves to the next `model.fallback` entry; other 4xx fail immediately; 5xx/network errors retry 3× with jittered backoff honouring `Retry-After` (≤ 60 s) · 403/404 cover a free-tier model being withdrawn mid-hackathon
D-39 · 2026-11-02 · The Fixie repository is `https://github.com/Agent-X-Hackathon-2026-Team-MisfitMinds/demo-repository`: the Action is used as `Agent-X-Hackathon-2026-Team-MisfitMinds/demo-repository@v1`, the ruleset help link is `https://github.com/Agent-X-Hackathon-2026-Team-MisfitMinds/demo-repository#ruleset`, and demo repos live in the same org as `Agent-X-Hackathon-2026-Team-MisfitMinds/fixie-demo-python` and `Agent-X-Hackathon-2026-Team-MisfitMinds/fixie-demo-ts`. The npm package stays `@misfitminds/fixie` (npm scopes are lowercase and separate from GitHub orgs). Canonical values live in `packages/shared/src/repo.ts` · Hackathon-provided org and repo (answers Q2)
