import { MigrationInterface, QueryRunner } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { assertMigrationRoleBypassesRls } from '../migration-guards';
import { EncryptionService } from '../../core/security/encryption.service';
import { lockDownArchiveTable } from './legacy-column-drop.base';

/**
 * 20261002000002_EncryptArtistsAndClientsPiiInPlace (BLK-CRM-PII-PLAINTEXT): GATED DRAFT, NOT REGISTERED.
 *
 * NOT part of ALL_MIGRATIONS (migrations/index.ts); nothing imports it except its own spec. It REWRITES and
 * SCRUBS existing personal/bank data (destructive class, L5). Registering/running it requires every gate of
 * docs/engineering/data-governance-pii-backfill.md to be evidenced. Second lock: up() and down() throw unless
 * PII_ENCRYPT_CONFIRM=<CONFIRM_TOKEN> is exported (the token differs from every other draft).
 *
 * Prerequisites (checked, fail-closed, before any write): the registered migration
 * 20261002000001_AddArtistsPiiEncryptedColumns ran; ENCRYPTION_KEY is the real 64-hex key of the target
 * environment (not unset, not the all-zero default: the same key the API uses, so the API can decrypt what is
 * written here); the migration role is superuser/BYPASSRLS (every tenant is processed).
 *
 * up(), in this order (nothing before step 4 changes live rows):
 *   1. confirmation, key and RLS-bypass guards, SET LOCAL lock_timeout;
 *   2. column presence (artists 8 ciphertext columns, clients.cpf_cnpj_encrypted);
 *   3. counts-only preflight of the candidate rows (no values, no PII in any message);
 *   4. archive side tables artists_pii_archive_20261002 / clients_pii_archive_20261002 (RLS ENABLED + FORCED, no
 *      policy, every app role revoked) holding the ORIGINAL plaintext values and the PII metadata keys of every
 *      candidate row (ON CONFLICT DO NOTHING), then a by-value coverage check: a candidate row whose archive row
 *      differs (stale archive from an earlier cycle) ABORTS, nothing is rewritten;
 *   5. row by row (FOR UPDATE, keyset batches, updated_at untouched, WHERE id AND tenant_id):
 *        artists  plaintext column -> `<column>_encrypted` ONLY when that ciphertext is still NULL (existing
 *                 ciphertext is newer truth and is never overwritten), plaintext column set NULL, the PII keys
 *                 removed from metadata (their values are only archived, never promoted: nobody reads them);
 *        clients  metadata PII keys removed; the document (cpf/cnpj/cpf_cnpj/documento/document) is promoted to
 *                 cpf_cnpj_encrypted ONLY when that column is NULL (flag recorded in the archive);
 *   6. residue audit inside the transaction: zero candidate rows left, else the whole migration rolls back.
 * down(): restores plaintext columns / metadata keys from the archive; a ciphertext is nulled only when it still
 * decrypts to exactly the archived value (a value edited since up() is kept and counted). Archive tables are NEVER
 * dropped here: retention/retirement is a separate, later, authorized step (data-governance-pii-backfill.md).
 */
export const CONFIRM_ENV = 'PII_ENCRYPT_CONFIRM';
export const CONFIRM_TOKEN = 'encrypt-artists-clients-pii-gates-satisfied';
export const MAX_MESSAGE = 600;
export const BATCH_SIZE = 200;
export const ARTISTS_ARCHIVE = 'artists_pii_archive_20261002';
export const CLIENTS_ARCHIVE = 'clients_pii_archive_20261002';

/** Plaintext artist columns moved to `<column>_encrypted` (birth_date is a `date`). */
export const ARTIST_PII_FIELDS = [
  'birth_date', 'rg', 'address', 'bank_name', 'bank_branch', 'bank_account', 'pix_key', 'account_holder',
] as const;

/** Frozen copy of ARTIST_METADATA_PII_KEYS (artist-input-sanitizer.ts); the spec asserts they are identical. */
export const ARTIST_METADATA_PII_KEYS: readonly string[] = [
  'cpf', 'cnpj', 'cpf_cnpj', 'documento', 'document', 'rg',
  'birth_date', 'data_nascimento', 'address', 'endereco',
  'bank_name', 'banco', 'bank_branch', 'agencia', 'bank_account', 'conta',
  'pix_key', 'chave_pix', 'account_holder', 'titular_conta',
  'email', 'e_mail', 'phone', 'telefone', 'celular', 'manager_contact', 'manager_contato',
];

/** Frozen copy of METADATA_PII_KEYS (client-legacy-fields.ts); the spec asserts they are identical. */
export const CLIENT_METADATA_PII_KEYS: readonly string[] = [
  'cpf', 'cnpj', 'cpf_cnpj', 'documento', 'document', 'rg', 'email', 'e_mail', 'telefone', 'phone', 'celular',
];
/** Priority order of the metadata keys holding the client document (normalized key names). */
export const CLIENT_DOCUMENT_KEYS = ['cpf_cnpj', 'cpf', 'cnpj', 'documento', 'document'] as const;

export const normalizeKey = (key: string): string => key.trim().toLowerCase().replace(/[-\s]+/g, '_');

function bounded(text: string): string {
  return text.length <= MAX_MESSAGE ? text : `${text.slice(0, MAX_MESSAGE)}...(+${text.length - MAX_MESSAGE} chars)`;
}

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** Splits a metadata object into the PII entries (by normalized key) and the rest. */
export function splitMetadata(metadata: unknown, piiKeys: readonly string[]): { pii: Record<string, unknown>; rest: Record<string, unknown> } {
  const pii: Record<string, unknown> = {};
  const rest: Record<string, unknown> = {};
  if (!isObject(metadata)) return { pii, rest };
  const set = new Set(piiKeys);
  for (const [key, value] of Object.entries(metadata)) (set.has(normalizeKey(key)) ? pii : rest)[key] = value;
  return { pii, rest };
}

/** The client document held by the archived PII metadata (first non-empty string by priority), or null. */
export function documentOf(pii: Record<string, unknown>): string | null {
  const byKey = new Map<string, unknown>();
  for (const [key, value] of Object.entries(pii)) if (!byKey.has(normalizeKey(key))) byKey.set(normalizeKey(key), value);
  for (const key of CLIENT_DOCUMENT_KEYS) {
    const value = byKey.get(key);
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return null;
}

const NORMALIZED_KEY_SQL = `lower(regexp_replace(btrim(k.key), '[-[:space:]]+', '_', 'g'))`;
const hasPiiKey = (alias: string): string =>
  `(jsonb_typeof(${alias}.metadata) = 'object' AND EXISTS (SELECT 1 FROM jsonb_object_keys(${alias}.metadata) AS k(key) WHERE ${NORMALIZED_KEY_SQL} = ANY($1::text[])))`;
const piiMetadataOf = (alias: string): string =>
  `CASE WHEN jsonb_typeof(${alias}.metadata) = 'object' THEN (SELECT COALESCE(jsonb_object_agg(k.key, ${alias}.metadata -> k.key), '{}'::jsonb) FROM jsonb_object_keys(${alias}.metadata) AS k(key) WHERE ${NORMALIZED_KEY_SQL} = ANY($1::text[])) ELSE '{}'::jsonb END`;
const artistsCandidate = (alias: string): string =>
  `(${ARTIST_PII_FIELDS.map((f) => `${alias}."${f}" IS NOT NULL`).join(' OR ')} OR ${hasPiiKey(alias)})`;

function encryptionFromEnv(): EncryptionService {
  const key = process.env['ENCRYPTION_KEY'];
  if (!key || !/^[0-9a-fA-F]{64}$/.test(key) || /^0+$/.test(key)) {
    throw new Error('EncryptArtistsAndClientsPiiInPlace: ENCRYPTION_KEY must be the real 64-hex key of this environment (unset or all-zero is refused).');
  }
  return new EncryptionService({ get: (name: string) => process.env[name] } as unknown as ConfigService);
}

export class EncryptArtistsAndClientsPiiInPlace20261002000002 implements MigrationInterface {
  name = 'EncryptArtistsAndClientsPiiInPlace20261002000002';

  private assertConfirmed(): void {
    if (process.env[CONFIRM_ENV] !== CONFIRM_TOKEN) {
      throw new Error(`${this.name}: gated draft. Set ${CONFIRM_ENV} only after the gates of docs/engineering/data-governance-pii-backfill.md are evidenced.`);
    }
  }

  private async count(qr: QueryRunner, sql: string, params: unknown[] = []): Promise<number> {
    const rows: Array<{ n: number }> = await qr.query(sql, params);
    return rows[0]?.n ?? 0;
  }

  public async up(qr: QueryRunner): Promise<void> {
    this.assertConfirmed();
    const encryption = encryptionFromEnv();
    await assertMigrationRoleBypassesRls(qr, this.name);
    await qr.query(`SET LOCAL lock_timeout = '15s'`);

    // (2) presence
    const needed = [...ARTIST_PII_FIELDS.map((f) => `${f}_encrypted`)];
    const present: Array<{ column_name: string }> = await qr.query(
      `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'artists' AND column_name = ANY($1::text[])`,
      [needed],
    );
    if (present.length !== needed.length) {
      throw new Error(bounded(`${this.name}: artists ciphertext columns missing (${present.length}/${needed.length}); run 20261002000001_AddArtistsPiiEncryptedColumns first. Nothing was changed.`));
    }
    const clientCol = await this.count(
      qr,
      `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'cpf_cnpj_encrypted'`,
    );
    if (clientCol !== 1) throw new Error(`${this.name}: clients.cpf_cnpj_encrypted is missing. Nothing was changed.`);

    // (3) counts-only preflight
    const artistsPending = await this.count(qr, `SELECT count(*)::int AS n FROM "artists" a WHERE ${artistsCandidate('a')}`, [ARTIST_METADATA_PII_KEYS]);
    const clientsPending = await this.count(qr, `SELECT count(*)::int AS n FROM "clients" c WHERE ${hasPiiKey('c')}`, [CLIENT_METADATA_PII_KEYS]);
    if (artistsPending === 0 && clientsPending === 0) return;

    // (4) archive + by-value coverage
    await this.archive(qr);

    // (5) rewrite
    await this.rewriteArtists(qr, encryption);
    await this.rewriteClients(qr, encryption);

    // (6) residue audit
    const artistsLeft = await this.count(qr, `SELECT count(*)::int AS n FROM "artists" a WHERE ${artistsCandidate('a')}`, [ARTIST_METADATA_PII_KEYS]);
    const clientsLeft = await this.count(qr, `SELECT count(*)::int AS n FROM "clients" c WHERE ${hasPiiKey('c')}`, [CLIENT_METADATA_PII_KEYS]);
    if (artistsLeft > 0 || clientsLeft > 0) {
      throw new Error(bounded(`${this.name}: residue after rewrite (artists=${artistsLeft}, clients=${clientsLeft}); rolling back.`));
    }
  }

  private async archive(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "${ARTISTS_ARCHIVE}" (
        "id" uuid PRIMARY KEY,
        "tenant_id" uuid NOT NULL,
        "birth_date" date, "rg" varchar(30), "address" varchar(300), "bank_name" varchar(100), "bank_branch" varchar(30),
        "bank_account" varchar(40), "pix_key" varchar(150), "account_holder" varchar(150),
        "metadata_pii" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "archived_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "${CLIENTS_ARCHIVE}" (
        "id" uuid PRIMARY KEY,
        "tenant_id" uuid NOT NULL,
        "metadata_pii" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "document_promoted" boolean NOT NULL DEFAULT false,
        "archived_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await lockDownArchiveTable(qr, ARTISTS_ARCHIVE);
    await lockDownArchiveTable(qr, CLIENTS_ARCHIVE);

    const fields = ARTIST_PII_FIELDS.map((f) => `"${f}"`).join(', ');
    await qr.query(
      `INSERT INTO "${ARTISTS_ARCHIVE}" ("id", "tenant_id", ${fields}, "metadata_pii")
       SELECT a."id", a."tenant_id", ${ARTIST_PII_FIELDS.map((f) => `a."${f}"`).join(', ')}, ${piiMetadataOf('a')}
         FROM "artists" a WHERE ${artistsCandidate('a')}
       ON CONFLICT ("id") DO NOTHING`,
      [ARTIST_METADATA_PII_KEYS],
    );
    await qr.query(
      `INSERT INTO "${CLIENTS_ARCHIVE}" ("id", "tenant_id", "metadata_pii")
       SELECT c."id", c."tenant_id", ${piiMetadataOf('c')} FROM "clients" c WHERE ${hasPiiKey('c')}
       ON CONFLICT ("id") DO NOTHING`,
      [CLIENT_METADATA_PII_KEYS],
    );

    const sameArtist = ARTIST_PII_FIELDS.map((f) => `x."${f}" IS NOT DISTINCT FROM a."${f}"`).join(' AND ');
    const missingArtists = await this.count(
      qr,
      `SELECT count(*)::int AS n FROM "artists" a WHERE ${artistsCandidate('a')}
         AND NOT EXISTS (SELECT 1 FROM "${ARTISTS_ARCHIVE}" x WHERE x."id" = a."id" AND ${sameArtist}
                         AND x."metadata_pii" IS NOT DISTINCT FROM ${piiMetadataOf('a')})`,
      [ARTIST_METADATA_PII_KEYS],
    );
    const missingClients = await this.count(
      qr,
      `SELECT count(*)::int AS n FROM "clients" c WHERE ${hasPiiKey('c')}
         AND NOT EXISTS (SELECT 1 FROM "${CLIENTS_ARCHIVE}" x WHERE x."id" = c."id"
                         AND x."metadata_pii" IS NOT DISTINCT FROM ${piiMetadataOf('c')})`,
      [CLIENT_METADATA_PII_KEYS],
    );
    if (missingArtists > 0 || missingClients > 0) {
      throw new Error(bounded(`${this.name}: archive verification failed (artists=${missingArtists}, clients=${missingClients} row(s) not archived with their current values; review and retire a stale archive table); nothing rewritten.`));
    }
  }

  private async rewriteArtists(qr: QueryRunner, encryption: EncryptionService): Promise<void> {
    let last = '00000000-0000-0000-0000-000000000000';
    for (;;) {
      const rows: Array<Record<string, unknown>> = await qr.query(
        `SELECT a."id", a."tenant_id", a."metadata", ${ARTIST_PII_FIELDS.map((f) => `a."${f}"::text AS "${f}"`).join(', ')},
                ${ARTIST_PII_FIELDS.map((f) => `a."${f}_encrypted" AS "${f}_encrypted"`).join(', ')}
           FROM "artists" a WHERE a."id" > $2::uuid AND ${artistsCandidate('a')}
          ORDER BY a."id" LIMIT ${BATCH_SIZE} FOR UPDATE`,
        [ARTIST_METADATA_PII_KEYS, last],
      );
      if (rows.length === 0) return;
      for (const row of rows) {
        const sets: string[] = [];
        const params: unknown[] = [];
        const bind = (value: unknown): string => { params.push(value); return `$${params.length}`; };
        for (const field of ARTIST_PII_FIELDS) {
          const plain = row[field];
          if (plain === null || plain === undefined) continue;
          if (row[`${field}_encrypted`] == null && typeof plain === 'string' && plain !== '') {
            sets.push(`"${field}_encrypted" = ${bind(encryption.encrypt(plain))}`);
          }
          sets.push(`"${field}" = NULL`);
        }
        const { pii, rest } = splitMetadata(row['metadata'], ARTIST_METADATA_PII_KEYS);
        if (Object.keys(pii).length > 0) sets.push(`"metadata" = ${bind(JSON.stringify(rest))}::jsonb`);
        if (sets.length > 0) {
          await qr.query(
            `UPDATE "artists" SET ${sets.join(', ')} WHERE "id" = ${bind(row['id'])} AND "tenant_id" = ${bind(row['tenant_id'])}`,
            params,
          );
        }
        last = String(row['id']);
      }
    }
  }

  private async rewriteClients(qr: QueryRunner, encryption: EncryptionService): Promise<void> {
    let last = '00000000-0000-0000-0000-000000000000';
    for (;;) {
      const rows: Array<Record<string, unknown>> = await qr.query(
        `SELECT c."id", c."tenant_id", c."metadata", c."cpf_cnpj_encrypted"
           FROM "clients" c WHERE c."id" > $2::uuid AND ${hasPiiKey('c')}
          ORDER BY c."id" LIMIT ${BATCH_SIZE} FOR UPDATE`,
        [CLIENT_METADATA_PII_KEYS, last],
      );
      if (rows.length === 0) return;
      for (const row of rows) {
        const { pii, rest } = splitMetadata(row['metadata'], CLIENT_METADATA_PII_KEYS);
        const document = documentOf(pii);
        const promote = document !== null && (row['cpf_cnpj_encrypted'] === null || row['cpf_cnpj_encrypted'] === undefined);
        const params: unknown[] = [JSON.stringify(rest)];
        let setDocument = '';
        if (promote) {
          params.push(encryption.encrypt(document));
          setDocument = `, "cpf_cnpj_encrypted" = $${params.length}`;
          await qr.query(`UPDATE "${CLIENTS_ARCHIVE}" SET "document_promoted" = true WHERE "id" = $1`, [row['id']]);
        }
        params.push(row['id'], row['tenant_id']);
        await qr.query(
          `UPDATE "clients" SET "metadata" = $1::jsonb${setDocument} WHERE "id" = $${params.length - 1} AND "tenant_id" = $${params.length}`,
          params,
        );
        last = String(row['id']);
      }
    }
  }

  public async down(qr: QueryRunner): Promise<void> {
    this.assertConfirmed();
    const encryption = encryptionFromEnv();
    await assertMigrationRoleBypassesRls(qr, this.name);
    await qr.query(`SET LOCAL lock_timeout = '15s'`);
    for (const archive of [ARTISTS_ARCHIVE, CLIENTS_ARCHIVE]) {
      const exists: Array<{ ok: boolean }> = await qr.query(`SELECT to_regclass('public.${archive}') IS NOT NULL AS ok`);
      if (!exists[0]?.ok) throw new Error(bounded(`${this.name}: refusing down(): archive table ${archive} is missing, values cannot be restored.`));
    }

    const artists: Array<Record<string, unknown>> = await qr.query(
      `SELECT x."id", x."tenant_id", x."metadata_pii", ${ARTIST_PII_FIELDS.map((f) => `x."${f}"::text AS "${f}"`).join(', ')},
              a."metadata" AS live_metadata,
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
        if (archived === null || archived === undefined) continue;
        const cipher = row[`${field}_encrypted`];
        const unchangedSinceUp = cipher == null || (typeof cipher === 'string' && encryption.decryptOrLegacy(cipher) === archived);
        if (!unchangedSinceUp) continue; // edited after up(): the newer ciphertext wins, nothing is overwritten
        sets.push(`"${field}" = ${bind(archived)}`);
        if (cipher != null) sets.push(`"${field}_encrypted" = NULL`);
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
      `SELECT x."id", x."tenant_id", x."metadata_pii", x."document_promoted", c."metadata" AS live_metadata, c."cpf_cnpj_encrypted"
         FROM "${CLIENTS_ARCHIVE}" x JOIN "clients" c ON c."id" = x."id" AND c."tenant_id" = x."tenant_id"
        ORDER BY x."id" FOR UPDATE OF c`,
    );
    for (const row of clients) {
      const archivedPii = isObject(row['metadata_pii']) ? row['metadata_pii'] : {};
      const live = isObject(row['live_metadata']) ? row['live_metadata'] : {};
      const params: unknown[] = [JSON.stringify({ ...archivedPii, ...live })];
      let clearDocument = '';
      const cipher = row['cpf_cnpj_encrypted'];
      if (row['document_promoted'] === true && typeof cipher === 'string' && encryption.decryptOrLegacy(cipher) === documentOf(archivedPii)) {
        clearDocument = `, "cpf_cnpj_encrypted" = NULL`;
      }
      params.push(row['id'], row['tenant_id']);
      await qr.query(
        `UPDATE "clients" SET "metadata" = $1::jsonb${clearDocument} WHERE "id" = $${params.length - 1} AND "tenant_id" = $${params.length}`,
        params,
      );
    }
  }
}
