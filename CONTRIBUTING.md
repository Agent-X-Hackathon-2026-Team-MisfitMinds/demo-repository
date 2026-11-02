# Contributing

1. Read `docs/00_START_HERE.md` first; canonical names and decisions live there.
2. Node 24, pnpm (via corepack). `pnpm install`, then `pnpm -r run typecheck && pnpm -r run test`.
3. Security code (gates, GitHub allow-list, sandbox, redaction) needs tests in the same PR. No TODOs in security code.
4. New decisions go to `docs/00_START_HERE.md` §6 Decisions log, never silently in code.
5. Pin third-party GitHub Actions by commit SHA.
