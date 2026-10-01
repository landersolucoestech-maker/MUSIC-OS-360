# Legacy column drop plan (LC1)

Status: PREPARED, NOTHING DROPPED. Every destructive step below is a DRAFT under
`apps/api/src/database/migration-drafts/` (not in `ALL_MIGRATIONS`, not importable by the runner, and gated at
execution time by `LEGACY_DROP_CONFIRM`). Executing any of them needs the explicit owner authorization of
section 8. Evidence of usage (file:line) lives in the census of the release notes (`legacy-columns-census.md`);
this plan holds the SQL proofs, the order and the rollback.

## 1. What is already done (registered, non-destructive)

| change | where |
|---|---|
| Dead dual-write removed: the API no longer writes `events.data` (the sync trigger fills it); entity column is `insert:false, update:false` | `events.service.ts` (`dtoToEntity`, `create`), `entities.ts` (`EventEntity.data`), `events-data-legacy-column.spec.ts` |
| Dead web writer removed: the invoice form no longer sends `legacy_amount` (the API derives the NOT NULL mirror from `service_amount`) | `useInvoiceForm.ts`, `useInvoiceForm.legacy-amount.guard.test.ts`, `invoices.service.spec.ts` |
| `invoices.legacy_amount` EXPAND: Stripe upsert dual-writes `service_amount`; overdue scheduler reads `service_amount ?? legacy_amount` | `billing.service.ts upsertStripeInvoice`, `invoice-overdue.scheduler.ts`, specs |
| Backfill migration `20260930000022_BackfillCanonicalFromLegacyMirrors` (guarded, reversible, no drop): fills NULL `invoices.service_amount` from `legacy_amount` and NULL `takedowns.infringing_url` from `url`, recording ids in RLS-locked side tables | `migrations/20260930000022_*.ts`, `backfill-canonical-from-legacy-mirrors.migration.spec.ts` |

`takedowns.url` writer and web fallback are deliberately NOT removed yet (section 5.2): the writer cannot go before
the fallback, and the fallback cannot go before the 20260930000022 backfill is applied everywhere.

## 2. Drafts (all gated, all NOT registered)

| draft | drops | archive table | preconditions (abort on any count > 0) | entity / code edits that MUST ship in the same release |
|---|---|---|---|---|
| 20260930000040 DropWorksLegacyColumns | works.legacy_language_label, legacy_instrumental_flag, legacy_ai_used, legacy_alternative_titles, legacy_lyrics | works_legacy_archive_20260930 | each legacy value has its canonical (language, is_instrumental, ai_used, alternative_titles, lyrics) | remove 5 lines `entities.ts:783-787`; `verify-canonical-column-order.ts:32-34` |
| 20260930000041 DropPhonogramsLegacyColumns | phonograms.legacy_recording_date, legacy_release_date, legacy_duration_minutes, legacy_duration_seconds_part, legacy_origin_country | phonograms_legacy_archive_20260930 | canonical recording_date, release_date, duration_seconds, country_of_recording present wherever the legacy value is | `entities.ts:926-930`; `verify-canonical-column-order.ts:47-49` |
| 20260930000042 DropTransactionsLegacyColumns | transactions.legacy_transaction_type, legacy_transaction_date, legacy_attachment_url, legacy_reference | transactions_legacy_archive_20260930 | attachment_url present where legacy_attachment_url is; notes present where legacy_reference is non-empty (type/transaction_date are NOT NULL) | `entities.ts:1095-1098`; do not mix with TX1 (migration 18) |
| 20260930000043 DropClientsLegacyContactStatus | clients.legacy_contact_status | clients_legacy_archive_20260930 | status never empty where legacy value is set; owner reviews the pair census (3.4) | `entities.ts:1210`; `client-entity-schema-alignment.spec.ts:55` (drop the `status_contato` entry); `verify-canonical-column-order.ts:110` |
| 20260930000044 DropSharesLegacyArtistProjectId | shares.legacy_artist_project_id | shares_legacy_archive_20260930 | `legacy_artist_project_id IS DISTINCT FROM artist_id` = 0 | `entities.ts:1579`; `share-contract.spec.ts:91` stays (still true); `verify-canonical-column-order.ts:141` |
| 20260930000045 DropHrLegacyMirrors | employees.legacy_full_name/legacy_sector/legacy_base_salary; payroll_entries.legacy_employee_id/legacy_reference_month; leave_requests.legacy_employee_id | employees_/payroll_entries_/leave_requests_legacy_archive_20260930 (PII: names, salary) | each legacy value equals its canonical (name, department, salary, employee_id, reference_month) | `verify-canonical-column-order.ts:165-203` (no entity declarations) |
| 20260930000046 DropEventsDataAndSyncTrigger | events.data + trigger `trg_events_sync_start_columns` + function `sync_events_start_columns()` + index `idx_events_tenant_data` (with the column) | none (data == starts_at is the proof) | `data IS DISTINCT FROM starts_at` = 0, `starts_at IS NULL` = 0, `idx_events_tenant_starts_at` present | remove `EventEntity.data` (`entities.ts:1387`); keep `report-form-contracts.ts` deprecated column id `data -> eventDate` (saved layouts) and web header alias "Data"; `add-events-starts-at.migration.spec.ts:40` still true; delete `events-data-legacy-column.spec.ts` trigger assertions together with the trigger |
| 20260930000047 DropTakedownsUrlMirror | takedowns.url | takedowns_legacy_archive_20260930 | `url IS DISTINCT FROM infringing_url` where url is set = 0 | stage 5.2 first; remove `TakedownEntity.url` (`entities.ts:1608`), writers (`takedowns.service.ts:98,112`), web fallback (`takedown-format.tsx:62`, `monitoring.types.ts:19`, test `takedown-format.test.tsx:28`), `takedown-contract.spec.ts:76` expectation |
| 20260930000048 RelaxInvoicesLegacyAmountNotNull | (no drop) `ALTER COLUMN legacy_amount DROP NOT NULL` | none | no row with legacy_amount and NULL service_amount | none; reversible |
| 20260930000049 DropInvoicesLegacyAmount | invoices.legacy_amount | invoices_legacy_archive_20260930 | `service_amount IS NULL` = 0 and `legacy_amount <> service_amount` = 0 | stage 5.1 steps 3-4 first; then remove `InvoiceEntity.legacy_amount` (`entities.ts:1128`), DTO `invoices.dto.ts:63`, `invoices.service.ts:82,170,183,186,242,259` fallbacks, Stripe upsert column, scheduler fallback, web fallbacks (`useInvoices.ts:17,19`, `Invoices.tsx:63`, `InvoiceViewModal.tsx:64,73`, `useInvoiceForm.ts:92,93`), e2e fixture `invoice-overdue-saas-exclusion.e2e-spec.ts:42` |

Draft skeleton (`legacy-column-drop.base.ts`): confirmation gate, RLS-bypass guard, `SET LOCAL lock_timeout '15s'`,
presence check (none present: skip; partial: abort), all preconditions for all tables BEFORE any write (counts only,
no values, message bounded to 600 chars), archive table (RLS ENABLED + FORCED, no policy, `anon`/`authenticated`/
`musicos_app` revoked), archive INSERT, archive coverage verification, then `DROP COLUMN IF EXISTS` last. The mock
specs in `legacy-column-drop.draft.spec.ts` pin that order and the rollback.

Note on the typed value `varchar(n)`/`numeric(p,s)` in the archive and in the rollback `ADD COLUMN`: they are the
exact physical types (verify with 3.0 before executing).

## 3. Preflight SQL (zero-use proofs; run read-only on each environment, DEV first)

Run as the migration role (BYPASSRLS) so every tenant is counted. Counts only, never select values (HR columns are PII).

### 3.0 Physical type check (the archive/rollback types must match)

```sql
SELECT table_name, column_name, data_type, character_maximum_length, numeric_precision, numeric_scale, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name LIKE 'legacy\_%' ESCAPE '\'
   OR (table_name = 'events' AND column_name = 'data') OR (table_name = 'takedowns' AND column_name = 'url')
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
-- clients (owner review: distinct pairs, counts only)
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
-- takedowns.url (after 20260930000022)
SELECT count(*) FILTER (WHERE url IS NOT NULL AND infringing_url IS DISTINCT FROM url) AS url_unreconciled FROM takedowns;
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
and the drop ship in the same release, and why the statements list is only meaningful after the entity edit is deployed).

### 3.3 Release-level proof (code)

Before the drop release: `grep -rnE "legacy_(language|instrumental|ai_used|alternative|lyrics|recording|release|duration|origin|transaction|attachment|reference|contact|artist_project|full_name|sector|base_salary|employee_id|reference_month|amount)" apps packages e2e scripts supabase` must list only the migrations, drafts, the entity lines being removed in that release and the order script; for events `grep -rn "\.data\b"` on the events module must be empty; for takedowns `grep -rn "raw.url\|\burl:" apps/web/src/modules/monitoring apps/api/src/modules/takedowns` must be empty.

### 3.4 Clients pair census

`clients.legacy_contact_status` held the pre-CZ-043 status vocabulary; it is not mapped 1:1 onto `status`. The owner signs off the
distinct (legacy, status) pairs from 3.1 as "no information worth keeping" before 20260930000043; otherwise keep the archive
indefinitely (it is anyway retained for rollback).

## 4. Ordering

1. Release A (this patch): API/web changes of section 1 + migration 20260930000022 (applied automatically with the release; it is
   additive). Needs the standard migration preflight (BYPASSRLS role).
2. Wait one release window. Run 3.1/3.2 on every environment. Evidence = query outputs (counts), saved with the release record.
3. Release B per table group (each its own authorization, DEV first, then STAGING, then PROD; never two destructive migrations
   in one deploy): (code: remove entity declaration + readers/writers listed in section 2) + register the draft in
   `migrations/index.ts` + `migration-guards.spec.ts` (RLS-bypass list) + move the draft file from `migration-drafts/` to
   `migrations/` (and its spec) + export `LEGACY_DROP_CONFIRM=drop-legacy-columns-gates-satisfied` for that deploy only.
   Suggested order (lowest risk first): 44 shares, 43 clients, 40 works, 41 phonograms, 42 transactions, 45 HR (PII
   retention decision first), 46 events (needs a release that only reads `starts_at`, already true: see below), 47 takedowns
   (after 5.2), 48 then 49 invoices (after 5.1).
4. After the retention window (owner decides, suggested 90 days) a separate migration drops the `*_legacy_archive_20260930` tables
   and the two `*_backfill_20260930` tracking tables. Not drafted: it must not exist while rollback is still wanted.

## 5. Staged plans

### 5.1 invoices.legacy_amount (LIVE: Stripe, invoices service, web form, overdue scheduler)

`service_amount` already exists (nullable numeric 15,2), is the report contract column (`INVOICES_CONTRACT`) and the web form
column. Stages:

1. EXPAND (done in LC1, release A): Stripe upsert writes both columns from the same `amount_due/100.0` expression; the
   overdue scheduler reads `service_amount ?? legacy_amount`; the invoices service already reads `service_amount ?? legacy_amount`;
   the web form stops sending `legacy_amount`; the API still derives `legacy_amount` from `service_amount` (`invoices.service.ts:82`)
   so the NOT NULL column keeps being satisfied; migration 20260930000022 backfills existing NULL `service_amount`.
2. RELAX (draft 48, release B1): precondition `service_amount IS NULL AND legacy_amount IS NOT NULL` = 0, then `DROP NOT NULL`. Reversible.
3. STOP WRITING (code, release B1 or B2, after 48 is applied EVERYWHERE): remove `invoices.service.ts:82` mirror, the Stripe upsert
   `legacy_amount` column and its `EXCLUDED` assignment, the DTO field (keep accepting `legacy_amount` as a deprecated INPUT alias
   mapped onto `service_amount` for one more window), the e2e fixture column; readers drop the `?? legacy_amount` fallback; web drops its fallbacks.
   Order inside the release: readers first would be wrong while old rows exist, so this release must follow the 3.1 proof (no row has
   `legacy_amount` without `service_amount`).
4. DROP (draft 49, release B3): preconditions in section 2, archive, drop; entity column removed in the same release.

Rollback at any stage: stage 1 is backward compatible (old API builds still read and write `legacy_amount`); 2: `down()`
refills NULLs from `service_amount`; 4: `down()` re-adds the column and restores from the archive, then SET NOT NULL by hand is
NOT done (draft 48 down() does it, so roll back 49 then 48).

### 5.2 takedowns.url

1. (done) Backfill `infringing_url` from `url` where NULL (20260930000022; down() reverts exactly those rows).
2. Release B: remove the web fallback (`takedown-format.tsx:62` becomes `pick(raw.infringing_url)`, drop `url` from `monitoring.types.ts`, adjust
   `takedown-format.test.tsx:28`), AND remove the two API writers (`takedowns.service.ts:98,112`) in the same release (the writer
   cannot go first, otherwise a cleared `infringing_url` would leave a stale `url` visible through the fallback; the fallback cannot go
   before the backfill, otherwise pre-CZ-034 rows lose their URL in the UI). The API response then still carries `url` (entity) until step 3.
3. Draft 47: preconditions, archive, drop, entity column removed; the API response no longer has `url` (breaking only for an external
   consumer that read it: confirm none in 3.2).

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
| drafts 40-45, 47, 49 | `down()`: re-add the columns (nullable, same type) and restore values by id from `*_legacy_archive_20260930` (rows created after the drop stay NULL); refuses when the archive is missing; never drops the archive |
| draft 46 | `down()`: re-add `data`, `UPDATE data = starts_at`, SET NOT NULL, recreate function, trigger and `idx_events_tenant_data` |
| draft 48 | `down()`: refill NULL `legacy_amount` from `service_amount` (0 if both NULL), SET NOT NULL |
| code of the same release | revert the release; the entity declarations come back and match the restored columns |

If a deploy aborts on a precondition, nothing was written (checks run for every table before the first write; TypeORM wraps the
migration in one transaction).

## 8. Explicit authorization checklist (all must be ticked for the migration being executed)

- [ ] Owner authorization recorded in the release record: names the migration (timestamp), the environment, and says "drop columns X".
- [ ] Preflight 3.0, 3.1, 3.2, 3.3 outputs for THIS environment attached; every "unreconciled/divergent" count is 0 (or an explicit signed exception, archive kept).
- [ ] Clients only: the (legacy, status) pair census signed off (3.4). HR only: the PII retention period for the archive tables decided.
- [ ] Release B code (entity declaration removed, readers/writers per section 2) is built, merged, and the full api jest + web vitest + tsc are green.
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
| 47 | BLK-TAKEDOWNS-URL-MIRROR |
| 49 | (no blocker; the invoices.legacy_amount debt is tracked only by the audit section 6) |

Exception rows: `TEMPORARY_MIGRATION_COMPATIBILITY` for `client-entity-schema-alignment.spec.ts` (CZ-043 guard) stays, only its
`status_contato -> legacy_contact_status` entry disappears; the `LEGACY_DATABASE_COMPATIBILITY` row for `clients.metadata` key
`legacy_cargo_responsavel` stays until section 6; `permission_aliases.legacy_key` and `operational_list_items.legacy_slug` are not
legacy debt. No `LEGACY_DATABASE_COMPATIBILITY` row names any of the dropped physical columns today (the applied migrations that
mention the old Portuguese names are historical text and keep their rows).
