import { createHash } from 'crypto';
import { MigrationInterface, QueryRunner } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { assertMigrationRoleBypassesRls } from '../migration-guards';
import { EncryptionService } from '../../core/security/encryption.service';
import { lockDownArchiveTable } from './legacy-column-drop.base';

/**
 * 20261002000002_EncryptArtistsAndClientsPiiBackfill (BLK-CRM-PII-PLAINTEXT): GATED DRAFT, NOT REGISTERED.
 *
 * Step 1 of 2 of the owner-approved model (decision deci-ed83c974, option A):
 *   plaintext historical -> controlled archive -> ENCRYPTED BACKFILL (this draft) -> verification -> ciphertext
 *   canonical -> LATER removal of plaintext (separate draft 20261002000003_ScrubArtistsAndClientsPlaintext, own
 *   token, own approval).
 *
 * THIS DRAFT NEVER REMOVES PLAINTEXT. It writes ciphertext only; every plaintext column and every metadata key is left
 * exactly as found. It is still gated (it rewrites live rows and creates plaintext archive tables): not part of
 * ALL_MIGRATIONS (migrations/index.ts); nothing imports it except its specs and the retire draft. Second lock:
 * up() and down() throw unless PII_ENCRYPT_CONFIRM=<CONFIRM_TOKEN> is exported (distinct from every other draft).
 * See docs/engineering/data-governance-pii-backfill.md and docs/engineering/pii-approval-packages.md.
 *
 * Prerequisites (fail-closed, before any write): migration 20261002000001_AddArtistsPiiEncryptedColumns ran;
 * ENCRYPTION_KEY is the real 64-hex key of the target environment (unset or all-zero refused: it must be the key the
 * API uses); the migration role is superuser/BYPASSRLS (every tenant is processed).
 *
 * up(), in this order (nothing before step 4 changes live rows):
 *   1. confirmation, key and RLS-bypass guards, SET LOCAL lock_timeout;
 *   2. column presence (artists 8 ciphertext columns, clients.cpf_cnpj_encrypted);
 *   3. counts-only preflight of the candidate rows (no values, no PII in any message);
 *   4. ARCHIVE FIRST: side tables artists_pii_archive_20261002 / clients_pii_archive_20261002 (RLS ENABLED + FORCED,
 *      no policy, every app role revoked) holding the ORIGINAL plaintext and PII metadata keys of every candidate row
 *      (ON CONFLICT DO NOTHING), then a by-value coverage check: a candidate row whose archive row differs ABORTS;
 *   5. row by row (FOR UPDATE, keyset batches, updated_at untouched, WHERE id AND tenant_id): ciphertext ONLY.
 *        artists  `<column>_encrypted` is written from the plaintext column ONLY when it is still NULL (existing
 *                 ciphertext is newer truth and is never overwritten); the fields written are recorded in the
 *                 archive (`encrypted_fields`) so down() removes only what this draft wrote;
 *        clients  the document (cpf/cnpj/cpf_cnpj/documento/document) is promoted to cpf_cnpj_encrypted ONLY when that
 *                 column is NULL (flag `document_promoted` recorded in the archive);
 *   6. verification inside the transaction: every plaintext value has a ciphertext, and every ciphertext written by
 *      this run decrypts to the plaintext (compared by SHA-256, values never printed); any mismatch rolls back the
 *      WHOLE migration. A pre-existing ciphertext that differs from the plaintext is not overwritten and not a failure
 *      here, but it is a DIVERGENCE that blocks the scrub (see verifyPlaintextVsCiphertext).
 * down(): removes only the ciphertext this draft wrote (a ciphertext edited since is kept). Plaintext was never
 * touched. Archive tables are NEVER dropped here: retention/retirement is a separate, later, authorized step.
 */
export const CONFIRM_ENV = 'PII_ENCRYPT_CONFIRM';
export const CONFIRM_TOKEN = 'encrypt-artists-clients-pii-gates-satisfied';
export const MAX_MESSAGE = 600;
export const BATCH_SIZE = 200;
export const ARTISTS_ARCHIVE = 'artists_pii_archive_20261002';
export const CLIENTS_ARCHIVE = 'clients_pii_archive_20261002';

/** Plaintext artist columns encrypted into `<column>_encrypted` (birth_date is a `date`). */
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

export function bounded(text: string): string {
  return text.length <= MAX_MESSAGE ? text : `${text.slice(0, MAX_MESSAGE)}...(+${text.length - MAX_MESSAGE} chars)`;
}

export const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

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
export const hasPiiKey = (alias: string): string =>
  `(jsonb_typeof(${alias}.metadata) = 'object' AND EXISTS (SELECT 1 FROM jsonb_object_keys(${alias}.metadata) AS k(key) WHERE ${NORMALIZED_KEY_SQL} = ANY($1::text[])))`;
export const piiMetadataOf = (alias: string): string =>
  `CASE WHEN jsonb_typeof(${alias}.metadata) = 'object' THEN (SELECT COALESCE(jsonb_object_agg(k.key, ${alias}.metadata -> k.key), '{}'::jsonb) FROM jsonb_object_keys(${alias}.metadata) AS k(key) WHERE ${NORMALIZED_KEY_SQL} = ANY($1::text[])) ELSE '{}'::jsonb END`;
export const artistsCandidate = (alias: string): string =>
  `(${ARTIST_PII_FIELDS.map((f) => `${alias}."${f}" IS NOT NULL`).join(' OR ')} OR ${hasPiiKey(alias)})`;
/** Artist rows holding at least one plaintext column (the rows the ciphertext verification compares). */
const artistsHasPlaintext = (alias: string): string => `(${ARTIST_PII_FIELDS.map((f) => `${alias}."${f}" IS NOT NULL`).join(' OR ')})`;
/** Artist rows where some non-empty plaintext has no ciphertext yet. */
const artistsLacksCiphertext = (alias: string): string =>
  `(${ARTIST_PII_FIELDS.map((f) => `(${alias}."${f}"::text <> '' AND ${alias}."${f}_encrypted" IS NULL)`).join(' OR ')})`;

export function encryptionFromEnv(migration: string): EncryptionService {
  const key = process.env['ENCRYPTION_KEY'];
  if (!key || !/^[0-9a-fA-F]{64}$/.test(key) || /^0+$/.test(key)) {
    throw new Error(`${migration}: ENCRYPTION_KEY must be the real 64-hex key of this environment (unset or all-zero is refused).`);
  }
  return new EncryptionService({ get: (name: string) => process.env[name] } as unknown as ConfigService);
}

export async function countRows(qr: QueryRunner, sql: string, params: unknown[] = []): Promise<number> {
  const rows: Array<{ n: number }> = await qr.query(sql, params);
  return rows[0]?.n ?? 0;
}

/** Fails (nothing changed) unless the 8 artists ciphertext columns and clients.cpf_cnpj_encrypted exist. */
export async function assertCiphertextColumns(qr: QueryRunner, migration: string): Promise<void> {
  const needed = [...ARTIST_PII_FIELDS.map((f) => `${f}_encrypted`)];
  const present: Array<{ column_name: string }> = await qr.query(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'artists' AND column_name = ANY($1::text[])`,
    [needed],
  );
  if (present.length !== needed.length) {
    throw new Error(bounded(`${migration}: artists ciphertext columns missing (${present.length}/${needed.length}); run 20261002000001_AddArtistsPiiEncryptedColumns first. Nothing was changed.`));
  }
  const clientCol = await countRows(
    qr,
    `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'cpf_cnpj_encrypted'`,
  );
  if (clientCol !== 1) throw new Error(`${migration}: clients.cpf_cnpj_encrypted is missing. Nothing was changed.`);
}

/** Candidate rows whose archive row does NOT hold their current plaintext values (counts only). */
export async function archiveCoverageGaps(qr: QueryRunner): Promise<{ artists: number; clients: number }> {
  const sameArtist = ARTIST_PII_FIELDS.map((f) => `x."${f}" IS NOT DISTINCT FROM a."${f}"`).join(' AND ');
  const artists = await countRows(
    qr,
    `SELECT count(*)::int AS n FROM "artists" a WHERE ${artistsCandidate('a')}
       AND NOT EXISTS (SELECT 1 FROM "${ARTISTS_ARCHIVE}" x WHERE x."id" = a."id" AND ${sameArtist}
                       AND x."metadata_pii" IS NOT DISTINCT FROM ${piiMetadataOf('a')})`,
    [ARTIST_METADATA_PII_KEYS],
  );
  const clients = await countRows(
    qr,
    `SELECT count(*)::int AS n FROM "clients" c WHERE ${hasPiiKey('c')}
       AND NOT EXISTS (SELECT 1 FROM "${CLIENTS_ARCHIVE}" x WHERE x."id" = c."id"
                       AND x."metadata_pii" IS NOT DISTINCT FROM ${piiMetadataOf('c')})`,
    [CLIENT_METADATA_PII_KEYS],
  );
  return { artists, clients };
}

export interface PiiVerification {
  artistRows: number;
  artistFieldsCompared: number;
  /** Non-empty plaintext without any ciphertext. */
  artistFieldsMissing: number;
  /** Ciphertext present but not equal to the plaintext (by SHA-256) or not decryptable. */
  artistFieldsDivergent: number;
  clientRows: number;
  clientsMissing: number;
  clientsDivergent: number;
  /** Row ids only (never values): `artists:<id>:<field>` / `clients:<id>`. */
  divergent: string[];
}

type Match = 'equal' | 'missing' | 'divergent';
function compare(encryption: EncryptionService, cipher: unknown, plain: string): Match {
  if (cipher === null || cipher === undefined || cipher === '') return 'missing';
  if (!encryption.isCiphertext(cipher)) return 'divergent';
  return sha256(encryption.decrypt(cipher)) === sha256(plain) ? 'equal' : 'divergent';
}

/**
 * Read-only controlled verification (counts and ids only, values never leave this function): for every artists
 * plaintext column and every client document held in metadata, the ciphertext must exist and decrypt to the plaintext.
 * The decryption happens in the migration process with ENCRYPTION_KEY; the database never sees the key.
 */
export async function verifyPlaintextVsCiphertext(qr: QueryRunner, encryption: EncryptionService): Promise<PiiVerification> {
  const out: PiiVerification = {
    artistRows: 0, artistFieldsCompared: 0, artistFieldsMissing: 0, artistFieldsDivergent: 0,
    clientRows: 0, clientsMissing: 0, clientsDivergent: 0, divergent: [],
  };
  let last = '00000000-0000-0000-0000-000000000000';
  for (;;) {
    const rows: Array<Record<string, unknown>> = await qr.query(
      `SELECT a."id", ${ARTIST_PII_FIELDS.map((f) => `a."${f}"::text AS "${f}"`).join(', ')},
              ${ARTIST_PII_FIELDS.map((f) => `a."${f}_encrypted" AS "${f}_encrypted"`).join(', ')}
         FROM "artists" a WHERE a."id" > $1::uuid AND ${artistsHasPlaintext('a')}
        ORDER BY a."id" LIMIT ${BATCH_SIZE}`,
      [last],
    );
    if (rows.length === 0) break;
    for (const row of rows) {
      out.artistRows += 1;
      for (const field of ARTIST_PII_FIELDS) {
        const plain = row[field];
        if (typeof plain !== 'string' || plain === '') continue;
        out.artistFieldsCompared += 1;
        const match = compare(encryption, row[`${field}_encrypted`], plain);
        if (match === 'missing') out.artistFieldsMissing += 1;
        if (match === 'divergent') { out.artistFieldsDivergent += 1; out.divergent.push(`artists:${String(row['id'])}:${field}`); }
      }
      last = String(row['id']);
    }
  }
  last = '00000000-0000-0000-0000-000000000000';
  for (;;) {
    const rows: Array<Record<string, unknown>> = await qr.query(
      `SELECT c."id", c."metadata", c."cpf_cnpj_encrypted"
         FROM "clients" c WHERE c."id" > $2::uuid AND ${hasPiiKey('c')}
        ORDER BY c."id" LIMIT ${BATCH_SIZE}`,
      [CLIENT_METADATA_PII_KEYS, last],
    );
    if (rows.length === 0) break;
    for (const row of rows) {
      last = String(row['id']);
      const document = documentOf(splitMetadata(row['metadata'], CLIENT_METADATA_PII_KEYS).pii);
      if (document === null) continue;
      out.clientRows += 1;
      const match = compare(encryption, row['cpf_cnpj_encrypted'], document);
      if (match === 'missing') out.clientsMissing += 1;
      if (match === 'divergent') { out.clientsDivergent += 1; out.divergent.push(`clients:${last}`); }
    }
  }
  return out;
}

export class EncryptArtistsAndClientsPiiBackfill20261002000002 implements MigrationInterface {
  name = 'EncryptArtistsAndClientsPiiBackfill20261002000002';

  private assertConfirmed(): void {
    if (process.env[CONFIRM_ENV] !== CONFIRM_TOKEN) {
      throw new Error(`${this.name}: gated draft. Set ${CONFIRM_ENV} only after the gates of docs/engineering/data-governance-pii-backfill.md are evidenced.`);
    }
  }

  public async up(qr: QueryRunner): Promise<void> {
    this.assertConfirmed();
    const encryption = encryptionFromEnv(this.name);
    await assertMigrationRoleBypassesRls(qr, this.name);
    await qr.query(`SET LOCAL lock_timeout = '15s'`);
    await assertCiphertextColumns(qr, this.name);

    const artistsPending = await countRows(qr, `SELECT count(*)::int AS n FROM "artists" a WHERE ${artistsCandidate('a')}`, [ARTIST_METADATA_PII_KEYS]);
    const clientsPending = await countRows(qr, `SELECT count(*)::int AS n FROM "clients" c WHERE ${hasPiiKey('c')}`, [CLIENT_METADATA_PII_KEYS]);
    if (artistsPending === 0 && clientsPending === 0) return;

    await this.archive(qr);

    const written = new Set<string>();
    await this.backfillArtists(qr, encryption, written);
    await this.backfillClients(qr, encryption, written);

    // (6) verification: any gap or any mismatch of what THIS run wrote rolls back the whole migration.
    const artistsLeft = await countRows(qr, `SELECT count(*)::int AS n FROM "artists" a WHERE ${artistsLacksCiphertext('a')}`);
    const verification = await verifyPlaintextVsCiphertext(qr, encryption);
    const mismatchedOwn = verification.divergent.filter((key) => written.has(key)).length;
    if (artistsLeft > 0 || verification.artistFieldsMissing > 0 || verification.clientsMissing > 0 || mismatchedOwn > 0) {
      throw new Error(bounded(`${this.name}: verification failed (artists rows without ciphertext=${artistsLeft}, artist fields missing=${verification.artistFieldsMissing}, clients missing=${verification.clientsMissing}, written ciphertext mismatched=${mismatchedOwn}); rolling back.`));
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
        "encrypted_fields" text[] NOT NULL DEFAULT '{}',
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

    const gaps = await archiveCoverageGaps(qr);
    if (gaps.artists > 0 || gaps.clients > 0) {
      throw new Error(bounded(`${this.name}: archive verification failed (artists=${gaps.artists}, clients=${gaps.clients} row(s) not archived with their current values; review and retire a stale archive table); nothing written.`));
    }
  }

  private async backfillArtists(qr: QueryRunner, encryption: EncryptionService, written: Set<string>): Promise<void> {
    let last = '00000000-0000-0000-0000-000000000000';
    for (;;) {
      const rows: Array<Record<string, unknown>> = await qr.query(
        `SELECT a."id", a."tenant_id", ${ARTIST_PII_FIELDS.map((f) => `a."${f}"::text AS "${f}"`).join(', ')},
                ${ARTIST_PII_FIELDS.map((f) => `a."${f}_encrypted" AS "${f}_encrypted"`).join(', ')}
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
        const fieldsWritten: string[] = [];
        for (const field of ARTIST_PII_FIELDS) {
          const plain = row[field];
          if (typeof plain !== 'string' || plain === '') continue;
          if (row[`${field}_encrypted`] == null) { // existing ciphertext is newer truth: never overwritten
            sets.push(`"${field}_encrypted" = ${bind(encryption.encrypt(plain))}`);
            fieldsWritten.push(field);
          }
        }
        if (sets.length === 0) continue;
        await qr.query(
          `UPDATE "artists" SET ${sets.join(', ')} WHERE "id" = ${bind(row['id'])} AND "tenant_id" = ${bind(row['tenant_id'])}`,
          params,
        );
        await qr.query(
          `UPDATE "${ARTISTS_ARCHIVE}" SET "encrypted_fields" = ARRAY(SELECT DISTINCT e FROM unnest("encrypted_fields" || $1::text[]) AS e) WHERE "id" = $2`,
          [fieldsWritten, row['id']],
        );
        for (const field of fieldsWritten) written.add(`artists:${last}:${field}`);
      }
    }
  }

  private async backfillClients(qr: QueryRunner, encryption: EncryptionService, written: Set<string>): Promise<void> {
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
        last = String(row['id']);
        const document = documentOf(splitMetadata(row['metadata'], CLIENT_METADATA_PII_KEYS).pii);
        if (document === null || (row['cpf_cnpj_encrypted'] !== null && row['cpf_cnpj_encrypted'] !== undefined)) continue;
        await qr.query(
          `UPDATE "clients" SET "cpf_cnpj_encrypted" = $1 WHERE "id" = $2 AND "tenant_id" = $3`,
          [encryption.encrypt(document), row['id'], row['tenant_id']],
        );
        await qr.query(`UPDATE "${CLIENTS_ARCHIVE}" SET "document_promoted" = true WHERE "id" = $1`, [row['id']]);
        written.add(`clients:${last}`);
      }
    }
  }

  public async down(qr: QueryRunner): Promise<void> {
    this.assertConfirmed();
    const encryption = encryptionFromEnv(this.name);
    await assertMigrationRoleBypassesRls(qr, this.name);
    await qr.query(`SET LOCAL lock_timeout = '15s'`);
    for (const archive of [ARTISTS_ARCHIVE, CLIENTS_ARCHIVE]) {
      const exists: Array<{ ok: boolean }> = await qr.query(`SELECT to_regclass('public.${archive}') IS NOT NULL AS ok`);
      if (!exists[0]?.ok) throw new Error(bounded(`${this.name}: refusing down(): archive table ${archive} is missing, the ciphertext written by up() cannot be identified.`));
    }

    const artists: Array<Record<string, unknown>> = await qr.query(
      `SELECT x."id", x."tenant_id", x."encrypted_fields", ${ARTIST_PII_FIELDS.map((f) => `x."${f}"::text AS "${f}"`).join(', ')},
              ${ARTIST_PII_FIELDS.map((f) => `a."${f}_encrypted" AS "${f}_encrypted"`).join(', ')}
         FROM "${ARTISTS_ARCHIVE}" x JOIN "artists" a ON a."id" = x."id" AND a."tenant_id" = x."tenant_id"
        WHERE cardinality(x."encrypted_fields") > 0
        ORDER BY x."id" FOR UPDATE OF a`,
    );
    for (const row of artists) {
      const sets: string[] = [];
      const params: unknown[] = [];
      const bind = (value: unknown): string => { params.push(value); return `$${params.length}`; };
      const removed: string[] = [];
      const recorded = Array.isArray(row['encrypted_fields']) ? (row['encrypted_fields'] as string[]) : [];
      for (const field of ARTIST_PII_FIELDS) {
        if (!recorded.includes(field)) continue;
        const archived = row[field];
        const cipher = row[`${field}_encrypted`];
        // Only the ciphertext this draft wrote, and only while it still equals the archived value.
        if (typeof archived === 'string' && typeof cipher === 'string' && encryption.decryptOrLegacy(cipher) === archived) {
          sets.push(`"${field}_encrypted" = NULL`);
          removed.push(field);
        }
      }
      if (sets.length === 0) continue;
      await qr.query(`UPDATE "artists" SET ${sets.join(', ')} WHERE "id" = ${bind(row['id'])} AND "tenant_id" = ${bind(row['tenant_id'])}`, params);
      await qr.query(
        `UPDATE "${ARTISTS_ARCHIVE}" SET "encrypted_fields" = ARRAY(SELECT e FROM unnest("encrypted_fields") AS e WHERE NOT (e = ANY($1::text[]))) WHERE "id" = $2`,
        [removed, row['id']],
      );
    }

    const clients: Array<Record<string, unknown>> = await qr.query(
      `SELECT x."id", x."tenant_id", x."metadata_pii", c."cpf_cnpj_encrypted"
         FROM "${CLIENTS_ARCHIVE}" x JOIN "clients" c ON c."id" = x."id" AND c."tenant_id" = x."tenant_id"
        WHERE x."document_promoted" = true
        ORDER BY x."id" FOR UPDATE OF c`,
    );
    for (const row of clients) {
      const cipher = row['cpf_cnpj_encrypted'];
      const archivedPii = isObject(row['metadata_pii']) ? row['metadata_pii'] : {};
      if (typeof cipher === 'string' && encryption.decryptOrLegacy(cipher) === documentOf(archivedPii)) {
        await qr.query(`UPDATE "clients" SET "cpf_cnpj_encrypted" = NULL WHERE "id" = $1 AND "tenant_id" = $2`, [row['id'], row['tenant_id']]);
        await qr.query(`UPDATE "${CLIENTS_ARCHIVE}" SET "document_promoted" = false WHERE "id" = $1`, [row['id']]);
      }
    }
  }
}
