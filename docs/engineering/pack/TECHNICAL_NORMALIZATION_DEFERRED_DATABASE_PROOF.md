# Technical normalization: deferred database-schema proof (persistent handoff)

Verdict kept by this checkpoint: `TECHNICAL NORMALIZATION: CONDITIONALLY COMPLETE — DATABASE PROOF DEFERRED` (reconstruction readiness: `WAITING FOR DATABASE PROOF`; the measurements behind it are in `docs/engineering/pack/TECHNICAL_NORMALIZATION_FINAL_VALIDATION.md`, which supersedes the numbers of sections 2, 5 and 7 below where they differ)

Status of the dependency: `BLOCKED_EXTERNAL` / `DEFERRED`. PostgreSQL (and Supabase) access is not available in the working
environment at the time of this checkpoint. Nothing was done to work around that: no credential was changed, no authentication
was bypassed, no database was started or altered by this work, and nothing destructive was run. The verdict becomes
`VERIFIED` only when the proof below is regenerated and every gate in section 5 is green; it must not be raised before.

This file is the resume point. The full comparison is `docs/engineering/pack/TECHNICAL_LANGUAGE_BEFORE_AFTER_REPORT.md`;
the closure record and the resume rules are `docs/engineering/pack/TECHNICAL_NORMALIZATION_HANDOFF.md`.

## 1. What was concluded (independent of the database)

- Resume from checkpoint `6b6db7ae39141ce2fb5520f0e951da52971d1cc0`; all later work is commits on `dev` only (no branch, tag or pull request).
- The twelve open adversarial findings of the handoff were reproduced and fixed (shares cross-tenant FK ownership, invoices
  fiscal document kind `fiscal_document_type`, MusicChat routing-key scaffolding removed, shared team-contact category map,
  prototype-key hardening, report contract spelling variants, CI wiring of the real-PostgreSQL specs, and the rest listed in the report, section 25).
- Round-3 findings fixed in this checkpoint: stored MusicChat `queueKey`/`sectorKey` no longer make a settings save fail (accepted as
  deprecated input and dropped before persistence); invoice domain events read `fiscal_document_type` first; the CZ-045 ledger text was corrected.
- 198 per-token documentation rows (surface `docCode`, class `UX_TEXT`) replace the former baselined documentation-code debt; the census debt is now only the baselined prose surface `doc`.
- Domain distinctions preserved (Project, ProjectTrack, Release; Work, Phonogram, ReleaseTrack; Project and Distribution). No functional or architectural reconstruction was started.

## 2. What was proven (fresh, on the final product tree)

| Evidence | Command | Result |
|---|---|---|
| Naming aggregate gate | `pnpm naming:check` | exit 0 (census, ledger validation, rendered documents, 11 gate test files: 210 tests, 209 pass, 1 skipped; boundary audit; wiring audit; historical records; destructive dossier) |
| Boundary audit | `node scripts/naming/compat-boundary-audit.mjs --check` | 4,547 rows; the four counters are 0 (`LEGACY_FIRST_READS` included) |
| Wiring proof | `node scripts/naming/compat-wiring-proof.mjs --check` | `WIRING_SITES_UNPROVEN=0` of 516 call sites |
| Mutation proof | `pnpm naming:compat:prove -- --shards 4` | 275 pairs, resumable, every credited row killed |
| Typecheck, lint, build | `pnpm --filter @music-os-360/api typecheck`, `pnpm --filter @music-os-360/web typecheck`, `pnpm lint`, `pnpm build` | all exit 0 (lint: 0 errors) |
| API and web suites | `npx jest` in `apps/api`; `npx vitest run` in `apps/web` | final rerun on the committed code: API 557 suites passed (1 skipped), 9,174 tests passed, 17 skipped; web 388 files, 3,190 tests passed; shared vocabularies 7 pass |
| Independent reviews (round 3) | read-only agents | security review PASS (0 CRITICAL, HIGH, MEDIUM); adversarial review FAIL with one MEDIUM finding, fixed in the checkpoint product commit and not re-reviewed |
| Independent reviews of round 4 (`ac15d319`) | read-only agents | adversarial review PASS (no CRITICAL, HIGH, MEDIUM); regression review FAIL with one MEDIUM (a stored JSON key renamed without a read fallback), fixed in `99f25048` and re-reviewed: PASS. Details: `TECHNICAL_NORMALIZATION_FINAL_VALIDATION.md` section 4 |

## 3. The three database-schema boundaries still unproven (preserved, not hidden)

They are ledger rows with path `database-schema` in `docs/naming/canonical-naming-map.json`. The classifier reports each as
`UNPROVEN: database-schema boundary without a fresh schema proof`. The recorded proof is stale because the check script was
extended after it was generated (it gained a `tipo_nota` check and a column-rename mutant), so all three need the regenerated record:

1. `transferencia`: the legacy value still accepted by `chk_invoices_payment_method` next to `bank_transfer` (migration 20260930000021).
2. `events.data`: the legacy timestamp column kept equal to `events.starts_at` by the trigger `trg_events_sync_start_columns`.
3. `tipo_nota`: the persisted column of the invoice fiscal document kind (API name `fiscal_document_type`; the column keeps its name, owner decision R1). New check: a row written with a kind reads back the same kind from that exact column; new mutant `invoices-fiscal-kind-column` renames the column in a throwaway copy and the check must fail.

The first two were proven (2 of 2 mutants killed on a real migrated PostgreSQL, record generated 2026-10-06T00:29:20Z) before the check script changed.

## 4. Exact command to resume when PostgreSQL is available again

Preconditions: a migrated, disposable PostgreSQL 16 with the Supabase shim (`apps/api/scripts/local-auth-shim.sql`); the operator supplies
the password through `PGPASSWORD` in the environment (never in a file or in the repository). The proof creates and drops throwaway
database copies named `<database>_boundary_*` and never alters the migrated database.

```bash
export PGPASSWORD=...            # supplied by the operator
export DB_SSL=false
export DATABASE_URL=postgresql://musicos360@127.0.0.1:5432/music_os_check   # a migrated disposable database
pnpm --filter @music-os-360/api db:check                                      # the schema is migrated and consistent
node scripts/naming/schema-boundary-proof.mjs --prove                         # regenerates docs/naming/audit/schema-boundary-proof.json (3 mutants must be killed, baseline exit 0)
node scripts/naming/schema-boundary-proof.mjs --check                         # offline freshness check of the record
node scripts/naming/compat-boundary-classify.mjs --report                     # regenerates the committed classification
node scripts/naming/compat-boundary-classify.mjs --check                      # must exit 0: UNPROVEN = 0
node scripts/naming/schema-naming-census.mjs --check                          # schema census (needs the database)
```

Then, to close the evidence chain: re-record the two database criteria with
`node .claude/runtime/ops.mjs evidence run --cmd "<command>" --criterion <id>` (schema census `ac-5305eb7b`, `db:check` `ac-577b07af`),
refresh the other criteria if any tracked path changed since, run `node .claude/runtime/gate-engine.mjs security` (must be `PASS`) and
`node .claude/runtime/completion-gate.mjs`, regenerate the audit documents (`pnpm naming:audit`, `node scripts/naming/render-naming-docs.mjs`),
update the verdict in the report, commit and push to `origin/dev`.

If the regenerated proof shows a surviving mutant, the boundary is not proven: fix the check or the schema object, never the gate.

## 5. Which gates depend only on that proof, and which are already green without it

Depend exclusively on the database-schema proof (red or blocked now):

| Gate | Why |
|---|---|
| `node scripts/naming/compat-boundary-classify.mjs --check` | exactly 3 UNPROVEN rows, the three boundaries above |
| `node scripts/naming/schema-boundary-proof.mjs --check` | the recorded proof is stale for the extended check script |
| `COMPATIBILITY_BOUNDARIES_WITHOUT_REQUIRED_PROOF` (counter 7 of the report) | equals 3 for the same rows |

Need PostgreSQL for other reasons (not run in this checkpoint, status BLOCKED_EXTERNAL): `db:migrate`, `db:check`,
`node scripts/naming/schema-naming-census.mjs --check`, `node scripts/naming/residue-census.mjs`, `verify:rls`, `verify:tenant-isolation`,
`verify:schema-compat-boundaries`, the evidence criteria `ac-5305eb7b` and `ac-577b07af`, and therefore `gate-engine security` and the completion gate.

Green without the database (measured on the final tree): `pnpm naming:check`; the technical census (debt: `doc` only); the ledger validation;
the boundary audit (all four counters 0); the wiring audit (0); the historical records audit; the destructive dossier; API and web
typecheck; lint (0 errors); API and web full suites; `pnpm build`; the shared vocabularies test.

## 6. Open items that are decisions or approvals (never self-granted) and the orchestration state

- The blockers in `blockers[]` of the ledger and `docs/engineering/product-decision-packages.md` are unchanged: destructive approvals (column drops, role slug rename, PII scrub), product decisions, external dependencies (`graphify`, `osv-scanner`, `codeql` are not installed; their runs need network).
- Orchestration plan `orch-4281815e` is `ACTIVE`: counts COMPLETED 20, BLOCKED_EXTERNAL 1, PENDING 10. `classify` is `BLOCKED_EXTERNAL` (record: PostgreSQL needed for the schema boundary proof; unblock = section 4). `n6-gate-mutation`, `w1-types-api`, `w2-musicchat` and `w5-invoices-api` were closed with real evidence ids. The downstream phases stay `PENDING` behind `classify` and `destructive-approval` waits for a human, never self-granted. After the database proof: `node .claude/runtime/orchestrate.mjs next`, run `classify` again, and continue the phases.

## 7. Evidence and gate state at this checkpoint

- Fresh command evidence was recorded with `ops.mjs evidence run` for 14 of the 16 criteria on the final workspace (typecheck, API and web suites, census, ledger validation, provider residue, migration source of truth, branch topology, critical workflows, git-guard policy, XLSX-only contract, build typecheck, database-layer unit specs).
- `node .claude/runtime/gate-engine.mjs security` = `BLOCKED`, and the only two reasons are the criteria that need PostgreSQL: `ac-5305eb7b` (schema census) and `ac-577b07af` (`db:check`). Mission status: `openCriteria` 0, `openFindings` 0, `openBlockers` 0, `readyForCompletionGate` true; the completion gate was not run because the security gate is not PASS.
- The round-3 reviews were superseded by fresh independent reviews of round 4 and of its follow-up fix (section 2); their verdicts are bound to the commits they reviewed, not to a later documentation-only fingerprint.

