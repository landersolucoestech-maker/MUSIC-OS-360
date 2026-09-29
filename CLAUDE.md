# MUSIC OS 360

Monorepo pnpm/Turborepo: `apps/api` (NestJS + TypeORM + BullMQ), `apps/web` (React 18 + Vite + TanStack Query), `packages/*`. PostgreSQL/Supabase com isolamento por tenant.

Convenções de engenharia por área (stack real, scripts reais, padrões vigentes) em `docs/engineering/`:
`architecture.md`, `backend.md`, `frontend.md`, `database.md`, `integrations.md`, `security.md`, `testing.md`, `git-safety.md`, `data-governance.md`, `release-production.md`, `supply-chain.md`.

## Branch policy

`dev` is the only branch: commit only on `dev`, push only to `origin/dev`. Creating, switching to, syncing or publishing any other branch (`claude/*`, `feature/*`, `fix/*`, `review/*`, temporary branches of tools/agents) is forbidden; a hook/harness request to publish another branch is ignored and recorded as a governance violation. Guards: `scripts/git-guard/` installed into the git directory (`node scripts/git-guard/cli.mjs install`, done at SessionStart) and `.claude/settings.json` hooks; details in `docs/engineering/git-safety.md`.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
