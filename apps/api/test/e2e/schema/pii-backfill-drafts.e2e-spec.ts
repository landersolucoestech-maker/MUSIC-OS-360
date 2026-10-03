/**
 * PII backfill + scrub drafts REHEARSAL against a REAL disposable PostgreSQL (BLK-CRM-PII-PLAINTEXT, decision
 * deci-ed83c974 option A; docs/engineering/data-governance-pii-backfill.md, docs/engineering/pii-approval-packages.md).
 *
 * Safety: DATABASE_URL must point at a LOCAL disposable BASE database (host 127.0.0.1/localhost, name `music_os_*`).
 * The spec creates its own COPY (`CREATE DATABASE <copy> TEMPLATE <base>`), runs everything against the copy ONLY and
 * drops the copy at the end. The base is never written. Seed data is SYNTHETIC. The ENCRYPTION_KEY is a throwaway
 * 64-hex key generated in memory for this run (never printed, never written to a file, restored afterwards).
 * The drafts are imported directly (they are, and must stay, unregistered in migrations/index.ts).
 *
 * Rehearsal order (each step asserts schema AND data):
 *   backfill: refusal without token -> failure injection mid-batch (whole migration rolls back) -> verification
 *   mismatch injection (rolls back) -> up -> verification (archive integrity, ciphertext decrypts == original by hash,
 *   plaintext untouched) -> controlled decrypt verification -> idempotent rerun, existing ciphertext never overwritten
 *   -> down (only what it wrote) -> up again;
 *   scrub: refusal (backfill token does not unlock it) -> blocked by divergence -> blocked by tampered archive ->
 *   failure injection (rolls back) -> up (separate token) -> plaintext gone, ciphertext intact -> rerun no-op ->
 *   down restores plaintext from the archive.
 * Only counts and row ids are ever printed; no value.
 */
import { createHash, randomBytes } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { EncryptionService } from '../../../src/core/security/encryption.service';
import { AddArtistsPiiEncryptedColumns20261002000001 } from '../../../src/database/migrations/20261002000001_AddArtistsPiiEncryptedColumns';
import {
  ARTIST_PII_FIELDS,
  ARTISTS_ARCHIVE,
  CLIENTS_ARCHIVE,
  CONFIRM_ENV as BACKFILL_ENV,
  CONFIRM_TOKEN as BACKFILL_TOKEN,
  EncryptArtistsAndClientsPiiBackfill20261002000002 as Backfill,
  archiveCoverageGaps,
  verifyPlaintextVsCiphertext,
} from '../../../src/database/migration-drafts/20261002000002_EncryptArtistsAndClientsPiiBackfill';
import {
  CONFIRM_ENV as SCRUB_ENV,
  CONFIRM_TOKEN as SCRUB_TOKEN,
  ScrubArtistsAndClientsPlaintext20261002000003 as Scrub,
} from '../../../src/database/migration-drafts/20261002000003_ScrubArtistsAndClientsPlaintext';

const T1 = '10000000-0000-0000-0000-0000000000a1';
const T2 = '10000000-0000-0000-0000-0000000000a2';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const A1 = id(9101), A2 = id(9102), A3 = id(9103), A4 = id(9104), A5 = id(9105), A6 = id(9106);
const C1 = id(9201), C2 = id(9202), C3 = id(9203), C4 = id(9204), C5 = id(9205);
const CIPHER_COLUMNS = ARTIST_PII_FIELDS.map((f) => `${f}_encrypted`);
const sha = (v: string) => createHash('sha256').update(v, 'utf8').digest('hex');

type Migration = { name: string; up(q: unknown): Promise<void>; down(q: unknown): Promise<void> };

describe('PII backfill + scrub drafts rehearsal, real disposable PostgreSQL (COPY database only)', () => {
  const baseUrl = new URL(process.env['DATABASE_URL'] ?? 'postgresql://invalid/invalid');
  const baseDb = baseUrl.pathname.replace(/^\//, '');
  const copyDb = `${baseDb}_copy_pii_${process.pid}`;
  const url = (db: string) => { const u = new URL(baseUrl.toString()); u.pathname = `/${db}`; return u.toString(); };
  let admin: Client;
  let c: Client;
  let encryption: EncryptionService;
  const prev = { key: process.env['ENCRYPTION_KEY'], backfill: process.env[BACKFILL_ENV], scrub: process.env[SCRUB_ENV] };
  const counts: Record<string, number> = {};
  const backfill: Migration = new Backfill();
  const scrub: Migration = new Scrub();

  const qr = () => ({ query: async (text: string, params?: unknown[]) => (await c.query(text, params as never)).rows });
  const run = async (m: Migration, dir: 'up' | 'down') => {
    await c.query('BEGIN');
    try { await m[dir](qr()); await c.query('COMMIT'); } catch (e) { await c.query('ROLLBACK'); throw e; }
  };
  const withToken = async <T>(env: string, token: string | undefined, fn: () => Promise<T>): Promise<T> => {
    const old = process.env[env];
    if (token === undefined) delete process.env[env]; else process.env[env] = token;
    try { return await fn(); } finally { if (old === undefined) delete process.env[env]; else process.env[env] = old; }
  };
  const upBackfill = () => withToken(BACKFILL_ENV, BACKFILL_TOKEN, () => run(backfill, 'up'));
  const downBackfill = () => withToken(BACKFILL_ENV, BACKFILL_TOKEN, () => run(backfill, 'down'));
  const upScrub = () => withToken(SCRUB_ENV, SCRUB_TOKEN, () => run(scrub, 'up'));
  const downScrub = () => withToken(SCRUB_ENV, SCRUB_TOKEN, () => run(scrub, 'down'));
  const message = async (p: Promise<unknown>): Promise<string> => { try { await p; } catch (e) { return (e as Error).message; } throw new Error('expected the migration to fail'); };

  /** Plaintext + metadata state of every row (ciphertext columns excluded), keyed by id. */
  const plaintextState = async () => {
    const artists = (await c.query(`SELECT id, to_jsonb(a) - $1::text[] AS v FROM artists a ORDER BY id`, [CIPHER_COLUMNS])).rows;
    const clients = (await c.query(`SELECT id, to_jsonb(x) - 'cpf_cnpj_encrypted' AS v FROM clients x ORDER BY id`)).rows;
    return { artists, clients };
  };
  /** Exact ciphertext strings of every row, keyed by id. */
  const cipherState = async () => ({
    artists: (await c.query(`SELECT id, ${CIPHER_COLUMNS.join(', ')} FROM artists ORDER BY id`)).rows,
    clients: (await c.query(`SELECT id, cpf_cnpj_encrypted FROM clients ORDER BY id`)).rows,
  });
  const exists = async (table: string) => (await c.query(`SELECT to_regclass('public.${table}') IS NOT NULL AS ok`)).rows[0].ok as boolean;
  const artist = async (artistId: string) => (await c.query(`SELECT * FROM artists WHERE id = $1`, [artistId])).rows[0];
  const client = async (clientId: string) => (await c.query(`SELECT * FROM clients WHERE id = $1`, [clientId])).rows[0];
  const dropTriggers = async () => {
    await c.query(`DROP TRIGGER IF EXISTS pii_rehearsal_fail ON artists`);
    await c.query(`DROP TRIGGER IF EXISTS pii_rehearsal_corrupt ON artists`);
  };

  let seeded: Awaited<ReturnType<typeof plaintextState>>;
  let seedCiphers: Awaited<ReturnType<typeof cipherState>>;

  beforeAll(async () => {
    expect(['127.0.0.1', 'localhost']).toContain(baseUrl.hostname);
    expect(baseDb).toMatch(/^music_os_[a-z0-9_]+$/);
    expect(baseDb).not.toMatch(/_copy_/);
    process.env['ENCRYPTION_KEY'] = randomBytes(32).toString('hex'); // throwaway, in memory only
    encryption = new EncryptionService({ get: (name: string) => process.env[name] } as unknown as ConfigService);
    delete process.env[BACKFILL_ENV];
    delete process.env[SCRUB_ENV];
    admin = new Client({ connectionString: url('postgres') });
    await admin.connect();
    await admin.query(`DROP DATABASE IF EXISTS "${copyDb}"`);
    await admin.query(`CREATE DATABASE "${copyDb}" TEMPLATE "${baseDb}"`);
    c = new Client({ connectionString: url(copyDb) });
    await c.connect();
    expect((await c.query('SELECT current_database() AS d')).rows[0].d).toBe(copyDb); // everything below runs here
    // Seed with FK enforcement off, then back to origin so the failure-injection triggers fire.
    await c.query(`SET session_replication_role = replica`);
    await c.query(`INSERT INTO tenants (id, org_id, name, slug) VALUES ('${T1}', gen_random_uuid(), 'pii1', 'pii1'), ('${T2}', gen_random_uuid(), 'pii2', 'pii2') ON CONFLICT DO NOTHING`);
    // Prerequisite: the REGISTERED additive migration (the base predates it).
    await c.query('BEGIN');
    await new AddArtistsPiiEncryptedColumns20261002000001().up(qr() as never);
    await c.query('COMMIT');
    const enc = (v: string) => encryption.encrypt(v);
    const full = {
      birth_date: '1991-02-03', rg: '11.222.333-4', address: 'Synthetic Street 100', bank_name: 'Synthetic Bank',
      bank_branch: '0001', bank_account: '12345-6', pix_key: 'synthetic@example.invalid', account_holder: 'Synthetic Holder',
    };
    const insertArtist = (artistId: string, tenant: string, name: string, plain: Record<string, string>, cipher: Record<string, string>, metadata: unknown) => {
      const cols = ['id', 'tenant_id', 'stage_name', 'metadata', ...Object.keys(plain), ...Object.keys(cipher)];
      const vals = [artistId, tenant, name, JSON.stringify(metadata), ...Object.values(plain), ...Object.values(cipher)];
      return c.query(`INSERT INTO artists (${cols.map((x) => `"${x}"`).join(', ')}) VALUES (${vals.map((_, i) => `$${i + 1}`).join(', ')})`, vals);
    };
    await insertArtist(A1, T1, 'Synthetic A1', full, {}, { gender: 'female', rg: 'META-RG', banco: 'META-BANK', leadId: 'l1' });
    await insertArtist(A2, T2, 'Synthetic A2', { rg: '55.666.777-8', pix_key: 'a2@example.invalid' }, {}, {});
    await insertArtist(A3, T1, 'Synthetic A3', { rg: 'OLD-RG', bank_name: 'Bank Three' }, { rg_encrypted: enc('NEWER-RG') }, {}); // pre-existing divergent ciphertext
    await insertArtist(A4, T1, 'Synthetic A4 no pii', {}, {}, { gender: 'male' });
    await insertArtist(A5, T2, 'Synthetic A5 metadata only', {}, {}, { cpf: '000.000.000-00', keep: 1 });
    await insertArtist(A6, T2, 'Synthetic A6 empty rg', { rg: '', bank_name: 'Bank Six' }, {}, {});
    const insertClient = (clientId: string, tenant: string, name: string, metadata: unknown, cipher: string | null) =>
      c.query(
        `INSERT INTO clients (id, tenant_id, category, profile, name, metadata, cpf_cnpj_encrypted) VALUES ($1, $2, 'label', 'b2b', $3, $4::jsonb, $5)`,
        [clientId, tenant, name, JSON.stringify(metadata), cipher],
      );
    await insertClient(C1, T1, 'Synthetic C1', { cpf: '111.222.333-44', telefone: '1199', origem: 'event', razao_social: 'Keep Form Key' }, null);
    await insertClient(C2, T2, 'Synthetic C2', { cnpj: '12.345.678/0001-90' }, enc('12.345.678/0001-90'));
    await insertClient(C3, T1, 'Synthetic C3 email only', { email: 'c3@example.invalid' }, null);
    await insertClient(C4, T1, 'Synthetic C4 no pii', { origem: 'event' }, null);
    await insertClient(C5, T2, 'Synthetic C5 divergent', { cpf: '999' }, enc('DIFFERENT'));
    await c.query(`SET session_replication_role = origin`);
    await c.query(`
      CREATE OR REPLACE FUNCTION pii_rehearsal_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'rehearsal injected failure'; END $$;
      CREATE OR REPLACE FUNCTION pii_rehearsal_corrupt() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.rg_encrypted := 'enc:v1:AAAA'; RETURN NEW; END $$;`);
    seeded = await plaintextState();
    seedCiphers = await cipherState();
  }, 120000);

  afterAll(async () => {
    for (const [name, value] of [['ENCRYPTION_KEY', prev.key], [BACKFILL_ENV, prev.backfill], [SCRUB_ENV, prev.scrub]] as const) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
    await c?.end().catch(() => undefined);
    if (admin) { await admin.query(`DROP DATABASE IF EXISTS "${copyDb}"`); await admin.end(); }
    // eslint-disable-next-line no-console
    console.log(`PII REHEARSAL COUNTS ${JSON.stringify(counts)}`);
  }, 60000);

  it('the base database is untouched and the drafts are unregistered', async () => {
    const b = new Client({ connectionString: url(baseDb) });
    await b.connect();
    try {
      for (const archive of [ARTISTS_ARCHIVE, CLIENTS_ARCHIVE]) {
        expect((await b.query(`SELECT to_regclass('public.${archive}') IS NOT NULL AS ok`)).rows[0].ok).toBe(false);
      }
      expect((await b.query(`SELECT count(*)::int AS n FROM artists WHERE stage_name LIKE 'Synthetic%'`)).rows[0].n).toBe(0);
    } finally { await b.end(); }
    expect(await exists(ARTISTS_ARCHIVE)).toBe(false);
  });

  it('SEED: synthetic plaintext rows, ciphertext columns exist and are empty except the planted pre-existing ones', async () => {
    counts['seed:artists'] = seeded.artists.length;
    counts['seed:clients'] = seeded.clients.length;
    expect(seeded.artists).toHaveLength(6);
    expect(seeded.clients).toHaveLength(5);
    const presentCols = (await c.query(`SELECT column_name FROM information_schema.columns WHERE table_name='artists' AND column_name = ANY($1::text[])`, [CIPHER_COLUMNS])).rows;
    expect(presentCols).toHaveLength(8);
    const writtenCipher = (await c.query(`SELECT count(*)::int AS n FROM artists WHERE ${CIPHER_COLUMNS.map((x) => `${x} IS NOT NULL`).join(' OR ')}`)).rows[0].n;
    expect(writtenCipher).toBe(1); // A3.rg_encrypted
  });

  it('BACKFILL without the exact token (or with the scrub token) throws and changes nothing', async () => {
    await expect(withToken(BACKFILL_ENV, undefined, () => run(backfill, 'up'))).rejects.toThrow(/gated draft/);
    await expect(withToken(BACKFILL_ENV, SCRUB_TOKEN, () => run(backfill, 'up'))).rejects.toThrow(/gated draft/);
    expect(await exists(ARTISTS_ARCHIVE)).toBe(false);
    expect(await cipherState()).toEqual(seedCiphers);
  });

  it('FAILURE RECOVERY: a failure mid-batch rolls the WHOLE backfill back (earlier rows, archive tables, ciphertext)', async () => {
    await c.query(`CREATE TRIGGER pii_rehearsal_fail BEFORE UPDATE ON artists FOR EACH ROW WHEN (NEW.id = '${A6}' AND NEW.bank_name_encrypted IS NOT NULL) EXECUTE FUNCTION pii_rehearsal_fail()`);
    try {
      const msg = await message(upBackfill());
      expect(msg).toContain('rehearsal injected failure');
    } finally { await dropTriggers(); }
    expect(await exists(ARTISTS_ARCHIVE)).toBe(false);
    expect(await exists(CLIENTS_ARCHIVE)).toBe(false);
    expect(await cipherState()).toEqual(seedCiphers); // A1..A5 were processed before A6 inside the rolled-back transaction
    expect(await plaintextState()).toEqual(seeded);
  });

  it('VERIFICATION AUDIT: a written ciphertext that does not decrypt to the plaintext rolls the whole backfill back', async () => {
    await c.query(`CREATE TRIGGER pii_rehearsal_corrupt BEFORE UPDATE ON artists FOR EACH ROW WHEN (NEW.id = '${A2}' AND NEW.rg_encrypted IS NOT NULL) EXECUTE FUNCTION pii_rehearsal_corrupt()`);
    try {
      const msg = await message(upBackfill());
      expect(msg).toMatch(/verification failed/);
      expect(msg).toMatch(/written ciphertext mismatched=1/);
      expect(msg).not.toMatch(/55\.666|Synthetic|example\.invalid/); // counts only
    } finally { await dropTriggers(); }
    expect(await exists(ARTISTS_ARCHIVE)).toBe(false);
    expect(await cipherState()).toEqual(seedCiphers);
  });

  it('BACKFILL up: archive first, ciphertext only, plaintext and metadata untouched, existing ciphertext never overwritten', async () => {
    await upBackfill();
    // plaintext/metadata/updated_at of EVERY row identical to the seed
    expect(await plaintextState()).toEqual(seeded);
    // archive tables: exist, RLS enabled + forced, no policy, app roles without access
    for (const archive of [ARTISTS_ARCHIVE, CLIENTS_ARCHIVE]) {
      const flags = (await c.query(`SELECT relrowsecurity AS rls, relforcerowsecurity AS forced FROM pg_class WHERE oid = to_regclass('public.${archive}')`)).rows[0];
      expect(flags).toEqual({ rls: true, forced: true });
      expect((await c.query(`SELECT count(*)::int AS n FROM pg_policies WHERE tablename = $1`, [archive])).rows[0].n).toBe(0);
    }
    counts['archive:artists'] = (await c.query(`SELECT count(*)::int AS n FROM "${ARTISTS_ARCHIVE}"`)).rows[0].n;
    counts['archive:clients'] = (await c.query(`SELECT count(*)::int AS n FROM "${CLIENTS_ARCHIVE}"`)).rows[0].n;
    expect(counts['archive:artists']).toBe(5); // A1 A2 A3 A5 A6 (A4 has no PII)
    expect(counts['archive:clients']).toBe(4); // C1 C2 C3 C5 (C4 has no PII)
    expect((await c.query(`SELECT id FROM "${ARTISTS_ARCHIVE}" ORDER BY id`)).rows.map((r) => r.id)).toEqual([A1, A2, A3, A5, A6]);
    expect((await c.query(`SELECT id FROM "${CLIENTS_ARCHIVE}" ORDER BY id`)).rows.map((r) => r.id)).toEqual([C1, C2, C3, C5]);
    expect(await archiveCoverageGaps(qr() as never)).toEqual({ artists: 0, clients: 0 });

    const a1 = await artist(A1);
    for (const f of ARTIST_PII_FIELDS) expect(a1[`${f}_encrypted`]).toMatch(/^enc:v1:/);
    const a3 = await artist(A3);
    expect(a3['rg_encrypted']).toBe(seedCiphers.artists.find((r) => r.id === A3)!['rg_encrypted']); // never overwritten
    expect(a3['bank_name_encrypted']).toMatch(/^enc:v1:/);
    const a6 = await artist(A6);
    expect(a6['rg_encrypted']).toBeNull(); // empty string is not a value
    expect(a6['bank_name_encrypted']).toMatch(/^enc:v1:/);
    expect((await artist(A4))['rg_encrypted']).toBeNull();
    expect((await client(C1))['cpf_cnpj_encrypted']).toMatch(/^enc:v1:/); // promoted from metadata
    expect((await client(C2))['cpf_cnpj_encrypted']).toBe(seedCiphers.clients.find((r) => r.id === C2)!['cpf_cnpj_encrypted']);
    expect((await client(C5))['cpf_cnpj_encrypted']).toBe(seedCiphers.clients.find((r) => r.id === C5)!['cpf_cnpj_encrypted']);
    expect((await client(C3))['cpf_cnpj_encrypted']).toBeNull(); // email only: no document
    const archivedFields = (await c.query(`SELECT id, encrypted_fields FROM "${ARTISTS_ARCHIVE}" ORDER BY id`)).rows;
    expect(archivedFields.find((r) => r.id === A3)!.encrypted_fields).toEqual(['bank_name']); // rg ciphertext was not written by the draft
    expect((await c.query(`SELECT id FROM "${CLIENTS_ARCHIVE}" WHERE document_promoted ORDER BY id`)).rows.map((r) => r.id)).toEqual([C1]);
  });

  it('VERIFICATION: archive holds the original values; ciphertext decrypts == original by hash; divergences are exactly the two planted', async () => {
    // archive by value vs the seed snapshot (plaintext columns of the seeded rows)
    for (const f of ARTIST_PII_FIELDS) {
      const rows = (await c.query(`SELECT x.id FROM "${ARTISTS_ARCHIVE}" x JOIN artists a ON a.id = x.id WHERE x."${f}" IS DISTINCT FROM a."${f}"`)).rows;
      expect(rows).toHaveLength(0);
    }
    const v = await verifyPlaintextVsCiphertext(qr() as never, encryption);
    counts['verify:artistFieldsCompared'] = v.artistFieldsCompared;
    counts['verify:artistFieldsDivergent'] = v.artistFieldsDivergent;
    counts['verify:clientRows'] = v.clientRows;
    counts['verify:clientsDivergent'] = v.clientsDivergent;
    expect(v.artistFieldsMissing).toBe(0);
    expect(v.clientsMissing).toBe(0);
    expect(v.artistFieldsCompared).toBe(13); // A1:8 A2:2 A3:2 A6:1 (A6.rg is empty)
    expect(v.divergent.sort()).toEqual([`artists:${A3}:rg`, `clients:${C5}`].sort());
  });

  it('CONTROLLED DECRYPT VERIFICATION: independent of the draft code, every non-divergent ciphertext hashes equal to the archived original', async () => {
    const rows = (await c.query(
      `SELECT x.id, ${ARTIST_PII_FIELDS.map((f) => `x."${f}"::text AS "${f}", a."${f}_encrypted" AS "${f}_encrypted"`).join(', ')}
         FROM "${ARTISTS_ARCHIVE}" x JOIN artists a ON a.id = x.id ORDER BY x.id`,
    )).rows;
    let equal = 0;
    let skipped = 0;
    for (const row of rows) for (const f of ARTIST_PII_FIELDS) {
      if (!row[f]) continue;
      if (row.id === A3 && f === 'rg') { skipped += 1; expect(sha(encryption.decrypt(row[`${f}_encrypted`]))).not.toBe(sha(row[f])); continue; }
      expect(sha(encryption.decrypt(row[`${f}_encrypted`]))).toBe(sha(row[f]));
      equal += 1;
    }
    const docs: Record<string, string> = { [C1]: '111.222.333-44', [C2]: '12.345.678/0001-90' };
    for (const [clientId, doc] of Object.entries(docs)) {
      expect(sha(encryption.decrypt((await client(clientId))['cpf_cnpj_encrypted']))).toBe(sha(doc));
      equal += 1;
    }
    counts['decrypt:equal'] = equal;
    counts['decrypt:divergentSkipped'] = skipped;
    expect(equal).toBe(14);
    expect(skipped).toBe(1);
    // the ciphertext is not the plaintext and the wrong key cannot read it
    const other = new EncryptionService({ get: () => randomBytes(32).toString('hex') } as unknown as ConfigService);
    expect(other.decrypt((await artist(A1))['rg_encrypted'])).toBe('[encrypted]');
  });

  it('IDEMPOTENT RERUN: a second up() changes no ciphertext and no archive row', async () => {
    const before = await cipherState();
    const archiveBefore = (await c.query(`SELECT id, to_jsonb(x) - 'archived_at' AS v FROM "${ARTISTS_ARCHIVE}" x ORDER BY id`)).rows;
    await upBackfill();
    expect(await cipherState()).toEqual(before);
    expect((await c.query(`SELECT id, to_jsonb(x) - 'archived_at' AS v FROM "${ARTISTS_ARCHIVE}" x ORDER BY id`)).rows).toEqual(archiveBefore);
    expect(await plaintextState()).toEqual(seeded);
  });

  it('SCRUB is refused in every non-authorized way and nothing changes (backfill token, no token, divergent ciphertext)', async () => {
    const before = await cipherState();
    await expect(withToken(SCRUB_ENV, undefined, () => run(scrub, 'up'))).rejects.toThrow(/gated destructive draft/);
    await expect(withToken(SCRUB_ENV, BACKFILL_TOKEN, () => run(scrub, 'up'))).rejects.toThrow(/gated destructive draft/);
    const msg = await message(upScrub()); // two divergences planted: ciphertext is not equal for every row
    expect(msg).toMatch(/precondition failed, ciphertext not verified equal \(artist fields missing=0, divergent=1; clients missing=0, divergent=1\)/);
    expect(msg).not.toMatch(/OLD-RG|NEWER-RG|DIFFERENT|999/);
    expect(await plaintextState()).toEqual(seeded);
    expect(await cipherState()).toEqual(before);
  });

  it('BACKFILL down removes ONLY the ciphertext it wrote; plaintext untouched; pre-existing ciphertext kept', async () => {
    await downBackfill();
    expect(await cipherState()).toEqual(seedCiphers); // back to the seed: only the planted ciphertexts remain
    expect(await plaintextState()).toEqual(seeded);
    expect(await exists(ARTISTS_ARCHIVE)).toBe(true); // archives are never dropped by the migrations
    expect(await exists(CLIENTS_ARCHIVE)).toBe(true);
    expect((await c.query(`SELECT count(*)::int AS n FROM "${ARTISTS_ARCHIVE}" WHERE cardinality(encrypted_fields) > 0`)).rows[0].n).toBe(0);
  });

  it('BACKFILL up AGAIN after down: same end state as the first up', async () => {
    await upBackfill();
    expect(await plaintextState()).toEqual(seeded);
    const a1 = await artist(A1);
    for (const f of ARTIST_PII_FIELDS) expect(encryption.decrypt(a1[`${f}_encrypted`])).toBe(
      (await c.query(`SELECT "${f}"::text AS v FROM artists WHERE id = $1`, [A1])).rows[0].v,
    );
    expect((await client(C1))['cpf_cnpj_encrypted']).toMatch(/^enc:v1:/);
    const v = await verifyPlaintextVsCiphertext(qr() as never, encryption);
    expect(v.divergent).toHaveLength(2);
    expect(v.artistFieldsMissing + v.clientsMissing).toBe(0);
  });

  it('REHEARSAL FIXTURE: the owner resolves the two divergences (synthetic: ciphertext re-written to equal the plaintext) so the scrub can be rehearsed', async () => {
    await c.query(`UPDATE artists SET rg_encrypted = $1 WHERE id = $2`, [encryption.encrypt('OLD-RG'), A3]);
    await c.query(`UPDATE clients SET cpf_cnpj_encrypted = $1 WHERE id = $2`, [encryption.encrypt('999'), C5]);
    const v = await verifyPlaintextVsCiphertext(qr() as never, encryption);
    expect(v.divergent).toHaveLength(0);
    expect(v.artistFieldsMissing + v.clientsMissing).toBe(0);
  });

  it('SCRUB precondition archive intact: a tampered archive row blocks it and nothing changes', async () => {
    await c.query(`UPDATE "${ARTISTS_ARCHIVE}" SET rg = 'tampered' WHERE id = $1`, [A1]);
    const before = await cipherState();
    const plainBefore = await plaintextState();
    try {
      const msg = await message(upScrub());
      expect(msg).toMatch(/precondition failed, archive not intact \(artists=1, clients=0 row/);
      expect(msg).not.toContain('tampered');
    } finally {
      await c.query(`UPDATE "${ARTISTS_ARCHIVE}" SET rg = $1 WHERE id = $2`, ['11.222.333-4', A1]);
    }
    expect(await plaintextState()).toEqual(plainBefore);
    expect((await artist(A1))['rg']).toBe('11.222.333-4');
    expect(await cipherState()).toEqual(before);
  });

  it('SCRUB FAILURE RECOVERY: a failure mid-scrub rolls the WHOLE scrub back, plaintext intact', async () => {
    const plainBefore = await plaintextState();
    const cipherBefore = await cipherState();
    await c.query(`CREATE TRIGGER pii_rehearsal_fail BEFORE UPDATE ON artists FOR EACH ROW WHEN (NEW.id = '${A6}' AND NEW.bank_name IS NULL) EXECUTE FUNCTION pii_rehearsal_fail()`);
    try {
      expect(await message(upScrub())).toContain('rehearsal injected failure');
    } finally { await dropTriggers(); }
    expect(await plaintextState()).toEqual(plainBefore);
    expect(await cipherState()).toEqual(cipherBefore);
  });

  it('SCRUB up (separate token): plaintext columns NULL, metadata PII keys gone, non-PII keys kept, ciphertext intact, archive intact', async () => {
    const cipherBefore = await cipherState();
    const archiveBefore = (await c.query(`SELECT id, to_jsonb(x) - 'archived_at' AS v FROM "${ARTISTS_ARCHIVE}" x ORDER BY id`)).rows;
    const clientArchiveBefore = (await c.query(`SELECT id, to_jsonb(x) - 'archived_at' AS v FROM "${CLIENTS_ARCHIVE}" x ORDER BY id`)).rows;
    await upScrub();
    expect(await cipherState()).toEqual(cipherBefore); // ciphertext byte-for-byte intact
    const left = (await c.query(`SELECT count(*)::int AS n FROM artists WHERE ${ARTIST_PII_FIELDS.map((f) => `"${f}" IS NOT NULL`).join(' OR ')}`)).rows[0].n;
    counts['scrub:artistsWithPlaintextLeft'] = left;
    expect(left).toBe(0);
    expect((await artist(A1))['metadata']).toEqual({ gender: 'female', leadId: 'l1' });
    expect((await artist(A5))['metadata']).toEqual({ keep: 1 });
    expect((await artist(A4))['metadata']).toEqual({ gender: 'male' }); // not a candidate: untouched
    expect((await client(C1))['metadata']).toEqual({ origem: 'event', razao_social: 'Keep Form Key' });
    expect((await client(C3))['metadata']).toEqual({});
    expect((await client(C4))['metadata']).toEqual({ origem: 'event' });
    // the originals survive ONLY in the archive; ciphertext still decrypts to them by hash
    expect((await c.query(`SELECT id, to_jsonb(x) - 'archived_at' AS v FROM "${ARTISTS_ARCHIVE}" x ORDER BY id`)).rows).toEqual(archiveBefore);
    expect((await c.query(`SELECT id, to_jsonb(x) - 'archived_at' AS v FROM "${CLIENTS_ARCHIVE}" x ORDER BY id`)).rows).toEqual(clientArchiveBefore);
    const a1 = await artist(A1);
    const archived = (await c.query(`SELECT rg, bank_account FROM "${ARTISTS_ARCHIVE}" WHERE id = $1`, [A1])).rows[0];
    expect(sha(encryption.decrypt(a1['rg_encrypted']))).toBe(sha(archived.rg));
    expect(sha(encryption.decrypt(a1['bank_account_encrypted']))).toBe(sha(archived.bank_account));
    expect((await c.query(`SELECT count(*)::int AS n FROM clients WHERE jsonb_typeof(metadata) = 'object' AND metadata ?| ARRAY['cpf','cnpj','telefone','email']`)).rows[0].n).toBe(0);
  });

  it('SCRUB rerun is a no-op', async () => {
    const before = { p: await plaintextState(), c: await cipherState() };
    await upScrub();
    expect(await plaintextState()).toEqual(before.p);
    expect(await cipherState()).toEqual(before.c);
  });

  it('SCRUB down restores plaintext and metadata from the archive: end state equals the seed (ciphertext intact)', async () => {
    const cipherBefore = await cipherState();
    await downScrub();
    expect(await plaintextState()).toEqual(seeded); // every plaintext column, metadata and updated_at identical to the seed
    expect(await cipherState()).toEqual(cipherBefore);
    const v = await verifyPlaintextVsCiphertext(qr() as never, encryption);
    expect(v.divergent).toHaveLength(0);
    expect(await archiveCoverageGaps(qr() as never)).toEqual({ artists: 0, clients: 0 });
  });
});
