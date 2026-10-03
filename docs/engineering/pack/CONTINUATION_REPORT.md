# Continuation report: closing the naming normalization (workflow naming-normalization)

Order: continue from SHA `eeb88913de0c0dbc` on `dev` (the owner confirmed `dev`), close the workflow-runtime gap, reopen every blocker, prepare every destructive operation without executing it. This report is generated from the real plan records and evidence; nothing in it is asserted without an evidence id.

## 1. Git state

- Branch `dev` only; every commit pushed to `origin/dev`; no other branch, tag, merge, force push or amend (independent git audit evid-961bb44b, PASS).
- 29 commits since `eeb8891` (28 audited, plus this report); no dependency, lockfile, `.env*` or supabase change; the only CI change is the rename of the job to `Security Regression`.
- Registered migrations added: `20260930000037`, `20260930000038`, `20261002000001` (additive). Every destructive draft under `apps/api/src/database/migration-drafts/` stays UNREGISTERED and refuses to run without its own confirmation token.

## 2. Workflow runtime (the earlier gap)

Earlier the order went straight from intent to a task graph because the pack had no discovery or matching layer at all, so no workflow could ever have been selected. Fixed: `.claude/runtime/workflow-match.mjs` (discovery of all 25 manifests, scoring, every candidate persisted as a `workflow-match` record), `plan` binds the matched workflow and creates a `workflow-instance` whose phases own the tasks, completed evidenced work is adopted (not duplicated), `NO_WORKFLOW_MATCH` is a pack gap, and the canonical `naming-normalization` workflow was added with `match` metadata. Gates `workflow-coverage`, `workflow-runtime-exercised` and `workflow-instance-complete` enforce it. Three independent adversarial rounds hardened the layer (empty adoption, out-of-order closure, forged records, single-vote quorum, abandon/reassign guards, attributed reviews): 116 pack regression tests pass. Residual, inherent to plain-JSON local state: any process with filesystem access can edit `.claude/ops`, and there is no authenticated human identity; the durable boundary is CI/branch protection/human review (documented in `orchestration.md`, "Record integrity").

## 3. Execution table

| WORKFLOW | INSTANCE | STEP | AGENT | SKILL | CAPABILITY | RESULT | EVIDENCE |
|---|---|---|---|---|---|---|---|
| naming-normalization | work-c27898bd | census | naming-analyzer | naming-analysis, repository-census | repository-census | COMPLETED | evid-ef9d3358 |
| naming-normalization | work-c27898bd | classify | naming-analyzer | naming-analysis, duplication-analysis, dead-code-analysis | naming-analysis | COMPLETED | evid-93e29a14 |
| naming-normalization | work-c27898bd | canonical-model | naming-reviewer | canonical-naming | canonical-naming | COMPLETED | evid-8ace878b |
| naming-normalization | work-c27898bd | schema-plan | migration-planner | migration-audit, destructive-change-check | migration-planning | COMPLETED | evid-bd7ed4f5, evid-d9d5ba87, evid-571ce3fe |
| naming-normalization | work-c27898bd | destructive-approval | human-approval-agent | evaluate-human-approval, request-human-approval | human-approval | WAITING_APPROVAL (human) | none: no approval exists |
| naming-normalization | work-c27898bd | propagate | implementation-engineer | safe-refactor, schema-normalization | safe-refactor | COMPLETED | evid-35f5fa7f, evid-07cdc4e8 |
| naming-normalization | work-c27898bd | compatibility | qa-engineer | create-contract-tests, create-regression-tests | contract-testing | COMPLETED | evid-cd654d29, evid-5fca3e71, evid-d418cd42, evid-79371c58 |
| naming-normalization | work-c27898bd | verify | migration-test-engineer | create-migration-tests, run-unit-tests, run-typecheck | migration-verification | COMPLETED | evid-6dc93db6, evid-a7c9bded, evid-6d9208d3, evid-a909ffa4, evid-54995d24, evid-4d5baf31, evid-43b55c78, evid-8a94a616, evid-f33acd02, evid-15464194, evid-4eebd84c, evid-a5060f8d, evid-f9c9805f, evid-49fdc9cf, evid-7776a19a, evid-7bcafa13 |
| naming-normalization | work-c27898bd | residue | dead-code-detector | residue-search, orphan-analysis | residue-search | COMPLETED | evid-c6436dbc, evid-a5ba8a95, evid-ac32403d, evid-d59c4a2f |
| naming-normalization | work-c27898bd | review | security-reviewer | security-audit, diff-review, blast-radius-analysis | security-review | COMPLETED | evid-f18da642, evid-65aac649, evid-6f5b209d |
| naming-normalization | work-c27898bd | closure | git-auditor | definition-of-done | git-audit | COMPLETED | evid-961bb44b, evid-91738c19 |
| naming-normalization | work-c27898bd | completion-gate | completion-controller | definition-of-done | completion-control | PENDING (blocked by the approval) | none yet |

The plan also holds 31 delegated work tasks (b1-b7 tracing, p-* implementation, c-* compatibility, s1 rehearsal) all COMPLETED with evidence. Match record `work-b3fd2144`, instance `work-c27898bd`, plan `orch-dff75522`.

## 4. Numbers (before -> after)

| Metric | Before | After |
|---|---|---|
| ACTIVE temporary compatibility rows without a covering test | 1075 | 0 (ratchet `untestedTemporaryRows` = 0) |
| Covering tests mutation-proven | none verified | api 27 slices + 11 targeted, web 30 modules, 6 weak ones fixed or removed |
| Ledger exception rows | 2453 | 3145 |
| Blockers | 25 rows, 17 open per the order | 25 rows: 13 RESOLVED, 12 OPEN (9 DESTRUCTIVE_APPROVAL_REQUIRED, 2 GENUINE_BUSINESS_DECISION, 1 EXTERNAL) |
| Solvable naming blockers left | 17 open | 0 (every open one is an approval, a business decision or external) |
| Tests | n/a | api 500 suites / 7350 tests, web 280 files / 2163 tests, pack 116, naming census tests 65 |
| Technical-naming census | n/a | 4561 files, 0 new Portuguese technical names |

## 5. Gates on the final tree (head recorded in each evidence record)

| GATE | RESULT | EVIDENCE |
|---|---|---|
| node scripts/naming/technical-naming-census.mjs --check | PASS | evid-fc25ddb0 |
| node scripts/naming/validate-canonical-map.mjs | PASS | evid-19167db8 |
| node apps/api/node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit | PASS | evid-3ca139d2 |
| npm --prefix apps/api run test -- --silent | PASS | evid-5a359727 |
| node apps/web/node_modules/typescript/bin/tsc -p apps/web/tsconfig.app.json --noEmit | PASS | evid-5e5fddd6 |
| npm --prefix apps/web run test | PASS | evid-396c9eba |
| node scripts/verify-provider-residue.mjs | PASS | evid-04627fc1 |
| node scripts/verify-migration-source-of-truth.mjs | PASS | evid-55a85831 |
| node scripts/verify-branch-topology.mjs | PASS | evid-568fee81 |
| node scripts/verify-critical-workflows.mjs | PASS | evid-9e2e72ab |
| node --test scripts/git-guard/policy.test.mjs | PASS | evid-a79bdb26 |
| node scripts/verify-xlsx-only.mjs | PASS | evid-7e5341fc |
| node apps/api/node_modules/typescript/bin/tsc -p apps/api/tsconfig.build.json --noEmit | PASS | evid-b853c52a |
| env DATABASE_URL=postgresql://postgres@127.0.0.1:54329/music_os_scratch DB_SSL=false node  | PASS | evid-0ae19293 |
| pnpm --filter @music-os-360/api exec jest --config jest.config.ts src/database/entities-re | PASS | evid-06a6da6d |
| env DATABASE_URL=postgresql://postgres@127.0.0.1:54329/music_os_scratch DB_SSL=false NODE_ | PASS | evid-463e9ebd |

Security gate (`gate-engine.mjs security`) PASS. Completion gate BLOCKED by one thing only: the destructive approval (see section 7). Independent reviews recorded: security PASS (evid-f18da642), regression PASS (evid-65aac649), git audit PASS (evid-961bb44b), canonical-model / schema-plan / residue reviews returned FAIL with findings that were fixed (recorded FAIL evidence kept), last adversarial verdict FAIL with the fix applied and regression-tested (evid-7dfa5cbd).

## 6. Residue scan and accepted findings

- Residue scan (dead-code-detector): stale ledger rows removed, stale doc notes fixed, no TODO/FIXME or empty catch added, no confirmation token set in CI/scripts/env.
- Accepted: `env.schema` keeps an all-zero `ENCRYPTION_KEY` default (rejected for production/staging; an unset `NODE_ENV` is caught by `verify:production-flags`); `EncryptionService` fails closed outside development/local/test.
- Accepted: the retirement draft `20260930000052` must be re-timestamped after the PII backfill draft when registered (documented).
- Not done by choice: `/var/tmp/pgreg` (78 MB scratch data of a reviewer's disposable database) could not be removed (permission denied); it is outside the repository.
- Providers (transcription, distributor, payout) stay `CAPABILITY_UNAVAILABLE`; no provider was added.

## 7. Surviving genuine decisions

Only these remain; each needs a human. Fields: ID, domain, files/schema, current state, canonical rule available, why it is not derivable, option A/B with impact, non-binding recommendation, operation executed after approval, risk, reversibility, data affected, tests already run.

### D1 - Column drops (7 groups + HR PII columns): DESTRUCTIVE_APPROVAL_REQUIRED
- Domain: events, HR, shares, works, phonograms, transactions, clients. Files: `migration-drafts/20260930000040-46`, `53`, `48/49` (invoices), `legacy-column-drop-plan.md`.
- Current state: entities no longer map the legacy columns; reads/writes/jobs/scripts traced with no producer or consumer; archive-then-drop drafts rehearsed up/down/up on a disposable COPY database (35 e2e assertions).
- Canonical rule: the canonical column of each pair is authoritative; the archive keeps every legacy value by id.
- Why not derivable: dropping data is irreversible without the archive and needs per-environment census and (HR, clients) reconciliation and a retention decision.
- Option A: approve group by group, one destructive migration per deploy, DEV then staging then production, after the owner's census returns 0 divergences. Impact: columns gone, archives kept until retirement. Option B: keep the columns indefinitely. Impact: permanent duplicated fields (a finding under naming-canonical).
- Recommendation (non-binding): A, in the documented order, after the signed census.
- Operation after approval: `LEGACY_DROP_CONFIRM` set only in that deploy job for the named migration.
- Risk: data loss if the census is skipped. Reversibility: `down()` restores by id from the archive until the archive is retired. Data affected: the legacy_* columns listed in the plan (HR archives hold personal data). Tests: 188 draft specs, e2e up/down/up on a copy.
- External evidence still required: production census, signed clients pair census, HR retention decision, staging rehearsal on restored production data, PITR id, table sizes.

### D2 - Artist/client PII backfill and scrub: DESTRUCTIVE_APPROVAL_REQUIRED
- Files: `20261002000001` (registered, additive), draft `20261002000002`, `data-governance-pii-backfill.md`. State: ciphertext-only writes, dual-read, export/log redaction live; existing rows still hold plaintext until the backfill. Rule: existing `EncryptionService` pattern. Not derivable: encrypting and scrubbing production rows needs key escrow, a restore proof and a retention owner for the plaintext archives.
- Option A: run the backfill (archive first), then later drop the plaintext columns as a separate approval. Option B: leave historical plaintext. Recommendation: A with key escrow evidenced first. Reversibility: archive restore until retired; key loss makes scrubbed data unrecoverable. Tests: draft spec (gates, order, residue audit, down), PII encryption specs with negative paths.

### D3 - Release status for rejected/taken-down rows: GENUINE_BUSINESS_DECISION
- Files: `releases.status`, ReleaseStatus, runbook census query added. State: the workflow has no rejected/taken_down state. Option A: add `rejected`/`taken_down` to ReleaseStatus (workflow, labels, CHECK). Option B: move those rows to `cancelled`. Recommendation: decide after the census; preserve Release != Distribution. Operation: map rows and add `chk_releases_status`. Reversibility: metadata keeps the original value.

### D4 - HR employee documents: GENUINE_BUSINESS_DECISION
- No storage backend, document types, retention or read scope exists anywhere; the unavailable state is tested. Option A: build the capability with an owner-chosen storage; Option B: keep it unavailable. Recommendation: B until the owner specifies the four items.

### D5 - CI required check name: EXTERNAL
- The job is renamed; rulesets read through the API require no status check; classic branch protection returned 403. A repository admin confirms no required check uses the old name `Security Regression (FASE 9.x fixes)`.

### D6 - Later releases (not asked now)
- Retirement of drop and PII archives (`20260930000052`) and purge of backfill side tables (`20260930000050`) need their own approvals after the rollback windows; end-to-end login with institutional credentials and token revocation are external; shares registry creation (NC-039) and the transactions v2 ledger cutover (NC-041) remain product decisions recorded in the ledger.
