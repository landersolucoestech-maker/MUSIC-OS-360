# PII key custody: what the owner must provide (BLK-CRM-PII-PLAINTEXT)

Date: 2026-10-03. Non-destructive preparation is exhausted (see `data-governance-pii-backfill.md`); the items below cannot be produced inside this workspace and are not invented. Nothing here scrubs or removes plaintext.

## What exists today (verified in code)

| Item | State |
|---|---|
| Algorithm and format | AES-256-GCM, value `enc:v1:` + base64(iv[12] + tag[16] + ciphertext) (`apps/api/src/core/security/encryption.service.ts`) |
| Key source | one environment variable `ENCRYPTION_KEY`, 64 hex characters, read once at boot |
| Key validation | unset refused outside development/local/test; non-hex or wrong length refused; all-zero value rejected in staging and production by the env schema; the backfill and scrub drafts refuse an unset or all-zero key before any query |
| Key versioning | none beyond the `enc:v1:` prefix: a ciphertext does not say which key encrypted it |
| Dual read | `decryptOrLegacy`: prefixed value is decrypted, anything else passes through as legacy plaintext |
| Controlled decrypt | done inside the backfill (SHA-256 comparison of decrypt(ciphertext) with the plaintext, values never printed) and by the scrub precondition; rehearsed with a throwaway key only |
| Archive | RLS-forced plaintext archive tables created by the backfill; the scrub requires them to cover every row by value |

## Rotation contract (design, not implemented)

1. `enc:v1:` stays readable forever (never rewritten blindly).
2. A new format `enc:v2:<kid>:` carries a key id; the service holds a keyring `{kid: key}` with one active key for writes and every retained key for reads. Environment contract: `ENCRYPTION_KEY` (active, unchanged name) plus `ENCRYPTION_KEY_PREVIOUS_<kid>` entries, documented in the three API templates when implemented.
3. Rotation procedure: add the new key as active, deploy dual-key readers everywhere, run a re-encrypt batch (read-only census first, archive-by-value coverage, hash verification, idempotent, resumable), verify zero `enc:v1:`/old-`kid` values, only then retire the old key after the escrow window.
4. Failure modes the batch must refuse: unknown `kid`, auth-tag failure (wrong key or tampered value), mixed-key rows without an archive.
5. This needs an owner decision on the rotation cadence and on who may hold two keys at once; implementing it before custody exists would only add a second unproven key.

## What the owner must provide (all `HUMAN_DECISION` or `EXTERNAL_REQUIREMENT`)

1. KEY HOLDER: the named person or role accountable for the production `ENCRYPTION_KEY` (and for staging, which must differ).
2. ESCROW LOCATION: where a recoverable copy lives (a secrets manager entry or an offline sealed copy), who may read it, and that it is separate from the database backups.
3. RECOVERY PROCEDURE: the written steps to restore the key into a clean environment, and EVIDENCE that the procedure was executed once: a clean environment boots with the escrowed key and decrypts a sample ciphertext (counts and hash comparison only, no value printed).
4. ROTATION DECISION: cadence and the approval of the rotation contract above (or an explicit "no rotation until X").
5. ARCHIVE RETENTION: owner, period and policy for `artists_pii_archive_20261002` and `clients_pii_archive_20261002` (after the scrub they hold the only plaintext copy), and who may read or purge them.
6. TARGET ENVIRONMENT NAME for the first backfill (staging first), a read-only connection to run the census, a PITR restore point and a restore proof.

Without items 1 to 3 the scrub must not be approved: after it, the ciphertext and the archive are the only copies and a lost key makes the data unreadable.
