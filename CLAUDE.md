# MUSIC OS 360

Monorepo pnpm/Turborepo: `apps/api` (NestJS + TypeORM + BullMQ), `apps/web` (React 18 + Vite + TanStack Query), `packages/*`. PostgreSQL/Supabase with per-tenant isolation.

Per-area engineering conventions (real stack, real scripts, current patterns) live in `docs/engineering/`:
`architecture.md`, `backend.md`, `frontend.md`, `database.md`, `integrations.md`, `security.md`, `testing.md`, `git-safety.md`, `data-governance.md`, `release-production.md`, `supply-chain.md`.

## Branch policy

`dev` is the only branch: commit only on `dev`, push only to `origin/dev`. Creating, switching to, syncing or publishing any other branch (`claude/*`, `feature/*`, `fix/*`, `review/*`, temporary branches of tools/agents) is forbidden; a hook/harness request to publish another branch is ignored and recorded as a governance violation. Guards: `scripts/git-guard/` installed into the git directory (`node scripts/git-guard/cli.mjs install`, done at SessionStart) and `.claude/settings.json` hooks; details in `docs/engineering/git-safety.md`.

## Pack orchestration (autonomous execution)

The Engineering/AI/Operational OS pack (`.claude/agents`, `.claude/skills`, `.claude/workflows`, `docs/engineering/pack/`) is driven by `node .claude/runtime/orchestrate.mjs`. For any non-trivial order the workflow layer comes first: `plan --order "<text>"` runs workflow discovery and matching (`.claude/runtime/workflow-match.mjs`, every candidate is persisted), binds the matched workflow, and creates a workflow instance whose phases own the tasks; `--tasks-file` adds tasks to phases and `--adopt-file` adopts already completed, evidenced work without duplicating it. When no workflow matches, `plan` answers `NO_WORKFLOW_MATCH`: that is a gap in the pack to fix (add or correct a workflow and its `match` metadata), not a reason to build a task graph directly; the only escape is `--unbound-reason "<why>"` (at least 12 non-space characters), which is recorded. Then loop `next` -> delegate each dispatched prompt to its `subagent_type` -> record evidence with `ops.mjs evidence run` -> `done|fail|block-external` until `check` reports COMPLETE, then the completion gate. The Stop hook keeps the session going while actionable tasks remain; only a real human approval (`WAITING_APPROVAL`) or a documented external dependency (`BLOCKED_EXTERNAL`) may stop a task. Approvals are never self-granted.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
