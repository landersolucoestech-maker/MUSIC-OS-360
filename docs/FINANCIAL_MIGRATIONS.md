# Financial Domain Migrations (M0–M9)

> Materialization of the **Phase 12 — Financial Database Design** specification
> (official decisions of Phases 11/12, Q1–Q10). Created in **Phase 13A** —
> **NONE executed yet**; execution on the DEV branch is **Phase 13B** and
> requires its own authorization.

## Sequence (mandatory order)

| M | File (`apps/api/src/database/migrations/`) | Content |
|---|---|---|
| M0 | `20260718000000_FinancialPrereqs.ts` | pgcrypto (idempotent) + `UNIQUE (tenant_id, id)` on projects/artists/phonograms/releases/clients/contracts/events (basis for the composite FKs — I6) |
| M1 | `20260718000001_FinancialEnums.ts` | 9 closed enums (status WITHOUT paid/received/overdue/partially — unified `settled`; `overdue` is derived) |
| M2 | `20260718000002_FinancialCategories.ts` | global templates (read-only) + per-tenant categories (hierarchy ≤3, nature → P&L line, logical deactivation, level trigger) |
| M3 | `20260718000003_FinancialPartiesAccounts.ts` | financial accounts (derived balance), counterparties (optional typed FK to artists/clients), cost centers |
| M4 | `20260718000004_FinancialTransactions.ts` | v2 transactions (accrual/due/settlement dates, currency, installments, reversal) + state machine + settled immutability + optimistic locking |
| M5 | `20260718000005_TransactionAllocations.ts` | allocations in PARALLEL DIMENSIONS (project/artist/phonogram/release) + `fn_largest_remainder` + deferred constraint trigger for sums (I5/I7) |
| M6 | `20260718000006_FinancialBudgets.ts` | per-project budget (1 active) + append-only revisions |
| M7 | `20260718000007_FinancialRls.ts` | ENABLE+FORCE RLS + `_isolation`/`migrator_admin_all` policies + conditional grants (`musicos_*` roles are NOT created in a migration) |
| M8 | `20260718000008_PerformanceMetricEntries.ts` | performance metrics (never a transaction — I12), partial UNIQUE dedupe, correction via supersede, own RLS |
| M9 | `20260718000009_FinancialOperationalBridges.ts` | optional `financial_project_id` on marketing/audiovisual_projects (Q6/Q7 — no automatic association) |

## External dependencies (provisioning, outside migrations)

- Cluster roles `musicos_migrator`/`musicos_app`: the grants and the
  migrator policy are **conditional** (`IF EXISTS pg_roles`) — without the roles, the
  migration passes and the grants stay pending until provisioning is re-run.
- `private_get_tenant_id()`: created by the existing chain
  (`20260612000001_PortableRlsTenantContext`) — M7/M8 run **after** it in the
  natural order of the chain.
- Seed of the category templates: **technical load via `db:seed`** (structure and
  data kept separate — no migration inserts data).

## Invariants protected in the database

I1 (amount>0) · I5/I7 (sums per dimension, largest remainder, deferred trigger) ·
I6 (composite FKs with tenant — cross-tenant is impossible) · I8 (settled is immutable)
· I9/I10 (RESTRICT + logical deactivation) · I16 (status↔settlement_date) ·
I17 (dedupe + referenced correction) · state machine
(`pending→settled|cancelled`, `settled→reversed`) · physical deletion forbidden
(transactions and metrics) · transfer without allocation and without P&L (trigger).
The remaining invariants (I2/I3/I11/I13/I14/I15) are query/service-level and will be
protected in the backend + reconciliation tests (backend phase).

## Largest remainder algorithm

Normative in Phase 12 §10. Two equivalent materializations:
`fn_largest_remainder(numeric, numeric[])` (SQL, M5 — for import/validation) and
`apps/api/src/modules/financial/domain/largest-remainder.ts` (pure TypeScript,
BigInt, no float — the backend write path). Tie-break: largest fraction;
on a tie → lowest input index. An installment that results in R$ 0.00 → rejection.

## Tests of this phase (no database)

- `largest-remainder.spec.ts` — minimum cases from the mandate + normative ones.
- `financial-migrations.static.spec.ts` — static contracts (existence,
  order, up/down, absence of secrets/forbidden refs/OWNER TO/seeds,
  composite FKs, RLS+FORCE, CASCADE restricted to the 2 justified cases).

## Phase 13B (execution on DEV) — prerequisites

DEV password reset · temporary token revoked · `SUPABASE_ACCESS_TOKEN`
absent · local `.env` exclusively pointing at DEV (`rypnevnfipygyhysqpdo`) ·
`env:check` green · database guards active (commit `79519134`) · known
working tree · role provisioning before M7 · rollback plan = `down()`
per migration (an empty DEV needs no backup).
