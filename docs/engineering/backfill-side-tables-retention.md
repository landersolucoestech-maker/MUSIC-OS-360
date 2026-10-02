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
| `contract_type_backfill_20260930` | `20260930000034` | `before`/`after` of `contracts.type` (`outro` -> `other`) | Low (vocabulary values) |
| `contract_signed_transaction_category_backfill_20260930` | `20260930000035` | `before`/`after` of `transactions.category` for contract-signed provisional transactions | Low (vocabulary values) |

Related but separate: `<table>_legacy_archive_20260930` tables exist only if a gated legacy column drop
(`docs/engineering/legacy-column-drop-plan.md`) was executed; they follow the same rules and are retired by
their own later migration.

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
    'artist_distributor_id_backfill_20260930'
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
