import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { ALL_ENTITIES, ContractEntity } from '../../database/entities';
import { ArtistRefDto, ClientRefDto, ContractPartyRefsDto, LegacyClientRefDto } from './dto/contract-party-ref.dto';
import { ContractsService } from './contracts.service';
import { toContractResponse } from './contract-party-refs';

/**
 * S1 / D1 (review bc40b76): contract responses embed only whitelisted party
 * projections — never the artist/client metadata (historical plaintext
 * cpf/cnpj), `*_encrypted` ciphertext or any other column.
 *
 * Uses the REAL TypeORM metadata, SQL builder and raw-result hydration; only the
 * wire to Postgres is replaced by a fake query runner that records the SQL and
 * returns raw rows. The fake rows deliberately carry extra artist/client
 * columns (as if an over-wide select slipped in) to prove the response
 * projection is field-by-field, not a pass-through.
 */

const TENANT = '11111111-1111-4111-8111-111111111111';
const CONTRACT = '22222222-2222-4222-8222-222222222222';
const ARTIST = '33333333-3333-4333-8333-333333333333';
const CLIENT = '44444444-4444-4444-8444-444444444444';

const SENSITIVE_TOKENS = ['metadata_secret', 'CIPHERTEXT', '123.456.789-00', '12.345.678/0001-90'];

function contractRaw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    c_id: CONTRACT, c_tenant_id: TENANT, c_title: 'Contrato A', c_type: 'gravacao', c_status: 'draft',
    c_artist_id: ARTIST, c_client_id: CLIENT, c_metadata: {}, c_versions: [], c_documents: [], c_signers: [],
    artist_ref_id: ARTIST, artist_ref_stage_name: 'MC Teste',
    // Over-wide columns that must never reach the wire:
    artist_ref_metadata: { cpf: '123.456.789-00', note: 'metadata_secret' },
    artist_ref_email_encrypted: 'CIPHERTEXT', artist_ref_cpf_cnpj_encrypted: 'CIPHERTEXT',
    client_ref_id: CLIENT, client_ref_name: 'Cliente Ltda',
    client_ref_metadata: { cnpj: '12.345.678/0001-90', note: 'metadata_secret' },
    client_ref_cpf_cnpj_encrypted: 'CIPHERTEXT', client_ref_email_encrypted: 'CIPHERTEXT',
    ...overrides,
  };
}

async function makeService(rows: Record<string, unknown>[]) {
  const ds = new DataSource({ type: 'postgres', entities: ALL_ENTITIES });
  await (ds as unknown as { buildMetadatas(): Promise<void> }).buildMetadatas();
  const sqls: string[] = [];
  const params: unknown[][] = [];
  (ds as unknown as { createQueryRunner: () => unknown }).createQueryRunner = () => ({
    query: async (sql: string, p: unknown[]) => {
      sqls.push(sql);
      params.push(p);
      if (sql.includes('COUNT(DISTINCT')) return { records: [{ cnt: String(rows.length) }] };
      if (sql.includes('"distinctAlias"')) return { records: rows.map((r) => ({ ids_c_id: r['c_id'] })) };
      return { records: rows };
    },
    release: async () => undefined,
    isReleased: false,
    isTransactionActive: false,
    // Entity-load subscribers hook (no subscribers registered here).
    broadcaster: { broadcast: async () => undefined },
    data: {},
  });
  const svc = new ContractsService(
    ds,
    { getAllowedTransitions: jest.fn(() => []) } as never,
    { emitTyped: jest.fn() } as never,
    {} as never,
  );
  return { svc, sqls, params };
}

function expectNoSensitive(body: unknown) {
  const json = JSON.stringify(body);
  for (const token of SENSITIVE_TOKENS) expect(json).not.toContain(token);
  expect(json).not.toMatch(/_encrypted/);
}

describe('Contract party embeds are minimal projections (S1/D1)', () => {
  it('SQL selects only id/stage_name of the artist and id/name of the client, tenant-scoped', async () => {
    const { svc, sqls } = await makeService([contractRaw()]);
    await svc.findById(TENANT, CONTRACT);
    const sql = sqls[0];
    expect(sql).toContain('"artist_ref"."id"');
    expect(sql).toContain('"artist_ref"."stage_name"');
    expect(sql).toContain('"client_ref"."id"');
    expect(sql).toContain('"client_ref"."name"');
    expect(sql).not.toMatch(/"artist_ref"\."(metadata|\w*_encrypted|email|phone)"/);
    expect(sql).not.toMatch(/"client_ref"\."(metadata|\w*_encrypted|email|phone|cpf\w*)"/);
    // Cross-tenant isolation of the join is unchanged.
    expect(sql).toContain('"artist_ref"."tenant_id" = "c"."tenant_id"');
    expect(sql).toContain('"client_ref"."tenant_id" = "c"."tenant_id"');
    expect(sql).toContain('"artist_ref"."deleted_at" IS NULL');
    expect(sql).toContain('"client_ref"."deleted_at" IS NULL');
    expect(sql).toMatch(/"c"\."tenant_id" = \$\d/);
  });

  it('findById returns artist/client + deprecated artistas/clientes with the exact minimal shape', async () => {
    const { svc } = await makeService([contractRaw()]);
    const res = await svc.findById(TENANT, CONTRACT) as unknown as Record<string, unknown>;
    expect(res['artist']).toEqual({ id: ARTIST, stage_name: 'MC Teste' });
    expect(res['client']).toEqual({ id: CLIENT, name: 'Cliente Ltda' });
    expect(res['artistas']).toEqual({ id: ARTIST, stage_name: 'MC Teste' });
    expect(res['clientes']).toEqual({ id: CLIENT, name: 'Cliente Ltda', nome: 'Cliente Ltda' });
    expect(res).not.toHaveProperty('artist_ref');
    expect(res).not.toHaveProperty('client_ref');
    expectNoSensitive(res);
  });

  it('list returns the same minimal projections for every row', async () => {
    const { svc } = await makeService([contractRaw()]);
    const res = await svc.list(TENANT, {} as never);
    expect(res.meta.total).toBe(1);
    expect(res.data).toHaveLength(1);
    const row = res.data[0] as unknown as Record<string, unknown>;
    expect(row['artist']).toEqual({ id: ARTIST, stage_name: 'MC Teste' });
    expect(row['clientes']).toEqual({ id: CLIENT, name: 'Cliente Ltda', nome: 'Cliente Ltda' });
    expectNoSensitive(res);
  });

  it('unlinked / other-tenant / deleted party (join yields NULLs) → null embeds, never a partial object', async () => {
    const { svc } = await makeService([contractRaw({
      artist_ref_id: null, artist_ref_stage_name: null, artist_ref_metadata: null,
      artist_ref_email_encrypted: null, artist_ref_cpf_cnpj_encrypted: null,
      client_ref_id: null, client_ref_name: null, client_ref_metadata: null,
      client_ref_cpf_cnpj_encrypted: null, client_ref_email_encrypted: null,
    })]);
    const res = await svc.findById(TENANT, CONTRACT) as unknown as Record<string, unknown>;
    expect(res['artist']).toBeNull();
    expect(res['client']).toBeNull();
    expect(res['artistas']).toBeNull();
    expect(res['clientes']).toBeNull();
    // The FK ids stay so the web can resolve / show the PT-BR "not found" fallback.
    expect(res['artist_id']).toBe(ARTIST);
    expect(res['client_id']).toBe(CLIENT);
  });

  it('a contract of another tenant is still 404 (WHERE bound to the caller tenant)', async () => {
    const { svc, params } = await makeService([]);
    await expect(svc.findById('99999999-9999-4999-8999-999999999999', CONTRACT)).rejects.toThrow('Contrato não encontrado');
    expect(params[0]).toEqual(expect.arrayContaining(['99999999-9999-4999-8999-999999999999', CONTRACT]));
  });
});

describe('toContractResponse — field-by-field projection (defense in depth)', () => {
  it('drops every non-whitelisted column even if an over-wide row is hydrated', () => {
    const overWide = {
      id: CONTRACT, tenant_id: TENANT, title: 'Contrato A', artist_id: ARTIST, client_id: CLIENT,
      artist: { id: ARTIST, metadata: { note: 'metadata_secret' } },
      artist_ref: { id: ARTIST, stage_name: 'MC Teste', metadata: { cpf: '123.456.789-00' }, email_encrypted: 'CIPHERTEXT' },
      client_ref: { id: CLIENT, name: 'Cliente Ltda', metadata: { cnpj: '12.345.678/0001-90' }, cpf_cnpj_encrypted: 'CIPHERTEXT' },
    } as unknown as ContractEntity;
    const res = toContractResponse(overWide) as unknown as Record<string, unknown>;
    expect(res['artist']).toEqual({ id: ARTIST, stage_name: 'MC Teste' });
    expect(res['client']).toEqual({ id: CLIENT, name: 'Cliente Ltda' });
    expect(res['artistas']).toEqual({ id: ARTIST, stage_name: 'MC Teste' });
    expect(res['clientes']).toEqual({ id: CLIENT, name: 'Cliente Ltda', nome: 'Cliente Ltda' });
    expectNoSensitive(res);
  });

  it('a party row without a string id is treated as absent (null), never a partial object', () => {
    const res = toContractResponse({ id: CONTRACT, artist_ref: { stage_name: 'X' }, client_ref: {} } as unknown as ContractEntity);
    expect(res.artist).toBeNull();
    expect(res.client).toBeNull();
  });

  it('the documented ContractPartyRefsDto keys are exactly the party embeds the response serializes (canonical + deprecated)', async () => {
    const { svc } = await makeService([contractRaw()]);
    const res = await svc.findById(TENANT, CONTRACT) as unknown as Record<string, unknown>;
    // Read the keys from the Swagger metadata of the documented DTOs so a DTO/serializer drift fails at runtime.
    const documentedKeys = (cls: { prototype: object }): string[] =>
      ((Reflect.getMetadata('swagger/apiModelPropertiesArray', cls.prototype) ?? []) as string[])
        .map((k) => k.replace(/^:/, ''))
        .sort();
    expect(documentedKeys(ContractPartyRefsDto)).toEqual(['artist', 'artistas', 'client', 'clientes']);
    for (const key of documentedKeys(ContractPartyRefsDto)) expect(res).toHaveProperty(key);
    expect(Object.keys(res['artist'] as object).sort()).toEqual(documentedKeys(ArtistRefDto));
    expect(Object.keys(res['artistas'] as object).sort()).toEqual(documentedKeys(ArtistRefDto));
    expect(Object.keys(res['client'] as object).sort()).toEqual(documentedKeys(ClientRefDto));
    expect(Object.keys(res['clientes'] as object).sort()).toEqual(documentedKeys(LegacyClientRefDto));
    expect(documentedKeys(LegacyClientRefDto)).toEqual(['id', 'name', 'nome']);
  });
});
