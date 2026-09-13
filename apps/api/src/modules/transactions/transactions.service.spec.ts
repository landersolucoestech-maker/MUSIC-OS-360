import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { TransactionsService, toTransactionDetails } from './transactions.service';
import { DATA_SOURCE } from '../../database/database.module';
import { TransactionEntity } from '../../database/entities';

/**
 * Task J — fase de continuidade (concurrent writes / stale-lost updates).
 * update()/patch() antes sobrescreviam incondicionalmente (repo.update sem
 * checar version/updated_at) — dois usuários editando a mesma transação em
 * paralelo perdiam a edição de um deles silenciosamente. Agora, quando o
 * chamador manda `expectedUpdatedAt`, o UPDATE só aplica se `updated_at` no
 * banco ainda for exatamente esse valor (CAS via coluna já existente, sem
 * migração); 0 linhas afetadas -> 409, nunca sobrescreve silenciosamente.
 * Sem `expectedUpdatedAt`, o comportamento é idêntico ao anterior
 * (compatibilidade retroativa).
 */

const TENANT = 'tenant-test';
const TX_ID  = 'tx-test';
const NOW    = new Date('2026-08-14T12:00:00.000Z');

const mockTx = {
  id: TX_ID,
  tenant_id: TENANT,
  type: 'receita',
  categoria: 'outros',
  status: 'pendente',
  valor: '100',
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

describe('toTransactionDetails — contrato de saída em inglês (naming-canonical)', () => {
  it('mapeia colunas PT e chaves de metadata PT para os nomes de campo em inglês do DTO', () => {
    const entity = {
      id: 'tx-1',
      type: 'despesa',
      status: 'pendente',
      descricao: 'Aluguel de estúdio',
      referencia: null,
      valor: '250.50',
      data: new Date('2026-08-01T00:00:00.000Z'),
      categoria: 'servicos',
      artist_id: 'artist-1',
      contrato_id: 'contract-1',
      project_id: 'project-1',
      comprovante_url: null,
      created_by: 'user-1',
      updated_by: 'user-1',
      created_at: new Date('2026-08-01T00:00:00.000Z'),
      updated_at: new Date('2026-08-02T00:00:00.000Z'),
      metadata: {
        observacao: 'pago via pix',
        formaPagamento: 'pix',
        tipoPagamento: 'avista',
        quantidadeParcelas: '1',
        subcategoria: 'estudio',
        fornecedorCliente: 'Estúdio XYZ',
        eventoVinculado: 'evento-1',
      },
    } as unknown as import('../../database/entities').TransactionEntity;

    const dto = toTransactionDetails(entity);

    expect(dto.description).toBe('Aluguel de estúdio');
    expect(dto.amount).toBe(250.5);
    expect(dto.category).toBe('servicos');
    expect(dto.subcategory).toBe('estudio');
    expect(dto.note).toBe('pago via pix');
    expect(dto.paymentMethod).toBe('pix');
    expect(dto.paymentType).toBe('avista');
    expect(dto.installments).toBe('1');
    expect(dto.supplierOrClient).toBe('Estúdio XYZ');
    expect(dto.linkedEventId).toBe('evento-1');
    expect(dto.artistId).toBe('artist-1');
    expect(dto.contractId).toBe('contract-1');
    expect(dto.projectId).toBe('project-1');
    expect(dto.transactionDate).toBe('2026-08-01T00:00:00.000Z');
    // nenhum nome de campo em português deve vazar no DTO de saída
    expect(dto).not.toHaveProperty('descricao');
    expect(dto).not.toHaveProperty('valor');
    expect(dto).not.toHaveProperty('categoria');
  });
});

describe('TransactionsService — concorrência otimista em update/patch', () => {
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

  it('sem expectedUpdatedAt: aplica update incondicional (compatibilidade retroativa)', async () => {
    service = await buildService({ affected: 1 });
    await service.patch(TENANT, 'u1', TX_ID, { descricao: 'Nova descrição' } as any);

    expect(mockDs._repo.update).toHaveBeenCalledWith(
      { id: TX_ID, tenant_id: TENANT },
      expect.objectContaining({ descricao: 'Nova descrição' }),
    );
  });

  it('com expectedUpdatedAt correto: inclui updated_at no critério e aplica normalmente', async () => {
    service = await buildService({ affected: 1 });
    await service.patch(TENANT, 'u1', TX_ID, {
      descricao: 'Editado',
      expectedUpdatedAt: NOW.toISOString(),
    } as any);

    const [criteria, payload] = mockDs._repo.update.mock.calls[0];
    expect(criteria.id).toBe(TX_ID);
    expect(criteria.tenant_id).toBe(TENANT);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const op = criteria.updated_at as any;
    expect(op._type).toBe('raw');
    expect(op._objectLiteralParameters).toEqual({ expected: NOW });
    expect(payload).toEqual(expect.objectContaining({ descricao: 'Editado' }));
  });

  it('com expectedUpdatedAt desatualizado (0 linhas afetadas): lança ConflictException (409), não sobrescreve', async () => {
    service = await buildService({ affected: 0 });
    await expect(
      service.patch(TENANT, 'u1', TX_ID, {
        descricao: 'Tentativa concorrente',
        expectedUpdatedAt: new Date('2026-08-14T11:00:00.000Z').toISOString(),
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('mesma proteção se aplica a update() (PUT), não só patch()', async () => {
    service = await buildService({ affected: 0 });
    await expect(
      service.update(TENANT, 'u1', TX_ID, {
        tipoTransacao: 'receita',
        expectedUpdatedAt: new Date('2026-08-14T11:00:00.000Z').toISOString(),
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('expectedUpdatedAt com formato inválido: 400, não 500 nem silêncio', async () => {
    service = await buildService({ affected: 1 });
    await expect(
      service.patch(TENANT, 'u1', TX_ID, {
        descricao: 'x',
        expectedUpdatedAt: 'not-a-date',
      } as any),
    ).rejects.toThrow(BadRequestException);
  });
});

/**
 * Task W — auto-categorização por palavra-chave na criação de transações.
 * Cobre o único ponto de criação real usado tanto pelo formulário manual
 * quanto pela importação OFX (ambos chamam create() com o mesmo contrato).
 */
describe('TransactionsService.create — auto-categorização por regras (Task W)', () => {
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

  it('categoria explícita e real: NUNCA aciona o matcher, categoria preservada', async () => {
    const { service, mockDs, suggestFn } = await buildServiceWithMatcher(null);

    const saved = await service.create(TENANT, 'u1', {
      tipoTransacao: 'despesa', descricao: 'Pagamento Spotify', categoria: 'marketing', valor: '50',
    } as any);

    expect(saved.categoria).toBe('marketing');
    expect(suggestFn).not.toHaveBeenCalled();
    expect(mockDs._repo.save).toHaveBeenCalled();
  });

  it("categoria 'outros' + regra correspondente: aplica a categoria sugerida", async () => {
    const { service } = await buildServiceWithMatcher({ categoryId: 'cat-1', categoryName: 'streaming', ruleId: 'rule-1' });

    const saved = await service.create(TENANT, 'u1', {
      tipoTransacao: 'despesa', descricao: 'Pagamento Spotify mensal', categoria: 'outros', valor: '50',
    } as any);

    expect(saved.categoria).toBe('streaming');
  });

  it("categoria ausente (default 'outros') + regra correspondente: aplica a categoria sugerida", async () => {
    const { service } = await buildServiceWithMatcher({ categoryId: 'cat-2', categoryName: 'servicos', ruleId: 'rule-2' });

    const saved = await service.create(TENANT, 'u1', {
      tipoTransacao: 'receita', descricao: 'Recebimento de show', valor: '500',
    } as any);

    expect(saved.categoria).toBe('servicos');
  });

  it("categoria 'outros' sem nenhuma regra correspondente: mantém 'outros'", async () => {
    const { service, suggestFn } = await buildServiceWithMatcher(null);

    const saved = await service.create(TENANT, 'u1', {
      tipoTransacao: 'despesa', descricao: 'Compra qualquer', categoria: 'outros', valor: '20',
    } as any);

    expect(saved.categoria).toBe('outros');
    expect(suggestFn).toHaveBeenCalledWith(TENANT, 'DESPESA', 'Compra qualquer');
  });

  it('nunca cruza tenant: passa exatamente o tenantId do chamador ao matcher', async () => {
    const { service, suggestFn } = await buildServiceWithMatcher({ categoryId: 'c', categoryName: 's', ruleId: 'r' });
    const otherTenant = 'tenant-other';

    await service.create(otherTenant, 'u1', {
      tipoTransacao: 'despesa', descricao: 'Pagamento Spotify', categoria: 'outros', valor: '10',
    } as any);

    expect(suggestFn).toHaveBeenCalledWith(otherTenant, 'DESPESA', 'Pagamento Spotify');
  });

  it('type transferencia: nunca aciona o matcher (finance-category-rules só cobre RECEITA/DESPESA)', async () => {
    const { service, suggestFn } = await buildServiceWithMatcher({ categoryId: 'c', categoryName: 's', ruleId: 'r' });

    const saved = await service.create(TENANT, 'u1', {
      tipoTransacao: 'transferencia', descricao: 'Transferência entre contas', categoria: 'outros', valor: '10',
    } as any);

    expect(suggestFn).not.toHaveBeenCalled();
    expect(saved.categoria).toBe('outros');
  });

  it('matcher indisponível/erro: não bloqueia a criação, cai para outros', async () => {
    const { service } = await buildServiceWithMatcher(new Error('finance-category-rules DB down'));

    const saved = await service.create(TENANT, 'u1', {
      tipoTransacao: 'despesa', descricao: 'Pagamento Spotify', categoria: 'outros', valor: '10',
    } as any);

    expect(saved.categoria).toBe('outros');
  });

  it('importação em lote (múltiplas transações OFX em sequência): cada uma é categorizada de forma independente e determinística', async () => {
    const mockDs = buildCreateDs();
    const suggestFn = jest.fn(async (_tenant: string, _type: string, descricao: string) => {
      if (descricao.toLowerCase().includes('spotify')) return { categoryId: 'cat-1', categoryName: 'streaming', ruleId: 'r1' };
      if (descricao.toLowerCase().includes('uber')) return { categoryId: 'cat-2', categoryName: 'transporte', ruleId: 'r2' };
      return null;
    });
    const financeCategoryRules = { suggestCategoryForTransaction: suggestFn } as any;
    const service = new TransactionsService(mockDs as any, undefined as any, undefined as any, financeCategoryRules);

    const ofxRows = [
      { tipoTransacao: 'despesa', descricao: 'Pagamento Spotify', categoria: 'outros', valor: '20' },
      { tipoTransacao: 'despesa', descricao: 'Corrida Uber', categoria: 'outros', valor: '35' },
      { tipoTransacao: 'despesa', descricao: 'Padaria do bairro', categoria: 'outros', valor: '15' },
    ];

    const results = [];
    for (const row of ofxRows) {
      results.push(await service.create(TENANT, 'u1', row as any));
    }

    expect(results.map((r) => r.categoria)).toEqual(['streaming', 'transporte', 'outros']);
    expect(suggestFn).toHaveBeenCalledTimes(3);
  });

  it('matcher indisponível (não injetado, undefined): cria a transação normalmente com a categoria fornecida', async () => {
    const mockDs = buildCreateDs();
    const service = new TransactionsService(mockDs as any, undefined as any, undefined as any, undefined as any);

    const saved = await service.create(TENANT, 'u1', {
      tipoTransacao: 'despesa', descricao: 'Pagamento Spotify', categoria: 'outros', valor: '10',
    } as any);

    expect(saved.categoria).toBe('outros');
  });
});

/**
 * find-4cd2f044: artist_id/contrato_id/project_id had no cross-tenant
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

  it('rejects an artistaVinculado (artist_id) belonging to another tenant', async () => {
    const { service } = makeService(jest.fn(async () => []));
    await expect(
      service.create(TENANT, 'user-1', {
        tipoTransacao: 'despesa', descricao: 'X', categoria: 'marketing', valor: '50',
        artistaVinculado: '323e4567-e89b-12d3-a456-426614174000',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows an artistaVinculado that belongs to the same tenant', async () => {
    const { service, repo } = makeService(jest.fn(async () => [{ exists: 1 }]));
    await expect(
      service.create(TENANT, 'user-1', {
        tipoTransacao: 'despesa', descricao: 'X', categoria: 'marketing', valor: '50',
        artistaVinculado: '223e4567-e89b-12d3-a456-426614174000',
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

  it('update: rejects changing contratoVinculado (contrato_id) to another tenant\'s contract', async () => {
    const { service } = makeUpdateService(jest.fn(async () => []));
    await expect(
      service.update(TENANT, 'user-1', TX_ID, {
        contratoVinculado: '323e4567-e89b-12d3-a456-426614174000',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update: does not re-validate FK fields when the patch omits them (unchanged)', async () => {
    const query = jest.fn();
    const { service } = makeUpdateService(query);
    await expect(
      service.update(TENANT, 'user-1', TX_ID, { descricao: 'New' } as any),
    ).resolves.toBeDefined();
    expect(query).not.toHaveBeenCalled();
  });

  it('patch: rejects changing projetoVinculado (project_id) to another tenant\'s project', async () => {
    const { service } = makeUpdateService(jest.fn(async () => []));
    await expect(
      service.patch(TENANT, 'user-1', TX_ID, {
        projetoVinculado: '323e4567-e89b-12d3-a456-426614174000',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('patch: does not re-validate FK fields when the patch omits them (unchanged)', async () => {
    const query = jest.fn();
    const { service } = makeUpdateService(query);
    await expect(
      service.patch(TENANT, 'user-1', TX_ID, { descricao: 'New' } as any),
    ).resolves.toBeDefined();
    expect(query).not.toHaveBeenCalled();
  });
});
