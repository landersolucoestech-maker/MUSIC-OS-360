# Normalization mission report (orchestration `orch-a03c3f22`)

Branch policy used: `dev` (the repository policy in `CLAUDE.md`, `docs/engineering/git-safety.md` and the installed git guard; the order named `main`, and the owner confirmed `dev` when asked). No other branch, no pull request, no force push.

**Status: NOT at the Definition of Done.** Two of its targets are not reached and cannot be reached without a human decision: 0 naming blockers (17 remain open) and 0 compatibility rows without a covering test (1075 remain). Everything the repository's own sources could settle was done; the rest is listed with the exact decision needed.

## Git

| Item | Value |
|---|---|
| Initial SHA of this mission | `c6189270b7926bc3c761ed3900b0cfb28f7cdf37` (the previous mission's last commit) |
| Final SHA, `origin/dev` | `git rev-parse HEAD origin/dev` (a report committed in the same change cannot contain its own SHA) |
| Commits | `git log --oneline c618927..HEAD` (13 before the report commit) |

## Before and after (recomputed from the tree, never from the earlier report)

| Metric | Before | After | Command |
|---|---|---|---|
| Naming blockers OPEN | 25 | 17 (8 RESOLVED) | `node scripts/naming/validate-canonical-map.mjs`, blockers in `docs/naming/canonical-naming-map.json` |
| Compatibility rows (TEMPORARY + LEGACY_DATABASE) | 2183 | 2191 | ledger `exceptions[]` |
| Compatibility rows with a covering test | 759 | 1083 | same |
| TEMPORARY rows without a covering test (ratchet) | 1391 | 1075 | `scripts/naming/covering-test-baseline.json` |
| Distinct compatibility groups (distinct `currentName`) | 879 | 879 | ledger |
| Legacy aliases in concepts | 43 | 43 | ledger |
| Legacy database rows (LEGACY_DATABASE_COMPATIBILITY) | 83 | 83 | ledger |
| Entities mapped | 138 tables checked by the map | 132 (six dead entities removed) | `validate-canonical-map.mjs` |
| Census debt (code) | 0 | 0 (`doc` 8696 unchanged) | `technical-naming-census.mjs --check` |
| Schema census | not run (no database) | exit 0 on a migrated disposable database | `schema-naming-census.mjs --check` |
| Migration verifiers cz042-cz043, cz045 | not run | both PASS (35 and 16 checks) | `verify:cz042-cz043-migrations`, `verify:cz045-musicchat-migration` |

New in this mission: 8 test groups with mutation proof, 1 new runtime test, 6 new ledger exemption rows for spec literals, 0 migrations (no schema or data change), 0 boundaries removed or added beyond the ledger rows above.

## Autonomous execution

Orchestration `orch-a03c3f22`, 25 tasks, driven by `.claude/runtime/orchestrate.mjs` (plan, next, done, fail). The workflow used is a custom task graph passed with `--tasks-file`; the driver can instantiate a named workflow with `--workflow`, but none of the 24 shipped workflows matches this mission, so no named workflow was instantiated. Skills and capabilities are those named per task; the driver records the agent and skills and does not execute capabilities.

`WORKFLOW | INSTANCE | STEP | AGENT | SKILL | CAPABILITY | RESULT | EVIDENCE`

| Workflow | Instance | Step | Agent | Skill | Capability | Result | Evidence |
|---|---|---|---|---|---|---|---|
| custom graph | orch-a03c3f22 | census-baseline | naming-analyzer | naming-analysis, repository-census | naming census | COMPLETED | evid-ef9d3358 |
| custom graph | orch-a03c3f22 | triage-db-blockers | database-reviewer | database-audit, schema-normalization | schema review | COMPLETED | evid-e7a30850 |
| custom graph | orch-a03c3f22 | triage-app-blockers | naming-analyzer | naming-analysis, contract-tracing | contract tracing | COMPLETED | evid-d5a5e521 |
| custom graph | orch-a03c3f22 | triage-compat-rows | naming-analyzer | naming-analysis, dead-code-analysis | compatibility classification | COMPLETED | evid-8d14ed14 |
| custom graph | orch-a03c3f22 | share-type-todo | requirements-analyst | contract-tracing, data-flow-trace | requirement analysis | COMPLETED (decision record) | evid-6801b8a0 |
| custom graph | orch-a03c3f22 | env-var-audit | configuration-analyzer | config-map, feature-flag-analysis | configuration audit | COMPLETED | evid-dea08fd9 |
| custom graph | orch-a03c3f22 | migration-verifiers | migration-test-engineer | create-migration-tests, run-integration-tests | migration verification | COMPLETED after 1 retry | evid-b9d678c6 |
| custom graph | orch-a03c3f22 | dev-auth-regression | authorization-engineer | create-security-tests, run-security-tests | security tests | COMPLETED | evid-45ff55ce |
| custom graph | orch-a03c3f22 | remove-dead-entities | schema-engineer | schema-normalization, dead-code-analysis | entity cleanup | COMPLETED after 1 retry | evid-5199f687 |
| custom graph | orch-a03c3f22 | env-cleanup | configuration-analyzer | config-map, feature-flag-analysis | configuration change | COMPLETED after 1 retry (last item finished by the orchestrator) | evid-f01d4033, evid-a008964f |
| custom graph | orch-a03c3f22 | share-type-dedup | service-layer-engineer | contract-tracing, safe-refactor | refactor | COMPLETED after 1 retry | evid-aa4720dd |
| custom graph | orch-a03c3f22 | compat-coverage-tests | qa-engineer | create-contract-tests, create-regression-tests | test authoring | COMPLETED after 1 retry | evid-9fedeb94, evid-2532d154 |
| custom graph | orch-a03c3f22 | *-recovery-1 (5 tasks) | root-cause-investigator | root-cause-analysis | recovery | COMPLETED (API rate limit 429, transient) | evid-cf61ae9e |
| custom graph | orch-a03c3f22 | fix-workflow-error-text | service-layer-engineer | service-layer-audit, create-regression-tests | error boundary | COMPLETED | evid-7edbdb00, evid-641b2ab1 |
| custom graph | orch-a03c3f22 | fix-projects-export | backend-engineer | create-regression-tests, safe-refactor | reports | COMPLETED | evid-7edbdb00, evid-641b2ab1 |
| custom graph | orch-a03c3f22 | fix-contract-filters | frontend-engineer | create-unit-tests, safe-refactor | web filter | COMPLETED | evid-c1ebdd21, evid-641b2ab1 |
| custom graph | orch-a03c3f22 | fix-takedowns-entity | backend-engineer | create-regression-tests, data-integrity-audit | entity fix | COMPLETED | evid-7edbdb00, evid-641b2ab1 |
| custom graph | orch-a03c3f22 | fix-residue-census-docs | technical-debt-analyzer | residue-search, doc-writer | docs | COMPLETED (agent had no Edit tool; the orchestrator applied its output) | evid-7edbdb00, evid-641b2ab1 |
| custom graph | orch-a03c3f22 | security-review-2 | security-reviewer | security-audit | security review | COMPLETED (PASS-WITH-FINDINGS, fixed) | evid-dc4e3803, evid-0afa4042 |
| custom graph | orch-a03c3f22 | regression-review-2 | regression-reviewer | diff-review, blast-radius-analysis | regression review | COMPLETED (PASS-WITH-FINDINGS, fixed) | evid-60528818 |
| custom graph | orch-a03c3f22 | completion-gate | completion-controller | definition-of-done | completion gate | see Gates | see `.claude/docs/pack/evidence-index.md` |

Retry and recovery were exercised for real: five tasks died on an API rate limit, `fail` planned a recovery task and a retry for each, the root cause was recorded, and the retries succeeded. The scheduler kept independent tasks running while others were RUNNING (up to 5 agents in parallel). Approvals: none requested or granted; no high-impact action was executed (no destructive migration was registered or run).

## Canonical model decisions implemented

- Six dead `FinancialCategory*` entity classes removed (tables dropped by 20260718000002).
- `TakedownEntity` maps only existing columns; the DTO whitelist rejects the dropped fields.
- One authoritative registry-eligibility rule for shares (`share-eligibility.util.ts`), with a guard spec that fails if a consumer re-introduces a raw `share_type IS NULL`.
- One list of production-forbidden bypass flags (`PROD_FORBIDDEN_BYPASS_FLAGS`); the frontend bypass is `VITE_DEV_AUTH_BYPASS` (renamed from `VITE_DISABLE_AUTH`); dead `MOCK_MODE`, `VITE_MOCK_MODE`, `VITE_USE_MOCK` removed; the dev social mock is `DEV_SOCIAL_METRICS_MOCK` with `USE_MOCK` as a deprecated alias; stale names still fail a prod-like build when `true`.
- Public workflow execution DTOs never carry raw error text.
- Projects export uses PT-BR labels for project type, solo/feat and original/remix, and round-trips through the importer; the old em-dash headers are a documented deprecated alias.
- Business contract filter uses the canonical `exclusivity` slug.
- Musical-domain separation (Work, Phonogram, released music, Project, Release, Distribution) was not touched.

## Database

No schema change and no migration in this mission. Verified on a disposable PostgreSQL 16 (port 54329, started and stopped by this session): migrate twice exit 0, `db:check` clean, `verify:rls`, `verify:critical-rls`, `verify:tenant-isolation`, `verify:canonical-order artists`, `verify:migrations`, schema census, and both pending migration verifiers. The verifiers needed two root-cause fixes to their own scripts (a fixed rollback bound that went stale as migrations were added, and an assertion that migration 026 was the last applied). A disposable tenant came from the repository's own `seed:operational`; no external dependency was involved.

## Compatibility boundaries

The ledger (`docs/naming/canonical-naming-map.json`) holds every boundary with reason, consumer, owner, removal condition and, for 1083 of 2191 rows, a covering test. 316 rows gained a covering test this mission through eight behavioral or contract test groups, each proven to fail when the alias is broken (nine mutation checks). **1075 temporary rows still have no covering test**: the triage found no row provably dead or obsolete from the repository alone (that needs evidence that the backfills ran in every environment), and the remaining groups are web mirrors, the RBAC dual read (gated by owner authorization of RBAC S5), and the CZ release families. The ratchet only allows the number to go down.

## `share_type`

Not resolvable from the repository: no canonical source fixes the value set, the handling of omitted values or the backfill, and a backfill is an L5 data change. The generic TODO is replaced by a DECISION REQUIRED block in `apps/api/src/modules/shares/share-eligibility.util.ts` (options A: explicit `registry` value + CHECK + backfill migration; B: keep NULL as the signal; consequences and impact). The derivable part was done: the rule now has one implementation and a guard test.

## Authentication

Validated without institutional credentials: dev-bypass isolation (`AUTH_DISABLED` only when `NODE_ENV` is exactly `development`), production guards and fail-closed startup, the four dev-auth scripts (explicit `DEV_AUTH_*` flags, prod-like and non-loopback targets refused, no silent downgrade to public-only), the production flags gate (`verify:production-flags`), guard negatives, and the flag agreement spec. **Real authentication is NOT validated** and no server-side access-token revocation exists; the E2E login journey needs institutional credentials (BLOCKED_EXTERNAL).

## Security review

`security-reviewer` on `c618927..HEAD`: PASS-WITH-FINDINGS, no CRITICAL or HIGH. Findings and disposition: G-1 loopback tunnel to a remote API (accepted; the server-side production guard is the control); G-2 removed web flags unchecked (fixed: a stale `true` fails the build); G-3 takedowns `tenant_id` spread order (fixed, test); G-4 non-failed workflow logs unsanitized (fixed, test); orchestrator name handling (path traversal through workflow, agent, skill or task names) fixed with `SAFE_NAME` validation and a regression test. Approval bypass, evidence forgery and replay of the driver rest on the earlier review of `orchestrate.mjs` plus its tests; they were not re-audited in depth this mission.

## Regression review

`regression-reviewer`: PASS-WITH-FINDINGS, no regression (api jest 460 suites and 6834 tests, web 251 files and 1891 tests). LOW findings fixed: stale `VITE_DISABLE_AUTH` banner and comments, a dead compose build arg, stale mentions in `SECURITY_ARCHITECTURE.md`, `docker-compose.prod-test.yml` and a script comment. Operational note: the staging smoke job now fails loudly when `STAGING_SMOKE_TOKEN` or `STAGING_SMOKE_TENANT` is unset (intended).

## Gates

`GATE | COMMAND | RESULT | EVIDENCE`: the per-gate results, commands and exit codes of the final run are recorded in `.claude/docs/pack/evidence-index.md` (generated by `node .claude/runtime/evidence-index.mjs` after the last change) and in the final answer. A gate that was not executed is reported BLOCKED, never PASS.

## Residue scan

Recorded after the last change in the final answer and in the evidence index (commands: `grep` for `TODO|FIXME`, skipped or focused tests, `findings/*.md` references, the removed flag names, `node scripts/verify-provider-residue.mjs`, `node scripts/verify-xlsx-only.mjs`, `node scripts/naming/technical-naming-census.mjs --check`).

## Open blockers (17) and what each needs

These are not external dependencies; they need an owner decision or an authorization the rules do not let an agent give.

| Blocker | Needs |
|---|---|
| BLK-C3-E6, BLK-HR-LEGACY-MIRRORS, BLK-SHARES-ARTIST-MIRROR, BLK-WORKS-LEGACY-DUPLICATES, BLK-PHONOGRAMS-LEGACY-DUPLICATES, BLK-TRANSACTIONS-LEGACY-DUPLICATES, BLK-CLIENTS-LEGACY-DUPLICATES | Authorization to run the prepared archive-then-drop drafts (`apps/api/src/database/migration-drafts/`, `docs/engineering/legacy-column-drop-plan.md`): preflight counts 0 in dev, staging and production, `LEGACY_DROP_CONFIRM`, registration in the migration index. Destructive data change, L5. |
| BLK-HR-PII, BLK-CRM-PII-PLAINTEXT | Security and product decision: persist the fields encrypted (L5 backfill) or remove the inputs. |
| BLK-TRANSACTION-CATEGORY-TAXONOMY | Accounting owner states the English meaning of `receitas-internas` and `repasse-contrato`. |
| BLK-RELEASES-STATUS-CHECK | Product decision on rejected and taken-down release states. |
| BLK-PHONOGRAMS-DERIVED-FIELDS | Product decision on the canonical field for duration and ISRC. |
| BLK-HR-EMPLOYEE-DOCUMENTS | Storage provider, document types, retention and access rules. |
| BLK-CONTRACT-CATEGORY-REGISTRY | Contracts owner decides canonical categories for `non_exclusive`, `representation`, `services`. |
| BLK-CI-JOB-NAME-FASE | Repository admin confirms the job name is not a required status check (branch protection is unreadable from here, HTTP 403). |
| BLK-LEGACY-ROOT-SQL | Owner decides about `apps/api/migrations-complete.sql` (gate allowlist, its test and docs change together). |
| BLK-E2E-ROOT-XLSX-DEPENDENCY | Authorization of a manifest and lockfile change (`xlsx` as a root devDependency). |

## External blockers

Only real external dependencies: no transcription provider, no distributor API, no payout provider (their ports answer `CAPABILITY_UNAVAILABLE`), and institutional credentials for the E2E login journey. Unblock condition for each: the owner authorizes a provider and supplies credentials.
