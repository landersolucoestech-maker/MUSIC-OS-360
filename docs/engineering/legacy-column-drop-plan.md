# Legacy column drop plan (LC1)

Status: PREPARED, NOTHING DROPPED. Every destructive step below is a DRAFT under
`apps/api/src/database/migration-drafts/` (not in `ALL_MIGRATIONS`, not importable by the runner, and gated at
execution time by `LEGACY_DROP_CONFIRM`). Executing any of them needs the explicit owner authorization of
section 8. The file `legacy-columns-census.md` that earlier revisions of this plan cited does NOT exist in the repository (no
such file is tracked); the usage evidence is the grep of 3.3 re-run for the release (its output is saved in the release record),
the `file:line` references of section 2 and the physical census of 3.0-3.2. This plan holds the SQL proofs, the order and the rollback.

## 1. What is already done (registered, non-destructive)

| change | where |
|---|---|
| Dead dual-write removed: the API no longer writes `events.data` (the sync trigger fills it); the entity declares no `data` column (pinned by `events-data-legacy-column.spec.ts`) | `events.service.ts` (`dtoToEntity`, `create`), `entities.ts` (`EventEntity`), `events-data-legacy-column.spec.ts` |
| Dead web writer removed: the invoice form no longer sends `legacy_amount` (the API derives the NOT NULL mirror from `service_amount`) | `useInvoiceForm.ts`, `useInvoiceForm.legacy-amount.guard.test.ts`, `invoices.service.spec.ts` |
| `invoices.legacy_amount` EXPAND: Stripe upsert dual-writes `service_amount`; overdue scheduler reads `service_amount ?? legacy_amount` | `billing.service.ts upsertStripeInvoice`, `invoice-overdue.scheduler.ts`, specs |
| Backfill migration `20260930000022_BackfillCanonicalFromLegacyMirrors` (guarded, reversible, no drop): fills NULL `invoices.service_amount` from `legacy_amount` and NULL `takedowns.infringing_url` from `url`, recording ids in RLS-locked side tables | `migrations/20260930000022_*.ts`, `backfill-canonical-from-legacy-mirrors.migration.spec.ts` |

`takedowns.url` needs no drop: migration `20260719000016` removed the column from the physical schema, so the entity mapping, the API
writers and the web fallback that still referenced it were removed instead (section 5.2). There is no draft 47.

## 2. Drafts (all gated, all NOT registered)

| draft | drops | archive table | preconditions (abort on any count > 0) | entity / code edits: entity declaration, readers and writers ship in B0 (ONE RELEASE BEFORE the drop, section 4); the physical-column-list script edit ships WITH the drop (release B) |
|---|---|---|---|---|
| 20260930000040 DropWorksLegacyColumns | works.legacy_language_label, legacy_instrumental_flag, legacy_ai_used, legacy_alternative_titles, legacy_lyrics | works_legacy_archive_20260930 | each legacy value has its canonical (language, is_instrumental, ai_used, alternative_titles, lyrics) | remove 5 lines `entities.ts:783-787`; `verify-canonical-column-order.ts:32-34` |
| 20260930000041 DropPhonogramsLegacyColumns | phonograms.legacy_recording_date, legacy_release_date, legacy_duration_minutes, legacy_duration_seconds_part, legacy_origin_country | phonograms_legacy_archive_20260930 | canonical recording_date, release_date, duration_seconds, country_of_recording present wherever the legacy value is | `entities.ts:926-930`; `verify-canonical-column-order.ts:47-49` |
| 20260930000042 DropTransactionsLegacyColumns | transactions.legacy_transaction_type, legacy_transaction_date, legacy_attachment_url, legacy_reference | transactions_legacy_archive_20260930 | attachment_url present where legacy_attachment_url is; notes present where legacy_reference is non-empty (type/transaction_date are NOT NULL) | `entities.ts:1095-1098`; do not mix with TX1 (migration 18) |
| 20260930000043 DropClientsLegacyContactStatus | clients.legacy_contact_status | clients_legacy_archive_20260930 | INFORMATIONAL only (legacy value on a row with an empty status); the claimed canonical `status` is NOT proven (migration 20260719000010 calls `status` distinct from `status_contato`), so the owner-signed (legacy, status) pair census (3.4) is the real gate | `entities.ts:1210`; `client-entity-schema-alignment.spec.ts`: do NOT delete the `status_contato -> legacy_contact_status` entry of `RENAMED_AFTER_CANONICAL` (the migration text it parses still names the column); the spec filters `legacy_contact_status` out of the migration columns through `DROPPED_ENTITY_COLUMNS` (a filter, every other column stays strictly checked); `verify-canonical-column-order.ts:110` |
| 20260930000044 DropSharesLegacyArtistProjectId | shares.legacy_artist_project_id | shares_legacy_archive_20260930 | `legacy_artist_project_id IS DISTINCT FROM artist_id` = 0 | `entities.ts:1579`; `share-contract.spec.ts:91` stays (still true); `verify-canonical-column-order.ts:141` |
| 20260930000045 DropHrLegacyMirrors | employees.legacy_full_name/legacy_sector/legacy_base_salary; payroll_entries.legacy_employee_id/legacy_reference_month; leave_requests.legacy_employee_id | employees_/payroll_entries_/leave_requests_legacy_archive_20260930 (PII: names, salary) | each legacy value equals its canonical (name, department, salary, employee_id, reference_month) | `verify-canonical-column-order.ts:165-203` (no entity declarations) |
| 20260930000046 DropEventsDataAndSyncTrigger | events.data + trigger `trg_events_sync_start_columns` + function `sync_events_start_columns()` + index `idx_events_tenant_data` (with the column) | none (data == starts_at is the proof) | `data IS DISTINCT FROM starts_at` = 0, `starts_at IS NULL` = 0, `idx_events_tenant_starts_at` present | remove `EventEntity.data` (`entities.ts:1387`) in B0; remove the `'data'` entry of the `events` list in `apps/api/scripts/verify-canonical-column-order.ts` (line 89) WITH the drop (release B; the verifier compares the physical column list, which still holds `data` during B0); regenerate the two `.audit-runtime` baselines (`pt-column-census.jsonl`, `pt-census-classified.jsonl`) with `npx tsx .audit-runtime/census-pt-columns.ts` then `npx tsx .audit-runtime/classify-pt-census.ts` and commit both with the change, so `pt-column-naming-baseline.guard.spec.ts` stays green (they are entity-derived: re-run in B0 after every entity removal of section 2); keep `report-form-contracts.ts` deprecated column id `data -> eventDate` (saved layouts) and web header alias "Data"; `add-events-starts-at.migration.spec.ts:40` still true; delete `events-data-legacy-column.spec.ts` trigger assertions together with the trigger |
| 20260930000048 RelaxInvoicesLegacyAmountNotNull | (no drop) `ALTER COLUMN legacy_amount DROP NOT NULL` | none | no row with legacy_amount and NULL service_amount | none; reversible |
| 20260930000049 DropInvoicesLegacyAmount | invoices.legacy_amount | invoices_legacy_archive_20260930 | `service_amount IS NULL` = 0 and `legacy_amount <> service_amount` = 0 | stage 5.1 steps 3-4 first (step 3 is B0 and already removed `InvoiceEntity.legacy_amount`; list of what step 3 removes): `InvoiceEntity.legacy_amount` (`entities.ts:1128`), DTO `invoices.dto.ts:63`, `invoices.service.ts:82,170,183,186,242,259` fallbacks, Stripe upsert column, scheduler fallback, web fallbacks (`useInvoices.ts:17,19`, `Invoices.tsx:63`, `InvoiceViewModal.tsx:64,73`, `useInvoiceForm.ts:92,93`), e2e fixture `invoice-overdue-saas-exclusion.e2e-spec.ts:42` |
| 20260930000053 DropEmployeesLegacyPiiColumns | employees.rg, birth_date, address (plaintext PII: identity document, date of birth, home address; physical columns only, added by 20260712000003, renamed by 20260928000008, NOT mapped by `EmployeeEntity`, form inputs already removed) | `employees_pii_legacy_archive_20260930` (own name: `employees_legacy_archive_20260930` belongs to draft 45; PII, RLS forced, grants revoked, in the erasure SQL, retired by draft 52) | none machine-checkable: there is no canonical counterpart, the values exist only here; the gate is the owner census (3.6) and the HR retention decision | none (no entity declaration, no reader, no writer: B0 is a grep-only proof, 3.3); `verify-canonical-column-order.ts` employees list if it names the columns |

Draft skeleton (`legacy-column-drop.base.ts`): confirmation gate, RLS-bypass guard, `SET LOCAL lock_timeout '15s'`,
`LOCK TABLE "<table>" IN SHARE ROW EXCLUSIVE MODE` on EVERY table of the plans (inside the transaction, after lock_timeout, also in `down()`: writers wait at most 15s, readers are not blocked, so the preconditions and the archive describe exactly the rows the `ALTER` then drops; a lock timeout aborts with nothing written),
presence check (none present: skip; partial: abort), all preconditions for all tables BEFORE any write (counts only,
no values, message bounded to 600 chars), archive table (RLS ENABLED + FORCED, no policy, `anon`/`authenticated`/
`musicos_app` revoked), archive INSERT (`ON CONFLICT (id) DO NOTHING`), archive coverage verification BY VALUE (every live row with a legacy value needs an
archive row whose columns are all `IS NOT DISTINCT FROM` the live ones), staleness verification (any archive row that differs from its
live row, NULLs included, ABORTS: an old archive row left by an earlier up/down/up cycle is never silently kept nor overwritten; the
operator reviews it and retires or renames that archive table), then `DROP COLUMN IF EXISTS` last. Archive tables carry `tenant_id` with
no foreign key (they must outlive a deleted tenant row only until the erasure procedure of
`backfill-side-tables-retention.md` runs, which now lists them). The mock
specs in `legacy-column-drop.draft.spec.ts` pin that order and the rollback.

Note on the typed value `varchar(n)`/`numeric(p,s)` in the archive and in the rollback `ADD COLUMN`: they are the
exact physical types (verify with 3.0 before executing).

## 3. Preflight SQL (zero-use proofs; run read-only on each environment, DEV first)

Run as the migration role (BYPASSRLS) so every tenant is counted. Counts only, never select values (HR columns are PII).

### 3.0 Physical type check (the archive/rollback types must match)

```sql
SELECT table_name, column_name, data_type, character_maximum_length, numeric_precision, numeric_scale, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (column_name LIKE 'legacy\_%' ESCAPE '\'
       OR (table_name = 'events' AND column_name = 'data')
       OR (table_name = 'takedowns' AND column_name = 'url'))
ORDER BY table_name, column_name;
```

### 3.1 Population and reconciliation per table (the same predicates the drafts enforce)

```sql
-- works
SELECT count(*) FILTER (WHERE legacy_language_label IS NOT NULL)                      AS lang_rows,
       count(*) FILTER (WHERE legacy_language_label IS NOT NULL AND language IS NULL) AS lang_unreconciled,
       count(*) FILTER (WHERE legacy_instrumental_flag IS NOT NULL AND is_instrumental IS NULL) AS instrumental_unreconciled,
       count(*) FILTER (WHERE legacy_ai_used IS NOT NULL AND ai_used IS NULL)         AS ai_unreconciled,
       count(*) FILTER (WHERE legacy_alternative_titles IS NOT NULL AND alternative_titles IS NULL) AS titles_unreconciled,
       count(*) FILTER (WHERE legacy_lyrics IS NOT NULL AND lyrics IS NULL)           AS lyrics_unreconciled
FROM works;
-- phonograms
SELECT count(*) FILTER (WHERE legacy_recording_date IS NOT NULL AND recording_date IS NULL) AS rec_unreconciled,
       count(*) FILTER (WHERE legacy_release_date IS NOT NULL AND release_date IS NULL)     AS rel_unreconciled,
       count(*) FILTER (WHERE (legacy_duration_minutes IS NOT NULL OR legacy_duration_seconds_part IS NOT NULL) AND duration_seconds IS NULL) AS dur_unreconciled,
       count(*) FILTER (WHERE legacy_origin_country IS NOT NULL AND country_of_recording IS NULL) AS country_unreconciled
FROM phonograms;
-- transactions
SELECT count(*) FILTER (WHERE legacy_attachment_url IS NOT NULL AND attachment_url IS NULL) AS attachment_unreconciled,
       count(*) FILTER (WHERE legacy_reference IS NOT NULL AND legacy_reference <> '' AND notes IS NULL) AS reference_unreconciled,
       count(*) FILTER (WHERE legacy_transaction_type IS NOT NULL AND legacy_transaction_type <> type)  AS type_differs_info_only,
       count(*) FILTER (WHERE legacy_transaction_date IS NOT NULL AND legacy_transaction_date <> transaction_date::date) AS date_differs_info_only
FROM transactions;
-- clients (owner review: distinct pairs, counts only; the machine check of draft 43 is informational and cannot replace this)
SELECT legacy_contact_status, status, count(*) FROM clients WHERE legacy_contact_status IS NOT NULL GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 50;
-- shares
SELECT count(*) FILTER (WHERE legacy_artist_project_id IS NOT NULL AND artist_id IS DISTINCT FROM legacy_artist_project_id) AS shares_divergent FROM shares;
-- HR
SELECT count(*) FILTER (WHERE legacy_full_name IS NOT NULL AND legacy_full_name IS DISTINCT FROM name) AS name_div,
       count(*) FILTER (WHERE legacy_sector IS NOT NULL AND legacy_sector IS DISTINCT FROM department) AS dept_div,
       count(*) FILTER (WHERE legacy_base_salary IS NOT NULL AND legacy_base_salary IS DISTINCT FROM salary) AS salary_div FROM employees;
SELECT count(*) FILTER (WHERE legacy_employee_id IS NOT NULL AND legacy_employee_id IS DISTINCT FROM employee_id) AS emp_div,
       count(*) FILTER (WHERE legacy_reference_month IS NOT NULL AND legacy_reference_month IS DISTINCT FROM reference_month) AS month_div FROM payroll_entries;
SELECT count(*) FILTER (WHERE legacy_employee_id IS NOT NULL AND legacy_employee_id IS DISTINCT FROM employee_id) AS emp_div FROM leave_requests;
-- events.data
SELECT count(*) FILTER (WHERE data IS DISTINCT FROM starts_at) AS diverging, count(*) FILTER (WHERE starts_at IS NULL) AS null_start FROM events;
-- invoices.legacy_amount (after 20260930000022)
SELECT count(*) FILTER (WHERE service_amount IS NULL AND legacy_amount IS NOT NULL) AS not_backfilled,
       count(*) FILTER (WHERE service_amount IS NOT NULL AND legacy_amount IS NOT NULL AND service_amount <> legacy_amount) AS diverging
FROM invoices;
```

Every "unreconciled/divergent" count must be 0 (a non-zero count means a legacy value would lose its only copy: reconcile
by hand, or accept it explicitly and let the archive keep it). The `*_info_only` counts are for the owner's review.

### 3.2 No readers in production (query log evidence)

The code census proves no code path reads these columns. Confirm no external reader (BI tool, manual query, view) either:

```sql
-- dependent objects (views, policies, triggers, indexes, constraints, generated columns) on the target columns
SELECT 'view' AS kind, v.table_name AS name FROM information_schema.view_column_usage v
 WHERE v.table_schema = 'public' AND (v.column_name LIKE 'legacy\_%' ESCAPE '\' OR (v.table_name = 'events' AND v.column_name = 'data') OR (v.table_name = 'takedowns' AND v.column_name = 'url'))
UNION ALL
SELECT 'index', indexname FROM pg_indexes WHERE schemaname = 'public' AND (indexdef ILIKE '%legacy\_%' OR indexname = 'idx_events_tenant_data')
UNION ALL
SELECT 'policy', policyname FROM pg_policies WHERE schemaname = 'public' AND (qual ILIKE '%legacy\_%' OR with_check ILIKE '%legacy\_%')
UNION ALL
SELECT 'trigger', tgname FROM pg_trigger WHERE NOT tgisinternal AND pg_get_triggerdef(oid) ILIKE '%legacy\_%';
-- statements seen by the server (needs pg_stat_statements; Supabase has it). Expected: only migration/backfill statements.
SELECT calls, left(query, 160) AS query FROM pg_stat_statements
WHERE query ~ '(legacy_[a-z_]+)' AND query !~* '(information_schema|pg_catalog|ALTER TABLE|CREATE TABLE|INSERT INTO "?[a-z_]+_legacy_archive)'
ORDER BY calls DESC LIMIT 50;
SELECT calls, left(query, 160) FROM pg_stat_statements WHERE query ~* '\mevents\M' AND query ~ '\mdata\M' ORDER BY calls DESC LIMIT 20;
```

Expected result: no view/policy dependencies; the only `idx_events_tenant_data` index (dropped with the events column, replaced by
`idx_events_tenant_starts_at`); no application statement mentions a legacy column (INSERTs written by TypeORM list the
declared entity columns, so while the entity declarations exist you will see `DEFAULT` for them: that is why the entity edit
and the drop are separate releases (B0 then B), and why the statements list is only meaningful after the entity edit (B0) is deployed).

### 3.3 Release-level proof (code)

Before the drop release: `grep -rnE "legacy_(language|instrumental|ai_used|alternative|lyrics|recording|release|duration|origin|transaction|attachment|reference|contact|artist_project|full_name|sector|base_salary|employee_id|reference_month|amount)" apps packages e2e scripts supabase` must list only the migrations, drafts, the entity lines still to be removed in B0 (the same grep before release B must list none of them) and the order script; for events `grep -rn "\.data\b"` on the events module must be empty; for takedowns `grep -rn "raw.url\|\burl:" apps/web/src/modules/monitoring apps/api/src/modules/takedowns` must be empty.

### 3.4 Clients pair census

`clients.legacy_contact_status` held the pre-CZ-043 status vocabulary; it is not mapped 1:1 onto `status`. The owner signs off the
distinct (legacy, status) pairs from 3.1 as "no information worth keeping" before 20260930000043; otherwise keep the archive
indefinitely (it is anyway retained for rollback). Requirement, recorded in the draft header too: the pair census output (counts
only, no row values) is attached to the release record and signed by the owner BEFORE `LEGACY_DROP_CONFIRM` is set. The only machine
check of the draft (legacy value with an empty status) is marked `informational`: it passes vacuously when `status` is always filled,
so a green precondition says nothing about whether `status` carries the legacy information.

### 3.5 Catalog dependency proof and exact per-group preflight SQL

Dependencies that block or silently change a `DROP COLUMN` (views, rules, generated columns, constraints, indexes, triggers
referencing the column) are found in the catalog, not in the code census. Run per environment (counts and object names only):

```sql
-- objects depending on a target column (pg_depend); any row other than the column's own default/sequence/NOT NULL needs review
SELECT c.relname AS tbl, a.attname AS col, d.classid::regclass AS catalog, d.objid, d.deptype,
       pg_describe_object(d.classid, d.objid, d.objsubid) AS dependent
FROM pg_depend d
JOIN pg_class c ON c.oid = d.refobjid AND c.relnamespace = 'public'::regnamespace
JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
WHERE d.refobjsubid > 0
  AND d.deptype IN ('n', 'a')
  AND (a.attname LIKE 'legacy\_%' ESCAPE '\' OR (c.relname = 'events' AND a.attname = 'data'))
  AND d.classid <> 'pg_attrdef'::regclass
ORDER BY 1, 2;
-- column-referencing rules/views/triggers/policies are covered by 3.2; this one also catches indexes, constraints and generated columns
```

Exact per-group preflight (the SAME predicates the drafts run; each count must be 0, run each as `SELECT count(*) FROM <table> WHERE <predicate>`):

| draft | table | predicate (a count above 0 aborts the draft) |
|---|---|---|
| 40 | works | `legacy_language_label IS NOT NULL AND language IS NULL`; `legacy_instrumental_flag IS NOT NULL AND is_instrumental IS NULL`; `legacy_ai_used IS NOT NULL AND ai_used IS NULL`; `legacy_alternative_titles IS NOT NULL AND alternative_titles IS NULL`; `legacy_lyrics IS NOT NULL AND lyrics IS NULL` |
| 41 | phonograms | `legacy_recording_date IS NOT NULL AND recording_date IS NULL`; `legacy_release_date IS NOT NULL AND release_date IS NULL`; `(legacy_duration_minutes IS NOT NULL OR legacy_duration_seconds_part IS NOT NULL) AND duration_seconds IS NULL`; `legacy_origin_country IS NOT NULL AND country_of_recording IS NULL` |
| 42 | transactions | `legacy_attachment_url IS NOT NULL AND attachment_url IS NULL`; `legacy_reference IS NOT NULL AND legacy_reference <> '' AND notes IS NULL` |
| 43 | clients | INFORMATIONAL: `legacy_contact_status IS NOT NULL AND (status IS NULL OR status = '')`; the gate is the pair census of 3.1/3.4 |
| 44 | shares | `legacy_artist_project_id IS NOT NULL AND artist_id IS DISTINCT FROM legacy_artist_project_id` |
| 45 | employees | `legacy_full_name IS NOT NULL AND legacy_full_name IS DISTINCT FROM name`; `legacy_sector IS NOT NULL AND legacy_sector IS DISTINCT FROM department`; `legacy_base_salary IS NOT NULL AND legacy_base_salary IS DISTINCT FROM salary` |
| 45 | payroll_entries | `legacy_employee_id IS NOT NULL AND legacy_employee_id IS DISTINCT FROM employee_id`; `legacy_reference_month IS NOT NULL AND legacy_reference_month IS DISTINCT FROM reference_month` |
| 45 | leave_requests | `legacy_employee_id IS NOT NULL AND legacy_employee_id IS DISTINCT FROM employee_id` |
| 53 | employees | none (no canonical counterpart); census counts of 3.6 only |
| 46 | events | `data IS DISTINCT FROM starts_at`; `starts_at IS NULL` (plus `idx_events_tenant_starts_at` present) |
| 48 | invoices | `legacy_amount IS NOT NULL AND service_amount IS NULL` |
| 49 | invoices | `legacy_amount IS NOT NULL AND service_amount IS NULL`; `legacy_amount IS NOT NULL AND service_amount IS NOT NULL AND legacy_amount <> service_amount` |

Stale-archive probe, only when an archive table already exists from an earlier up/down/up (the draft aborts on it; counts only):
`SELECT count(*) FROM <table>_legacy_archive_20260930 a JOIN <table> t ON t.id = a.id WHERE NOT (<every column> a.c IS NOT DISTINCT FROM t.c AND ...)`.

### 3.6 Employees PII census (draft 53, counts only)

`employees.rg`, `birth_date` and `address` are the only copy of that data. Before the drop the HR owner must see how much would be
archived. Run as the migration role (BYPASSRLS), per environment, DEV first. Counts only: never select the values.

```sql
SELECT count(*)                                         AS employees_total,
       count(*) FILTER (WHERE rg IS NOT NULL)           AS with_rg,
       count(*) FILTER (WHERE birth_date IS NOT NULL)   AS with_birth_date,
       count(*) FILTER (WHERE address IS NOT NULL)      AS with_address,
       count(*) FILTER (WHERE rg IS NOT NULL OR birth_date IS NOT NULL OR address IS NOT NULL) AS rows_to_archive,
       count(DISTINCT tenant_id) FILTER (WHERE rg IS NOT NULL OR birth_date IS NOT NULL OR address IS NOT NULL) AS tenants_affected
FROM employees;
-- physical presence and types (must match the draft: varchar(30), date, varchar(300))
SELECT column_name, data_type, character_maximum_length FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'employees' AND column_name IN ('rg', 'birth_date', 'address');
```

The archive `employees_pii_legacy_archive_20260930` HOLDS THIS PII in plaintext (RLS enabled and forced with no policy, every app role
revoked, readable only by the BYPASSRLS migration role, `tenant_id` without a foreign key). It is therefore a personal-data store of its own:
its retention period is decided by the HR owner (recorded in the release record BEFORE `LEGACY_DROP_CONFIRM` is set), it is part of the
per-tenant erasure SQL of `backfill-side-tables-retention.md` (listed in the array and as an explicit `DELETE`), and it is retired by draft 52 when the
window ends. Dropping the columns removes the plaintext from the live table and its backups age out; keeping the archive does NOT
reduce the exposure unless the retention is short. If the owner decides the data has no purpose, the shortest compliant path is to run draft 53, verify, and retire
the archive early through draft 52 after the rollback window, not to keep the archive indefinitely.

## 4. Ordering

1. Release A (this patch): API/web changes of section 1 + migration 20260930000022 (applied automatically with the release; it is
   additive). Needs the standard migration preflight (BYPASSRLS role).
2. Wait one release window. Run 3.1/3.2 on every environment. Evidence = query outputs (counts), saved with the release record.
3. Release B0 per table group, ONE RELEASE BEFORE the drop (entity removal first): ship the entity declaration removal and the
   reader/writer edits of section 2 alone (no migration). The column still exists physically, the entity no longer selects or inserts it
   (an INSERT then relies on the column being nullable: it is for every group above; invoices.legacy_amount is NOT NULL until draft 48
   is applied, so its entity removal waits for stage 5.1 step 3). Check 3.2 `pg_stat_statements` only after B0 is deployed everywhere.
   Why: a single release that removes the entity and drops the column cannot be rolled back as code alone, and the old build still
   running during a rolling deploy would SELECT the dropped column. NOTE for staging: the API build/boot validates entities against
   the schema (verify scripts and the alignment/column-order specs), so on staging the build STOPS before migrating when the entity and
   the physical schema disagree; this is why the entity removal must be deployed (and green) before the drop, never together with it.
3b. Release B per table group (each its own authorization, DEV first, then STAGING, then PROD; never two destructive migrations
   in one deploy), only after B0 of that group is deployed and green in every environment (the entity declaration and the
   readers/writers listed in section 2 are ALREADY gone; B carries no entity change, only the `verify-canonical-column-order.ts`
   list edit) + register the draft in
   `migrations/index.ts` + `migration-guards.spec.ts` (RLS-bypass list) + move the draft file from `migration-drafts/` to
   `migrations/` (and its spec) + export `LEGACY_DROP_CONFIRM=drop-legacy-columns-gates-satisfied` for that deploy only.
   Suggested order (lowest risk first): 44 shares, 43 clients, 40 works, 41 phonograms, 42 transactions, 45 HR (PII
   retention decision first), 53 employees PII columns (HR retention decision and census 3.6 first, never in the same deploy as 45), 46 events (needs a release that only reads `starts_at`, already true: see below), 48 then 49
   invoices (after 5.1). There is no draft 47 (takedowns.url no longer exists, see 5.2).
4. After the retention window (owner decides, suggested 90 days) a separate migration drops the `*_legacy_archive_20260930` tables:
   gated draft `20260930000052_RetireLegacyColumnDropArchives.ts` (own token `LEGACY_ARCHIVE_RETIRE_CONFIRM=retire-legacy-archives-window-over`,
   distinct from `LEGACY_DROP_CONFIRM`; only `DROP TABLE IF EXISTS` of the ten archives (the nine default ones plus `employees_pii_legacy_archive_20260930` of draft 53); `down()` refuses, irreversible; spec
   `retire-legacy-column-drop-archives.draft.spec.ts` keeps it unregistered and checks it lists exactly the archives of the drop plans).
   It must not be registered while rollback is still wanted. The `*_backfill_20260930` tracking tables are retired by draft 50
   (`backfill-side-tables-retention.md`). Until retirement, the archive tables are part of the per-tenant erasure procedure of that document.

## 5. Staged plans

### 5.1 invoices.legacy_amount (LIVE: Stripe, invoices service, web form, overdue scheduler)

`service_amount` already exists (nullable numeric 15,2), is the report contract column (`INVOICES_CONTRACT`) and the web form
column. Stages:

1. EXPAND (done in LC1, release A): Stripe upsert writes both columns from the same `amount_due/100.0` expression; the
   overdue scheduler reads `service_amount ?? legacy_amount`; the invoices service already reads `service_amount ?? legacy_amount`;
   the web form stops sending `legacy_amount`; the API still derives `legacy_amount` from `service_amount` (`invoices.service.ts:82`)
   so the NOT NULL column keeps being satisfied; migration 20260930000022 backfills existing NULL `service_amount`.
2. RELAX (draft 48, release B1): precondition `service_amount IS NULL AND legacy_amount IS NOT NULL` = 0, then `DROP NOT NULL`. Reversible.
3. STOP WRITING + ENTITY REMOVAL (code, this is B0 of draft 49, release B1 or B2, after 48 is applied EVERYWHERE; no migration): remove `InvoiceEntity.legacy_amount`, `invoices.service.ts:82` mirror, the Stripe upsert
   `legacy_amount` column and its `EXCLUDED` assignment, the DTO field (keep accepting `legacy_amount` as a deprecated INPUT alias
   mapped onto `service_amount` for one more window), the e2e fixture column; readers drop the `?? legacy_amount` fallback; web drops its fallbacks.
   Order inside the release: readers first would be wrong while old rows exist, so this release must follow the 3.1 proof (no row has
   `legacy_amount` without `service_amount`).
4. DROP (draft 49, release B3, one release after step 3 is deployed everywhere): preconditions in section 2, archive, drop. No entity change here: the entity column was removed in step 3 (B0), so an old build in a rolling deploy never selects a dropped column.

Rollback at any stage: stage 1 is backward compatible (old API builds still read and write `legacy_amount`); 2: `down()`
refills NULLs from `service_amount`; 4: `down()` re-adds the column and restores from the archive, then SET NOT NULL by hand is
NOT done (draft 48 down() does it, so roll back 49 then 48).

### 5.2 takedowns.url

Resolved by code, not by a drop. `takedowns.url` does not exist in any migrated schema: `20260719000016`
(`RebuildTakedownsInCanonicalFormOrder`) removed it as a proven orphan. `TakedownEntity.url`, the two writers in
`TakedownsService` and the web fallback (`takedown-format.tsx`, `monitoring.types.ts`) still referenced it, so the entity failed
every query with `column TakedownEntity.url does not exist` against a database migrated from scratch. They are removed, and
`takedown-contract.spec.ts` now asserts that a create never writes `url`. Migration `20260930000022` already skips the mirror
when the column is absent. The former draft 47 had nothing to drop and was deleted.

### 5.3 events.data

Dual-write removed in LC1. `data` is now maintained exclusively by the trigger; reads never used it. Draft 46 drops trigger,
function and column. Requirement in BLK-C3-E6 "a release that only reads `starts_at` deployed to every environment" is satisfied by
this patch's API; the reports contract already moved to `starts_at` (`report-form-contracts.ts:578`). Keep the deprecated column id
`data -> eventDate` (saved report layouts and `report-column-ids.spec.ts`).

Deployment-order caveat for LC1 release A: the API now relies on the trigger of 20260928000007 to fill `data` on INSERT
(`data` is NOT NULL, no default). That migration is in production history since the 20260928 batch; an environment where it was
not applied would reject event creates. Verify with `SELECT tgname FROM pg_trigger WHERE tgname = 'trg_events_sync_start_columns'` before deploying A.

## 6. Non-DDL cleanup (separate, owner decision)

`clients.metadata` key `legacy_cargo_responsavel` (ledger LEGACY_DATABASE_COMPATIBILITY row): data cleanup, not a column.
Preflight `SELECT count(*) FROM clients WHERE metadata ? 'legacy_cargo_responsavel'`; the cleanup is
`UPDATE clients SET metadata = metadata - 'legacy_cargo_responsavel' WHERE metadata ? 'legacy_cargo_responsavel'` with a pre-image
side table like the tables above. Not drafted as a migration (owner must first say the pre-CZ-043 history is not needed).

## 7. Rollback summary

| step | rollback |
|---|---|
| 20260930000022 | `down()`: NULLs `service_amount` / `infringing_url` only for recorded ids that still equal their mirror, then drops the two tracking tables |
| draft 52 | none: irreversible by design (down() refuses); restore from a backup only |
| drafts 40-45, 49, 53 | `down()`: re-add the columns (nullable, same type) and restore values by id from the archive (`*_legacy_archive_20260930`, `employees_pii_legacy_archive_20260930` for 53) (rows created after the drop stay NULL); refuses when the archive is missing; never drops the archive |
| draft 46 | `down()`: re-add `data`, `UPDATE data = starts_at`, SET NOT NULL, recreate function, trigger and `idx_events_tenant_data` |
| draft 53 | `down()`: re-add `rg`, `birth_date`, `address` (nullable, same types) and restore by id from `employees_pii_legacy_archive_20260930`; refuses when the archive is missing |
| draft 48 | `down()`: refuses when `legacy_amount` is absent (roll back 49 first) and refuses when any row has BOTH `legacy_amount` and `service_amount` NULL (it would invent a 0: the owner reconciles those rows first, counts only in the message); otherwise refills NULL `legacy_amount` from `service_amount` and SET NOT NULL. `up()` is a no-op when `legacy_amount` is already gone |
| code of B0 / B | revert the release; B0 is code-only (the columns still exist), B has no entity change, so a code revert never meets a missing column; the restored columns after `down()` are not selected by any entity |

If a deploy aborts on a precondition, nothing was written (checks run for every table before the first write; TypeORM wraps the
migration in one transaction).

## 8. Explicit authorization checklist (all must be ticked for the migration being executed)

- [ ] Owner authorization recorded in the release record: names the migration (timestamp), the environment, and says "drop columns X".
- [ ] Preflight 3.0, 3.1, 3.2, 3.3 outputs for THIS environment attached; every "unreconciled/divergent" count is 0 (or an explicit signed exception, archive kept).
- [ ] Clients only: the (legacy, status) pair census signed off (3.4). HR only (drafts 45 and 53): the PII retention period for the archive tables decided by the HR owner, and for 53 the census of 3.6 attached.
- [ ] Release B0 (entity declaration removed, readers/writers per section 2) was deployed and is green in EVERY environment at least one release before this drop; the current build is built, merged, and the full api jest + web vitest + tsc are green.
- [ ] Staging rehearsal done on a fresh restore of production data: `up()`, verify, `down()`, verify values byte-equal, `up()` again.
- [ ] Backup / PITR point taken immediately before the deploy; its id is in the release record.
- [ ] Previous releases (A) are deployed in EVERY environment (the trigger of 20260928000007 and the 20260930000022 backfill are applied).
- [ ] The draft was moved from `migration-drafts/` to `migrations/`, registered in `index.ts` and `migration-guards.spec.ts`, and its spec moved with it.
- [ ] `LEGACY_DROP_CONFIRM=drop-legacy-columns-gates-satisfied` is set only in the executing deploy job, and unset afterwards.
- [ ] One destructive migration per deploy; rollback owner on call; archive tables kept at least until the agreed retention window ends.
- [ ] After the deploy: `docs/naming` ledger regenerated by the orchestrator (section 9) and the census baselines (`verify-canonical-column-order.ts`, backend-v2 inventories) updated.

## 9. Ledger rows removable after the drops

Blockers in `docs/naming/canonical-naming-map.json` (to be regenerated by the orchestrator, not edited here):

| after migration | blocker to close and remove |
|---|---|
| 40 | BLK-WORKS-LEGACY-DUPLICATES |
| 41 | BLK-PHONOGRAMS-LEGACY-DUPLICATES |
| 42 | BLK-TRANSACTIONS-LEGACY-DUPLICATES |
| 43 | BLK-CLIENTS-LEGACY-DUPLICATES |
| 44 | BLK-SHARES-ARTIST-MIRROR |
| 45 | BLK-HR-LEGACY-MIRRORS |
| 46 | BLK-C3-E6 |
| 49 | (no blocker; the invoices.legacy_amount debt is tracked only by the audit section 6) |

Exception rows: `TEMPORARY_MIGRATION_COMPATIBILITY` for `client-entity-schema-alignment.spec.ts` (CZ-043 guard) stays, only its
`status_contato -> legacy_contact_status` entry disappears; the `LEGACY_DATABASE_COMPATIBILITY` row for `clients.metadata` key
`legacy_cargo_responsavel` stays until section 6; `permission_aliases.legacy_key` and `operational_list_items.legacy_slug` are not
legacy debt. No `LEGACY_DATABASE_COMPATIBILITY` row names any of the dropped physical columns today (the applied migrations that
mention the old Portuguese names are historical text and keep their rows).

## 10. Consolidated execution order and approval boundaries

Order (each step needs its own evidence; nothing below is executed by an agent, and no step is implied by the previous one):

1. Census, read-only: DEV, then STAGING, then PRODUCTION (production is external, run and attached by its owner): sections 3.0-3.2, 3.5, 3.6 and the clients pair census 3.4.
2. B0 per table group (code only, no migration): entity declaration and reader/writer removal, deployed and green everywhere, one release BEFORE that group's drop.
3. One destructive migration per deploy, DEV, then STAGING (rehearsal), then PRODUCTION, each its own authorization. Suggested group order in section 4.
4. Invoices: 48 (relax NOT NULL), then the stop-writing + entity-removal release (5.1 step 3, which is B0 of 49), then 49.
5. Retention window (owner decides, suggested 90 days), then draft 52 (archives, including the employees PII archive). Never while a rollback is still wanted.
6. Draft 50 (backfill side tables) only after ALL rollback windows of the `20260930*` backfills are over, in every environment (`backfill-side-tables-retention.md`).
7. PII encryption of artists and clients (separate plan, `data-governance-pii-backfill.md`): additive migration first, then the dual-write release, then the backfill, then verification, then the scrub of the plaintext as its OWN authorization (it is destructive and is not covered by any approval of this plan).

What an approval authorizes: exactly one named migration (timestamp and class name), in one named environment, for the named columns, with `LEGACY_DROP_CONFIRM` (or the draft's own token) present only in that deploy job and unset afterwards.
What an approval never does: authorize another migration, another environment (a DEV or STAGING approval is not a PRODUCTION approval), another column set, two destructive migrations in one deploy, registering a draft by a different release, retiring an archive (52) or purging a side table (50), keeping the token in a shared or persistent environment, executing the PII scrub, or replace a missing item of the evidence list below. An agent, a CI job or a rollback never self-grants approval.

External evidence that must exist before the corresponding approval (an item that cannot be produced makes the step BLOCKED, never "assumed fine"):

- production census (3.0-3.2, 3.5, 3.6): counts only, attached to the release record;
- signed clients (legacy_contact_status, status) pair census (3.4), signed by the owner, before draft 43;
- HR retention decision for the HR archives (draft 45) and for `employees_pii_legacy_archive_20260930` (draft 53), by the HR owner;
- staging rehearsal on a fresh restore of production data: `up()`, verify, `down()`, verify values byte-equal, `up()` again;
- PITR / backup point id taken immediately before each production deploy;
- table sizes and measured lock timings of the rehearsal (the 15s `lock_timeout` and the SHARE ROW EXCLUSIVE lock must be acceptable for the largest table: works, phonograms, transactions, invoices, employees);
- key escrow / recovery of the encryption keys (PII encryption, step 7), proven by a restore of a key and a decrypt of a sample.
