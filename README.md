# Fixie

Free, open-source (Apache-2.0) bug-fix agent for GitHub. Label an issue `fixie`; Fixie reproduces the bug with a failing test in a locked Docker sandbox, finds the breaking commit with `git bisect`, writes the smallest patch, and opens a **draft** PR with a Proof Card only if all nine gates pass. A person always merges.

**Three hard gates:** no failing repro, no fix · no passing gates, no PR · no human approval, no merge.

> Status: Phase 1 (setup) in progress. See `docs/06_Implementation_Plan_Fixie.md`.

## Monorepo

| Path | What |
| --- | --- |
| `packages/shared` | Enums, `.fixie.yml` schema, events, BugSpec, Proof Card, labels, state markers |
| `packages/engine` | Gates, JUnit/diff parsers, SEARCH/REPLACE applier, secret scanner, confidence, Proof Card render |
| `packages/github` | Allow-listed GitHub client (no merge/approve/ready, refs only under `fixie/*`), ruleset check |
| `packages/sandbox` | Docker provider (locked container, network cut + egress probe), host work tree with hook-less git and confined reads, project detection |
| `packages/llm` | Presets, OpenAI-compatible client (retries, fallback, caps, replay), prompt budgeting, JSON repair |
| `packages/cli`, `action/`, `apps/hub` | Next phases |
| `supabase/` | Migrations and smoke tests (Hub schema) |
| `docs/` | Build pack v2.0 (start with `00_START_HERE.md`) |

## Develop

```bash
git clone https://github.com/Agent-X-Hackathon-2026-Team-MisfitMinds/demo-repository.git
cd demo-repository
```

```bash
corepack enable
pnpm install
pnpm -r run typecheck
pnpm -r run test
```

## Ruleset

Fixie refuses to open PRs unless the default branch has a ruleset requiring ≥ 1 approval **and** approval of the most recent push (Settings → Rules → Rulesets → Require a pull request before merging → Require approval of the most recent reviewable push).
