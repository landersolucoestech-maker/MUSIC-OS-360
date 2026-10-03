import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';
import {
  ARTIST_METADATA_PII_KEYS,
  ARTIST_PII_FIELDS,
  ARTISTS_ARCHIVE,
  BATCH_SIZE,
  CLIENTS_ARCHIVE,
  CLIENT_METADATA_PII_KEYS,
  archiveCoverageGaps,
  artistsCandidate,
  assertCiphertextColumns,
  bounded,
  countRows,
  encryptionFromEnv,
  hasPiiKey,
  isObject,
  splitMetadata,
  verifyPlaintextVsCiphertext,
} from './20261002000002_EncryptArtistsAndClientsPiiBackfill';

/**
 * 20261002000003_ScrubArtistsAndClientsPlaintext (BLK-CRM-PII-PLAINTEXT): GATED DRAFT, NOT REGISTERED, DESTRUCTIVE (L5).
 *
 * Step 2 of 2 of the owner-approved model (decision deci-ed83c974, option A). It REMOVES the historical plaintext
 * from the live rows once the ciphertext written by 20261002000002_EncryptArtistsAndClientsPiiBackfill is proven
 * canonical. It needs its OWN, SEPARATE destructive approval (docs/engineering/pii-approval-packages.md, package
 * SCRUB): the approval of the backfill does NOT authorize it. Second lock: up() and down() throw unless
 * PII_SCRUB_CONFIRM=<CONFIRM_TOKEN> is exported (distinct from every other draft, including the backfill token).
 *
 * Ordering: must run AFTER the backfill and after the owner-required proofs (key custody, restore proof, retention
 * owner/period, record census, staging rehearsal); the retire draft 20260930000052 must be re-timestamped after THIS
 * migration.
 *
 * up(), fail-closed, in this order (nothing is written before step 5):
 *   1. confirmation, key and RLS-bypass guards, SET LOCAL lock_timeout, ciphertext columns present;
 *   2. both archive tables exist (else refuse: there would be no way back);
 *   3. counts-only preflight; nothing to scrub means no-op;
 *   4. PRECONDITIONS (any failure throws, counts only, nothing changed):
 *        a. archive intact BY VALUE: every candidate live row has an archive row with identical plaintext and
 *           identical PII metadata keys;
 *        b. ciphertext verified equal for EVERY row: each plaintext column / client document has a ciphertext that
 *           decrypts to it (SHA-256 comparison, values never printed). A missing or divergent ciphertext blocks;
 *   5. row by row (FOR UPDATE, keyset batches, updated_at untouched, WHERE id AND tenant_id): artists plaintext
 *      columns set NULL and PII metadata keys removed; clients PII metadata keys removed. Ciphertext is never touched;
 *   6. residue audit inside the transaction: zero candidate rows left and the number of ciphertext values unchanged,
 *      else the whole migration rolls back.
 * down(): restores the plaintext columns and metadata keys from the archive. A plaintext column is restored only while
 * it is NULL and its ciphertext is absent or still decrypts to the archived value (a value edited since up() is
 * kept). Ciphertext is never touched. Archive tables are never dropped here.
 */
export const CONFIRM_ENV = 'PII_SCRUB_CONFIRM';
export const CONFIRM_TOKEN = 'scrub-artists-clients-plaintext-gates-satisfied';

const CIPHERTEXT_COUNT_SQL = `
  SELECT (SELECT count(*) FROM "artists" a WHERE ${ARTIST_PII_FIELDS.map((f) => `a."${f}_encrypted" IS NOT NULL`).join(' OR ')})::int
       + (SELECT count(*) FROM "clients" c WHERE c."cpf_cnpj_encrypted" IS NOT NULL)::int AS n`;

export class ScrubArtistsAndClientsPlaintext20261002000003 implements MigrationInterface {
  name = 'ScrubArtistsAndClientsPlaintext20261002000003';

  private assertConfirmed(): void {
    if (process.env[CONFIRM_ENV] !== CONFIRM_TOKEN) {
      throw new Error(`${this.name}: gated destructive draft. Set ${CONFIRM_ENV} only after the SCRUB package of docs/engineering/pii-approval-packages.md is approved.`);
    }
  }

  private async assertArchives(qr: QueryRunner, action: string): Promise<void> {
    for (const archive of [ARTISTS_ARCHIVE, CLIENTS_ARCHIVE]) {
      const exists: Array<{ ok: boolean }> = await qr.query(`SELECT to_regclass('public.${archive}') IS NOT NULL AS ok`);
      if (!exists[0]?.ok) throw new Error(bounded(`${this.name}: refusing ${action}: archive table ${archive} is missing. Nothing was changed.`));
    }
  }

  public async up(qr: QueryRunner): Promise<void> {
    this.assertConfirmed();
    const encryption = encryptionFromEnv(this.name);
    await assertMigrationRoleBypassesRls(qr, this.name);
    await qr.query(`SET LOCAL lock_timeout = '15s'`);
    await assertCiphertextColumns(qr, this.name);
    await this.assertArchives(qr, 'up()');

    const artistsPending = await countRows(qr, `SELECT count(*)::int AS n FROM "artists" a WHERE ${artistsCandidate('a')}`, [ARTIST_METADATA_PII_KEYS]);
    const clientsPending = await countRows(qr, `SELECT count(*)::int AS n FROM "clients" c WHERE ${hasPiiKey('c')}`, [CLIENT_METADATA_PII_KEYS]);
    if (artistsPending === 0 && clientsPending === 0) return;

    // (4a) archive intact by value
    const gaps = await archiveCoverageGaps(qr);
    if (gaps.artists > 0 || gaps.clients > 0) {
      throw new Error(bounded(`${this.name}: precondition failed, archive not intact (artists=${gaps.artists}, clients=${gaps.clients} row(s) not archived with their current values). Nothing was changed.`));
    }
    // (4b) ciphertext verified equal for every row
    const verification = await verifyPlaintextVsCiphertext(qr, encryption);
    if (verification.artistFieldsMissing + verification.artistFieldsDivergent + verification.clientsMissing + verification.clientsDivergent > 0) {
      throw new Error(bounded(`${this.name}: precondition failed, ciphertext not verified equal (artist fields missing=${verification.artistFieldsMissing}, divergent=${verification.artistFieldsDivergent}; clients missing=${verification.clientsMissing}, divergent=${verification.clientsDivergent}). Nothing was changed.`));
    }

    const ciphertextBefore = await countRows(qr, CIPHERTEXT_COUNT_SQL);
    await this.scrubArtists(qr);
    await this.scrubClients(qr);

    // (6) residue audit
    const artistsLeft = await countRows(qr, `SELECT count(*)::int AS n FROM "artists" a WHERE ${artistsCandidate('a')}`, [ARTIST_METADATA_PII_KEYS]);
    const clientsLeft = await countRows(qr, `SELECT count(*)::int AS n FROM "clients" c WHERE ${hasPiiKey('c')}`, [CLIENT_METADATA_PII_KEYS]);
    const ciphertextAfter = await countRows(qr, CIPHERTEXT_COUNT_SQL);
    if (artistsLeft > 0 || clientsLeft > 0 || ciphertextAfter !== ciphertextBefore) {
      throw new Error(bounded(`${this.name}: residue audit failed (artists=${artistsLeft}, clients=${clientsLeft}, ciphertext before=${ciphertextBefore}, after=${ciphertextAfter}); rolling back.`));
    }
  }

  private async scrubArtists(qr: QueryRunner): Promise<void> {
    let last = '00000000-0000-0000-0000-000000000000';
    for (;;) {
      const rows: Array<Record<string, unknown>> = await qr.query(
        `SELECT a."id", a."tenant_id", a."metadata", ${ARTIST_PII_FIELDS.map((f) => `(a."${f}" IS NOT NULL) AS "has_${f}"`).join(', ')}
           FROM "artists" a WHERE a."id" > $2::uuid AND ${artistsCandidate('a')}
          ORDER BY a."id" LIMIT ${BATCH_SIZE} FOR UPDATE`,
        [ARTIST_METADATA_PII_KEYS, last],
      );
      if (rows.length === 0) return;
      for (const row of rows) {
        last = String(row['id']);
        const sets: string[] = [];
        const params: unknown[] = [];
        const bind = (value: unknown): string => { params.push(value); return `$${params.length}`; };
        for (const field of ARTIST_PII_FIELDS) if (row[`has_${field}`] === true) sets.push(`"${field}" = NULL`);
        const { pii, rest } = splitMetadata(row['metadata'], ARTIST_METADATA_PII_KEYS);
        if (Object.keys(pii).length > 0) sets.push(`"metadata" = ${bind(JSON.stringify(rest))}::jsonb`);
        if (sets.length > 0) {
          await qr.query(`UPDATE "artists" SET ${sets.join(', ')} WHERE "id" = ${bind(row['id'])} AND "tenant_id" = ${bind(row['tenant_id'])}`, params);
        }
      }
    }
  }

  private async scrubClients(qr: QueryRunner): Promise<void> {
    let last = '00000000-0000-0000-0000-000000000000';
    for (;;) {
      const rows: Array<Record<string, unknown>> = await qr.query(
        `SELECT c."id", c."tenant_id", c."metadata"
           FROM "clients" c WHERE c."id" > $2::uuid AND ${hasPiiKey('c')}
          ORDER BY c."id" LIMIT ${BATCH_SIZE} FOR UPDATE`,
        [CLIENT_METADATA_PII_KEYS, last],
      );
      if (rows.length === 0) return;
      for (const row of rows) {
        last = String(row['id']);
        const { rest } = splitMetadata(row['metadata'], CLIENT_METADATA_PII_KEYS);
        await qr.query(
          `UPDATE "clients" SET "metadata" = $1::jsonb WHERE "id" = $2 AND "tenant_id" = $3`,
          [JSON.stringify(rest), row['id'], row['tenant_id']],
        );
      }
    }
  }

  public async down(qr: QueryRunner): Promise<void> {
    this.assertConfirmed();
    const encryption = encryptionFromEnv(this.name);
    await assertMigrationRoleBypassesRls(qr, this.name);
    await qr.query(`SET LOCAL lock_timeout = '15s'`);
    await this.assertArchives(qr, 'down()');

    const artists: Array<Record<string, unknown>> = await qr.query(
      `SELECT x."id", x."tenant_id", x."metadata_pii", ${ARTIST_PII_FIELDS.map((f) => `x."${f}"::text AS "${f}"`).join(', ')},
              a."metadata" AS live_metadata,
              ${ARTIST_PII_FIELDS.map((f) => `(a."${f}" IS NULL) AS "${f}_is_null"`).join(', ')},
              ${ARTIST_PII_FIELDS.map((f) => `a."${f}_encrypted" AS "${f}_encrypted"`).join(', ')}
         FROM "${ARTISTS_ARCHIVE}" x JOIN "artists" a ON a."id" = x."id" AND a."tenant_id" = x."tenant_id"
        ORDER BY x."id" FOR UPDATE OF a`,
    );
    for (const row of artists) {
      const sets: string[] = [];
      const params: unknown[] = [];
      const bind = (value: unknown): string => { params.push(value); return `$${params.length}`; };
      for (const field of ARTIST_PII_FIELDS) {
        const archived = row[field];
        if (archived === null || archived === undefined || row[`${field}_is_null`] !== true) continue;
        const cipher = row[`${field}_encrypted`];
        const unchangedSinceUp = cipher == null || (typeof cipher === 'string' && encryption.decryptOrLegacy(cipher) === archived);
        if (unchangedSinceUp) sets.push(`"${field}" = ${bind(archived)}`); // a newer ciphertext wins: not overwritten
      }
      const archivedPii = isObject(row['metadata_pii']) ? row['metadata_pii'] : {};
      if (Object.keys(archivedPii).length > 0) {
        const live = isObject(row['live_metadata']) ? row['live_metadata'] : {};
        sets.push(`"metadata" = ${bind(JSON.stringify({ ...archivedPii, ...live }))}::jsonb`);
      }
      if (sets.length > 0) {
        await qr.query(`UPDATE "artists" SET ${sets.join(', ')} WHERE "id" = ${bind(row['id'])} AND "tenant_id" = ${bind(row['tenant_id'])}`, params);
      }
    }

    const clients: Array<Record<string, unknown>> = await qr.query(
      `SELECT x."id", x."tenant_id", x."metadata_pii", c."metadata" AS live_metadata
         FROM "${CLIENTS_ARCHIVE}" x JOIN "clients" c ON c."id" = x."id" AND c."tenant_id" = x."tenant_id"
        ORDER BY x."id" FOR UPDATE OF c`,
    );
    for (const row of clients) {
      const archivedPii = isObject(row['metadata_pii']) ? row['metadata_pii'] : {};
      if (Object.keys(archivedPii).length === 0) continue;
      const live = isObject(row['live_metadata']) ? row['live_metadata'] : {};
      await qr.query(
        `UPDATE "clients" SET "metadata" = $1::jsonb WHERE "id" = $2 AND "tenant_id" = $3`,
        [JSON.stringify({ ...archivedPii, ...live }), row['id'], row['tenant_id']],
      );
    }
  }
}
