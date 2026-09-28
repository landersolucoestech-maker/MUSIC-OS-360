import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES, type ReleaseEntity } from '../../database/entities';
import { toReleaseResponse } from './release-artist-ref';
import { ReleasesService } from './releases.service';

/**
 * S1 (review bc40b76): release responses embed only `{ id, stage_name }` of the
 * artist — never its metadata or `*_encrypted` ciphertext. Real TypeORM
 * metadata/SQL/hydration; only the Postgres wire is faked (see
 * contract-party-refs.security.spec.ts). Fake raw rows carry over-wide artist
 * columns to prove the projection is field-by-field.
 */

const TENANT = '11111111-1111-4111-8111-111111111111';
const RELEASE = '55555555-5555-4555-8555-555555555555';
const ARTIST = '33333333-3333-4333-8333-333333333333';

function releaseRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    r_id: RELEASE, r_tenant_id: TENANT, r_title: 'Single A', r_type: 'single', r_status: 'draft',
    r_artist_id: ARTIST, r_metadata: {}, r_platforms: [],
    artist_ref_id: ARTIST, artist_ref_stage_name: 'MC Teste',
    artist_ref_metadata: { cpf: '123.456.789-00', note: 'metadata_secret' },
    artist_ref_email_encrypted: 'CIPHERTEXT', artist_ref_cpf_cnpj_encrypted: 'CIPHERTEXT',
    ...overrides,
  };
}

async function makeService(rows: Record<string, unknown>[]) {
  const ds = new DataSource({ type: 'postgres', entities: ALL_ENTITIES });
  await (ds as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();
  const sqls: string[] = [];
  (ds as unknown as { createQueryRunner: () => unknown }).createQueryRunner = () => ({
    query: async (sql: string) => {
      sqls.push(sql);
      if (sql.includes('COUNT(DISTINCT')) return { records: [{ cnt: String(rows.length) }] };
      if (sql.includes('"distinctAlias"')) return { records: rows.map((r) => ({ ids_r_id: r['r_id'] })) };
      return { records: rows };
    },
    release: async () => undefined,
    isReleased: false,
    isTransactionActive: false,
    // Entity-load subscribers hook (no subscribers registered here).
    broadcaster: { broadcast: async () => undefined },
    data: {},
  });
  const svc = new ReleasesService(ds, { getAllowedTransitions: jest.fn(() => []) } as never, { emitTyped: jest.fn() } as never);
  return { svc, sqls };
}

function expectNoSensitive(body: unknown) {
  const json = JSON.stringify(body);
  for (const token of ['metadata_secret', 'CIPHERTEXT', '123.456.789-00']) expect(json).not.toContain(token);
  expect(json).not.toMatch(/_encrypted/);
}

describe('Release artist embed is a minimal projection (S1)', () => {
  it('SQL selects only id/stage_name of the artist and keeps the tenant-scoped join', async () => {
    const { svc, sqls } = await makeService([releaseRaw()]);
    await svc.findById(TENANT, RELEASE);
    const sql = sqls[0];
    expect(sql).toContain('"artist_ref"."id"');
    expect(sql).toContain('"artist_ref"."stage_name"');
    expect(sql).not.toMatch(/"artist_ref"\."(metadata|\w*_encrypted|email|phone)"/);
    expect(sql).toContain('"artist_ref"."tenant_id" = "r"."tenant_id"');
    expect(sql).toContain('"artist_ref"."deleted_at" IS NULL');
  });

  it('findById returns artist + deprecated artistas with exactly {id, stage_name}', async () => {
    const { svc } = await makeService([releaseRaw()]);
    const res = await svc.findById(TENANT, RELEASE) as unknown as Record<string, unknown>;
    expect(res['artist']).toEqual({ id: ARTIST, stage_name: 'MC Teste' });
    expect(res['artistas']).toEqual({ id: ARTIST, stage_name: 'MC Teste' });
    expect(res).not.toHaveProperty('artist_ref');
    expectNoSensitive(res);
  });

  it('list returns the same projection; unmatched artist → null embeds', async () => {
    const { svc } = await makeService([
      releaseRaw(),
      releaseRaw({
        r_id: '66666666-6666-4666-8666-666666666666',
        artist_ref_id: null, artist_ref_stage_name: null, artist_ref_metadata: null,
        artist_ref_email_encrypted: null, artist_ref_cpf_cnpj_encrypted: null,
      }),
    ]);
    const res = await svc.list(TENANT, {} as never);
    expect(res.meta.total).toBe(2);
    const [a, b] = res.data as unknown as Record<string, unknown>[];
    expect(a['artist']).toEqual({ id: ARTIST, stage_name: 'MC Teste' });
    expect(b['artist']).toBeNull();
    expect(b['artistas']).toBeNull();
    expect(b['artist_id']).toBe(ARTIST);
    expectNoSensitive(res);
  });

  it('a release of another tenant is still 404', async () => {
    const { svc } = await makeService([]);
    await expect(svc.findById('99999999-9999-4999-8999-999999999999', RELEASE)).rejects.toThrow('Lançamento não encontrado');
  });
});

describe('toReleaseResponse — field-by-field projection (defense in depth)', () => {
  it('drops every non-whitelisted artist column even if an over-wide row is hydrated', () => {
    const res = toReleaseResponse({
      id: RELEASE, artist_id: ARTIST,
      artist: { id: ARTIST, metadata: { note: 'metadata_secret' } },
      artist_ref: { id: ARTIST, stage_name: 'MC Teste', metadata: { cpf: '123.456.789-00' }, email_encrypted: 'CIPHERTEXT' },
    } as unknown as ReleaseEntity) as unknown as Record<string, unknown>;
    expect(res['artist']).toEqual({ id: ARTIST, stage_name: 'MC Teste' });
    expect(res['artistas']).toEqual({ id: ARTIST, stage_name: 'MC Teste' });
    expectNoSensitive(res);
  });
});
