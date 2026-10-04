# PII key custody: what the owner must provide (BLK-CRM-PII-PLAINTEXT)

Date: 2026-10-03. Non-destructive preparation is exhausted (see `data-governance-pii-backfill.md`); the items below cannot be produced inside this workspace and are not invented. Nothing here scrubs or removes plaintext.

## What exists today (verified in code)

| Item | State |
|---|---|
| Algorithm and format | AES-256-GCM, value `enc:v1:` + base64(iv[12] + tag[16] + ciphertext) (`apps/api/src/core/security/encryption.service.ts`) |
| Key source | one environment variable `ENCRYPTION_KEY`, 64 hex characters; `EncryptionService` reads it at boot, but two other consumers read the variable again at call time (see the key-use inventory below) |
| Key validation | unset refused outside development/local/test; non-hex or wrong length refused; all-zero value rejected in staging and production by the env schema; the backfill and scrub drafts refuse an unset or all-zero key before any query |
| Key versioning | none beyond the `enc:v1:` prefix: a ciphertext does not say which key encrypted it |
| Dual read | `decryptOrLegacy`: prefixed value is decrypted, anything else passes through as legacy plaintext |
| Controlled decrypt | done inside the backfill (SHA-256 comparison of decrypt(ciphertext) with the plaintext, values never printed) and by the scrub precondition; rehearsed with a throwaway key only |
| Archive | RLS-forced plaintext archive tables created by the backfill; the scrub requires them to cover every row by value |

## Hardening done in this closure (non-destructive, compatible)

- `decrypt` pins `authTagLength: 16` and rejects a payload shorter than iv + tag (a truncated GCM tag is never accepted); tests added.
- The env schema now requires `ENCRYPTION_KEY` to be hexadecimal, not only 64 characters long (the service already refused non-hex at boot); tests added.

## Known limits of the current design (found by the independent review, not changed here)

- `decrypt` swallows every error and returns the literal `[encrypted]`: a wrong key produces silent garbage, not an error (callers: hr, leads, clients, artists, invoices, company settings, the export engine, integration credentials). The drafts are safe because the sentinel never equals an archived plaintext. Rotation readers must fail loudly.
- Key-use inventory: the same raw `ENCRYPTION_KEY` has FOUR consumers and no per-purpose key separation: (1) AES-256-GCM data encryption (`EncryptionService`); (2) the HMAC of signed OAuth state through `getKeyBytes()` (the live buffer); (3) the signing key of development HS256 tokens (`core/guards/auth.guard.ts`, `core/security/dev-token.ts`, `token-verifier.service.ts`), accepted only in environments that are not production-like, so any "preview" or "qa" environment holding the real key and a real database lets anyone who knows the key forge tokens for it; (4) the fallback state secret of the Spotify OAuth flow when `SPOTIFY_OAUTH_STATE_SECRET` is unset (`spotify.service.ts`, read from `process.env` at call time, not through `getKeyBytes()`). A rotation or a leak therefore also invalidates or exposes the dev-token and Spotify-state paths, and the real key must never be used in a non-production environment that is reachable by people who must not decrypt production data.
- The format has no associated data: a ciphertext can be swapped between rows, columns or tenants and still decrypt.
- The all-zero key is rejected only when `NODE_ENV` is production or staging; any other value (for example a "preview" or "qa" environment with a real database) accepts it.
- `redactSensitiveObject` matches keys only and never inspects values: it does not cover `email`, `phone` or `*_encrypted` keys, and a PII or `enc:v1:` string inside a message or error text is not redacted.
- Tracked templates: the root `.env.production`, `apps/api/.env.production` and `apps/api/.env.staging` carry an active `ENCRYPTION_KEY=<...>` placeholder line; `apps/api/.env.development.example` and the root `.env.development.example` carry it only as a comment, and the root `.env.staging` has none. The active placeholders are 16-character non-hex values that would fail boot validation, as intended.

## Rotation contract (design, not implemented)

1. `enc:v1:` carries no key id: it maps to ONE designated legacy key id (`v1` = the `ENCRYPTION_KEY` in use when the rotation starts). That key must be kept in the keyring until a census shows zero `enc:v1:` rows; only then may it be retired. Decision needed: v1 reads use that single legacy key (recommended, deterministic) or trial decryption across the keyring.
2. New format `enc:v2:<kid>:<base64>`; `kid` restricted to `[a-z0-9_-]` (no `:`); parse order fixed. The service holds a keyring `{kid: key}` with one active key for writes and every retained key for reads. Environment contract: `ENCRYPTION_KEY` (active, name unchanged) plus `ENCRYPTION_KEY_PREVIOUS_<kid>` entries, added to the schema, the startup check and the three API templates when implemented.
3. v2 binds the ciphertext to its location with associated data `kid|table|column|row-id` (or tenant), and derives a per-purpose subkey with HKDF so the OAuth-state HMAC, the dev-token signer and the Spotify state fallback stop sharing the data key (the keyring must cover the HMAC; in-flight OAuth states have a 10-minute TTL, so rotation impact is low).
4. v2 readers fail loudly: an unknown `kid`, a tag failure or a malformed payload throws; the legacy `[encrypted]` sentinel stays only behind an explicit method for the callers that need it.
5. Rotation procedure: add the new key as active, deploy dual-key readers everywhere, run a re-encrypt batch (read-only census first, archive-by-value coverage, hash verification, idempotent, resumable), verify zero values under the old `kid` and zero `enc:v1:`, retire the old key only after the escrow window.
6. The batch must refuse: unknown `kid`, auth-tag failure, mixed-key rows without an archive.
7. Owner decisions: rotation cadence, who may hold two keys at once, v1 single-key versus trial decryption.

## What the owner must provide (all `HUMAN_DECISION` or `EXTERNAL_REQUIREMENT`)

1. KEY HOLDER: the named person or role accountable for the production `ENCRYPTION_KEY` (staging and every other environment must use a different key).
2. KEY GENERATION: CSPRNG generation procedure, who generates it, and that it is never pasted into chat, tickets or CI logs.
3. ESCROW LOCATION: where a recoverable copy lives (a secrets manager entry or an offline sealed copy), who may read it, dual control or break-glass access with an access audit trail, separate from the database backups.
4. PRODUCTION INJECTION: which secret manager feeds `ENCRYPTION_KEY` in each environment and the guarantee that staging, dev and CI keys differ.
5. RECOVERY PROCEDURE with EVIDENCE it was executed once: a clean environment boots with the escrowed key and decrypts a sample ciphertext (counts and hash comparison only, no value printed). Include every consumer of the key (data encryption, OAuth-state HMAC, dev-token signer, Spotify state fallback), which share it today.
6. COMPROMISE RUNBOOK: emergency rotation with a time target.
7. ROTATION DECISION: cadence and approval of the contract above (or an explicit "no rotation until X").
8. ARCHIVE RETENTION: owner, period, legal basis (LGPD) and purge trigger for `artists_pii_archive_20261002` and `clients_pii_archive_20261002` (after the scrub they hold the only plaintext copy), who may read or purge them, and whether they are encrypted or access-restricted beyond RLS.
9. BACKUPS AND PITR: older backups and PITR points still contain plaintext after the scrub until they expire: state their lifetime and purge or restore policy.
10. ERASURE REQUESTS (LGPD): how a data-subject erasure request is honoured for data held in the two archives, in older backups and in PITR points, which cannot be edited in place (for example crypto-erasure by destroying a per-subject key, or an expiry window after which the copies are gone), and who answers the request.
11. ARCHIVE PROTECTION STATE: today the two PII archives hold plaintext bank and identity data protected only by RLS (enabled, forced, no policy, app roles revoked): a database dump or a BYPASSRLS role reads them in clear. The owner decides whether they must be encrypted at application level or restricted further before the backfill runs.
12. TARGET ENVIRONMENT NAME for the first backfill (staging first), a read-only connection to run the census, a PITR restore point and a restore proof.

Without items 1 to 5 the scrub must not be approved: after it, the ciphertext and the archive are the only copies and a lost key makes the data unreadable.

## Non-destructive work still possible without the owner (not done here, listed so it is not mistaken for finished)

- A read-only key-verification and census tool (per table and column: counts of `enc:v1:`, plaintext, null and undecryptable values using decrypt plus a SHA-256 round trip, counts only). It would give the owner the restore proof of item 5 and the rotation census.
- A keyring-capable `EncryptionService` with v2 behind tests (premature before the owner decisions above).
- Value-level redaction of `enc:v1:` blobs and CPF-shaped strings, and `email`/`phone` keys in the redaction key list.
