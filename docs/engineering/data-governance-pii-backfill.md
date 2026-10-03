# PII at rest: artists and clients (BLK-CRM-PII-PLAINTEXT)

Status: code (additive, dual-read) shipped; the backfill + scrub of EXISTING rows is an unregistered, gated draft and has NOT been run anywhere.

## Discovered current state

- `clients`: `cpf_cnpj`/`email`/`phone` are already ciphertext columns (`*_encrypted`, `EncryptionService`, prefix `enc:v1:`). The API never persists plaintext document/e-mail/phone in `clients.metadata` (`client-legacy-fields.ts`, SEC-F3) and never returns `metadata`. What remains is HISTORICAL plaintext (`cpf`, `cnpj`, ... keys written by pre-CZ-043 builds) inside existing `clients.metadata`.
- `artists`: CZ-042 moved rg, birth date, address and bank data out of `metadata` into physical columns, but as PLAINTEXT columns (`birth_date`, `rg`, `address`, `bank_name`, `bank_branch`, `bank_account`, `pix_key`, `account_holder`; the Portuguese keys `data_nascimento`, `endereco`, `banco`, `agencia`, `conta`, `chave_pix`, `titular_conta` are only accepted as deprecated input aliases). `artists.metadata` could also still receive these keys from a caller-supplied `metadata` object, and historical rows keep copies the CZ-042 backfill could not copy.

## What the code does now (additive, safe to deploy after the migration)

1. Migration `20261002000001_AddArtistsPiiEncryptedColumns` (REGISTERED): eight nullable `text` columns `<field>_encrypted` on `artists`. No data copied, plaintext columns untouched. `down()` refuses while any ciphertext exists. Deploy order: migrations, then API release (an API that selects the new columns before the migration ran fails).
2. Write path: `ArtistsService` writes these fields ONLY as `enc:v1:` ciphertext (`encryption.encryptNullable`) and sets the plaintext column of that field to `NULL` on every write of the field (this row only, no bulk rewrite). Report import writes the ciphertext column (contract `encFromPlaintext`). `sanitizeArtistMetadataInput` drops plaintext PII keys (canonical and Portuguese) from a caller `metadata` on create/update.
3. Read path (dual-read): response = decrypted ciphertext when present, else the legacy plaintext column (never an unreadable blob). Ciphertext columns and raw `metadata` never leave the API (existing allow-list). Authorization is unchanged: `artist:read` / `client:read` + tenant scoping; no new per-field permission was invented (see decisions below).
4. Exports: the artists contract declares the fields as encrypted with `legacyPlaintextColumn`; the export SQL reads `COALESCE(<field>_encrypted, <field>::text)` and the engine decrypts or passes legacy plaintext through. `metadata` stays an internal column (never exported).
5. Logs: `redactSensitiveObject` redacts the PII keys (exact, anchored match; canonical and Portuguese spellings). The audit interceptor already logs ids only, not request bodies.

## Backfill + scrub draft (NOT registered, NOT executed)

`apps/api/src/database/migration-drafts/20261002000002_EncryptArtistsAndClientsPiiInPlace.ts`, spec `encrypt-artists-clients-pii.draft.spec.ts`. Destructive class (rewrites and nulls live PII): L5.

- Second lock: `PII_ENCRYPT_CONFIRM=encrypt-artists-clients-pii-gates-satisfied` (distinct from the other drafts) and a real `ENCRYPTION_KEY` of the target environment (unset or all-zero refused; it must be the key the API runs with, otherwise the API cannot read what was written).
- Fail-closed order: gates, BYPASSRLS role, ciphertext columns present, counts-only preflight, archive side tables, by-value archive coverage check (stale archive aborts), row rewrite (`FOR UPDATE`, keyset batches, `updated_at` untouched, `WHERE id AND tenant_id`), residue audit (rolls back if any candidate row remains).
- Archive tables `artists_pii_archive_20261002` and `clients_pii_archive_20261002` hold the ORIGINAL plaintext (they are PII themselves): RLS ENABLED and FORCED, no policy, every app role revoked; only the BYPASSRLS migration role reads them.
- Artists: plaintext column to `<field>_encrypted` only when the ciphertext is still NULL (existing ciphertext is newer truth, never overwritten), plaintext column set NULL, PII keys removed from `metadata` (values only archived, never promoted).
- Clients: PII keys removed from `metadata`; the document (cpf_cnpj, cpf, cnpj, documento, document in that priority) is promoted to `cpf_cnpj_encrypted` only when that column is NULL. Non-PII legacy form keys (razao_social, ...) are NOT touched (the key rename is a separate blocker).
- `down()`: restores plaintext columns and metadata keys from the archive; a ciphertext is nulled only if it still decrypts to the archived value (values edited after `up()` are kept). Archive tables are never dropped by this migration.

### What the approval must authorize (all required, recorded per environment)

1. Explicit owner/security approval to rewrite and scrub live PII in the named environment (staging first, production after).
2. Evidence of a disposable/staging dry run: preflight counts, `up()`, residue audit zero, API read-after-write of a sample through the API (decrypted value equals the archived value), `down()` then `up()` again.
3. Backup/restore evidence (a restore was actually performed), not backup existence alone.
4. The API release with the dual-read code live on EVERY instance before running (an old build would read NULL plaintext columns as empty and could write plaintext back).
5. The archive retention window and who may read/purge the archive tables (they hold plaintext PII; retired by the later, separately authorized draft `20260930000052`, which now lists both PII archives), plus a maintenance window for the `FOR UPDATE` row locks.
6. After success and a retention window: a separate authorized step to drop the plaintext columns (`birth_date`, `rg`, `address`, `bank_*`, `pix_key`, `account_holder`) and remove the `legacyPlaintextColumn` fallback (code and contract) in the same release.

## Decisions and residual risks (not fixed here, recorded)

- Per-field role gating: any holder of `artist:read` receives artist bank/ID data (list and detail). Restricting to a narrower permission (or omitting from list rows) needs a product/security decision and a web change.
- Sorting an artists export by `birth_date` is no longer meaningful (ciphertext); `birth_date` left the directly sortable contract columns.
- Deterministic search on these fields is not possible (random-IV ciphertext); none existed.
- `clients.metadata` historical keys and artist historical metadata copies stay until the draft runs; they are never returned or exported.
- Key rotation: `EncryptionService` has no key versioning beyond the `enc:v1:` prefix; rotation needs its own plan.

## Ordering of the retirement draft

`20260930000052` retires the PII archives too, but its timestamp is earlier than the backfill draft. When it is registered it must be re-timestamped after `20261002000002`; otherwise it would run first as a no-op (`DROP TABLE IF EXISTS`) and the plaintext archives created by the backfill would never be retired.
