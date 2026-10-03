# PII approval packages: artists and clients (BLK-CRM-PII-PLAINTEXT)

Owner decision 2026-10-03 (deci-ed83c974), D2 artist/client PII, OPTION A: `plaintext historical -> controlled archive -> encrypted backfill -> verification -> ciphertext canonical -> LATER removal of plaintext under a SEPARATE destructive approval`. Design and ordering: `data-governance-pii-backfill.md`.

Two packages, two approvals. The BACKFILL package never authorizes the SCRUB. Both are drafts, UNREGISTERED, and have NOT been executed on any dev, staging or production database: no such database is reachable from the environment that prepared this document. Everything below marked `NOT_SATISFIED`, `NOT_DEFINED` or `NOT_MEASURED` is a missing prerequisite, listed individually. Nothing here is approval: an approval is a human decision recorded per environment.

Evidence base: unit specs (`encrypt-artists-clients-pii.draft.spec.ts`, `scrub-artists-clients-plaintext.draft.spec.ts`) and the rehearsal `apps/api/test/e2e/schema/pii-backfill-drafts.e2e-spec.ts` on a COPY of a disposable local PostgreSQL with SYNTHETIC rows and a throwaway in-memory key. That proves the code, not any real dataset.

## Package BACKFILL

- MIGRATION: `20261002000002_EncryptArtistsAndClientsPiiBackfill` (draft, unregistered, token `PII_ENCRYPT_CONFIRM`). Prerequisite: registered migration `20261002000001_AddArtistsPiiEncryptedColumns`. Writes ciphertext only; never touches plaintext.
- ENVIRONMENT: disposable-rehearsal (local PostgreSQL copy, synthetic data). No dev, staging or production database is reachable; the target environment is NOT_DEFINED until the owner names it.
- TABLE: `artists`, `clients` (live, read and ciphertext write); new `artists_pii_archive_20261002`, `clients_pii_archive_20261002` (plaintext PII copy, RLS enabled and forced, no policy, app roles revoked).
- COLUMNS: artists `birth_date`, `rg`, `address`, `bank_name`, `bank_branch`, `bank_account`, `pix_key`, `account_holder` (read) -> `<column>_encrypted` (written only when NULL); artists `metadata` PII keys (archived only); clients `metadata` PII keys (archived) with the document promoted to `cpf_cnpj_encrypted` (written only when NULL).
- ROWS: rehearsal only (synthetic): 6 artists and 5 clients seeded; archive 5 artists and 4 clients; 13 artist fields compared, 14 values decrypted equal by hash. REAL record census: NOT_SATISFIED (not measured on any real environment; no census was produced, so the real row counts are unknown).
- DIVERGENCES: rehearsal: 2 planted pre-existing ciphertexts that differ from the plaintext (1 artist field, 1 client) were detected, never overwritten, and block the scrub. REAL divergences: NOT_MEASURED (needs the real census and the read-only `verifyPlaintextVsCiphertext` run against the real environment).
- ARCHIVE: created by the migration itself before any write (by-value coverage check aborts on a stale archive). Rehearsal: archive equals the seed, survives down/up and the scrub. Real archive: NOT_SATISFIED (not created anywhere). Archive tables hold plaintext PII; access only by the BYPASSRLS migration role.
- RESTORE_PROOF: NOT_SATISFIED. No backup restore was performed for any real environment. The rehearsal proves the logical reversal (`down()` removes only written ciphertext; plaintext was never touched), not a backup restore.
- PITR: NOT_DEFINED. Point-in-time recovery for the target database is neither confirmed nor tested.
- KEY_ESCROW: NOT_DEFINED. No custody record for the real `ENCRYPTION_KEY` (holder, escrow location, recovery procedure, rotation plan; `EncryptionService` has no key versioning beyond the `enc:v1:` prefix). The rehearsal key was a throwaway and is discarded.
- RETENTION: owner NOT_DEFINED, period NOT_DEFINED, policy NOT_DEFINED for the archive tables (no document names an owner or a period for them; none is invented here). The retire draft `20260930000052` lists both archives but must be re-timestamped after `20261002000003` and needs its own decision.
- PRECONDITIONS:
  1. SATISFIED in code and rehearsal: confirmation token, real-key guard (unset/all-zero refused), BYPASSRLS guard, `lock_timeout`, ciphertext columns present, archive-first with by-value coverage, verification inside the transaction with whole-migration rollback, idempotent rerun, down removes only what it wrote.
  2. NOT_SATISFIED: explicit owner/security approval for the named environment.
  3. NOT_SATISFIED: real record census.
  4. NOT_SATISFIED: staging rehearsal (a disposable one exists; staging has none).
  5. NOT_SATISFIED: restore proof; NOT_DEFINED: PITR.
  6. NOT_DEFINED: key escrow/custody.
  7. NOT_DEFINED: archive retention owner, period and policy.
  8. NOT_SATISFIED: confirmation that the dual-read API release is live on every instance of the target.
  9. NOT_SATISFIED: maintenance window for the `FOR UPDATE` row locks.
- RISK: wrong or lost key makes written ciphertext unreadable (plaintext still present, so recoverable in this step); plaintext archive tables widen the plaintext footprint until retired; row locks on `artists`/`clients` during the run; an old API build that ignores the ciphertext columns; pre-existing divergences discovered later block the scrub. No plaintext is removed by this package.
- ROLLBACK: transaction rollback on any failure (rehearsed: injected failure and injected verification mismatch leave no archive table and no ciphertext). After commit: `down()` removes only the ciphertext it wrote (recorded in the archive); plaintext was never touched; archive tables are kept. Backup restore as a last resort: NOT_SATISFIED (see RESTORE_PROOF).
- READY_FOR_DESTRUCTIVE_EXECUTION: NO

## Package SCRUB

- MIGRATION: `20261002000003_ScrubArtistsAndClientsPlaintext` (draft, unregistered, DESTRUCTIVE, own token `PII_SCRUB_CONFIRM`; the backfill token does not unlock it). Requires the backfill applied and verified in the same environment.
- ENVIRONMENT: disposable-rehearsal (local PostgreSQL copy, synthetic data). No dev, staging or production database is reachable; the target environment is NOT_DEFINED until the owner names it.
- TABLE: `artists`, `clients` (live rows, plaintext removed); `artists_pii_archive_20261002`, `clients_pii_archive_20261002` (read as the way back).
- COLUMNS: artists `birth_date`, `rg`, `address`, `bank_name`, `bank_branch`, `bank_account`, `pix_key`, `account_holder` set NULL; artists `metadata` and clients `metadata` PII keys removed (non-PII keys kept). Ciphertext columns are never touched.
- ROWS: rehearsal only (synthetic): after the scrub 0 artists with plaintext left, metadata PII keys gone, ciphertext byte-identical, archive unchanged, `down()` restored the seed state exactly. REAL record census: NOT_SATISFIED (not measured; real counts unknown).
- DIVERGENCES: the scrub REFUSES while any plaintext has a missing or divergent ciphertext (rehearsed). Rehearsal: 2 planted divergences blocked it until resolved. REAL divergences: NOT_MEASURED; resolving a real divergence is an owner decision (which value is canonical) not made here.
- ARCHIVE: precondition enforced in code (both tables must exist and cover every candidate row by value; a tampered archive row blocked the scrub in the rehearsal). Real archive: NOT_SATISFIED (not created anywhere; it is created by the BACKFILL).
- RESTORE_PROOF: NOT_SATISFIED. `down()` restores from the archive (rehearsed on synthetic data); a restore of a real backup was never performed. Controlled decrypt verification was rehearsed with a throwaway key only; on a real environment it is NOT_SATISFIED.
- PITR: NOT_DEFINED.
- KEY_ESCROW: NOT_DEFINED. After the scrub the ciphertext plus the archive are the only copies; without a custody-proven key the ciphertext is unrecoverable.
- RETENTION: owner NOT_DEFINED, period NOT_DEFINED, policy NOT_DEFINED for the archive tables that become the only plaintext copy. Retirement of the archives is a further separate authorized step.
- PRECONDITIONS:
  1. SATISFIED in code and rehearsal: own token, key/BYPASSRLS/`lock_timeout` guards, archive-intact-by-value check, ciphertext-equal-for-every-row check, residue audit with whole-migration rollback, rerun no-op, `down()` restores from the archive.
  2. NOT_SATISFIED: a completed, approved and verified BACKFILL in the target environment (it has run nowhere real).
  3. NOT_SATISFIED: separate explicit owner/security destructive approval naming this migration and the environment.
  4. NOT_SATISFIED: real record census.
  5. NOT_SATISFIED: staging rehearsal.
  6. NOT_SATISFIED: restore proof; NOT_DEFINED: PITR.
  7. NOT_DEFINED: key escrow/custody.
  8. NOT_DEFINED: retention owner, period and policy.
  9. NOT_SATISFIED: backfill verification and controlled decrypt verification on the real data, with zero missing and zero divergent.
  10. NOT_SATISFIED: failure-recovery rehearsal on staging (a disposable one exists).
  11. NOT_SATISFIED: dual-read API release live on every instance; maintenance window.
- RISK: irreversible loss of historical plaintext if the archive is lost, purged early, or never restored-tested; unreadable data if the key is lost; an old API build reading NULL plaintext as empty or writing plaintext back; row locks during the run. The archive is the only way back and holds plaintext PII.
- ROLLBACK: transaction rollback on any failure (rehearsed: injected mid-scrub failure leaves plaintext intact). After commit: `down()` restores plaintext columns and metadata keys from the archive (a newer ciphertext edit wins and is not overwritten); ciphertext untouched. If the archive is gone: only a backup restore, NOT_SATISFIED (see RESTORE_PROOF and PITR).
- READY_FOR_DESTRUCTIVE_EXECUTION: NO
