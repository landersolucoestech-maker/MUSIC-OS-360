# Legacy column drop: approval packages (LC1 D1)

Status: PREPARATION ONLY. Every package below says `READY_FOR_DESTRUCTIVE_EXECUTION: NO`. Nothing was dropped in any environment.

## Authorization boundary

- Human owner decision 2026-10-03 (decision record `deci-ed83c974`): for the D1 column drops only final preparation, censuses, verifications, rehearsals and other NON-destructive operations are approved. There is NO unconditional DROP authorization. Production receives NO DROP authorization.
- `LEGACY_DROP_CONFIRM` must never be set in production nor in any CI job, script or environment file. The pre-flight tool refuses to run when the variable is present (exit 3).
- A package is the evidence file the owner reads to decide; it grants nothing. An approval, if ever given, names exactly one migration (timestamp and class), one environment and the columns, and is recorded outside this document (plan section 10).
- ENVIRONMENT is `disposable-rehearsal` for every package because no dev, staging or production database is reachable from this workspace. Every measurement of a real environment is `NOT_MEASURED`; PITR, production census and retention decisions are not claimed.

## How the evidence was produced (reproducible)

```text
node --test scripts/legacy-drop-preflight.test.mjs
LEGACY_DROP_REHEARSAL_REPORT=<file.json> DB_SSL=false NODE_ENV=test DATABASE_URL=postgresql://musicos360@127.0.0.1:54329/music_os_drops_base \
  pnpm --filter @music-os-360/api exec jest --config jest.e2e.config.ts test/e2e/schema/legacy-column-drop-drafts
DATABASE_URL=postgresql://musicos360@127.0.0.1:54329/music_os_drops_base DB_SSL=false \
  node scripts/legacy-drop-preflight.mjs --env disposable --rehearsal-report <file.json> --pretty
```

- `scripts/legacy-drop-preflight.mjs` is SELECT-only (statement guard plus a read-only session), counts only, credentials redacted, and emits the 15 owner evidence items per group. It needs `--env` and `DATABASE_URL` (or an explicit `--no-db`), and takes `--pitr-id`, `--retention-ref` and `--rehearsal-report` as inputs: absent means `NOT_PROVIDED` / `NOT_DEFINED`.
- The rehearsal is a real up -> down -> up run of each draft against a `CREATE DATABASE ... TEMPLATE music_os_drops_base` COPY that the spec drops afterwards; the base database is never written. The rehearsal report pins each draft by sha256 (a changed draft makes the report `STALE`).
- The disposable base was freshly migrated and holds no business rows: its census is 0 everywhere and says nothing about dev, staging or production. The rehearsal fixtures (seeded rows in the COPY) exercise the code paths only.
- Static scan: apps/, packages/, e2e/, scripts/ for each legacy identifier, excluding the drafts and their specs, the rehearsal spec, applied historical migrations, the deprecated drizzle snapshots and a narrow entity-free allowlist (each entry has a reason in the tool; the allowlisted hits are reported separately). Hits are `file:line`, expected 0, any hit = NO. Ambiguous names (`rg`, `birth_date`, `address`, `data`) need the group table in the same statement window (artists share those names).

## Prerequisites missing for EVERY group (external or human, cannot be produced here)

1. Owner authorization naming the migration, the environment and the columns (decision `deci-ed83c974` grants none).
2. Census of a real environment (plan 3.0-3.2, 3.5, 3.6): dev, staging and production were never reachable; production is external.
3. Release B0 (entity/reader/writer removal) deployed and green in every environment, and release A deployed everywhere.
4. Staging rehearsal on a fresh restore of production data (`up()`, verify, `down()`, byte-equal values, `up()`); only the disposable rehearsal exists.
5. PITR / backup point id taken immediately before the deploy (`--pitr-id`, NOT_PROVIDED).
6. Table sizes and measured lock timings of the rehearsal on production-sized data (15s lock_timeout, SHARE ROW EXCLUSIVE).
7. Draft moved to `migrations/`, registered and `LEGACY_DROP_CONFIRM` present only in the single executing deploy job (never done, never allowed from here); one destructive migration per deploy; rollback owner on call.
8. Post-deploy ledger regeneration and census baseline updates (orchestrator).

## Package 44: shares legacy artist project id

```text
MIGRATION: DropSharesLegacyArtistProjectId20260930000044 | apps/api/src/database/migration-drafts/20260930000044_DropSharesLegacyArtistProjectId.ts | sha256=1eb80cea6014b2645aa4b1946fc0bcea9651095162050afa2a4c3109164aa57e | registered=false
ENVIRONMENT: disposable-rehearsal (music_os_drops_base COPY at 127.0.0.1:54329; no dev/staging/production database reachable)
TABLE: shares
COLUMNS: shares.legacy_artist_project_id (uuid); information_schema verification on the disposable base: VERIFIED
ROWS: disposable base census (rows holding legacy values / rows total) shares=0/0; rehearsal fixtures archived 1 row(s); dev=NOT_MEASURED staging=NOT_MEASURED production=NOT_MEASURED
DIVERGENCES: disposable base ZERO (blocking=0, informational=0) over 1 draft check(s); rehearsal negative path: a violating row aborts up() with the exact count and nothing is archived or dropped; dev=NOT_MEASURED staging=NOT_MEASURED production=NOT_MEASURED
ARCHIVE: shares_legacy_archive_20260930. Before the drop NOT_APPLICABLE. In the rehearsal: created by up(), RLS enabled and forced, no policy, grants to PUBLIC/anon/authenticated/musicos_app = 0, rows = rows holding legacy values (1), kept by down(). Real environments: not measurable before a drop
RESTORE_PROOF: PASS on a disposable COPY only: real up -> down -> up executed, values equal by id after down(), archive not dropped by down(); idempotent re-run of up() is a no-op. NOT a staging rehearsal on restored production data
PITR: NOT_PROVIDED (no --pitr-id; never invented)
RETENTION: NOT_APPLICABLE (not a PII group)
PRECONDITIONS: static scan producers=0 (YES), consumers=0 (YES), allowlisted=11 || canonical replacement: legacy_artist_project_id -> artist_id || machine checks of the draft: shares:artist_project_id_differs_from_artist_id || items of the 15 not satisfied here: 11 rehearsal=PASS_DISPOSABLE_ONLY; 12 pitr_restore_point=NOT_PROVIDED; 15 runbook_prerequisites=HAS_NOT_SATISFIED || runbook (plan section 8) NOT_SATISFIED: 10 of 11 (all external/human, see the common list above)
RISK: Lowest-risk group (single uuid column, precondition proves legacy_artist_project_id = artist_id wherever set), but still unmeasured on any real environment; shares size and lock timing NOT_MEASURED.
ROLLBACK: down(): re-add legacy_artist_project_id and restore by id from shares_legacy_archive_20260930; refuses without the archive.
READY_FOR_DESTRUCTIVE_EXECUTION: NO
```

Missing before this package could become YES: (a) owner authorization naming this migration and environment; (b) real-environment census with every divergence 0; (c) staging rehearsal on restored production data; (d) PITR id; (e) B0/A deployments confirmed in every environment, table sizes and lock timings measured.

## Package 43: clients legacy contact status

```text
MIGRATION: DropClientsLegacyContactStatus20260930000043 | apps/api/src/database/migration-drafts/20260930000043_DropClientsLegacyContactStatus.ts | sha256=b146e76c38319dae936784cc1f8dc3976ae4e56d6d96d0aef422eccfa29d0333 | registered=false
ENVIRONMENT: disposable-rehearsal (music_os_drops_base COPY at 127.0.0.1:54329; no dev/staging/production database reachable)
TABLE: clients
COLUMNS: clients.legacy_contact_status (varchar(40)); information_schema verification on the disposable base: VERIFIED
ROWS: disposable base census (rows holding legacy values / rows total) clients=0/0; rehearsal fixtures archived 1 row(s); dev=NOT_MEASURED staging=NOT_MEASURED production=NOT_MEASURED
DIVERGENCES: disposable base ZERO (blocking=0, informational=0) over 1 draft check(s); rehearsal negative path: a violating row aborts up() with the exact count and nothing is archived or dropped; dev=NOT_MEASURED staging=NOT_MEASURED production=NOT_MEASURED
ARCHIVE: clients_legacy_archive_20260930. Before the drop NOT_APPLICABLE. In the rehearsal: created by up(), RLS enabled and forced, no policy, grants to PUBLIC/anon/authenticated/musicos_app = 0, rows = rows holding legacy values (1), kept by down(). Real environments: not measurable before a drop
RESTORE_PROOF: PASS on a disposable COPY only: real up -> down -> up executed, values equal by id after down(), archive not dropped by down(); idempotent re-run of up() is a no-op. NOT a staging rehearsal on restored production data
PITR: NOT_PROVIDED (no --pitr-id; never invented)
RETENTION: NOT_DEFINED (PII group: the owner retention decision for the archive is required, --retention-ref absent)
PRECONDITIONS: static scan producers=0 (YES), consumers=0 (YES), allowlisted=15 || canonical replacement: legacy_contact_status -> status (UNPROVEN: owner-signed (legacy, status) pair census is the gate) [NOT SATISFIED: no proven canonical counterpart] || machine checks of the draft: clients:contact_status_without_status [informational] || owner-signed (legacy_contact_status, status) pair census (plan 3.4): NOT_PROVIDED || items of the 15 not satisfied here: 3 canonical_replacement=DECLARED; 11 rehearsal=PASS_DISPOSABLE_ONLY; 12 pitr_restore_point=NOT_PROVIDED; 14 retention=NOT_DEFINED; 15 runbook_prerequisites=HAS_NOT_SATISFIED || runbook (plan section 8) NOT_SATISFIED: 11 of 11 (all external/human, see the common list above)
RISK: The canonical replacement is NOT proven: migration 20260719000010 calls status distinct from status_contato. The only machine check (legacy value on a row with an empty status) is informational and passes vacuously. The owner-signed (legacy_contact_status, status) pair census (plan 3.4) is the real gate and does not exist. clients holds personal data: the archive is a personal-data store needing a retention decision.
ROLLBACK: down(): re-add legacy_contact_status and restore by id from clients_legacy_archive_20260930; refuses without the archive.
READY_FOR_DESTRUCTIVE_EXECUTION: NO
```

Missing before this package could become YES: (a) owner authorization naming this migration and environment; (b) real-environment census with every divergence 0; (c) staging rehearsal on restored production data; (d) PITR id; (e) signed (legacy_contact_status, status) pair census and clients archive retention; (f) B0/A deployments confirmed in every environment, table sizes and lock timings measured.

## Package 40: works legacy columns

```text
MIGRATION: DropWorksLegacyColumns20260930000040 | apps/api/src/database/migration-drafts/20260930000040_DropWorksLegacyColumns.ts | sha256=058428cd41f0d296cc46ac7441b236ef5b8aa4fa5990b8e60a6ffb62142df33f | registered=false
ENVIRONMENT: disposable-rehearsal (music_os_drops_base COPY at 127.0.0.1:54329; no dev/staging/production database reachable)
TABLE: works
COLUMNS: works.legacy_language_label, legacy_instrumental_flag, legacy_ai_used, legacy_alternative_titles, legacy_lyrics (varchar(20), varchar(10), boolean, jsonb, text); information_schema verification on the disposable base: VERIFIED
ROWS: disposable base census (rows holding legacy values / rows total) works=0/0; rehearsal fixtures archived 1 row(s); dev=NOT_MEASURED staging=NOT_MEASURED production=NOT_MEASURED
DIVERGENCES: disposable base ZERO (blocking=0, informational=0) over 5 draft check(s); rehearsal negative path: a violating row aborts up() with the exact count and nothing is archived or dropped; dev=NOT_MEASURED staging=NOT_MEASURED production=NOT_MEASURED
ARCHIVE: works_legacy_archive_20260930. Before the drop NOT_APPLICABLE. In the rehearsal: created by up(), RLS enabled and forced, no policy, grants to PUBLIC/anon/authenticated/musicos_app = 0, rows = rows holding legacy values (1), kept by down(). Real environments: not measurable before a drop
RESTORE_PROOF: PASS on a disposable COPY only: real up -> down -> up executed, values equal by id after down(), archive not dropped by down(); idempotent re-run of up() is a no-op. NOT a staging rehearsal on restored production data
PITR: NOT_PROVIDED (no --pitr-id; never invented)
RETENTION: NOT_APPLICABLE (not a PII group)
PRECONDITIONS: static scan producers=0 (YES), consumers=0 (YES), allowlisted=58 || canonical replacement: legacy_language_label -> language; legacy_instrumental_flag -> is_instrumental; legacy_ai_used -> ai_used; legacy_alternative_titles -> alternative_titles; legacy_lyrics -> lyrics || machine checks of the draft: works:language_label_without_language, works:instrumental_flag_without_is_instrumental, works:ai_used_without_ai_used, works:alternative_titles_without_alternative_titles, works:lyrics_without_lyrics || items of the 15 not satisfied here: 11 rehearsal=PASS_DISPOSABLE_ONLY; 12 pitr_restore_point=NOT_PROVIDED; 15 runbook_prerequisites=HAS_NOT_SATISFIED || runbook (plan section 8) NOT_SATISFIED: 10 of 11 (all external/human, see the common list above)
RISK: works is one of the largest tables (size and lock timing NOT_MEASURED): the 15s lock_timeout with LOCK TABLE works IN SHARE ROW EXCLUSIVE MODE blocks writers while the archive INSERT and the ALTER run. legacy_lyrics and legacy_alternative_titles can be large (archive doubles their storage). A legacy value with no canonical counterpart aborts the migration (count only).
ROLLBACK: down(): re-add the 5 columns (nullable, same types) and restore by id from works_legacy_archive_20260930 (COALESCE: live values are never overwritten); refuses when the archive is missing; archive never dropped by down(). Rows created after the drop stay NULL.
READY_FOR_DESTRUCTIVE_EXECUTION: NO
```

Missing before this package could become YES: (a) owner authorization naming this migration and environment; (b) real-environment census with every divergence 0; (c) staging rehearsal on restored production data; (d) PITR id; (e) B0/A deployments confirmed in every environment, table sizes and lock timings measured.

## Package 41: phonograms legacy columns

```text
MIGRATION: DropPhonogramsLegacyColumns20260930000041 | apps/api/src/database/migration-drafts/20260930000041_DropPhonogramsLegacyColumns.ts | sha256=3c807e8ae639094f95fad0ca3d674c202fa8b06104a6fc8f870330cadbc2c5f6 | registered=false
ENVIRONMENT: disposable-rehearsal (music_os_drops_base COPY at 127.0.0.1:54329; no dev/staging/production database reachable)
TABLE: phonograms
COLUMNS: phonograms.legacy_recording_date, legacy_release_date, legacy_duration_minutes, legacy_duration_seconds_part, legacy_origin_country (date, date, integer, integer, varchar(100)); information_schema verification on the disposable base: VERIFIED
ROWS: disposable base census (rows holding legacy values / rows total) phonograms=0/0; rehearsal fixtures archived 1 row(s); dev=NOT_MEASURED staging=NOT_MEASURED production=NOT_MEASURED
DIVERGENCES: disposable base ZERO (blocking=0, informational=0) over 4 draft check(s); rehearsal negative path: a violating row aborts up() with the exact count and nothing is archived or dropped; dev=NOT_MEASURED staging=NOT_MEASURED production=NOT_MEASURED
ARCHIVE: phonograms_legacy_archive_20260930. Before the drop NOT_APPLICABLE. In the rehearsal: created by up(), RLS enabled and forced, no policy, grants to PUBLIC/anon/authenticated/musicos_app = 0, rows = rows holding legacy values (1), kept by down(). Real environments: not measurable before a drop
RESTORE_PROOF: PASS on a disposable COPY only: real up -> down -> up executed, values equal by id after down(), archive not dropped by down(); idempotent re-run of up() is a no-op. NOT a staging rehearsal on restored production data
PITR: NOT_PROVIDED (no --pitr-id; never invented)
RETENTION: NOT_APPLICABLE (not a PII group)
PRECONDITIONS: static scan producers=0 (YES), consumers=0 (YES), allowlisted=50 || canonical replacement: legacy_recording_date -> recording_date; legacy_release_date -> release_date; legacy_duration_minutes -> duration_seconds; legacy_duration_seconds_part -> duration_seconds; legacy_origin_country -> country_of_recording || machine checks of the draft: phonograms:recording_date_missing, phonograms:release_date_missing, phonograms:duration_seconds_missing, phonograms:country_of_recording_missing || items of the 15 not satisfied here: 11 rehearsal=PASS_DISPOSABLE_ONLY; 12 pitr_restore_point=NOT_PROVIDED; 15 runbook_prerequisites=HAS_NOT_SATISFIED || runbook (plan section 8) NOT_SATISFIED: 10 of 11 (all external/human, see the common list above)
RISK: phonograms size and lock timing NOT_MEASURED (15s lock_timeout, SHARE ROW EXCLUSIVE). The duration is split in two legacy columns (minutes, seconds part) that map to ONE canonical duration_seconds: the precondition only proves duration_seconds is present, not that it equals minutes*60+seconds (the archive keeps the original parts).
ROLLBACK: down(): re-add the 5 columns and restore by id from phonograms_legacy_archive_20260930; refuses without the archive.
READY_FOR_DESTRUCTIVE_EXECUTION: NO
```

Missing before this package could become YES: (a) owner authorization naming this migration and environment; (b) real-environment census with every divergence 0; (c) staging rehearsal on restored production data; (d) PITR id; (e) B0/A deployments confirmed in every environment, table sizes and lock timings measured.

## Package 42: transactions legacy columns

```text
MIGRATION: DropTransactionsLegacyColumns20260930000042 | apps/api/src/database/migration-drafts/20260930000042_DropTransactionsLegacyColumns.ts | sha256=1c2000b3f86c83dab71ccb5fbba9eb4e6553f13e9750a5ee9002eef13fb98988 | registered=false
ENVIRONMENT: disposable-rehearsal (music_os_drops_base COPY at 127.0.0.1:54329; no dev/staging/production database reachable)
TABLE: transactions
COLUMNS: transactions.legacy_transaction_type, legacy_transaction_date, legacy_attachment_url, legacy_reference (varchar(50), date, text, varchar(255)); information_schema verification on the disposable base: VERIFIED
ROWS: disposable base census (rows holding legacy values / rows total) transactions=0/0; rehearsal fixtures archived 1 row(s); dev=NOT_MEASURED staging=NOT_MEASURED production=NOT_MEASURED
DIVERGENCES: disposable base ZERO (blocking=0, informational=0) over 2 draft check(s); rehearsal negative path: a violating row aborts up() with the exact count and nothing is archived or dropped; dev=NOT_MEASURED staging=NOT_MEASURED production=NOT_MEASURED
ARCHIVE: transactions_legacy_archive_20260930. Before the drop NOT_APPLICABLE. In the rehearsal: created by up(), RLS enabled and forced, no policy, grants to PUBLIC/anon/authenticated/musicos_app = 0, rows = rows holding legacy values (1), kept by down(). Real environments: not measurable before a drop
RESTORE_PROOF: PASS on a disposable COPY only: real up -> down -> up executed, values equal by id after down(), archive not dropped by down(); idempotent re-run of up() is a no-op. NOT a staging rehearsal on restored production data
PITR: NOT_PROVIDED (no --pitr-id; never invented)
RETENTION: NOT_APPLICABLE (not a PII group)
PRECONDITIONS: static scan producers=0 (YES), consumers=0 (YES), allowlisted=32 || canonical replacement: legacy_transaction_type -> type; legacy_transaction_date -> transaction_date; legacy_attachment_url -> attachment_url; legacy_reference -> notes || machine checks of the draft: transactions:attachment_url_missing, transactions:reference_not_in_notes || items of the 15 not satisfied here: 11 rehearsal=PASS_DISPOSABLE_ONLY; 12 pitr_restore_point=NOT_PROVIDED; 15 runbook_prerequisites=HAS_NOT_SATISFIED || runbook (plan section 8) NOT_SATISFIED: 10 of 11 (all external/human, see the common list above)
RISK: transactions is a financial, high-write table (size and lock timing NOT_MEASURED): writers wait up to 15s on SHARE ROW EXCLUSIVE. legacy_transaction_type and legacy_transaction_date are NOT compared with the canonical NOT NULL columns by any precondition (informational in the plan, 3.1); the archive keeps them. Must not be mixed with TX1 (migration 18).
ROLLBACK: down(): re-add the 4 columns and restore by id from transactions_legacy_archive_20260930; refuses without the archive.
READY_FOR_DESTRUCTIVE_EXECUTION: NO
```

Missing before this package could become YES: (a) owner authorization naming this migration and environment; (b) real-environment census with every divergence 0; (c) staging rehearsal on restored production data; (d) PITR id; (e) B0/A deployments confirmed in every environment, table sizes and lock timings measured.

## Package 45: HR legacy mirrors (employees, payroll_entries, leave_requests)

```text
MIGRATION: DropHrLegacyMirrors20260930000045 | apps/api/src/database/migration-drafts/20260930000045_DropHrLegacyMirrors.ts | sha256=1b85f38f22236bec9ffac7f0521cb10c58b0d4801bc7efc743ab72f4fbfec40f | registered=false
ENVIRONMENT: disposable-rehearsal (music_os_drops_base COPY at 127.0.0.1:54329; no dev/staging/production database reachable)
TABLE: employees, payroll_entries, leave_requests
COLUMNS: employees.legacy_full_name, legacy_sector, legacy_base_salary (varchar(150), varchar(100), numeric(15,2)) | payroll_entries.legacy_employee_id, legacy_reference_month (uuid, varchar(20)) | leave_requests.legacy_employee_id (uuid); information_schema verification on the disposable base: VERIFIED
ROWS: disposable base census (rows holding legacy values / rows total) employees=0/0, payroll_entries=0/0, leave_requests=0/0; rehearsal fixtures archived 3 row(s); dev=NOT_MEASURED staging=NOT_MEASURED production=NOT_MEASURED
DIVERGENCES: disposable base ZERO (blocking=0, informational=0) over 6 draft check(s); rehearsal negative path: a violating row aborts up() with the exact count and nothing is archived or dropped; dev=NOT_MEASURED staging=NOT_MEASURED production=NOT_MEASURED
ARCHIVE: employees_legacy_archive_20260930, payroll_entries_legacy_archive_20260930, leave_requests_legacy_archive_20260930. Before the drop NOT_APPLICABLE. In the rehearsal: created by up(), RLS enabled and forced, no policy, grants to PUBLIC/anon/authenticated/musicos_app = 0, rows = rows holding legacy values (3), kept by down(). Real environments: not measurable before a drop
RESTORE_PROOF: PASS on a disposable COPY only: real up -> down -> up executed, values equal by id after down(), archive not dropped by down(); idempotent re-run of up() is a no-op. NOT a staging rehearsal on restored production data
PITR: NOT_PROVIDED (no --pitr-id; never invented)
RETENTION: NOT_DEFINED (PII group: the owner retention decision for the archive is required, --retention-ref absent)
PRECONDITIONS: static scan producers=0 (YES), consumers=0 (YES), allowlisted=52 || canonical replacement: legacy_full_name -> name; legacy_sector -> department; legacy_base_salary -> salary; legacy_employee_id -> employee_id; legacy_reference_month -> reference_month || machine checks of the draft: employees:full_name_differs_from_name, employees:sector_differs_from_department, employees:base_salary_differs_from_salary, payroll_entries:employee_id_differs, payroll_entries:reference_month_differs, leave_requests:employee_id_differs || items of the 15 not satisfied here: 11 rehearsal=PASS_DISPOSABLE_ONLY; 12 pitr_restore_point=NOT_PROVIDED; 14 retention=NOT_DEFINED; 15 runbook_prerequisites=HAS_NOT_SATISFIED || runbook (plan section 8) NOT_SATISFIED: 11 of 11 (all external/human, see the common list above)
RISK: PII and salary data (names, base salary) are copied into three archive tables that need an HR retention decision and a place in the per-tenant erasure procedure. One migration locks three tables (15s lock_timeout each). Must never share a deploy with draft 53 (same table employees).
ROLLBACK: down(): re-add all 6 columns on 3 tables and restore by id from the three archives; refuses when any archive is missing.
READY_FOR_DESTRUCTIVE_EXECUTION: NO
```

Missing before this package could become YES: (a) owner authorization naming this migration and environment; (b) real-environment census with every divergence 0; (c) staging rehearsal on restored production data; (d) PITR id; (e) HR retention decision for the archive tables; (f) B0/A deployments confirmed in every environment, table sizes and lock timings measured.

## Package 53: employees PII columns (rg, birth_date, address)

```text
MIGRATION: DropEmployeesLegacyPiiColumns20260930000053 | apps/api/src/database/migration-drafts/20260930000053_DropEmployeesLegacyPiiColumns.ts | sha256=c4fb569479b8932d0b0d8363548efc45325274b8b17384788f385a93591081d7 | registered=false
ENVIRONMENT: disposable-rehearsal (music_os_drops_base COPY at 127.0.0.1:54329; no dev/staging/production database reachable)
TABLE: employees
COLUMNS: employees.rg, birth_date, address (varchar(30), date, varchar(300)); information_schema verification on the disposable base: VERIFIED
ROWS: disposable base census (rows holding legacy values / rows total) employees=0/0; rehearsal fixtures archived 2 row(s); dev=NOT_MEASURED staging=NOT_MEASURED production=NOT_MEASURED
DIVERGENCES: disposable base ZERO (blocking=0, informational=0) over 0 draft check(s); rehearsal negative path: a violating row aborts up() with the exact count and nothing is archived or dropped; dev=NOT_MEASURED staging=NOT_MEASURED production=NOT_MEASURED
ARCHIVE: employees_pii_legacy_archive_20260930. Before the drop NOT_APPLICABLE. In the rehearsal: created by up(), RLS enabled and forced, no policy, grants to PUBLIC/anon/authenticated/musicos_app = 0, rows = rows holding legacy values (2), kept by down(). Real environments: not measurable before a drop
RESTORE_PROOF: PASS on a disposable COPY only: real up -> down -> up executed, values equal by id after down(), archive not dropped by down(); idempotent re-run of up() is a no-op. NOT a staging rehearsal on restored production data
PITR: NOT_PROVIDED (no --pitr-id; never invented)
RETENTION: NOT_DEFINED (PII group: the owner retention decision for the archive is required, --retention-ref absent)
PRECONDITIONS: static scan producers=0 (YES), consumers=0 (YES), allowlisted=60 || canonical replacement: rg -> NONE (no canonical counterpart: the values exist only here); birth_date -> NONE; address -> NONE [NOT SATISFIED: no proven canonical counterpart] || machine checks of the draft: NONE (owner census and retention decision are the only gate) || items of the 15 not satisfied here: 3 canonical_replacement=DECLARED; 11 rehearsal=PASS_DISPOSABLE_ONLY; 12 pitr_restore_point=NOT_PROVIDED; 14 retention=NOT_DEFINED; 15 runbook_prerequisites=HAS_NOT_SATISFIED || runbook (plan section 8) NOT_SATISFIED: 11 of 11 (all external/human, see the common list above)
RISK: The values exist ONLY in these columns (no canonical counterpart, no machine precondition): the archive is the only copy after the drop and holds identity document, date of birth and home address in plaintext, readable only by the BYPASSRLS migration role. Keeping the archive does not reduce exposure unless the retention is short; the HR owner must decide retention and the census of plan 3.6 must be attached. Never in the same deploy as 45.
ROLLBACK: down(): re-add rg, birth_date, address (nullable, same types) and restore by id from employees_pii_legacy_archive_20260930; refuses without the archive.
READY_FOR_DESTRUCTIVE_EXECUTION: NO
```

Missing before this package could become YES: (a) owner authorization naming this migration and environment; (b) real-environment census with every divergence 0; (c) staging rehearsal on restored production data; (d) PITR id; (e) HR retention decision for the archive tables and the plan 3.6 census attached; (f) B0/A deployments confirmed in every environment, table sizes and lock timings measured.

## Package 46: events.data column and sync trigger

```text
MIGRATION: DropEventsDataAndSyncTrigger20260930000046 | apps/api/src/database/migration-drafts/20260930000046_DropEventsDataAndSyncTrigger.ts | sha256=62c838136642e6f59784a43e3c77378639ba9533d3640c9602cd7a69e2101755 | registered=false
ENVIRONMENT: disposable-rehearsal (music_os_drops_base COPY at 127.0.0.1:54329; no dev/staging/production database reachable)
TABLE: events
COLUMNS: events.data (timestamp) + trigger trg_events_sync_start_columns + function sync_events_start_columns() + index idx_events_tenant_data; information_schema verification on the disposable base: VERIFIED
ROWS: disposable base census (rows holding legacy values / rows total) events=0/0; rehearsal fixtures archived n/a (no archive) row(s); dev=NOT_MEASURED staging=NOT_MEASURED production=NOT_MEASURED
DIVERGENCES: disposable base ZERO (blocking=0, informational=0) over 2 draft check(s); rehearsal negative path: a violating row aborts up() with the exact count and nothing is archived or dropped; dev=NOT_MEASURED staging=NOT_MEASURED production=NOT_MEASURED
ARCHIVE: none by design (events.data == events.starts_at, trigger-enforced; starts_at is the surviving copy). Before the drop NOT_APPLICABLE. In the rehearsal: created by up(), RLS enabled and forced, no policy, grants to PUBLIC/anon/authenticated/musicos_app = 0, rows = rows holding legacy values (n/a (no archive)), kept by down(). Real environments: not measurable before a drop
RESTORE_PROOF: PASS on a disposable COPY only: real up -> down -> up executed, values equal by id after down(), archive not dropped by down() (n/a archive); idempotent re-run of up() is a no-op. NOT a staging rehearsal on restored production data
PITR: NOT_PROVIDED (no --pitr-id; never invented)
RETENTION: NOT_APPLICABLE (not a PII group)
PRECONDITIONS: static scan producers=0 (YES), consumers=0 (YES), allowlisted=20 || canonical replacement: data -> starts_at || machine checks of the draft: events:data_differs_from_starts_at, events:starts_at_null || items of the 15 not satisfied here: 11 rehearsal=PASS_DISPOSABLE_ONLY; 12 pitr_restore_point=NOT_PROVIDED; 15 runbook_prerequisites=HAS_NOT_SATISFIED || runbook (plan section 8) NOT_SATISFIED: 10 of 11 (all external/human, see the common list above)
RISK: Drops trigger trg_events_sync_start_columns, function sync_events_start_columns() and column data (with idx_events_tenant_data). The API must already read only starts_at and the B0 entity removal must be live everywhere, otherwise an older build INSERTs without data and fails (data is NOT NULL, the trigger is its only filler until the drop). Table lock added in this change (see fixes).
ROLLBACK: down(): re-add data (timestamp), UPDATE data = starts_at, SET NOT NULL, recreate function, trigger and idx_events_tenant_data (rebuilds, no archive needed).
READY_FOR_DESTRUCTIVE_EXECUTION: NO
```

Missing before this package could become YES: (a) owner authorization naming this migration and environment; (b) real-environment census with every divergence 0; (c) staging rehearsal on restored production data; (d) PITR id; (e) every environment confirmed reading only starts_at (B0 deployed) and the verify-canonical-column-order.ts edit prepared for release B; (f) B0/A deployments confirmed in every environment, table sizes and lock timings measured.

## Package 48: invoices.legacy_amount relax NOT NULL (non-destructive precursor of 49)

```text
MIGRATION: RelaxInvoicesLegacyAmountNotNull20260930000048 | apps/api/src/database/migration-drafts/20260930000048_RelaxInvoicesLegacyAmountNotNull.ts | sha256=d925611a50383cf5866309eedef59d0efe87aa942e14118ddc4efa8031680cb5 | registered=false | NON-DESTRUCTIVE precursor
ENVIRONMENT: disposable-rehearsal (music_os_drops_base COPY at 127.0.0.1:54329; no dev/staging/production database reachable)
TABLE: invoices
COLUMNS: invoices.legacy_amount (numeric(15,2)): ALTER COLUMN DROP NOT NULL only, no column is dropped; information_schema verification on the disposable base: VERIFIED
ROWS: disposable base census (rows holding legacy values / rows total) invoices=0/0; rehearsal fixtures archived n/a (no archive) row(s); dev=NOT_MEASURED staging=NOT_MEASURED production=NOT_MEASURED
DIVERGENCES: disposable base ZERO (blocking=0, informational=0) over 1 draft check(s); rehearsal negative path: a violating row aborts up() with the exact count and nothing is archived or dropped; dev=NOT_MEASURED staging=NOT_MEASURED production=NOT_MEASURED
ARCHIVE: none (no data is removed: only ALTER COLUMN legacy_amount DROP NOT NULL). Before the drop NOT_APPLICABLE. In the rehearsal: created by up(), RLS enabled and forced, no policy, grants to PUBLIC/anon/authenticated/musicos_app = 0, rows = rows holding legacy values (n/a (no archive)), kept by down(). Real environments: not measurable before a drop
RESTORE_PROOF: PASS on a disposable COPY only: real up -> down -> up executed, values equal by id after down(), archive not dropped by down() (n/a archive); idempotent re-run of up() is a no-op. NOT a staging rehearsal on restored production data
PITR: NOT_PROVIDED (no --pitr-id; never invented)
RETENTION: NOT_APPLICABLE (not a PII group)
PRECONDITIONS: static scan producers=8 (NO), consumers=31 (NO), allowlisted=69; HITS IN: apps/api/src/modules/billing/billing.service.spec.ts (3); apps/api/src/modules/billing/billing.service.ts (4); apps/api/src/modules/invoices/invoices.service.ts (6); apps/api/src/modules/invoices/schedulers/invoice-overdue.scheduler.spec.ts (5); apps/api/src/modules/invoices/schedulers/invoice-overdue.scheduler.ts (2); apps/api/test/e2e/billing/invoice-overdue-saas-exclusion.e2e-spec.ts (1); apps/api/src/database/entities.ts (1); apps/api/src/modules/invoices/dto/invoices.dto.ts (1); apps/api/src/modules/invoices/invoices.service.spec.ts (5); apps/web/src/modules/accounting/components/invoice-form/hooks/useInvoiceForm.legacy-amount.guard.test.ts (4); apps/web/src/modules/accounting/components/invoice-form/hooks/useInvoiceForm.ts (2); apps/web/src/modules/accounting/components/InvoiceViewModal.tsx (2); apps/web/src/modules/accounting/hooks/useInvoices.ts (2); apps/web/src/modules/accounting/pages/Invoices.tsx (1) || canonical replacement: legacy_amount -> service_amount || machine checks of the draft: invoices:legacy_amount_without_service_amount || items of the 15 not satisfied here: 4 zero_legacy_producers=NO; 5 zero_legacy_consumers=NO; 11 rehearsal=PASS_DISPOSABLE_ONLY; 12 pitr_restore_point=NOT_PROVIDED; 15 runbook_prerequisites=HAS_NOT_SATISFIED || runbook (plan section 8) NOT_SATISFIED: 10 of 11 (all external/human, see the common list above)
RISK: Non-destructive and reversible, but it is the precondition of the stop-writing release (5.1 step 3). While invoices.service.ts, the Stripe upsert and the entity still write legacy_amount (static scan hits below) nothing depends on it; relaxing before the B0 of 49 is harmless, dropping later is not.
ROLLBACK: down(): refuses when legacy_amount is absent (roll back 49 first) or when any row has neither value (would invent a 0); otherwise refills NULL legacy_amount from service_amount and SET NOT NULL.
READY_FOR_DESTRUCTIVE_EXECUTION: NO
```

Missing before this package could become YES: (a) owner authorization naming this migration and environment; (b) real-environment census with every divergence 0; (c) staging rehearsal on restored production data; (d) PITR id; (e) stage 5.1 step 3 (B0 of 49: stop writing and remove 39 legacy_amount hit(s) in 14 files); (f) B0/A deployments confirmed in every environment, table sizes and lock timings measured.

## Package 49: invoices.legacy_amount drop

```text
MIGRATION: DropInvoicesLegacyAmount20260930000049 | apps/api/src/database/migration-drafts/20260930000049_DropInvoicesLegacyAmount.ts | sha256=390ecf78cfecbdba5776e48b97271754634c43642fa197f66d3800824c85571e | registered=false
ENVIRONMENT: disposable-rehearsal (music_os_drops_base COPY at 127.0.0.1:54329; no dev/staging/production database reachable)
TABLE: invoices
COLUMNS: invoices.legacy_amount (numeric(15,2)); information_schema verification on the disposable base: VERIFIED
ROWS: disposable base census (rows holding legacy values / rows total) invoices=0/0; rehearsal fixtures archived 2 row(s); dev=NOT_MEASURED staging=NOT_MEASURED production=NOT_MEASURED
DIVERGENCES: disposable base ZERO (blocking=0, informational=0) over 2 draft check(s); rehearsal negative path: a violating row aborts up() with the exact count and nothing is archived or dropped; dev=NOT_MEASURED staging=NOT_MEASURED production=NOT_MEASURED
ARCHIVE: invoices_legacy_archive_20260930. Before the drop NOT_APPLICABLE. In the rehearsal: created by up(), RLS enabled and forced, no policy, grants to PUBLIC/anon/authenticated/musicos_app = 0, rows = rows holding legacy values (2), kept by down(). Real environments: not measurable before a drop
RESTORE_PROOF: PASS on a disposable COPY only: real up -> down -> up executed, values equal by id after down(), archive not dropped by down(); idempotent re-run of up() is a no-op. NOT a staging rehearsal on restored production data
PITR: NOT_PROVIDED (no --pitr-id; never invented)
RETENTION: NOT_APPLICABLE (not a PII group)
PRECONDITIONS: static scan producers=8 (NO), consumers=31 (NO), allowlisted=69; HITS IN: apps/api/src/modules/billing/billing.service.spec.ts (3); apps/api/src/modules/billing/billing.service.ts (4); apps/api/src/modules/invoices/invoices.service.ts (6); apps/api/src/modules/invoices/schedulers/invoice-overdue.scheduler.spec.ts (5); apps/api/src/modules/invoices/schedulers/invoice-overdue.scheduler.ts (2); apps/api/test/e2e/billing/invoice-overdue-saas-exclusion.e2e-spec.ts (1); apps/api/src/database/entities.ts (1); apps/api/src/modules/invoices/dto/invoices.dto.ts (1); apps/api/src/modules/invoices/invoices.service.spec.ts (5); apps/web/src/modules/accounting/components/invoice-form/hooks/useInvoiceForm.legacy-amount.guard.test.ts (4); apps/web/src/modules/accounting/components/invoice-form/hooks/useInvoiceForm.ts (2); apps/web/src/modules/accounting/components/InvoiceViewModal.tsx (2); apps/web/src/modules/accounting/hooks/useInvoices.ts (2); apps/web/src/modules/accounting/pages/Invoices.tsx (1) || canonical replacement: legacy_amount -> service_amount || machine checks of the draft: invoices:legacy_amount_without_service_amount, invoices:legacy_amount_differs_from_service_amount || items of the 15 not satisfied here: 4 zero_legacy_producers=NO; 5 zero_legacy_consumers=NO; 11 rehearsal=PASS_DISPOSABLE_ONLY; 12 pitr_restore_point=NOT_PROVIDED; 15 runbook_prerequisites=HAS_NOT_SATISFIED || runbook (plan section 8) NOT_SATISFIED: 10 of 11 (all external/human, see the common list above)
RISK: Live producers and consumers still exist (static scan: see PRECONDITIONS): InvoiceEntity.legacy_amount, the DTO, invoices.service.ts mirror and fallbacks, the Stripe upsert dual-write, the overdue scheduler fallback, web fallbacks and an e2e fixture. Dropping now would break Stripe upserts and invoice creation. invoices is a high-write financial table (size and lock timing NOT_MEASURED).
ROLLBACK: down(): re-add legacy_amount (nullable) and restore by id from invoices_legacy_archive_20260930; then draft 48 down() restores NOT NULL (roll back 49 first, then 48).
READY_FOR_DESTRUCTIVE_EXECUTION: NO
```

Missing before this package could become YES: (a) owner authorization naming this migration and environment; (b) real-environment census with every divergence 0; (c) staging rehearsal on restored production data; (d) PITR id; (e) stage 5.1 step 3 (B0 of 49: stop writing and remove 39 legacy_amount hit(s) in 14 files); (f) draft 48 applied everywhere first; (g) B0/A deployments confirmed in every environment, table sizes and lock timings measured.

## Defects found and fixed in the drafts (root cause, with specs)

- `legacy-column-drop.base.ts` `runRestore` (down() of drafts 40-45, 49, 53): the restore did `SET col = archived` unconditionally, so a down() run on a schema whose columns still existed (partly rolled back, never dropped) overwrote newer live values with older archived ones. It is now `COALESCE(live, archived)`: the archive only fills NULLs. Pinned by `legacy-column-drop.draft.spec.ts` and by the real-PostgreSQL rehearsal (invoices block: live value 999.00 survives a second down()).
- `20260930000046_DropEventsDataAndSyncTrigger.ts`: unlike every other draft it took no table lock, so the presence check, the precondition and the DROP did not see one frozen set of rows and a concurrent writer was not bounded by lock_timeout. up() and down() now run `LOCK TABLE "events" IN SHARE ROW EXCLUSIVE MODE` right after `SET LOCAL lock_timeout`, before the presence check. Pinned by a new spec.
- Coverage gap: drafts 48 and 49 had no real-database rehearsal. `apps/api/test/e2e/schema/legacy-column-drop-drafts.e2e-spec.ts` now rehearses 48 (abort count, relax, down refusal on rows with neither value, refill, restore NOT NULL) and 49 (abort on divergence, archive, RLS/grants, down by id, no overwrite, idempotent up, 48 down refusal once 49 applied) on the COPY, and writes the machine-readable rehearsal report when `LEGACY_DROP_REHEARSAL_REPORT` is set.

## Findings recorded, not fixed (outside the bounded path set)

- `apps/api/migrate.mjs` still references the DEPRECATED drizzle snapshot `apps/api/drizzle/0000_mixed_jimmy_woo.sql` (which creates `events.data`); `_DEPRECATED.md` says these files must never be applied. The pre-flight allowlists the snapshot directory for that reason. Candidate cleanup for the orchestrator.
- The draft 52 archive list and the erasure SQL are owned by another change set and were not touched here.
