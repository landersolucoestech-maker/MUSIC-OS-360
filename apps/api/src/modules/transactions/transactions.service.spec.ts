import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { TransactionsService, toTransactionDetails } from './transactions.service';
import { DATA_SOURCE } from '../../database/database.module';
import { TransactionEntity } from '../../database/entities';

/**
 * Task J — continuity phase (concurrent writes / stale lost updates).
 * update()/patch() used to overwrite unconditionally (repo.update without
 * checking version/updated_at) — two users editing the same transaction in
 * parallel silently lost one of the edits. Now, when the
 * caller sends `expectedUpdatedAt`, the UPDATE only applies if `updated_at` in the
 * database is still exactly that value (CAS via an already existing column, no
 * migration); 0 affected rows -> 409, never overwrites silently.
 * Without `expectedUpdatedAt`, the behavior is identical to before
 * (backward compatibility).
 */

const TENANT = 'tenant-test';
const TX_ID  = 'tx-test';
const NOW    = new Date('2026-08-14T12:00:00.000Z');

const mockTx = {
  id: TX_ID,
  tenant_id: TENANT,
  type: 'revenue',
  category: 'other',
  status: 'pending',
  amount: '100',
  metadata: {},
  deleted_at: null,
  updated_at: NOW,
} as unknown as TransactionEntity;

function buildMockDs(updateResult: { affected: number } = { affected: 1 }) {
  const qb: any = {
    where: jest.fn(),
    andWhere: jest.fn(),
    getOne: jest.fn().mockResolvedValue(mockTx),
  };
  qb.where.mockReturnValue(qb);
  qb.andWhere.mockReturnValue(qb);

  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    update: jest.fn().mockResolvedValue(updateResult),
    // assertSameTenantFk's ownership check — a truthy row means "found, same
    // tenant", so tests not focused on that behavior aren't coupled to it.
    manager: { connection: { query: jest.fn().mockResolvedValue([{ exists: 1 }]) } },
  };
  return { getRepository: jest.fn(() => repo), _repo: repo, _qb: qb };
}

describe('toTransactionDetails — English output contract (naming-canonical, CZ-041)', () => {
  it('maps the canonical columns to the DTO\'s English field names', () => {
    const entity = {
      id: 'tx-1',
      type: 'expense',
      status: 'pending',
      description: 'Aluguel de estúdio',
      amount: '250.50',
      transaction_date: new Date('2026-08-01T00:00:00.000Z'),
      category: 'services',
      subcategory: 'estudio',
      notes: 'pago via pix',
      payment_method: 'pix',
      payment_type: 'upfront',
      installment_count: '1',
      counterparty_name: 'Estúdio XYZ',
      event_id: 'event-1',
      artist_id: 'artist-1',
      contract_id: 'contract-1',
      project_id: 'project-1',
      reference_month: '2026-08',
      attachment_url: null,
      created_by: 'user-1',
      updated_by: 'user-1',
      created_at: new Date('2026-08-01T00:00:00.000Z'),
      updated_at: new Date('2026-08-02T00:00:00.000Z'),
      metadata: {
        // Pre-CZ-041 metadata copies are historical only — never read.
        observacao: 'IGNORED', formaPagamento: 'IGNORED', eventoVinculado: 'IGNORED',
      },
    } as unknown as import('../../database/entities').TransactionEntity;

    const dto = toTransactionDetails(entity);

    expect(dto.type).toBe('expense');
    expect(dto.description).toBe('Aluguel de estúdio');
    expect(dto.amount).toBe(250.5);
    expect(dto.category).toBe('services');
    expect(dto.subcategory).toBe('estudio');
    expect(dto.note).toBe('pago via pix');
    expect(dto.paymentMethod).toBe('pix');
    expect(dto.paymentType).toBe('upfront');
    expect(dto.installments).toBe('1');
    expect(dto.supplierOrClient).toBe('Estúdio XYZ');
    expect(dto.linkedEventId).toBe('event-1');
    expect(dto.competence).toBe('2026-08');
    expect(dto.artistId).toBe('artist-1');
    expect(dto.contractId).toBe('contract-1');
    expect(dto.projectId).toBe('project-1');
    expect(dto.transactionDate).toBe('2026-08-01T00:00:00.000Z');
    // no Portuguese field name may leak into the output DTO
    expect(dto).not.toHaveProperty('descricao');
    expect(dto).not.toHaveProperty('valor');
    expect(dto).not.toHaveProperty('categoria');
  });
});

describe('TransactionsService — optimistic concurrency on update/patch', () => {
  let service: TransactionsService;
  let mockDs: ReturnType<typeof buildMockDs>;

  async function buildService(updateResult?: { affected: number }) {
    mockDs = buildMockDs(updateResult);
    const module = await Test.createTestingModule({
      providers: [
        TransactionsService,
        { provide: DATA_SOURCE, useValue: mockDs },
      ],
    }).compile();
    return module.get<TransactionsService>(TransactionsService);
  }

  it('without expectedUpdatedAt: applies an unconditional update (backward compatibility)', async () => {
    service = await buildService({ affected: 1 });
    await service.patch(TENANT, 'u1', TX_ID, { description: 'Nova descrição' } as any);

    expect(mockDs._repo.update).toHaveBeenCalledWith(
      { id: TX_ID, tenant_id: TENANT },
      expect.objectContaining({ description: 'Nova descrição' }),
    );
  });

  it('with a correct expectedUpdatedAt: includes updated_at in the criteria and applies normally', async () => {
    service = await buildService({ affected: 1 });
    await service.patch(TENANT, 'u1', TX_ID, {
      description: 'Editado',
      expectedUpdatedAt: NOW.toISOString(),
    } as any);

    const [criteria, payload] = mockDs._repo.update.mock.calls[0];
    expect(criteria.id).toBe(TX_ID);
    expect(criteria.tenant_id).toBe(TENANT);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const op = criteria.updated_at as any;
    expect(op._type).toBe('raw');
    expect(op._objectLiteralParameters).toEqual({ expected: NOW });
    expect(payload).toEqual(expect.objectContaining({ description: 'Editado' }));
  });

  it('with a stale expectedUpdatedAt (0 rows affected): throws ConflictException (409), does not overwrite', async () => {
    service = await buildService({ affected: 0 });
    await expect(
      service.patch(TENANT, 'u1', TX_ID, {
        description: 'Tentativa concorrente',
        expectedUpdatedAt: new Date('2026-08-14T11:00:00.000Z').toISOString(),
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('the same protection applies to update() (PUT), not only patch()', async () => {
    service = await buildService({ affected: 0 });
    await expect(
      service.update(TENANT, 'u1', TX_ID, {
        transactionType: 'revenue',
        expectedUpdatedAt: new Date('2026-08-14T11:00:00.000Z').toISOString(),
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('expectedUpdatedAt with an invalid format: 400, not 500 or silence', async () => {
    service = await buildService({ affected: 1 });
    await expect(
      service.patch(TENANT, 'u1', TX_ID, {
        description: 'x',
        expectedUpdatedAt: 'not-a-date',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });
});

/**
 * Task W — keyword auto-categorization on transaction creation.
 * Covers the only real creation point used both by the manual form
 * and by the OFX import (both call create() with the same contract).
 */
describe('TransactionsService.create — rule-based auto-categorization (Task W)', () => {
  function buildCreateDs() {
    const savedEntities: any[] = [];
    const repo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn(async (data: any) => {
        const saved = { ...data, id: `tx-${savedEntities.length + 1}` };
        savedEntities.push(saved);
        return saved;
      }),
      manager: { connection: { query: jest.fn().mockResolvedValue([{ exists: 1 }]) } },
    };
    return { getRepository: jest.fn(() => repo), _repo: repo, _saved: savedEntities };
  }

  function buildServiceWithMatcher(suggestion: { categoryId: string; categoryName: string; ruleId: string } | null | Error) {
    const mockDs = buildCreateDs();
    const suggestFn = jest.fn(async () => {
      if (suggestion instanceof Error) throw suggestion;
      return suggestion;
    });
    const financeCategoryRules = { suggestCategoryForTransaction: suggestFn } as any;
    const service = new TransactionsService(mockDs as any, undefined as any, undefined as any, financeCategoryRules);
    return { service, mockDs, suggestFn };
  }

  it('an explicit real category: NEVER triggers the matcher, category preserved', async () => {
    const { service, mockDs, suggestFn } = await buildServiceWithMatcher(null);

    const saved = await service.create(TENANT, 'u1', {
      transactionType: 'expense', description: 'Pagamento Spotify', category: 'marketing', amount: '50',
    } as any);

    expect(saved.category).toBe('marketing');
    expect(suggestFn).not.toHaveBeenCalled();
    expect(mockDs._repo.save).toHaveBeenCalled();
  });

  it("legacy category 'outros' (read-compat) + a matching rule: applies the suggested category", async () => {
    const { service } = await buildServiceWithMatcher({ categoryId: 'cat-1', categoryName: 'streaming', ruleId: 'rule-1' });

    const saved = await service.create(TENANT, 'u1', {
      transactionType: 'expense', description: 'Pagamento Spotify mensal', category: 'outros', amount: '50',
    } as any);

    expect(saved.category).toBe('streaming');
  });

  it("absent category (default 'other') + matching rule: applies the suggested category", async () => {
    const { service } = await buildServiceWithMatcher({ categoryId: 'cat-2', categoryName: 'services', ruleId: 'rule-2' });

    const saved = await service.create(TENANT, 'u1', {
      transactionType: 'revenue', description: 'Recebimento de show', amount: '500',
    } as any);

    expect(saved.category).toBe('services');
  });

  it("category 'other' with no matching rule: keeps the placeholder 'other'", async () => {
    const { service, suggestFn } = await buildServiceWithMatcher(null);

    const saved = await service.create(TENANT, 'u1', {
      transactionType: 'expense', description: 'Compra qualquer', category: 'other', amount: '20',
    } as any);

    expect(saved.category).toBe('other');
    expect(suggestFn).toHaveBeenCalledWith(TENANT, 'EXPENSE', 'Compra qualquer');
  });

  it('never crosses tenants: passes exactly the caller\'s tenantId to the matcher', async () => {
    const { service, suggestFn } = await buildServiceWithMatcher({ categoryId: 'c', categoryName: 's', ruleId: 'r' });
    const otherTenant = 'tenant-other';

    await service.create(otherTenant, 'u1', {
      transactionType: 'expense', description: 'Pagamento Spotify', category: 'other', amount: '10',
    } as any);

    expect(suggestFn).toHaveBeenCalledWith(otherTenant, 'EXPENSE', 'Pagamento Spotify');
  });

  it('type transfer: never triggers the matcher (finance-category-rules only covers REVENUE/EXPENSE)', async () => {
    const { service, suggestFn } = await buildServiceWithMatcher({ categoryId: 'c', categoryName: 's', ruleId: 'r' });

    const saved = await service.create(TENANT, 'u1', {
      transactionType: 'transfer', description: 'Transferência entre contas', category: 'other', amount: '10',
    } as any);

    expect(suggestFn).not.toHaveBeenCalled();
    expect(saved.category).toBe('other');
  });

  it('matcher unavailable/error: does not block creation, falls back to other', async () => {
    const { service } = await buildServiceWithMatcher(new Error('finance-category-rules DB down'));

    const saved = await service.create(TENANT, 'u1', {
      transactionType: 'expense', description: 'Pagamento Spotify', category: 'other', amount: '10',
    } as any);

    expect(saved.category).toBe('other');
  });

  it('batch import (multiple OFX transactions in sequence): each is categorized independently and deterministically', async () => {
    const mockDs = buildCreateDs();
    const suggestFn = jest.fn(async (_tenant: string, _type: string, description: string) => {
      if (description.toLowerCase().includes('spotify')) return { categoryId: 'cat-1', categoryName: 'streaming', ruleId: 'r1' };
      if (description.toLowerCase().includes('uber')) return { categoryId: 'cat-2', categoryName: 'transporte', ruleId: 'r2' };
      return null;
    });
    const financeCategoryRules = { suggestCategoryForTransaction: suggestFn } as any;
    const service = new TransactionsService(mockDs as any, undefined as any, undefined as any, financeCategoryRules);

    const ofxRows = [
      { transactionType: 'expense', description: 'Pagamento Spotify', category: 'other', amount: '20' },
      { transactionType: 'expense', description: 'Corrida Uber', category: 'other', amount: '35' },
      { transactionType: 'expense', description: 'Padaria do bairro', category: 'other', amount: '15' },
    ];

    const results = [];
    for (const row of ofxRows) {
      results.push(await service.create(TENANT, 'u1', row as any));
    }

    expect(results.map((r) => r.category)).toEqual(['streaming', 'transporte', 'other']);
    expect(suggestFn).toHaveBeenCalledTimes(3);
  });

  it('matcher unavailable (not injected, undefined): creates the transaction normally with the given category', async () => {
    const mockDs = buildCreateDs();
    const service = new TransactionsService(mockDs as any, undefined as any, undefined as any, undefined as any);

    const saved = await service.create(TENANT, 'u1', {
      transactionType: 'expense', description: 'Pagamento Spotify', category: 'other', amount: '10',
    } as any);

    expect(saved.category).toBe('other');
  });
});

/**
 * find-4cd2f044: artist_id/contract_id/project_id had no cross-tenant
 * ownership check — a transaction could silently reference another
 * tenant's artist/contract/project.
 */
describe('TransactionsService.create — cross-tenant FK ownership (find-4cd2f044)', () => {
  function makeService(queryImpl: jest.Mock) {
    const repo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ id: 'tx-new', ...(v as object) })),
      manager: { connection: { query: queryImpl } },
    };
    const ds = { getRepository: jest.fn(() => repo) };
    const service = new TransactionsService(ds as never, undefined as never, undefined as never, undefined as never);
    return { service, repo };
  }

  it('rejects an artistId belonging to another tenant', async () => {
    const { service } = makeService(jest.fn(async () => []));
    await expect(
      service.create(TENANT, 'user-1', {
        transactionType: 'expense', description: 'X', category: 'marketing', amount: '50',
        artistId: '323e4567-e89b-12d3-a456-426614174000',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows an artistId that belongs to the same tenant', async () => {
    const { service, repo } = makeService(jest.fn(async () => [{ exists: 1 }]));
    await expect(
      service.create(TENANT, 'user-1', {
        transactionType: 'expense', description: 'X', category: 'marketing', amount: '50',
        artistId: '223e4567-e89b-12d3-a456-426614174000',
      } as any),
    ).resolves.toBeDefined();
    expect(repo.save).toHaveBeenCalled();
  });

  function makeUpdateService(queryImpl: jest.Mock) {
    const qb: Record<string, jest.Mock> = {};
    const chain = () => qb;
    qb['where'] = jest.fn(chain);
    qb['andWhere'] = jest.fn(chain);
    qb['getOne'] = jest.fn(async () => mockTx);
    const repo = {
      createQueryBuilder: jest.fn(() => qb),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      manager: { connection: { query: queryImpl } },
    };
    const ds = { getRepository: jest.fn(() => repo) };
    const service = new TransactionsService(ds as never, undefined as never, undefined as never, undefined as never);
    return { service, repo };
  }

  it('update: rejects changing contractId to another tenant\'s contract', async () => {
    const { service } = makeUpdateService(jest.fn(async () => []));
    await expect(
      service.update(TENANT, 'user-1', TX_ID, {
        contractId: '323e4567-e89b-12d3-a456-426614174000',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update: does not re-validate FK fields when the patch omits them (unchanged)', async () => {
    const query = jest.fn();
    const { service } = makeUpdateService(query);
    await expect(
      service.update(TENANT, 'user-1', TX_ID, { description: 'New' } as any),
    ).resolves.toBeDefined();
    expect(query).not.toHaveBeenCalled();
  });

  it('patch: rejects changing projectId to another tenant\'s project', async () => {
    const { service } = makeUpdateService(jest.fn(async () => []));
    await expect(
      service.patch(TENANT, 'user-1', TX_ID, {
        projectId: '323e4567-e89b-12d3-a456-426614174000',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('patch: does not re-validate FK fields when the patch omits them (unchanged)', async () => {
    const query = jest.fn();
    const { service } = makeUpdateService(query);
    await expect(
      service.patch(TENANT, 'user-1', TX_ID, { description: 'New' } as any),
    ).resolves.toBeDefined();
    expect(query).not.toHaveBeenCalled();
  });

  it('list: orders by transaction_date with an id tie-break (deterministic offset paging for full sweeps)', async () => {
    const qb: Record<string, jest.Mock> = {};
    for (const m of ['where', 'andWhere', 'orderBy', 'addOrderBy', 'skip', 'take']) qb[m] = jest.fn(() => qb);
    qb['getManyAndCount'] = jest.fn(async () => [[], 0]);
    const repo = { createQueryBuilder: jest.fn(() => qb) };
    const service = new TransactionsService({ getRepository: jest.fn(() => repo) } as never, undefined as never, undefined as never, undefined as never);
    await service.list(TENANT, { offset: 200, limit: 200 } as any);
    expect(qb['orderBy']).toHaveBeenCalledWith('t.transaction_date', 'DESC');
    expect(qb['addOrderBy']).toHaveBeenCalledWith('t.id', 'ASC');
    expect(qb['skip']).toHaveBeenCalledWith(200);
  });

  it('list: the external-rights category filter matches the canonical id and the legacy phrase; other categories stay exact', async () => {
    const qb: Record<string, jest.Mock> = {};
    for (const m of ['where', 'andWhere', 'orderBy', 'addOrderBy', 'skip', 'take']) qb[m] = jest.fn(() => qb);
    qb['getManyAndCount'] = jest.fn(async () => [[], 0]);
    const repo = { createQueryBuilder: jest.fn(() => qb) };
    const service = new TransactionsService({ getRepository: jest.fn(() => repo) } as never, undefined as never, undefined as never, undefined as never);
    await service.list(TENANT, { category: 'external_rights_receipts' } as any);
    expect(qb['andWhere']).toHaveBeenCalledWith('t.category IN (:...categories)', {
      categories: ['external_rights_receipts', 'external-rights-receipts', 'recebimentos externos de direitos'],
    });
    qb['andWhere'].mockClear();
    await service.list(TENANT, { category: 'marketing' } as any);
    expect(qb['andWhere']).toHaveBeenCalledWith('t.category = :category', { category: 'marketing' });
  });

  it('create: persists the canonical external-rights category for the legacy phrase', async () => {
    const { service, repo } = makeService(jest.fn(async () => [{ exists: 1 }]));
    await service.create(TENANT, 'user-1', {
      transactionType: 'revenue', description: 'X', category: 'recebimentos externos de direitos', amount: '50',
    } as any);
    const created = (repo.create as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(created['category']).toBe('external_rights_receipts');
  });

  it('TX1 list: a platform slug filter matches the canonical id and every legacy spelling, in either direction', async () => {
    const qb: Record<string, jest.Mock> = {};
    for (const m of ['where', 'andWhere', 'orderBy', 'addOrderBy', 'skip', 'take']) qb[m] = jest.fn(() => qb);
    qb['getManyAndCount'] = jest.fn(async () => [[], 0]);
    const repo = { createQueryBuilder: jest.fn(() => qb) };
    const service = new TransactionsService({ getRepository: jest.fn(() => repo) } as never, undefined as never, undefined as never, undefined as never);
    for (const input of ['music_revenue', 'receitas-musicais']) {
      qb['andWhere'].mockClear();
      await service.list(TENANT, { category: input } as any);
      expect(qb['andWhere']).toHaveBeenCalledWith('t.category IN (:...categories)', { categories: ['music_revenue', 'receitas-musicais'] });
    }
    qb['andWhere'].mockClear();
    await service.list(TENANT, { category: 'Receitas Musicais' } as any);
    expect(qb['andWhere']).toHaveBeenCalledWith('t.category = :category', { category: 'Receitas Musicais' });
  });

  it('TX1 create: legacy category/subcategory slugs are persisted canonical; the legacy placeholder becomes other; free text is kept', async () => {
    const { service, repo } = makeService(jest.fn(async () => [{ exists: 1 }]));
    await service.create(TENANT, 'user-1', {
      transactionType: 'revenue', description: 'X', category: 'receitas-musicais', subcategory: 'direitos-autorais', amount: '50',
    } as any);
    const created = (repo.create as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
    expect(created['category']).toBe('music_revenue');
    expect(created['subcategory']).toBe('copyright');
    await service.create(TENANT, 'user-1', {
      transactionType: 'revenue', description: 'Y', category: 'Receitas Musicais', amount: '50',
    } as any);
    expect((repo.create as jest.Mock).mock.calls[1][0]['category']).toBe('Receitas Musicais');
  });
});
