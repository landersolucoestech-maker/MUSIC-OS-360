/**
 * contracts.service.spec.ts
 *
 * Covers exclusively the C1 prerequisite (unrelated to EN/PT aliases):
 * persistence of template_id/signers (columns from migration
 * 20260712000004, already committed) and the default `type = 'other'` when
 * the wizard creates a contract without a defined service type. No test
 * here covers alias resolution — that belongs to the C1 commit proper.
 */
import 'reflect-metadata';
import { ContractsService } from './contracts.service';
import type { CreateContractDto } from './dto/create-contract.dto';

function makeRepo() {
  return {
    create: jest.fn((data: unknown) => ({ ...(data as object) })),
    save: jest.fn(async (entity: unknown) => ({ id: 'contract-new', ...(entity as object) })),
  };
}

function makeService(repo = makeRepo(), queryImpl = jest.fn(async () => [{ exists: 1 }])) {
  // query() backs assertSameTenantFk's cross-tenant FK ownership check — a
  // truthy row by default means "found, same tenant", so these pre-existing
  // create() tests (which aren't about that check) keep passing unchanged.
  const ds = { getRepository: jest.fn(() => repo), query: queryImpl } as never;
  const workflowService = {} as never;
  const events = { emitTyped: jest.fn() } as never;
  const planLimit = { enforce: jest.fn(async () => undefined) } as never;
  const svc = new ContractsService(ds, workflowService, events, planLimit);
  return { svc, repo };
}

function created(repo: ReturnType<typeof makeRepo>) {
  return (repo.create as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
}

describe('ContractsService.create — template_id/signers/type default (C1 prerequisite)', () => {
  it('persists template_id when sent', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', 'user-1', {
      title: 'Contrato X', type: 'gravacao', template_id: '11111111-1111-4111-8111-111111111111',
    } as unknown as CreateContractDto);

    expect(created(repo)['template_id']).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('persists signers when sent as an array', async () => {
    const { svc, repo } = makeService();
    const signers = [{ name: 'Fulano', email: 'fulano@example.com', role: 'artista' }];
    await svc.create('tenant-1', 'user-1', {
      title: 'Contrato X', type: 'gravacao', signers,
    } as unknown as CreateContractDto);

    expect(created(repo)['signers']).toEqual(signers);
  });

  it('does not persist signers when it is not an array', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', 'user-1', {
      title: 'Contrato X', type: 'gravacao', signers: 'not-an-array' as unknown as unknown[],
    } as unknown as CreateContractDto);

    expect(created(repo)['signers']).toBeUndefined();
  });

  it('REM-02: persists documents (real R2 attachments) when sent', async () => {
    const { svc, repo } = makeService();
    const documents = [{ name: 'contrato.pdf', size: 1234, type: 'application/pdf', path: 'https://r2/x.pdf', url: 'https://r2/x.pdf' }];
    await svc.create('tenant-1', 'user-1', {
      title: 'Contrato X', type: 'gravacao', documents,
    } as unknown as CreateContractDto);

    expect(created(repo)['documents']).toEqual(documents);
  });

  it('REM-02: missing documents persists as an empty array (same pattern as versions)', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', 'user-1', {
      title: 'Contrato X', type: 'gravacao',
    } as unknown as CreateContractDto);

    expect(created(repo)['documents']).toEqual([]);
  });

  it('applies type="other" when neither type nor tipo is sent (wizard flow without a template)', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', 'user-1', {
      title: 'Contrato sem tipo definido',
    } as unknown as CreateContractDto);

    expect(created(repo)['type']).toBe('other');
  });

  it('keeps the sent type when present (default not applied)', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', 'user-1', {
      title: 'Contrato X', type: 'gravacao',
    } as unknown as CreateContractDto);

    expect(created(repo)['type']).toBe('recording');
  });

  it('absent template_id is not persisted (final filter drops null/undefined)', async () => {
    const { svc, repo } = makeService();
    await svc.create('tenant-1', 'user-1', {
      title: 'Contrato X', type: 'gravacao',
    } as unknown as CreateContractDto);

    expect(created(repo)['template_id']).toBeUndefined();
  });
});

// ── Phase 5 / C1: alias consolidation (new tests; own helpers,
//    they do not reuse makeRepo/makeService above so the prerequisite is not altered) ──

import { NotFoundException, BadRequestException } from '@nestjs/common';
import type { UpdateContractDto } from './dto/update-contract.dto';
import type { QueryContractDto } from './dto/query-contract.dto';
import { Logger } from '@nestjs/common';

function makeQb(rows: Record<string, unknown>[]) {
  const qb: Record<string, jest.Mock> = {};
  const chain = () => qb;
  qb['leftJoinAndMapOne'] = jest.fn(chain);
  qb['select'] = jest.fn(chain);
  qb['where'] = jest.fn(chain);
  qb['andWhere'] = jest.fn(chain);
  qb['orderBy'] = jest.fn(chain);
  qb['skip'] = jest.fn(chain);
  qb['take'] = jest.fn(chain);
  qb['getOne'] = jest.fn(async () => rows[0] ?? null);
  qb['getManyAndCount'] = jest.fn(async () => [rows, rows.length]);
  return qb;
}

function makeRepoC1(findRows: Record<string, unknown>[] = []) {
  const qb = makeQb(findRows);
  return {
    create: jest.fn((data: unknown) => ({ ...(data as object) })),
    save: jest.fn(async (entity: unknown) => ({ id: 'contract-new', ...(entity as object) })),
    update: jest.fn(async () => ({ affected: 1 })),
    createQueryBuilder: jest.fn(() => qb),
    _qb: qb,
  };
}

function makeServiceC1(
  findRows: Record<string, unknown>[] = [],
  queryImpl = jest.fn(async () => [{ exists: 1 }]),
) {
  const repo = makeRepoC1(findRows);
  const ds = { getRepository: jest.fn(() => repo), query: queryImpl } as never;
  const workflowService = { getAllowedTransitions: jest.fn(() => []) } as never;
  const events = { emitTyped: jest.fn() } as never;
  const planLimit = { enforce: jest.fn(async () => undefined) } as never;
  const svc = new ContractsService(ds, workflowService, events, planLimit);
  return { svc, repo };
}

function createdC1(repo: ReturnType<typeof makeRepoC1>) {
  return (repo.create as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
}

function updatedC1(repo: ReturnType<typeof makeRepoC1>) {
  return (repo.update as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
}

const baseContractRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'contract-1',
  tenant_id: 'tenant-1',
  title: 'Contrato existente',
  type: 'gravacao',
  status: 'draft',
  artist_id: null,
  client_id: null,
  fixed_value: null,
  start_date: null,
  end_date: null,
  file_url: null,
  metadata: {},
  ...overrides,
});

describe('ContractsService.create — alias consolidation (Phase 5 / C1)', () => {
  it('a canonical PT payload persists only canonical keys', async () => {
    const { svc, repo } = makeServiceC1();
    await svc.create('tenant-1', 'user-1', {
      title: 'Contrato X', type: 'gravacao', artist_id: '11111111-1111-4111-8111-111111111111',
      start_date: '2026-01-01T00:00:00.000Z', file_url: 'https://a.com/x.pdf', valor: 10,
    } as unknown as CreateContractDto);

    const row = createdC1(repo);
    expect(row['title']).toBe('Contrato X');
    expect(row['type']).toBe('recording');
    expect(row['artist_id']).toBe('11111111-1111-4111-8111-111111111111');
    expect(row['fixed_value']).toBe('10');
    expect(row['titulo']).toBeUndefined();
    expect(row['tipo']).toBeUndefined();
    expect(row['artistId']).toBeUndefined();
    expect(row['value']).toBeUndefined();
  });

  it('payload with legacy PT aliases (titulo/tipo) + EN alias (value) is translated to the canonical columns', async () => {
    const { svc, repo } = makeServiceC1();
    await svc.create('tenant-1', 'user-1', {
      titulo: 'Contrato PT legado', tipo: 'recording', value: '10',
    } as unknown as CreateContractDto);

    const row = createdC1(repo);
    expect(row['title']).toBe('Contrato PT legado');
    expect(row['type']).toBe('recording');
    expect(row['fixed_value']).toBe('10');
    expect(row['titulo']).toBeUndefined();
    expect(row['tipo']).toBeUndefined();
    expect(row['value']).toBeUndefined();
  });

  it('alias use emits exactly one warning per alias', async () => {
    const { svc } = makeServiceC1();
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await svc.create('tenant-1', 'user-1', {
      titulo: 'Contrato PT legado', tipo: 'recording',
    } as unknown as CreateContractDto);

    const messages = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(messages.filter((m) => m.includes('alias=titulo'))).toHaveLength(1);
    expect(messages.filter((m) => m.includes('alias=tipo'))).toHaveLength(1);
    expect(messages.some((m) => m.includes('operation=create'))).toBe(true);
    expect(messages.some((m) => m.includes('tenantId=tenant-1'))).toBe(true);
    warnSpy.mockRestore();
  });

  it('a PT/EN conflict is rejected before calling the repository', async () => {
    const { svc, repo } = makeServiceC1();
    await expect(svc.create('tenant-1', 'user-1', {
      title: 'A', titulo: 'B',
    } as unknown as CreateContractDto)).rejects.toMatchObject({ response: { code: 'CONTRACT_ALIAS_CONFLICT' } });
    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('absent title (neither title nor titulo) is rejected before the repository', async () => {
    const { svc, repo } = makeServiceC1();
    await expect(svc.create('tenant-1', 'user-1', {
      type: 'gravacao',
    } as unknown as CreateContractDto)).rejects.toMatchObject({ response: { code: 'CONTRACT_TITLE_REQUIRED' } });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('a null/empty/whitespace title is rejected before the repository', async () => {
    const { svc, repo } = makeServiceC1();
    await expect(svc.create('tenant-1', 'user-1', { title: null } as unknown as CreateContractDto))
      .rejects.toMatchObject({ response: { code: 'CONTRACT_TITLE_INVALID' } });
    await expect(svc.create('tenant-1', 'user-1', { title: '' } as unknown as CreateContractDto))
      .rejects.toMatchObject({ response: { code: 'CONTRACT_TITLE_INVALID' } });
    await expect(svc.create('tenant-1', 'user-1', { title: '   ' } as unknown as CreateContractDto))
      .rejects.toMatchObject({ response: { code: 'CONTRACT_TITLE_INVALID' } });
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('absent type applies the "other" default (covered by the prerequisite; reconfirmed after resolver integration)', async () => {
    const { svc, repo } = makeServiceC1();
    await svc.create('tenant-1', 'user-1', { title: 'X' } as unknown as CreateContractDto);
    expect(createdC1(repo)['type']).toBe('other');
  });

  it('a zero value is preserved (not treated as absent)', async () => {
    const { svc, repo } = makeServiceC1();
    await svc.create('tenant-1', 'user-1', { title: 'X', valor: 0 } as unknown as CreateContractDto);
    expect(createdC1(repo)['fixed_value']).toBe('0');
  });

  it('metadata/currency/signedAt/parties keep their behavior unchanged (outside C1 scope)', async () => {
    const { svc, repo } = makeServiceC1();
    await svc.create('tenant-1', 'user-1', {
      title: 'X', currency: 'USD', signedAt: '2026-01-01T00:00:00.000Z', parties: [{ nome: 'A' }],
    } as unknown as CreateContractDto);

    const row = createdC1(repo);
    expect((row['metadata'] as Record<string, unknown>)['currency']).toBe('USD');
    expect((row['metadata'] as Record<string, unknown>)['signed_at']).toBe('2026-01-01T00:00:00.000Z');
    expect((row['metadata'] as Record<string, unknown>)['parties']).toEqual([{ nome: 'A' }]);
  });
});

describe('ContractsService.update — alias consolidation (Phase 5 / C1)', () => {
  it('partial PATCH (a single non-alias field) is preserved', async () => {
    const { svc, repo } = makeServiceC1([baseContractRow()]);
    await svc.update('tenant-1', 'user-1', 'contract-1', { notes: 'nova nota' } as unknown as UpdateContractDto);

    const row = updatedC1(repo);
    expect(row['notes']).toBe('nova nota');
    expect(row['title']).toBeUndefined();
  });

  it('an isolated null on an optional field does not change the column (current behavior preserved)', async () => {
    const { svc, repo } = makeServiceC1([baseContractRow()]);
    await svc.update('tenant-1', 'user-1', 'contract-1', { file_url: null } as unknown as UpdateContractDto);

    const row = updatedC1(repo);
    expect(row['file_url']).toBeUndefined();
  });

  it('an isolated legacy alias is translated', async () => {
    const { svc, repo } = makeServiceC1([baseContractRow()]);
    await svc.update('tenant-1', 'user-1', 'contract-1', { fileUrl: 'https://a.com/x.pdf' } as unknown as UpdateContractDto);

    const row = updatedC1(repo);
    expect(row['file_url']).toBe('https://a.com/x.pdf');
    expect(row['fileUrl']).toBeUndefined();
  });

  it('pre-canonical web payload (arquivo_url, exclusivo, versoes with PT keys) is persisted canonically (CZ-026)', async () => {
    const { svc, repo } = makeServiceC1([baseContractRow()]);
    await svc.update('tenant-1', 'user-1', 'contract-1', {
      arquivo_url: 'https://a.com/x.pdf', exclusivo: true,
      versoes: [{ versao: 'v1', url: 'https://a.com/x.pdf', criado_em: '2026-01-01', notas: 'n', autor: 'a' }],
    } as unknown as UpdateContractDto);

    const row = updatedC1(repo);
    expect(row['file_url']).toBe('https://a.com/x.pdf');
    expect(row['exclusive']).toBe(true);
    expect(row['versions']).toEqual([{ version: 'v1', url: 'https://a.com/x.pdf', created_at: '2026-01-01', notes: 'n', author: 'a' }]);
    for (const legacy of ['arquivo_url', 'exclusivo', 'versoes']) expect(row).not.toHaveProperty(legacy);
  });

  it('alias use on update emits a warning with operation=update and contractId', async () => {
    const { svc } = makeServiceC1([baseContractRow()]);
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await svc.update('tenant-1', 'user-1', 'contract-1', { fileUrl: 'https://a.com/x.pdf' } as unknown as UpdateContractDto);

    const messages = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(messages.some((m) => m.includes('alias=fileUrl') && m.includes('operation=update') && m.includes('contractId=contract-1'))).toBe(true);
    warnSpy.mockRestore();
  });

  it('a PT/EN conflict on update is rejected before calling the repository', async () => {
    const { svc, repo } = makeServiceC1([baseContractRow()]);
    await expect(svc.update('tenant-1', 'user-1', 'contract-1', {
      file_url: 'https://a.com/1.pdf', fileUrl: 'https://a.com/2.pdf',
    } as unknown as UpdateContractDto)).rejects.toMatchObject({ response: { code: 'CONTRACT_ALIAS_CONFLICT' } });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('an invalid (empty) title on update is rejected', async () => {
    const { svc, repo } = makeServiceC1([baseContractRow()]);
    await expect(svc.update('tenant-1', 'user-1', 'contract-1', { title: '' } as unknown as UpdateContractDto))
      .rejects.toMatchObject({ response: { code: 'CONTRACT_TITLE_INVALID' } });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('update without a sent type does NOT apply the "other" default', async () => {
    const { svc, repo } = makeServiceC1([baseContractRow()]);
    await svc.update('tenant-1', 'user-1', 'contract-1', { notes: 'x' } as unknown as UpdateContractDto);

    expect(updatedC1(repo)['type']).toBeUndefined();
  });

  it('the repository is not called when validation fails', async () => {
    const { svc, repo } = makeServiceC1([baseContractRow()]);
    await expect(svc.update('tenant-1', 'user-1', 'contract-1', { title: null } as unknown as UpdateContractDto)).rejects.toThrow();
    expect(repo.update).not.toHaveBeenCalled();
  });
});

describe('ContractsService.list — canonical and legacy filters (Phase 5 / C1)', () => {
  it('filters by canonical type', async () => {
    const { svc, repo } = makeServiceC1([baseContractRow()]);
    await svc.list('tenant-1', { type: 'gravacao' } as unknown as QueryContractDto);
    expect(repo._qb['andWhere']).toHaveBeenCalledWith('c.type IN (:...types)', { types: ['recording', 'gravacao'] });
  });

  it('matches both spellings of a platform-owned category slug (canonical query)', async () => {
    const { svc, repo } = makeServiceC1([baseContractRow()]);
    await svc.list('tenant-1', { type: 'recording' } as unknown as QueryContractDto);
    expect(repo._qb['andWhere']).toHaveBeenCalledWith('c.type IN (:...types)', { types: ['recording', 'gravacao'] });
  });

  it('matches both spellings of the registry seeds shared with tenant service types (R3-04)', async () => {
    const { svc, repo } = makeServiceC1([baseContractRow()]);
    await svc.list('tenant-1', { type: 'distribuicao' } as unknown as QueryContractDto);
    expect(repo._qb['andWhere']).toHaveBeenCalledWith('c.type IN (:...types)', { types: ['distribution', 'distribuicao'] });
  });

  it('keeps the exact match for tenant-created slugs', async () => {
    const { svc, repo } = makeServiceC1([baseContractRow()]);
    await svc.list('tenant-1', { type: 'agenciamento' } as unknown as QueryContractDto);
    expect(repo._qb['andWhere']).toHaveBeenCalledWith('c.type = :type', { type: 'agenciamento' });
  });

  it('filters by the legacy tipo (translated to type)', async () => {
    const { svc, repo } = makeServiceC1([baseContractRow()]);
    await svc.list('tenant-1', { tipo: 'gravacao' } as unknown as QueryContractDto);
    expect(repo._qb['andWhere']).toHaveBeenCalledWith('c.type IN (:...types)', { types: ['recording', 'gravacao'] });
  });

  it('equivalent type and tipo are accepted', async () => {
    const { svc, repo } = makeServiceC1([baseContractRow()]);
    await svc.list('tenant-1', { type: 'gravacao', tipo: 'gravacao' } as unknown as QueryContractDto);
    expect(repo._qb['andWhere']).toHaveBeenCalledWith('c.type IN (:...types)', { types: ['recording', 'gravacao'] });
  });

  it('conflicting type and tipo are rejected before building the query', async () => {
    const { svc, repo } = makeServiceC1([baseContractRow()]);
    await expect(svc.list('tenant-1', { type: 'gravacao', tipo: 'edicao' } as unknown as QueryContractDto))
      .rejects.toMatchObject({ response: { code: 'CONTRACT_ALIAS_CONFLICT' } });
    expect(repo._qb['getManyAndCount']).not.toHaveBeenCalled();
  });

  it('filters by canonical artist_id', async () => {
    const uuid = '11111111-1111-4111-8111-111111111111';
    const { svc, repo } = makeServiceC1([baseContractRow()]);
    await svc.list('tenant-1', { artist_id: uuid } as unknown as QueryContractDto);
    expect(repo._qb['andWhere']).toHaveBeenCalledWith('c.artist_id = :artistId', { artistId: uuid });
  });

  it('filters by the legacy artistId', async () => {
    const uuid = '11111111-1111-4111-8111-111111111111';
    const { svc, repo } = makeServiceC1([baseContractRow()]);
    await svc.list('tenant-1', { artistId: uuid } as unknown as QueryContractDto);
    expect(repo._qb['andWhere']).toHaveBeenCalledWith('c.artist_id = :artistId', { artistId: uuid });
  });

  it('conflicting artist_id and artistId are rejected', async () => {
    const { svc } = makeServiceC1([baseContractRow()]);
    await expect(svc.list('tenant-1', {
      artist_id: '11111111-1111-4111-8111-111111111111', artistId: '22222222-2222-4222-8222-222222222222',
    } as unknown as QueryContractDto)).rejects.toMatchObject({ response: { code: 'CONTRACT_ALIAS_CONFLICT' } });
  });

  it('the query builder never receives the legacy names as parameters', async () => {
    const { svc, repo } = makeServiceC1([baseContractRow()]);
    await svc.list('tenant-1', { tipo: 'gravacao' } as unknown as QueryContractDto);
    const calls = (repo._qb['andWhere'] as jest.Mock).mock.calls;
    expect(calls.some(([sql]) => String(sql).includes('tipo'))).toBe(false);
    expect(calls.some(([, params]) => params && 'tipo' in params)).toBe(false);
  });

  it('emits a warning when a legacy filter is used', async () => {
    const { svc } = makeServiceC1([baseContractRow()]);
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await svc.list('tenant-1', { tipo: 'gravacao' } as unknown as QueryContractDto);
    expect(warnSpy.mock.calls.some((c) => String(c[0]).includes('alias=tipo') && String(c[0]).includes('operation=list'))).toBe(true);
    warnSpy.mockRestore();
  });

  it('absent type/artist_id adds no filter', async () => {
    const { svc, repo } = makeServiceC1([baseContractRow()]);
    await svc.list('tenant-1', {} as unknown as QueryContractDto);
    const calls = (repo._qb['andWhere'] as jest.Mock).mock.calls;
    expect(calls.some(([sql]) => String(sql).includes('c.type'))).toBe(false);
    expect(calls.some(([sql]) => String(sql).includes('c.artist_id'))).toBe(false);
  });
});

describe('ContractsService.findById — unaffected by C1 (regression)', () => {
  it('still throws NotFoundException when the contract does not exist', async () => {
    const { svc } = makeServiceC1([]);
    await expect(svc.findById('tenant-1', 'missing-contract')).rejects.toThrow(NotFoundException);
  });
});

describe('ContractsService.create — FK cross-tenant (P1)', () => {
  it('rejects an artist_id that does not belong to the tenant (or does not exist)', async () => {
    const { svc } = makeServiceC1([], jest.fn(async () => []));
    await expect(svc.create('tenant-1', 'user-1', {
      title: 'X', type: 'gravacao', artist_id: '11111111-1111-4111-8111-111111111111',
    } as unknown as CreateContractDto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a client_id that does not belong to the tenant (or does not exist)', async () => {
    const { svc } = makeServiceC1([], jest.fn(async () => []));
    await expect(svc.create('tenant-1', 'user-1', {
      title: 'X', type: 'gravacao', client_id: '22222222-2222-4222-8222-222222222222',
    } as unknown as CreateContractDto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows when both belong to the tenant', async () => {
    const { svc } = makeServiceC1([], jest.fn(async () => [{ exists: 1 }]));
    await expect(svc.create('tenant-1', 'user-1', {
      title: 'X', type: 'gravacao',
      artist_id: '11111111-1111-4111-8111-111111111111',
      client_id: '22222222-2222-4222-8222-222222222222',
    } as unknown as CreateContractDto)).resolves.toBeDefined();
  });
});

describe('ContractsService — provider signature linkage is server-owned', () => {
  it('create ignores client autentique_doc_id and metadata provider* keys (cannot claim another tenant\'s signature)', async () => {
    const { svc, repo } = makeServiceC1();
    await svc.create('tenant-1', 'user-1', {
      title: 'X',
      autentique_doc_id: 'doc-of-another-tenant',
      signing_platform: 'docusign',
      metadata: { provider: 'docusign', provider_doc_id: 'env-of-another-tenant', provider_status: 'signed', synced_at: 'x', keep: 1 },
    } as unknown as CreateContractDto);

    const row = createdC1(repo);
    expect(row['autentique_doc_id']).toBeUndefined();
    expect(row['signing_platform']).toBe('docusign'); // user choice in the wizard stays writable
    expect(row['metadata']).toEqual({ keep: 1 });
  });

  it('update that replaces metadata keeps the current provider linkage and drops client-sent provider keys', async () => {
    const current = baseContractRow({
      metadata: { provider: 'docusign', provider_doc_id: 'env-real', provider_status: 'awaiting_signature', synced_at: 't0', currency: 'BRL' },
    });
    const { svc, repo } = makeServiceC1([current]);
    await svc.update('tenant-1', 'user-1', 'contract-1', {
      currency: 'USD',
      metadata: { provider_doc_id: 'env-forged' },
    } as unknown as UpdateContractDto);

    const meta = updatedC1(repo)['metadata'] as Record<string, unknown>;
    expect(meta['provider_doc_id']).toBe('env-real');
    expect(meta['provider']).toBe('docusign');
    expect(meta['provider_status']).toBe('awaiting_signature');
    expect(meta['currency']).toBe('USD');
  });
});

describe('ContractsService — category slug canonicalization (CT1)', () => {
  it('create writes the canonical slug for a platform-owned legacy slug; tenant slugs are untouched', async () => {
    const { svc, repo } = makeServiceC1();
    await svc.create('tenant-1', 'user-1', { title: 'X', type: 'gravacao' } as unknown as CreateContractDto);
    expect(createdC1(repo)['type']).toBe('recording');
    const second = makeServiceC1();
    await second.svc.create('tenant-1', 'user-1', { title: 'X', type: 'empresariamento_360' } as unknown as CreateContractDto);
    expect(createdC1(second.repo)['type']).toBe('empresariamento_360');
  });

  it('update writes the canonical slug', async () => {
    const { svc, repo } = makeServiceC1([baseContractRow()]);
    await svc.update('tenant-1', 'user-1', 'contract-1', { type: 'cessao_direitos' } as unknown as UpdateContractDto);
    expect(updatedC1(repo)['type']).toBe('rights_assignment');
  });

  it('typeFacets counts contracts per persisted type over the whole tenant', async () => {
    const qb: Record<string, jest.Mock> = {};
    for (const m of ['where', 'andWhere', 'select', 'addSelect', 'groupBy']) qb[m] = jest.fn(() => qb);
    qb['getRawMany'] = jest.fn(async () => [{ grp: 'recording', cnt: '2' }, { grp: 'gravacao', cnt: '1' }, { grp: 'custom_x', cnt: '4' }]);
    const repo = { createQueryBuilder: jest.fn(() => qb) };
    const ds = { getRepository: jest.fn(() => repo), query: jest.fn() } as never;
    const svc = new ContractsService(ds, { getAllowedTransitions: jest.fn(() => []) } as never, { emitTyped: jest.fn() } as never, { enforce: jest.fn() } as never);
    const res = await svc.typeFacets('tenant-1');
    expect(res.byGroup).toEqual({ recording: 2, gravacao: 1, custom_x: 4 });
    expect(res.total).toBe(7);
    expect(qb['groupBy']).toHaveBeenCalledWith('c.type');
    expect(qb['where']).toHaveBeenCalledWith('c.tenant_id = :tenantId', { tenantId: 'tenant-1' });
  });
});

describe('ContractsService write payload — canonical name wins over the deprecated spelling (CZ-026)', () => {
  const canonicalVersions = [{ version: 1, date: '2026-01-01', description: 'canonical-entry' }];
  const legacyVersions = [{ version: 9, date: '2025-01-01', description: 'legacy-entry' }];

  it('create(): exclusive and versions of the canonical names win when the deprecated names are sent too', async () => {
    const { svc, repo } = makeServiceC1();
    await svc.create('tenant-1', 'user-1', {
      title: 'Contrato X', type: 'gravacao', exclusive: false, exclusivo: true,
      versions: canonicalVersions, versoes: legacyVersions,
    } as unknown as CreateContractDto);
    const row = createdC1(repo);
    expect(row['exclusive']).toBe(false);
    const serialized = JSON.stringify(row['versions']);
    expect(serialized).toContain('canonical-entry');
    expect(serialized).not.toContain('legacy-entry');
  });

  it('create(): the deprecated names alone still populate the canonical columns', async () => {
    const { svc, repo } = makeServiceC1();
    await svc.create('tenant-1', 'user-1', {
      title: 'Contrato X', type: 'gravacao', exclusivo: true, versoes: legacyVersions,
    } as unknown as CreateContractDto);
    const row = createdC1(repo);
    expect(row['exclusive']).toBe(true);
    expect(JSON.stringify(row['versions'])).toContain('legacy-entry');
  });

  it('update(): the canonical exclusive wins over the deprecated exclusivo; the deprecated one alone is still honored', async () => {
    const both = makeServiceC1([baseContractRow()]);
    await both.svc.update('tenant-1', 'user-1', 'contract-1', { exclusive: false, exclusivo: true } as unknown as UpdateContractDto);
    expect(updatedC1(both.repo)['exclusive']).toBe(false);

    const legacyOnly = makeServiceC1([baseContractRow()]);
    await legacyOnly.svc.update('tenant-1', 'user-1', 'contract-1', { exclusivo: true } as unknown as UpdateContractDto);
    expect(updatedC1(legacyOnly.repo)['exclusive']).toBe(true);
  });
});

describe('ContractsService.create — legacy title alias "titulo" through the real resolver (every branch, legacy in, canonical out)', () => {
  const create = (svc: ContractsService, dto: Record<string, unknown>) =>
    svc.create('tenant-1', 'user-1', dto as unknown as CreateContractDto);
  const aliasWarnings = (spy: jest.SpyInstance) => spy.mock.calls.map((c) => String(c[0])).filter((m) => m.includes('alias=titulo'));
  type Body = { code: string; fields: Array<{ canonical: string; legacy?: string }> };
  /** The 400 body of a rejected create; a create that does NOT reject fails the assertion. */
  const rejectionBody = async (promise: Promise<unknown>): Promise<Body> => {
    const outcome = await promise.then(() => null, (e: unknown) => e);
    expect(outcome).toBeInstanceOf(BadRequestException);
    return (outcome as BadRequestException).getResponse() as Body;
  };

  it('titulo alone resolves (does not throw), is persisted as title and reported as a used legacy alias', async () => {
    const { svc, repo } = makeServiceC1();
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await expect(create(svc, { titulo: 'So legado' })).resolves.toBeDefined();
    expect(createdC1(repo)['title']).toBe('So legado');
    expect(aliasWarnings(warnSpy)).toHaveLength(1);
    warnSpy.mockRestore();
  });

  it('a blank titulo alone is rejected with CONTRACT_TITLE_INVALID naming titulo as the legacy field', async () => {
    const { svc, repo } = makeServiceC1();
    const body = await rejectionBody(create(svc, { titulo: '   ' }));
    expect(body.code).toBe('CONTRACT_TITLE_INVALID');
    expect(body.fields).toEqual([{ canonical: 'title', legacy: 'titulo' }]);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('title and titulo equal: resolves, persists title and still reports titulo as a used legacy alias', async () => {
    const { svc, repo } = makeServiceC1();
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    await expect(create(svc, { title: 'Igual', titulo: ' Igual ' })).resolves.toBeDefined();
    expect(createdC1(repo)['title']).toBe('Igual');
    expect(aliasWarnings(warnSpy)).toHaveLength(1);
    warnSpy.mockRestore();
  });

  it('title valid + blank titulo is rejected naming titulo; blank title + valid titulo is rejected naming title (no legacy)', async () => {
    const { svc, repo } = makeServiceC1();
    const blankLegacy = await rejectionBody(create(svc, { title: 'Ok', titulo: '  ' }));
    expect(blankLegacy.code).toBe('CONTRACT_TITLE_INVALID');
    expect(blankLegacy.fields).toEqual([{ canonical: 'title', legacy: 'titulo' }]);
    const blankCanonical = await rejectionBody(create(svc, { title: '  ', titulo: 'Ok' }));
    expect(blankCanonical.code).toBe('CONTRACT_TITLE_INVALID');
    expect(blankCanonical.fields).toEqual([{ canonical: 'title', legacy: undefined }]);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('title and titulo that differ conflict, and the conflict names titulo as the legacy field', async () => {
    const { svc, repo } = makeServiceC1();
    const body = await rejectionBody(create(svc, { title: 'A', titulo: 'B' }));
    expect(body.code).toBe('CONTRACT_ALIAS_CONFLICT');
    expect(body.fields).toEqual([{ canonical: 'title', legacy: 'titulo' }]);
    expect(repo.create).not.toHaveBeenCalled();
  });
});

// ─── Partial updates and signed-contract immutability ──────────────────────────

function makeServiceWithTransaction(findRows: Record<string, unknown>[]) {
  const repo = makeRepoC1(findRows);
  const em = { getRepository: jest.fn(() => repo) };
  const ds = {
    getRepository: jest.fn(() => repo),
    query: jest.fn(async () => [{ exists: 1 }]),
    transaction: jest.fn(async (fn: (m: unknown) => Promise<unknown>) => fn(em)),
  } as never;
  const workflowService = {
    getAllowedTransitions: jest.fn(() => []),
    transitionInTx: jest.fn(async () => undefined),
  } as never;
  const events = { emitTyped: jest.fn() };
  const planLimit = { enforce: jest.fn(async () => undefined) } as never;
  const svc = new ContractsService(ds, workflowService, events as never, planLimit);
  return { svc, repo, events };
}

describe('ContractsService.update: a partial update never writes a default over a stored field', () => {
  it('a notes-only update does not write exclusive, versions or documents', async () => {
    const { svc, repo } = makeServiceC1([baseContractRow({ exclusive: true, documents: [{ name: 'a.pdf' }], versions: [{ version: 'v1' }] })]);
    await svc.update('tenant-1', 'user-1', 'contract-1', { notes: 'nova nota' } as unknown as UpdateContractDto);

    const row = updatedC1(repo);
    expect(row['notes']).toBe('nova nota');
    expect(row).not.toHaveProperty('exclusive');
    expect(row).not.toHaveProperty('versions');
    expect(row).not.toHaveProperty('documents');
  });

  it('a status-only update does not write exclusive, versions or documents', async () => {
    const { svc, repo } = makeServiceWithTransaction([baseContractRow({ status: 'draft', exclusive: true })]);
    await svc.update('tenant-1', 'user-1', 'contract-1', { status: 'under_review' } as unknown as UpdateContractDto, 'admin');

    const row = updatedC1(repo as unknown as ReturnType<typeof makeRepoC1>);
    expect(row['status']).toBe('under_review');
    expect(row).not.toHaveProperty('exclusive');
    expect(row).not.toHaveProperty('versions');
    expect(row).not.toHaveProperty('documents');
  });

  it('an explicit exclusive=false, empty documents and the deprecated exclusive/versions names are still written', async () => {
    const { svc, repo } = makeServiceC1([baseContractRow({ exclusive: true, documents: [{ name: 'a.pdf' }] })]);
    await svc.update('tenant-1', 'user-1', 'contract-1', { exclusive: false, documents: [] } as unknown as UpdateContractDto);
    expect(updatedC1(repo)['exclusive']).toBe(false);
    expect(updatedC1(repo)['documents']).toEqual([]);

    const legacy = makeServiceC1([baseContractRow()]);
    await legacy.svc.update('tenant-1', 'user-1', 'contract-1', { exclusivo: true } as unknown as UpdateContractDto);
    expect(updatedC1(legacy.repo)['exclusive']).toBe(true);
  });

  it('create keeps its defaults', async () => {
    const { svc, repo } = makeServiceC1();
    await svc.create('tenant-1', 'user-1', { title: 'X' } as unknown as CreateContractDto);
    const row = createdC1(repo);
    expect(row['exclusive']).toBe(false);
    expect(row['versions']).toEqual([]);
    expect(row['documents']).toEqual([]);
  });
});

describe('ContractsService.update: fields a signature attests are immutable once signed', () => {
  const signed = (overrides: Record<string, unknown> = {}) => baseContractRow({
    status: 'signed',
    file_url: 'https://r2/contract.pdf',
    signers: [{ name: 'Ana', email: 'ana@example.com' }],
    template_id: '11111111-1111-4111-8111-111111111111',
    versions: [{ version: 'v1' }],
    ...overrides,
  });

  it.each([
    ['signers', { signers: [{ name: 'Outro', email: 'outro@example.com' }] }],
    ['file_url', { file_url: 'https://r2/other.pdf' }],
    ['template_id', { template_id: '22222222-2222-4222-8222-222222222222' }],
    ['versions', { versions: [{ version: 'v2' }] }],
  ])('rejects a change of %s on a signed contract and writes nothing', async (field, patch) => {
    const { svc, repo } = makeServiceC1([signed()]);
    await expect(svc.update('tenant-1', 'user-1', 'contract-1', patch as unknown as UpdateContractDto))
      .rejects.toMatchObject({ response: { code: 'CONTRACT_SIGNED_IMMUTABLE', fields: expect.arrayContaining([field]) } });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it.each(['signed', 'active', 'in_force', 'expiring', 'expired', 'terminated'])('is enforced in status %s', async (status) => {
    const { svc, repo } = makeServiceC1([signed({ status })]);
    await expect(svc.update('tenant-1', 'user-1', 'contract-1', { file_url: 'https://r2/other.pdf' } as unknown as UpdateContractDto))
      .rejects.toMatchObject({ response: { code: 'CONTRACT_SIGNED_IMMUTABLE' } });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('accepts the same signers with the keys in another order (jsonb hands keys back in its own order)', async () => {
    const { svc, repo } = makeServiceC1([signed({ signers: [{ name: 'Ana', role: 'artist', email: 'ana@example.com', order: 1, provider: 'autentique', required: true }] })]);
    await svc.update('tenant-1', 'user-1', 'contract-1', {
      signers: [{ name: 'Ana', email: 'ana@example.com', role: 'artist', required: true, order: 1, provider: 'autentique' }],
      notes: 'ok',
    } as unknown as UpdateContractDto);
    expect(updatedC1(repo)['notes']).toBe('ok');
  });

  it('still rejects a signer whose value really changed, whatever the key order', async () => {
    const { svc, repo } = makeServiceC1([signed({ signers: [{ name: 'Ana', role: 'artist', email: 'ana@example.com' }] })]);
    await expect(svc.update('tenant-1', 'user-1', 'contract-1', {
      signers: [{ email: 'other@example.com', name: 'Ana', role: 'artist' }],
    } as unknown as UpdateContractDto)).rejects.toMatchObject({ response: { code: 'CONTRACT_SIGNED_IMMUTABLE' } });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('accepts the same values again, so a form that posts the whole contract keeps working', async () => {
    const { svc, repo } = makeServiceC1([signed()]);
    await svc.update('tenant-1', 'user-1', 'contract-1', {
      file_url: 'https://r2/contract.pdf',
      signers: [{ name: 'Ana', email: 'ana@example.com' }],
      notes: 'ok',
    } as unknown as UpdateContractDto);
    expect(updatedC1(repo)['notes']).toBe('ok');
  });

  it('still allows unrelated fields on a signed contract', async () => {
    const { svc, repo } = makeServiceC1([signed()]);
    await svc.update('tenant-1', 'user-1', 'contract-1', { notes: 'updated note' } as unknown as UpdateContractDto);
    expect(updatedC1(repo)['notes']).toBe('updated note');
  });

  it.each(['draft', 'under_review', 'awaiting_signature'])('does not lock a contract in %s', async (status) => {
    const { svc, repo } = makeServiceC1([signed({ status })]);
    await svc.update('tenant-1', 'user-1', 'contract-1', { file_url: 'https://r2/other.pdf' } as unknown as UpdateContractDto);
    expect(updatedC1(repo)['file_url']).toBe('https://r2/other.pdf');
  });
});

describe('ContractsService.update: the signed event states how the signature was registered', () => {
  it('a manual registration emits contract.signed with origin manual_registration', async () => {
    const { svc, events } = makeServiceWithTransaction([baseContractRow({ status: 'awaiting_signature' })]);
    await svc.update('tenant-1', 'user-1', 'contract-1', { status: 'signed' } as unknown as UpdateContractDto, 'admin');

    const signedCall = (events.emitTyped as jest.Mock).mock.calls.find((c) => c[0] === 'contract.signed');
    expect(signedCall).toBeDefined();
    expect((signedCall as unknown[])[1]).toMatchObject({ payload: { contractId: 'contract-1', origin: 'manual_registration' } });
  });
});
