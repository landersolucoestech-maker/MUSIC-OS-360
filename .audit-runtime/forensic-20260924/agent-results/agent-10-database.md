# AGENT-10 — Database/Migrations/RLS Inventory Audit

subagent_type: database-reviewer
input_snapshot: HEAD 8c477787c043bdf0ceecf9feafe27a17fc932a3c
tool_uses: 79
duration_ms: 954655
status: COMPLETED

## Migration inventory: exact counts
274 migration files on disk (apps/api/src/database/migrations/, excluding index.ts). 272 imported and present in migrations/index.ts's ALL_MIGRATIONS array -- import list and array match exactly, 0 discrepancies.

## Classification consistency: zero mismatches, exhaustively checked
Exactly 1 migration classified EXTERNAL_MANAGED (RealtimeBroadcastAuthorization20260801000001), matching prior session findings. Grepped all 274 migrations for auth./storage./realtime./extensions. schema-qualified identifiers (18 files matched), filtered to real DDL verbs: only the one EXTERNAL_MANAGED migration performs real non-public-schema DDL. The other 17 matches are read-only predicates or false positives (frontend storage.ts). Zero classification mismatches across all 274.

## Registration parity: 2 unregistered files, both deliberate and CI-guarded
20260713000002_DropOrphanContactsSatelliteTables.ts and 20260910900001_PROPOSAL_BackfillArtistGoalStatusToEnglish.ts exist on disk but aren't registered -- both deliberate, documented, and enforced by scripts/verify-migration-source-of-truth.mjs's INTENTIONALLY_UNREGISTERED_MIGRATIONS allowlist. Zero dangling registrations (registered name with no file).

## RLS coverage: zero tenant-scoped tables missing RLS
171 currently-existing application tables reconstructed (event-ordered CREATE/DROP/RENAME across all 274 migrations). 178 tables have ENABLE ROW LEVEL SECURITY with no later DISABLE. 3 initial diff candidates, all resolved as non-issues on manual read: 2 false-negatives from the extraction regex (skill_run_logs/workflow_execution_logs DO have RLS, just missed by a tuple-destructuring pattern), 1 deliberately tenant-less-by-design table (market_reference_metrics, no tenant_id column, intentional cross-tenant cache). Zero real gaps.

## New finding (MEDIO) — schema-reconciliation e2e coverage gap
apps/api/test/e2e/schema/schema-reconciliation.e2e-spec.ts is a genuine live-Postgres drift guard but exercises only 5 of ~171 current tables. Real per-incident drift guards exist (lead/client-entity-schema-alignment.spec.ts, etc.) written reactively after real bugs, not as blanket coverage. Spot-checked InvoiceEntity against its most recent migration (dated today, 20260923000001) and found it consistent -- no active drift found, this is a coverage-gap finding about the guard's breadth, not an active bug.

## Real tooling usage
Recorded 4 findings via the project's own ops.mjs finding add (3 INFO confirming zero-defect results with methodology, 1 MEDIO for the coverage gap), closed with evidence review --verdict PASS -- using the real Engineering OS evidence-governance mechanism, not narration.

## Classification summary
- Migration inventory: VERIFIED, exact counts (274/272/2-deliberate)
- Classification consistency: VERIFIED CLEAN (0/274 mismatches)
- Registration parity: VERIFIED CLEAN (2 deliberate + CI-guarded, 0 dangling)
- RLS coverage: VERIFIED CLEAN (0/171 tenant tables missing RLS, 3 candidates resolved)
- Schema-drift guard breadth: NEW FINDING, MEDIO severity, informational (5/171 e2e coverage, no active drift found)
