import * as fs from 'fs';
import * as path from 'path';
import { ConfigService } from '@nestjs/config';
import { ALL_MIGRATIONS } from '../migrations';
import { EncryptionService } from '../../core/security/encryption.service';
import { ARTIST_METADATA_PII_KEYS as APP_ARTIST_PII_KEYS } from '../../modules/artists/artist-input-sanitizer';
import { METADATA_PII_KEYS as APP_CLIENT_PII_KEYS } from '../../modules/clients/client-legacy-fields';
import { CONFIRM_TOKEN as DROP_TOKEN } from './legacy-column-drop.base';
import { CONFIRM_TOKEN as ROLE_TOKEN } from './20260930000030_CanonicalizeRoleSlugsInPlaceAndBackfillMembers';
import { CONFIRM_TOKEN as HR_TOKEN } from './20260930000051_RenameLegacyHrPermissionsInPlace';
import {
  ARTIST_METADATA_PII_KEYS,
  ARTIST_PII_FIELDS,
  ARTISTS_ARCHIVE,
  CLIENTS_ARCHIVE,
  CLIENT_METADATA_PII_KEYS,
  CONFIRM_ENV,
  CONFIRM_TOKEN,
  EncryptArtistsAndClientsPiiInPlace20261002000002 as Draft,
  documentOf,
  splitMetadata,
} from './20261002000002_EncryptArtistsAndClientsPiiInPlace';

const KEY = 'ef'.repeat(32);
const encryption = new EncryptionService({ get: () => KEY } as unknown as ConfigService);

interface Script {
  bypass?: boolean;
  artistCols?: number;
  clientCol?: number;
  artistsPending?: number;
  clientsPending?: number;
  artistsResidue?: number;
  clientsResidue?: number;
  missingArtists?: number;
  artistRows?: Array<Record<string, unknown>>;
  clientRows?: Array<Record<string, unknown>>;
  archiveExists?: boolean;
  downArtists?: Array<Record<string, unknown>>;
  downClients?: Array<Record<string, unknown>>;
}

function runner(s: Script = {}) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  let artistCounts = 0;
  let clientCounts = 0;
  let artistBatches = 0;
  let clientBatches = 0;
  const query = jest.fn(async (sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes('rolbypassrls')) return [{ bypass: s.bypass ?? true }];
    if (sql.includes('information_schema.columns') && sql.includes(`'artists'`)) {
      return Array.from({ length: s.artistCols ?? 8 }, (_, i) => ({ column_name: `c${i}` }));
    }
    if (sql.includes('information_schema.columns') && sql.includes(`'clients'`)) return [{ n: s.clientCol ?? 1 }];
    if (sql.includes('to_regclass')) return [{ ok: s.archiveExists ?? true }];
    if (sql.startsWith('SELECT count(*)::int AS n FROM "artists" a') && sql.includes('NOT EXISTS')) return [{ n: s.missingArtists ?? 0 }];
    if (sql.startsWith('SELECT count(*)::int AS n FROM "clients" c') && sql.includes('NOT EXISTS')) return [{ n: 0 }];
    if (sql.startsWith('SELECT count(*)::int AS n FROM "artists" a')) return [{ n: artistCounts++ === 0 ? (s.artistsPending ?? 0) : (s.artistsResidue ?? 0) }];
    if (sql.startsWith('SELECT count(*)::int AS n FROM "clients" c')) return [{ n: clientCounts++ === 0 ? (s.clientsPending ?? 0) : (s.clientsResidue ?? 0) }];
    if (sql.includes('FROM "artists" a WHERE a."id" >')) return artistBatches++ === 0 ? (s.artistRows ?? []) : [];
    if (sql.includes('FROM "clients" c WHERE c."id" >')) return clientBatches++ === 0 ? (s.clientRows ?? []) : [];
    if (sql.includes(`FROM "${ARTISTS_ARCHIVE}" x JOIN`)) return s.downArtists ?? [];
    if (sql.includes(`FROM "${CLIENTS_ARCHIVE}" x JOIN`)) return s.downClients ?? [];
    return [];
  });
  return { query, calls };
}
const writes = (calls: Array<{ sql: string }>) => calls.filter((c) => /^\s*(UPDATE|INSERT|DELETE)/.test(c.sql));
const updatesOf = (calls: Array<{ sql: string; params: unknown[] }>, table: string) =>
  calls.filter((c) => c.sql.startsWith(`UPDATE "${table}" SET`));

const RAW = {
  rg: '12.345.678-9', bank_account: '99887-6', birth_date: '1990-01-02', pix_key: 'chave-secreta',
};
const emptyFields = Object.fromEntries(ARTIST_PII_FIELDS.flatMap((f) => [[f, null], [`${f}_encrypted`, null]]));

describe('PII backfill DRAFT: encrypt artists/clients personal data in place (BLK-CRM-PII-PLAINTEXT)', () => {
  const draft = new Draft();
  const OLD_CONFIRM = process.env[CONFIRM_ENV];
  const OLD_KEY = process.env['ENCRYPTION_KEY'];
  beforeEach(() => { process.env[CONFIRM_ENV] = CONFIRM_TOKEN; process.env['ENCRYPTION_KEY'] = KEY; });
  afterEach(() => {
    if (OLD_CONFIRM === undefined) delete process.env[CONFIRM_ENV]; else process.env[CONFIRM_ENV] = OLD_CONFIRM;
    if (OLD_KEY === undefined) delete process.env['ENCRYPTION_KEY']; else process.env['ENCRYPTION_KEY'] = OLD_KEY;
  });

  it('is not registered and lives only under migration-drafts/', () => {
    expect(ALL_MIGRATIONS.map((m) => m.name)).not.toContain(draft.name);
    expect(fs.existsSync(path.join(__dirname, '..', 'migrations', '20261002000002_EncryptArtistsAndClientsPiiInPlace.ts'))).toBe(false);
    expect(fs.readFileSync(path.join(__dirname, '..', 'migrations', 'index.ts'), 'utf8')).not.toContain('EncryptArtistsAndClientsPiiInPlace');
  });

  it('uses a confirmation token distinct from every other draft', () => {
    expect(new Set([CONFIRM_TOKEN, DROP_TOKEN, ROLE_TOKEN, HR_TOKEN]).size).toBe(4);
  });

  it('keeps its frozen PII key sets identical to the application sets (drift guard)', () => {
    expect([...ARTIST_METADATA_PII_KEYS].sort()).toEqual([...APP_ARTIST_PII_KEYS].sort());
    expect([...CLIENT_METADATA_PII_KEYS].sort()).toEqual([...APP_CLIENT_PII_KEYS].sort());
  });

  it('refuses without the exact token and never touches the database', async () => {
    const r = runner();
    delete process.env[CONFIRM_ENV];
    await expect(draft.up({ query: r.query } as never)).rejects.toThrow(/gated draft/);
    process.env[CONFIRM_ENV] = DROP_TOKEN;
    await expect(draft.up({ query: r.query } as never)).rejects.toThrow(/gated draft/);
    await expect(draft.down({ query: r.query } as never)).rejects.toThrow(/gated draft/);
    expect(r.query).not.toHaveBeenCalled();
  });

  it('refuses an unset or all-zero ENCRYPTION_KEY before any query, without printing the key', async () => {
    const r = runner({ artistsPending: 1 });
    delete process.env['ENCRYPTION_KEY'];
    await expect(draft.up({ query: r.query } as never)).rejects.toThrow(/ENCRYPTION_KEY/);
    process.env['ENCRYPTION_KEY'] = '0'.repeat(64);
    await expect(draft.up({ query: r.query } as never)).rejects.toThrow(/ENCRYPTION_KEY/);
    process.env['ENCRYPTION_KEY'] = 'short-secret-value';
    const error = await draft.up({ query: r.query } as never).catch((e: Error) => e);
    expect((error as Error).message).not.toContain('short-secret-value');
    expect(r.query).not.toHaveBeenCalled();
  });

  it('requires a BYPASSRLS role and the additive columns, failing before any write', async () => {
    const noBypass = runner({ bypass: false, artistsPending: 1 });
    await expect(draft.up({ query: noBypass.query } as never)).rejects.toThrow();
    expect(writes(noBypass.calls)).toHaveLength(0);
    const noColumns = runner({ artistCols: 3, artistsPending: 1 });
    await expect(draft.up({ query: noColumns.query } as never)).rejects.toThrow(/ciphertext columns missing/);
    expect(writes(noColumns.calls)).toHaveLength(0);
  });

  it('does nothing (no archive, no write) when there is no candidate row', async () => {
    const r = runner();
    await draft.up({ query: r.query } as never);
    expect(writes(r.calls)).toHaveLength(0);
    expect(r.calls.some((c) => c.sql.includes('CREATE TABLE'))).toBe(false);
  });

  it('archives with RLS forced BEFORE any live-row write, then encrypts, nulls plaintext and scrubs metadata', async () => {
    const r = runner({
      artistsPending: 1,
      clientsPending: 1,
      artistRows: [{
        id: 'a1', tenant_id: 't1', ...emptyFields, ...RAW, pix_key_encrypted: 'enc:v1:already-newer',
        metadata: { gender: 'female', rg: 'META-RG', Banco: 'META-BANCO', 'Chave-Pix': 'META-PIX', leadId: 'l1' },
      }],
      clientRows: [{
        id: 'c1', tenant_id: 't1', cpf_cnpj_encrypted: null,
        metadata: { origem: 'evento', cpf: '111.222.333-44', Telefone: '1199', razao_social: 'Keep Form Key' },
      }],
    });
    await draft.up({ query: r.query } as never);

    const sqls = r.calls.map((c) => c.sql);
    const firstLiveWrite = sqls.findIndex((s) => /^\s*UPDATE "(artists|clients)"/.test(s));
    const archiveInsert = sqls.findIndex((s) => s.includes(`INSERT INTO "${ARTISTS_ARCHIVE}"`));
    expect(archiveInsert).toBeGreaterThan(-1);
    expect(archiveInsert).toBeLessThan(firstLiveWrite);
    for (const archive of [ARTISTS_ARCHIVE, CLIENTS_ARCHIVE]) {
      expect(sqls).toContain(`ALTER TABLE "${archive}" ENABLE ROW LEVEL SECURITY`);
      expect(sqls).toContain(`ALTER TABLE "${archive}" FORCE ROW LEVEL SECURITY`);
      expect(sqls).toContain(`REVOKE ALL ON TABLE "${archive}" FROM PUBLIC`);
    }

    const [artistUpdate] = updatesOf(r.calls, 'artists');
    expect(artistUpdate.sql).toContain('"id" = $');
    expect(artistUpdate.sql).toContain('"tenant_id" = $');
    expect(artistUpdate.sql).not.toContain('updated_at');
    for (const field of ['rg', 'bank_account', 'birth_date']) {
      expect(artistUpdate.sql).toContain(`"${field}_encrypted" = $`);
      expect(artistUpdate.sql).toContain(`"${field}" = NULL`);
    }
    // existing ciphertext is newer truth: never overwritten, plaintext still nulled
    expect(artistUpdate.sql).not.toContain('"pix_key_encrypted" = $');
    expect(artistUpdate.sql).toContain('"pix_key" = NULL');
    const encrypted = artistUpdate.params.filter((p) => typeof p === 'string' && p.startsWith('enc:v1:')) as string[];
    expect(encrypted.map((c) => encryption.decrypt(c)).sort()).toEqual([RAW.bank_account, RAW.birth_date, RAW.rg].sort());
    const metadataParam = artistUpdate.params.find((p) => typeof p === 'string' && p.startsWith('{')) as string;
    expect(JSON.parse(metadataParam)).toEqual({ gender: 'female', leadId: 'l1' });
    const persisted = JSON.stringify(artistUpdate.params);
    for (const secret of [RAW.rg, RAW.bank_account, RAW.birth_date, RAW.pix_key, 'META-RG', 'META-BANCO', 'META-PIX']) {
      expect(persisted).not.toContain(secret);
    }

    const [clientUpdate] = updatesOf(r.calls, 'clients');
    expect(clientUpdate.sql).toContain('"cpf_cnpj_encrypted" = $');
    expect(JSON.parse(clientUpdate.params[0] as string)).toEqual({ origem: 'evento', razao_social: 'Keep Form Key' });
    const promoted = clientUpdate.params.find((p) => typeof p === 'string' && p.startsWith('enc:v1:')) as string;
    expect(encryption.decrypt(promoted)).toBe('111.222.333-44');
    expect(JSON.stringify(clientUpdate.params)).not.toContain('111.222.333-44');
    expect(r.calls.some((c) => c.sql.includes(`UPDATE "${CLIENTS_ARCHIVE}" SET "document_promoted" = true`))).toBe(true);
  });

  it('does not overwrite an existing client document ciphertext when scrubbing metadata', async () => {
    const r = runner({
      clientsPending: 1,
      clientRows: [{ id: 'c1', tenant_id: 't1', cpf_cnpj_encrypted: 'enc:v1:existing', metadata: { cpf: '1' } }],
    });
    await draft.up({ query: r.query } as never);
    const [clientUpdate] = updatesOf(r.calls, 'clients');
    expect(clientUpdate.sql).not.toContain('cpf_cnpj_encrypted');
    expect(JSON.parse(clientUpdate.params[0] as string)).toEqual({});
  });

  it('aborts before rewriting when the archive does not cover the live values (stale archive)', async () => {
    const r = runner({ artistsPending: 1, missingArtists: 1, artistRows: [{ id: 'a1', tenant_id: 't1', ...emptyFields, rg: 'x', metadata: {} }] });
    await expect(draft.up({ query: r.query } as never)).rejects.toThrow(/archive verification failed/);
    expect(updatesOf(r.calls, 'artists')).toHaveLength(0);
  });

  it('rolls back (throws) when residue remains after the rewrite; messages carry counts only', async () => {
    const r = runner({ artistsPending: 1, artistsResidue: 2, artistRows: [{ id: 'a1', tenant_id: 't1', ...emptyFields, rg: 'SECRET-RG', metadata: {} }] });
    const error = await draft.up({ query: r.query } as never).catch((e: Error) => e);
    expect((error as Error).message).toMatch(/residue after rewrite \(artists=2, clients=0\)/);
    expect((error as Error).message).not.toContain('SECRET-RG');
  });

  it('down refuses when an archive table is missing', async () => {
    const r = runner({ archiveExists: false });
    await expect(draft.down({ query: r.query } as never)).rejects.toThrow(/archive table .* is missing/);
    expect(writes(r.calls)).toHaveLength(0);
  });

  it('down restores plaintext and metadata keys, nulls only ciphertext that still equals the archived value', async () => {
    const unchanged = encryption.encrypt('12.345.678-9');
    const edited = encryption.encrypt('EDITED-AFTER-UP');
    const r = runner({
      downArtists: [{
        id: 'a1', tenant_id: 't1', ...emptyFields, rg: '12.345.678-9', bank_name: 'Banco Velho',
        rg_encrypted: unchanged, bank_name_encrypted: edited,
        metadata_pii: { banco: 'META-BANCO' }, live_metadata: { gender: 'male' },
      }],
      downClients: [{
        id: 'c1', tenant_id: 't1', metadata_pii: { cpf: '111' }, live_metadata: { origem: 'x' },
        document_promoted: true, cpf_cnpj_encrypted: encryption.encrypt('111'),
      }],
    });
    await draft.down({ query: r.query } as never);
    const [artistUpdate] = updatesOf(r.calls, 'artists');
    expect(artistUpdate.sql).toContain('"rg" = $');
    expect(artistUpdate.sql).toContain('"rg_encrypted" = NULL');
    expect(artistUpdate.sql).not.toContain('"bank_name" = $');
    expect(artistUpdate.sql).not.toContain('"bank_name_encrypted" = NULL');
    expect(JSON.parse(artistUpdate.params.find((p) => typeof p === 'string' && p.startsWith('{')) as string)).toEqual({ banco: 'META-BANCO', gender: 'male' });
    const [clientUpdate] = updatesOf(r.calls, 'clients');
    expect(clientUpdate.sql).toContain('"cpf_cnpj_encrypted" = NULL');
    expect(JSON.parse(clientUpdate.params[0] as string)).toEqual({ cpf: '111', origem: 'x' });
    expect(r.calls.some((c) => /DROP TABLE/.test(c.sql))).toBe(false);
  });
});

describe('PII backfill helpers', () => {
  it('splitMetadata matches keys case/format-insensitively and keeps the rest', () => {
    const { pii, rest } = splitMetadata({ 'Chave-Pix': 'a', RG: 'b', Data_Nascimento: 'c', keep: 1 }, ARTIST_METADATA_PII_KEYS);
    expect(Object.keys(pii).sort()).toEqual(['Chave-Pix', 'Data_Nascimento', 'RG']);
    expect(rest).toEqual({ keep: 1 });
    expect(splitMetadata(null, ARTIST_METADATA_PII_KEYS)).toEqual({ pii: {}, rest: {} });
  });
  it('documentOf picks the first non-empty document by priority', () => {
    expect(documentOf({ cnpj: '', cpf: ' 1 ', document: '9' })).toBe('1');
    expect(documentOf({ telefone: '1' })).toBeNull();
  });
});
