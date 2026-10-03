import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { ALL_MIGRATIONS } from '../migrations';
import { EncryptionService } from '../../core/security/encryption.service';
import { CONFIRM_TOKEN as BACKFILL_TOKEN, CONFIRM_ENV as BACKFILL_ENV, ARTIST_PII_FIELDS, ARTISTS_ARCHIVE, CLIENTS_ARCHIVE } from './20261002000002_EncryptArtistsAndClientsPiiBackfill';
import {
  CONFIRM_ENV,
  CONFIRM_TOKEN,
  ScrubArtistsAndClientsPlaintext20261002000003 as Draft,
} from './20261002000003_ScrubArtistsAndClientsPlaintext';

const KEY = 'cd'.repeat(32);
const encryption = new EncryptionService({ get: () => KEY } as unknown as ConfigService);

interface Script {
  bypass?: boolean;
  artistCols?: number;
  archiveExists?: boolean;
  artistsPending?: number;
  clientsPending?: number;
  missingArtists?: number;
  missingClients?: number;
  residueArtists?: number;
  ciphertextCounts?: [number, number];
  artistRows?: Array<Record<string, unknown>>;
  clientRows?: Array<Record<string, unknown>>;
  verifyArtistRows?: Array<Record<string, unknown>>;
  verifyClientRows?: Array<Record<string, unknown>>;
  downArtists?: Array<Record<string, unknown>>;
  downClients?: Array<Record<string, unknown>>;
}

function runner(s: Script = {}) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const once = (rows: Array<Record<string, unknown>> | undefined) => { let n = 0; return () => (n++ === 0 ? (rows ?? []) : []); };
  const nextArtists = once(s.artistRows);
  const nextClients = once(s.clientRows);
  const nextVerifyArtists = once(s.verifyArtistRows);
  const nextVerifyClients = once(s.verifyClientRows);
  let artistCounts = 0;
  let clientCounts = 0;
  let cipherCounts = 0;
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes('rolbypassrls')) return [{ bypass: s.bypass ?? true }];
    if (sql.includes('information_schema.columns') && sql.includes(`'artists'`)) {
      return Array.from({ length: s.artistCols ?? 8 }, (_, i) => ({ column_name: `c${i}` }));
    }
    if (sql.includes('information_schema.columns') && sql.includes(`'clients'`)) return [{ n: 1 }];
    if (sql.includes('to_regclass')) return [{ ok: s.archiveExists ?? true }];
    if (sql.includes('SELECT (SELECT count(*) FROM "artists" a')) return [{ n: (s.ciphertextCounts ?? [3, 3])[cipherCounts++ === 0 ? 0 : 1] }];
    if (sql.startsWith('SELECT count(*)::int AS n FROM "artists" a') && sql.includes('NOT EXISTS')) return [{ n: s.missingArtists ?? 0 }];
    if (sql.startsWith('SELECT count(*)::int AS n FROM "clients" c') && sql.includes('NOT EXISTS')) return [{ n: s.missingClients ?? 0 }];
    if (sql.startsWith('SELECT count(*)::int AS n FROM "artists" a')) return [{ n: artistCounts++ === 0 ? (s.artistsPending ?? 0) : (s.residueArtists ?? 0) }];
    if (sql.startsWith('SELECT count(*)::int AS n FROM "clients" c')) return [{ n: clientCounts++ === 0 ? (s.clientsPending ?? 0) : 0 }];
    if (sql.includes('FROM "artists" a WHERE a."id" >')) return sql.includes('FOR UPDATE') ? nextArtists() : nextVerifyArtists();
    if (sql.includes('FROM "clients" c WHERE c."id" >')) return sql.includes('FOR UPDATE') ? nextClients() : nextVerifyClients();
    if (sql.includes(`FROM "${ARTISTS_ARCHIVE}" x JOIN`)) return s.downArtists ?? [];
    if (sql.includes(`FROM "${CLIENTS_ARCHIVE}" x JOIN`)) return s.downClients ?? [];
    return [];
  });
  return { query, calls };
}
const writes = (calls: Array<{ sql: string }>) => calls.filter((c) => /^\s*(UPDATE|INSERT|DELETE|DROP|ALTER|CREATE)/.test(c.sql));
const updatesOf = (calls: Array<{ sql: string; params: unknown[] }>, table: string) =>
  calls.filter((c) => c.sql.startsWith(`UPDATE "${table}" SET`));

const hasFlags = Object.fromEntries(ARTIST_PII_FIELDS.map((f) => [`has_${f}`, false]));
const nullFlags = Object.fromEntries(ARTIST_PII_FIELDS.flatMap((f) => [[f, null], [`${f}_is_null`, true], [`${f}_encrypted`, null]]));
const plainFields = Object.fromEntries(ARTIST_PII_FIELDS.flatMap((f) => [[f, null], [`${f}_encrypted`, null]]));

describe('PII SCRUB draft: remove plaintext only after archive + verified ciphertext (BLK-CRM-PII-PLAINTEXT)', () => {
  const draft = new Draft();
  const OLD = { c: process.env[CONFIRM_ENV], b: process.env[BACKFILL_ENV], k: process.env['ENCRYPTION_KEY'] };
  beforeEach(() => { process.env[CONFIRM_ENV] = CONFIRM_TOKEN; process.env['ENCRYPTION_KEY'] = KEY; delete process.env[BACKFILL_ENV]; });
  afterEach(() => {
    for (const [name, value] of [[CONFIRM_ENV, OLD.c], [BACKFILL_ENV, OLD.b], ['ENCRYPTION_KEY', OLD.k]] as const) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });

  it('is not registered and lives only under migration-drafts/', () => {
    expect(ALL_MIGRATIONS.map((m) => m.name)).not.toContain(draft.name);
    const migrations = path.join(__dirname, '..', 'migrations');
    expect(fs.existsSync(path.join(migrations, '20261002000003_ScrubArtistsAndClientsPlaintext.ts'))).toBe(false);
    expect(fs.readFileSync(path.join(migrations, 'index.ts'), 'utf8')).not.toContain('ScrubArtistsAndClientsPlaintext');
  });

  it('has its own token: the backfill token (or none) never unlocks it, and nothing touches the database', async () => {
    expect(CONFIRM_ENV).toBe('PII_SCRUB_CONFIRM');
    expect(CONFIRM_TOKEN).not.toBe(BACKFILL_TOKEN);
    const r = runner();
    delete process.env[CONFIRM_ENV];
    await expect(draft.up({ query: r.query } as never)).rejects.toThrow(/gated destructive draft/);
    process.env[CONFIRM_ENV] = BACKFILL_TOKEN;
    await expect(draft.up({ query: r.query } as never)).rejects.toThrow(/gated destructive draft/);
    await expect(draft.down({ query: r.query } as never)).rejects.toThrow(/gated destructive draft/);
    delete process.env[CONFIRM_ENV];
    process.env[BACKFILL_ENV] = BACKFILL_TOKEN; // approving the backfill does not authorize the scrub
    await expect(draft.up({ query: r.query } as never)).rejects.toThrow(/gated destructive draft/);
    expect(r.query).not.toHaveBeenCalled();
  });

  it('refuses an unset or all-zero key, a non-BYPASSRLS role, missing columns and missing archives before any write', async () => {
    const r = runner({ artistsPending: 1 });
    delete process.env['ENCRYPTION_KEY'];
    await expect(draft.up({ query: r.query } as never)).rejects.toThrow(/ENCRYPTION_KEY/);
    process.env['ENCRYPTION_KEY'] = '0'.repeat(64);
    await expect(draft.up({ query: r.query } as never)).rejects.toThrow(/ENCRYPTION_KEY/);
    expect(r.query).not.toHaveBeenCalled();
    process.env['ENCRYPTION_KEY'] = KEY;
    for (const script of [{ bypass: false }, { artistCols: 2 }, { archiveExists: false }] as Script[]) {
      const x = runner({ artistsPending: 1, ...script });
      await expect(draft.up({ query: x.query } as never)).rejects.toThrow();
      expect(writes(x.calls).filter((c) => !c.sql.startsWith('SET'))).toHaveLength(0);
    }
  });

  it('is a no-op when there is nothing to scrub', async () => {
    const r = runner();
    await draft.up({ query: r.query } as never);
    expect(updatesOf(r.calls, 'artists')).toHaveLength(0);
    expect(r.calls.some((c) => c.sql.includes('SET LOCAL lock_timeout'))).toBe(true);
  });

  it('PRECONDITION archive intact: an uncovered row aborts with counts only and nothing is scrubbed', async () => {
    const r = runner({ artistsPending: 1, missingArtists: 1 });
    const error = await draft.up({ query: r.query } as never).catch((e: Error) => e);
    expect((error as Error).message).toMatch(/archive not intact \(artists=1, clients=0 row/);
    expect(updatesOf(r.calls, 'artists')).toHaveLength(0);
  });

  it('PRECONDITION ciphertext equal: a missing or divergent ciphertext aborts, values never in the message', async () => {
    const missing = runner({ artistsPending: 1, verifyArtistRows: [{ id: 'a1', ...plainFields, rg: 'SECRET-RG' }] });
    const e1 = await draft.up({ query: missing.query } as never).catch((e: Error) => e);
    expect((e1 as Error).message).toMatch(/ciphertext not verified equal \(artist fields missing=1, divergent=0/);
    expect((e1 as Error).message).not.toContain('SECRET-RG');
    expect(updatesOf(missing.calls, 'artists')).toHaveLength(0);

    const divergent = runner({
      clientsPending: 1,
      verifyClientRows: [{ id: 'c1', metadata: { cpf: 'SECRET-DOC' }, cpf_cnpj_encrypted: encryption.encrypt('OTHER-DOC') }],
    });
    const e2 = await draft.up({ query: divergent.query } as never).catch((e: Error) => e);
    expect((e2 as Error).message).toMatch(/clients missing=0, divergent=1/);
    expect((e2 as Error).message).not.toMatch(/SECRET-DOC|OTHER-DOC/);
    expect(updatesOf(divergent.calls, 'clients')).toHaveLength(0);
  });

  it('nulls plaintext columns and strips metadata PII keys; ciphertext is never written', async () => {
    const r = runner({
      artistsPending: 1,
      clientsPending: 1,
      verifyArtistRows: [{ id: 'a1', ...plainFields, rg: '12.3', rg_encrypted: encryption.encrypt('12.3') }],
      verifyClientRows: [{ id: 'c1', metadata: { cpf: '111' }, cpf_cnpj_encrypted: encryption.encrypt('111') }],
      artistRows: [{
        id: 'a1', tenant_id: 't1', ...hasFlags, has_rg: true, has_pix_key: true,
        metadata: { gender: 'female', Banco: 'META', leadId: 'l1' },
      }],
      clientRows: [{ id: 'c1', tenant_id: 't1', metadata: { origem: 'evento', cpf: '111', Telefone: '1199', razao_social: 'Keep' } }],
    });
    await draft.up({ query: r.query } as never);
    const [artistUpdate] = updatesOf(r.calls, 'artists');
    expect(artistUpdate.sql).toContain('"rg" = NULL');
    expect(artistUpdate.sql).toContain('"pix_key" = NULL');
    expect(artistUpdate.sql).not.toContain('"address" = NULL');
    expect(artistUpdate.sql).not.toContain('_encrypted');
    expect(artistUpdate.sql).not.toContain('updated_at');
    expect(artistUpdate.sql).toContain('"tenant_id" = $');
    expect(JSON.parse(artistUpdate.params[0] as string)).toEqual({ gender: 'female', leadId: 'l1' });
    const [clientUpdate] = updatesOf(r.calls, 'clients');
    expect(clientUpdate.sql).not.toContain('_encrypted');
    expect(JSON.parse(clientUpdate.params[0] as string)).toEqual({ origem: 'evento', razao_social: 'Keep' });
    const order = r.calls.map((c) => c.sql);
    const firstWrite = order.findIndex((s) => /^\s*UPDATE "(artists|clients)"/.test(s));
    expect(order.findIndex((s) => s.includes('NOT EXISTS'))).toBeLessThan(firstWrite); // archive check precedes the first write
    expect(order.findIndex((s) => s.includes('FROM "artists" a WHERE a."id" >') && !s.includes('FOR UPDATE'))).toBeLessThan(firstWrite); // so does the ciphertext verification
  });

  it('rolls back when residue remains or the ciphertext count changed', async () => {
    const residue = runner({ artistsPending: 1, residueArtists: 1, artistRows: [] });
    await expect(draft.up({ query: residue.query } as never)).rejects.toThrow(/residue audit failed \(artists=1/);
    const changed = runner({ artistsPending: 1, ciphertextCounts: [3, 2] });
    await expect(draft.up({ query: changed.query } as never)).rejects.toThrow(/ciphertext before=3, after=2/);
  });

  it('down refuses when an archive table is missing', async () => {
    const r = runner({ archiveExists: false });
    await expect(draft.down({ query: r.query } as never)).rejects.toThrow(/archive table .* is missing/);
    expect(updatesOf(r.calls, 'artists')).toHaveLength(0);
  });

  it('down restores plaintext and metadata keys from the archive, never touches ciphertext, keeps newer edits', async () => {
    const r = runner({
      downArtists: [{
        id: 'a1', tenant_id: 't1', ...nullFlags, rg: '12.3', bank_name: 'Banco Velho', address: 'Rua 1',
        rg_encrypted: encryption.encrypt('12.3'), // unchanged since up: restored
        bank_name_encrypted: encryption.encrypt('EDITED-AFTER-UP'), // newer ciphertext wins: not restored
        address_is_null: false, // plaintext already present: not overwritten
        metadata_pii: { banco: 'META' }, live_metadata: { gender: 'male' },
      }],
      downClients: [{ id: 'c1', tenant_id: 't1', metadata_pii: { cpf: '111' }, live_metadata: { origem: 'x' } }],
    });
    await draft.down({ query: r.query } as never);
    const [artistUpdate] = updatesOf(r.calls, 'artists');
    expect(artistUpdate.sql).toContain('"rg" = $');
    expect(artistUpdate.sql).not.toContain('"bank_name" = $');
    expect(artistUpdate.sql).not.toContain('"address" = $');
    expect(artistUpdate.sql).not.toContain('_encrypted');
    expect(JSON.parse(artistUpdate.params.find((p) => typeof p === 'string' && p.startsWith('{')) as string)).toEqual({ banco: 'META', gender: 'male' });
    const [clientUpdate] = updatesOf(r.calls, 'clients');
    expect(clientUpdate.sql).not.toContain('_encrypted');
    expect(JSON.parse(clientUpdate.params[0] as string)).toEqual({ cpf: '111', origem: 'x' });
    expect(r.calls.some((c) => /DROP TABLE/.test(c.sql))).toBe(false);
  });
});
