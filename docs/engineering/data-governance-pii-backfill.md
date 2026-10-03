# PII at rest: artists and clients (BLK-CRM-PII-PLAINTEXT)

Status: code (additive, dual-read) shipped; the backfill and the scrub of EXISTING rows are TWO separate unregistered, gated drafts. Neither has been run anywhere except a disposable-database rehearsal (see below). Owner decision 2026-10-03 (deci-ed83c974), D2 artist/client PII: OPTION A.

## Discovered current state

- `clients`: `cpf_cnpj`/`email`/`phone` are already ciphertext columns (`*_encrypted`, `EncryptionService`, prefix `enc:v1:`). The API never persists plaintext document/e-mail/phone in `clients.metadata` (`client-legacy-fields.ts`, SEC-F3) and never returns `metadata`. What remains is HISTORICAL plaintext (`cpf`, `cnpj`, ... keys written by pre-CZ-043 builds) inside existing `clients.metadata`.
- `artists`: CZ-042 moved rg, birth date, address and bank data out of `metadata` into physical columns, but as PLAINTEXT columns (`birth_date`, `rg`, `address`, `bank_name`, `bank_branch`, `bank_account`, `pix_key`, `account_holder`; the Portuguese keys `data_nascimento`, `endereco`, `banco`, `agencia`, `conta`, `chave_pix`, `titular_conta` are only accepted as deprecated input aliases). `artists.metadata` could also still receive these keys from a caller-supplied `metadata` object, and historical rows keep copies the CZ-042 backfill could not copy.

## What the code does now (additive, safe to deploy after the migration)

1. Migration `20261002000001_AddArtistsPiiEncryptedColumns` (REGISTERED): eight nullable `text` columns `<field>_encrypted` on `artists`. No data copied, plaintext columns untouched. `down()` refuses while any ciphertext exists. Deploy order: migrations, then API release (an API that selects the new columns before the migration ran fails).
2. Write path: `ArtistsService` writes these fields ONLY as `enc:v1:` ciphertext (`encryption.encryptNullable`) and sets the plaintext column of that field to `NULL` on every write of the field (this row only, no bulk rewrite). Report import writes the ciphertext column (contract `encFromPlaintext`). `sanitizeArtistMetadataInput` drops plaintext PII keys (canonical and Portuguese) from a caller `metadata` on create/update.
3. Read path (dual-read): response = decrypted ciphertext when present, else the legacy plaintext column (never an unreadable blob). Ciphertext columns and raw `metadata` never leave the API (existing allow-list). Authorization is unchanged: `artist:read` / `client:read` + tenant scoping; no new per-field permission was invented (see decisions below).
4. Exports: the artists contract declares the fields as encrypted with `legacyPlaintextColumn`; the export SQL reads `COALESCE(<field>_encrypted, <field>::text)` and the engine decrypts or passes legacy plaintext through. `metadata` stays an internal column (never exported).
5. Logs: `redactSensitiveObject` redacts the PII keys (exact, anchored match; canonical and Portuguese spellings). The audit interceptor already logs ids only, not request bodies.


## Model (owner decision, option A)

`plaintext historical -> controlled archive -> encrypted backfill -> verification -> ciphertext canonical -> LATER removal of plaintext under a SEPARATE destructive approval`.

Two drafts, two tokens, two approvals (see `pii-approval-packages.md`, packages BACKFILL and SCRUB). The approval of the backfill does NOT authorize the scrub.

| Step | Draft | Token | Touches plaintext | Class |
| --- | --- | --- | --- | --- |
| 1 | `20261002000002_EncryptArtistsAndClientsPiiBackfill.ts` | `PII_ENCRYPT_CONFIRM` | NEVER (ciphertext only) | rewrites live rows, creates plaintext archive tables (L5, non-destructive to values) |
| 2 | `20261002000003_ScrubArtistsAndClientsPlaintext.ts` | `PII_SCRUB_CONFIRM` | nulls columns, strips metadata keys | DESTRUCTIVE (L5), separate approval |

Specs: `encrypt-artists-clients-pii.draft.spec.ts`, `scrub-artists-clients-plaintext.draft.spec.ts`; real-database rehearsal: `apps/api/test/e2e/schema/pii-backfill-drafts.e2e-spec.ts`.

## Step 1: backfill draft (NOT registered, NOT executed on any real environment)

- Second lock: `PII_ENCRYPT_CONFIRM=encrypt-artists-clients-pii-gates-satisfied` (distinct from every other draft) and a real `ENCRYPTION_KEY` of the target environment (unset or all-zero refused; it must be the key the API runs with, otherwise the API cannot read what was written). RLS-bypass guard, `SET LOCAL lock_timeout`, counts-only error messages.
- Fail-closed order: gates, BYPASSRLS role, ciphertext columns present, counts-only preflight, ARCHIVE FIRST (side tables `artists_pii_archive_20261002` / `clients_pii_archive_20261002`, RLS ENABLED and FORCED, no policy, every app role revoked; only the BYPASSRLS migration role reads them), by-value archive coverage check (stale archive aborts), row writes (`FOR UPDATE`, keyset batches, `updated_at` untouched, `WHERE id AND tenant_id`), verification.
- Writes ciphertext ONLY. Every plaintext column and every metadata key is left exactly as found.
  - Artists: `<field>_encrypted` is written from the plaintext column only when it is still NULL (existing ciphertext is newer truth, never overwritten); the fields written are recorded in the archive (`encrypted_fields`).
  - Clients: the document (cpf_cnpj, cpf, cnpj, documento, document in that priority) is promoted to `cpf_cnpj_encrypted` only when that column is NULL (flag `document_promoted` in the archive). Non-PII legacy form keys are not touched (their rename is a separate blocker).
- Verification inside the transaction: no non-empty plaintext without ciphertext, and every ciphertext written by the run decrypts to the plaintext (SHA-256 comparison, values never printed). Any mismatch rolls back the WHOLE migration. A PRE-EXISTING ciphertext that differs from the plaintext is not overwritten and not a failure of the backfill, but it is a DIVERGENCE that blocks the scrub until the owner resolves it.
- `down()`: removes only the ciphertext the backfill wrote (recorded in the archive), and only while it still decrypts to the archived value; plaintext was never touched; archive tables are never dropped.

### What the BACKFILL approval authorizes

Only: creating the two archive tables (plaintext PII, locked down), writing ciphertext into NULL ciphertext columns, and reading with the migration role. It does NOT authorize removing, nulling or editing any plaintext column or metadata key. Required before running in an environment: items 1-5 of the list below.

## Step 2: scrub draft (NOT registered, NOT executed, DESTRUCTIVE)

- Own lock: `PII_SCRUB_CONFIRM=scrub-artists-clients-plaintext-gates-satisfied` (the backfill token never unlocks it), same key, RLS-bypass and lock_timeout guards, counts-only messages.
- PRECONDITIONS (any failure throws, nothing changed): both archive tables exist; archive intact BY VALUE for every candidate row; ciphertext verified equal (decrypts to the plaintext by hash) for EVERY row; a missing or divergent ciphertext blocks.
- Then: artists plaintext columns set NULL and PII metadata keys removed; clients PII metadata keys removed; ciphertext never touched. Residue audit (zero candidate rows left, ciphertext count unchanged) rolls back the whole migration otherwise.
- `down()`: restores plaintext columns and metadata keys from the archive (a column is restored only while NULL and its ciphertext is absent or still equals the archived value: a newer edit wins). Archive tables are never dropped.

### What the SCRUB approval must authorize (separate approval, all required, recorded per environment)

1. Explicit owner/security approval to remove plaintext PII from live rows in the named environment (staging first, production after), naming the migration `20261002000003_ScrubArtistsAndClientsPlaintext`.
2. A completed and approved BACKFILL in that environment, and the verification evidence of it (zero missing, zero divergent, divergences resolved by an owner decision).
3. All proofs of `pii-approval-packages.md` package SCRUB: key escrow/custody, restore proof, point-in-time recovery, retention owner and period, record census, staging rehearsal.
4. The API release with the dual-read code live on EVERY instance (an old build would read NULL plaintext columns as empty and could write plaintext back).
5. A maintenance window for the `FOR UPDATE` row locks.
6. LATER, again separately: dropping the plaintext columns (`birth_date`, `rg`, `address`, `bank_*`, `pix_key`, `account_holder`) and removing the `legacyPlaintextColumn` fallback; and retiring the archives (draft `20260930000052`) only after the retention period.

### What the approval must evidence before the BACKFILL (all required, recorded per environment)

1. Explicit owner/security approval to run the backfill in the named environment (staging first, production after).
2. Evidence of a disposable/staging dry run: preflight counts, `up()`, verification zero, API read-after-write of a sample through the API (decrypted value equals the archived value), `down()` then `up()` again. A disposable rehearsal exists (below); a staging rehearsal does not.
3. Backup/restore evidence (a restore was actually performed), not backup existence alone.
4. The API release with the dual-read code live on EVERY instance before running.
5. Key custody: where `ENCRYPTION_KEY` is escrowed, who holds it, and that losing it makes the ciphertext (and, after the scrub, the data) unrecoverable except from the archive; the archive retention owner and period and who may read/purge the archive tables.

## Rehearsal evidence

`pii-backfill-drafts.e2e-spec.ts` runs the full sequence on a COPY of a disposable local database with synthetic data and a throwaway in-memory key (never printed or written): backfill refusal, mid-batch failure injection (whole migration rolls back), verification-mismatch injection (rolls back), up, verification (archive integrity, ciphertext == original by hash, plaintext untouched), controlled decrypt verification, idempotent rerun with existing ciphertext never overwritten, down, up again, scrub refusals (token, divergence, tampered archive), scrub failure injection, scrub up, scrub rerun, scrub down restoring the seed state exactly. This proves the code on a real PostgreSQL; it is NOT evidence about any dev, staging or production database.


## Decisions and residual risks (not fixed here, recorded)

- Per-field role gating: any holder of `artist:read` receives artist bank/ID data (list and detail). Restricting to a narrower permission (or omitting from list rows) needs a product/security decision and a web change.
- Sorting an artists export by `birth_date` is no longer meaningful (ciphertext); `birth_date` left the directly sortable contract columns.
- Deterministic search on these fields is not possible (random-IV ciphertext); none existed.
- `clients.metadata` historical keys and artist historical metadata copies stay until the draft runs; they are never returned or exported.
- Key rotation: `EncryptionService` has no key versioning beyond the `enc:v1:` prefix; rotation needs its own plan.

## Ordering and re-timestamp

Run order: `20261002000001` (registered, additive) -> `20261002000002` (backfill) -> `20261002000003` (scrub, separate approval) -> later `20260930000052` (retire the archives).

`20260930000052` retires the PII archives too, but its timestamp is earlier than both drafts. When it is registered it must be re-timestamped AFTER `20261002000003`: otherwise it would run first as a no-op (`DROP TABLE IF EXISTS`) and the plaintext archives would never be retired; retiring them also removes the way back of the scrub, so it needs its own retention-window decision. When registering the backfill or the scrub, keep their relative order (`...02` before `...03`) and the dependence of `...03` on the archives created by `...02`.
