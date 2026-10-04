# Backfill side tables: retention, erasure and removed API aliases

Scope: the rollback side tables created by the `20260930*` persisted-vocabulary backfills, how long they
live, how a tenant's rows are erased from them, and the API aliases whose removal clients can notice.

## Why this matters

Each backfill records the rows it rewrites in a locked-down side table (RLS enabled and forced, no policy,
every application role revoked: only the BYPASSRLS migration role can read it). Several of them keep the full
`before`/`after` jsonb of the rewritten columns, which can include third-party personal data (contact e-mails
and phones of artist teams, release credits and lyrics). The tables carry a `tenant_id` but **no foreign key**,
and the migrations never drop them in `down()`, so tenant deletion and a data-subject erasure request do not
reach them. They are rollback material, not a business dataset: they must be short-lived and erasable.

## Inventory

Exactly the tables of `SIDE_TABLES` in draft `20260930000050` (one row each; the spec `purge-backfill-side-tables.draft.spec.ts` fails if this table, the erasure SQL below or the migrations drift from that list). PII classification is derived from the columns each migration records (`columns` of its `RowBackfillSpec`, or the `CREATE TABLE` of the side table).

| Side table | Migration | Content | PII risk |
| --- | --- | --- | --- |
| `contract_service_types_taxonomy_backup_20260930` | `20260930000002` | pre-image of `client_types`, `financial_model`, `financial_payment_frequency` | Low (vocabulary values) |
| `external_rights_receipts_backfill_20260930` | `20260930000017` | `table_name`, `id`, `tenant_id` | None (ids only) |
| `transaction_taxonomy_backfill_20260930` | `20260930000018` | `id`, `column_name`, legacy and canonical taxonomy value | Low |
| `release_metadata_backfill_20260930` | `20260930000019` | full `before`/`after` of `releases.metadata` (credits, lyrics, notes) | **High** (third parties, creative content) |
| `invoices_service_amount_backfill_20260930` | `20260930000022` | `id`, `tenant_id` | None (ids only) |
| `takedowns_infringing_url_backfill_20260930` | `20260930000022` | `id`, `tenant_id` | None (ids only) |
| `contracts_last_payment_backfill_20260930` | `20260930000023` | `before`/`after` of `contracts.metadata` | Medium (payment metadata) |
| `plan_features_backfill_20260930` | `20260930000024` | `before`/`after` of `tenants.features` / `billing_plans.features` | Low (feature flags; `billing_plans` rows are global, nil tenant) |
| `assets_asset_type_backfill_20260930` | `20260930000025` | `before`/`after` of `assets.asset_type` and `assets.metadata` | Medium (file metadata) |
| `marketing_vocabulary_backfill_20260930` | `20260930000026` | `before`/`after` of `metadata` (and task `kind`) of marketing projects, tasks, campaigns, briefings, content posts, `activity_logs` | **High** (free-form metadata, audience data, activity details) |
| `artist_distributor_id_backfill_20260930` | `20260930000027` | `before`/`after` of the artists' distributor columns | Medium (contact e-mails, phones) |
| `campaign_builder_state_backfill_20260930` | `20260930000028` | `before`/`after` of the whole `campaigns.metadata` jsonb (migration `columns: ['metadata']`): builder payload with audience gender/segmentation and free-text notes | **High** (free-form metadata, audience targeting) |
| `marketing_task_sector_backfill_20260930` | `20260930000029` | `before`/`after` of the whole `marketing_tasks.metadata` jsonb (migration `columns: ['metadata']`), not only `sector`/`automationFlowId` | **High** (free-form task metadata) |
| `operational_list_classification_backfill_20260930` | `20260930000031` | `before`/`after` of `kind`, `slug`, `name`, `legacy_slug`, `origin`, `stable_key` of `operational_list_items` | Low (tenant-authored list labels, no personal data by design) |
| `project_track_vocabulary_backfill_20260930` | `20260930000032` | `before`/`after` of `project_tracks.instrumental` and `project_tracks.language` | Low (vocabulary values) |
| `contract_type_backfill_20260930` | `20260930000034` | `before`/`after` of `contracts.type` (`outro` -> `other`) | Low (vocabulary values) |
| `contract_signed_transaction_category_backfill_20260930` | `20260930000035` | `before`/`after` of `transactions.category` for contract-signed provisional transactions | Low (vocabulary values) |
| `contract_category_slug_backfill_20260930` | `20260930000036` | `before`/`after` of `contracts.type` and `contract_templates.service_type` for the ten platform-owned category slugs | Low (vocabulary values) |
| `transaction_internal_revenue_backfill_20260930` | `20260930000037` | `id`, `column_name`, `tenant_id`, `legacy_value`, `canonical_value` of `transactions.category` / `subcategory` (`receitas-internas`, `repasse-contrato`) | Low (vocabulary values) |
| `phonogram_derived_fields_backfill_20260930` | `20260930000038` | `before`/`after` of `phonograms.duration_seconds`, `duration_text`, `isrc` and the four `isrc_*` parts | Low (catalogue metadata, ISRC is a public identifier) |
| `phonogram_derived_field_conflicts_20260930` | `20260930000038` | `id`, `tenant_id`, `field_group`, `stored`/`derived` jsonb of phonogram rows whose stored and derived duration/ISRC values disagree (created by the same migration; it was missing from draft 50 and from this document) | Low (catalogue metadata) |

Related: `<table>_legacy_archive_20260930` tables (works, phonograms, transactions, clients, shares, employees,
payroll_entries, leave_requests, invoices) plus `employees_pii_legacy_archive_20260930` (draft 53: employees `rg`, `birth_date`, `address`,
**direct personal data of employees, plaintext**; its retention period is decided by the HR owner before the drop and it is part of the erasure SQL) exist only if a gated legacy column drop
(`docs/engineering/legacy-column-drop-plan.md`) was executed. They hold the only copy of the dropped values (HR names and
salaries, client contact status), carry `tenant_id` WITHOUT a foreign key (a tenant deletion does not cascade to them), are RLS-locked
like the tables above, are listed in the erasure procedure below, and are retired by the gated draft
`apps/api/src/database/migration-drafts/20260930000052_RetireLegacyColumnDropArchives.ts` (own token
`LEGACY_ARCHIVE_RETIRE_CONFIRM=retire-legacy-archives-window-over`, `down()` refuses, not registered).

## Retention rule

1. The side tables exist only for the rollback window of the release that ran the backfills.
2. Once the window is over **and** the "Vocabulary pre-flight queries" of `docs/runbooks/staging-to-production.md`
   report 0 residue rows in **every** environment (staging and production), the tables are dropped. There is no archive: purging is
   the purpose, and after the purge `down()` of those migrations can no longer restore values (take a database backup first).
3. The drop is the gated draft `apps/api/src/database/migration-drafts/20260930000050_PurgeBackfillSideTables.ts`. It is not
   registered in `ALL_MIGRATIONS`; registering it is a release decision, and running it needs
   `BACKFILL_PURGE_CONFIRM=purge-backfill-side-tables-window-over`. Its spec asserts it stays unregistered, lists every side table, issues only
   `DROP TABLE IF EXISTS`, and that `down()` refuses.
4. Until then, the erasure procedure below is mandatory.

## Erasure procedure (tenant deletion or erasure request)

Run as the BYPASSRLS migration role (RLS is forced and no policy exists, so any other role sees nothing), inside a
transaction (psql), as part of the tenant deletion / erasure checklist. `tenant_id` is the tenant's uuid (`\set tenant_id '<uuid>'`). Tables that no
longer exist (already purged) are skipped by the guard.

```sql
BEGIN;
SET LOCAL app.erase_tenant = :'tenant_id';
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'contract_service_types_taxonomy_backup_20260930',
    'external_rights_receipts_backfill_20260930',
    'transaction_taxonomy_backfill_20260930',
    'release_metadata_backfill_20260930',
    'invoices_service_amount_backfill_20260930',
    'takedowns_infringing_url_backfill_20260930',
    'contracts_last_payment_backfill_20260930',
    'plan_features_backfill_20260930',
    'assets_asset_type_backfill_20260930',
    'marketing_vocabulary_backfill_20260930',
    'artist_distributor_id_backfill_20260930',
    'campaign_builder_state_backfill_20260930',
    'marketing_task_sector_backfill_20260930',
    'operational_list_classification_backfill_20260930',
    'project_track_vocabulary_backfill_20260930',
    'contract_type_backfill_20260930',
    'contract_signed_transaction_category_backfill_20260930',
    'contract_category_slug_backfill_20260930',
    'transaction_internal_revenue_backfill_20260930',
    'phonogram_derived_fields_backfill_20260930',
    'phonogram_derived_field_conflicts_20260930',
    'works_legacy_archive_20260930',
    'phonograms_legacy_archive_20260930',
    'transactions_legacy_archive_20260930',
    'clients_legacy_archive_20260930',
    'shares_legacy_archive_20260930',
    'employees_legacy_archive_20260930',
    'payroll_entries_legacy_archive_20260930',
    'leave_requests_legacy_archive_20260930',
    'invoices_legacy_archive_20260930',
    'employees_pii_legacy_archive_20260930'
  ] LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('DELETE FROM public.%I WHERE tenant_id = %L::uuid', t, current_setting('app.erase_tenant'));
    END IF;
  END LOOP;
END $$;
COMMIT;
```

Equivalent explicit statements, one per table:

```sql
DELETE FROM contract_service_types_taxonomy_backup_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM external_rights_receipts_backfill_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM transaction_taxonomy_backfill_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM release_metadata_backfill_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM invoices_service_amount_backfill_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM takedowns_infringing_url_backfill_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM contracts_last_payment_backfill_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM plan_features_backfill_20260930 WHERE tenant_id = :'tenant_id'; -- the tenants row is keyed by the tenant id
DELETE FROM assets_asset_type_backfill_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM marketing_vocabulary_backfill_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM artist_distributor_id_backfill_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM campaign_builder_state_backfill_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM marketing_task_sector_backfill_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM operational_list_classification_backfill_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM project_track_vocabulary_backfill_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM contract_type_backfill_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM contract_signed_transaction_category_backfill_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM contract_category_slug_backfill_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM transaction_internal_revenue_backfill_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM phonogram_derived_fields_backfill_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM phonogram_derived_field_conflicts_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM works_legacy_archive_20260930 WHERE tenant_id = :'tenant_id';        -- legacy archives: only if the table exists (legacy drop executed)
DELETE FROM phonograms_legacy_archive_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM transactions_legacy_archive_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM clients_legacy_archive_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM shares_legacy_archive_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM employees_legacy_archive_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM payroll_entries_legacy_archive_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM leave_requests_legacy_archive_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM invoices_legacy_archive_20260930 WHERE tenant_id = :'tenant_id';
DELETE FROM employees_pii_legacy_archive_20260930 WHERE tenant_id = :'tenant_id';  -- employee PII (rg, birth date, address)
```

Verify with `SELECT count(*) FROM <table> WHERE tenant_id = :'tenant_id'` on each table (expect 0), and record the counts
(not the values) in the erasure evidence. Note: the procedure is not wired into application code yet; until it is, it is a manual step
of the tenant deletion runbook.

## Removed API aliases (clients on old builds)

The deprecated alias spellings were removed from the API contract. A request that still sends one now fails
validation with **HTTP 400** (`forbidNonWhitelisted` for unknown properties, `IsIn` for enumerations) instead of being
silently translated:

- phonogram and work property `obra_vinculada` (use the canonical linked-work field);
- the `com-ecad` / `sem-ecad` filter values (use the canonical society-registration values);
- client timeline types `nota`, `ligacao`, `reuniao`, `outro` (use the canonical English timeline types).

There is no internal caller left (web and e2e were searched). **External API consumers and cached old web bundles must be updated**;
announce this in the release notes of the version that ships the removal. Historic `activity_logs` actions are
already covered by migration `20260928000023`.

## PII archives of the encryption backfill (gap recorded, decision pending)

`artists_pii_archive_20261002` and `clients_pii_archive_20261002` (created by drafts 20261002000002/3 before the plaintext scrub) are retired by draft 52 like the other archives, but they are NOT in the per-tenant erasure statements above: until the owner decides retention and erasure for them (`pii-key-custody-request.md` owner items 10 and 11) there is no per-tenant erasure path for the plaintext they hold, and older backups and PITR points keep plaintext until they expire. This is a HUMAN_DECISION, not something this repository can invent.
