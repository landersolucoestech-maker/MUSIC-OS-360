import 'reflect-metadata';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { FinanceCategoryRulesService } from './finance-category-rules.service';

const NOW = new Date('2026-08-16T12:00:00.000Z');
const RULE = {
  id: 'rule-1', tenant_id: 'tenant-1', keywords: ['spotify', 'streaming'],
  transaction_type: 'RECEITA', category_id: 'cat-1', priority: 100, active: true,
  deleted_at: null, updated_at: NOW,
};

function makeQueryBuilder(rows: unknown[]) {
  const qb: any = {
    where: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    addOrderBy: jest.fn(() => qb),
    skip: jest.fn(() => qb),
    take: jest.fn(() => qb),
    getManyAndCount: jest.fn(async () => [rows, rows.length]),
  };
  return qb;
}

function makeRepo(rows: unknown[] = [RULE]) {
  return {
    findOne: jest.fn(async () => RULE),
    update: jest.fn(async () => ({ affected: 1 })),
    create: jest.fn((data: unknown) => data),
    save: jest.fn(async (data: unknown) => ({ ...(data as object), id: 'new-id' })),
    createQueryBuilder: jest.fn(() => makeQueryBuilder(rows)),
    // assertSameTenantFk's ownership check — a truthy row means "found, same
    // tenant", so tests not focused on that behavior aren't coupled to it.
    manager: { connection: { query: jest.fn().mockResolvedValue([{ exists: 1 }]) } },
  };
}

function makeService(rows?: unknown[]) {
  const repo = makeRepo(rows);
  const ds = { getRepository: jest.fn(() => repo) } as any;
  const svc = new FinanceCategoryRulesService(ds);
  return { svc, repo };
}

describe('FinanceCategoryRulesService', () => {
  it('list: escopa por tenant e retorna meta de paginação', async () => {
    const { svc, repo } = makeService([RULE]);
    const result = await svc.list('tenant-1', {} as any);

    expect(result.data).toEqual([RULE]);
    expect(result.meta).toEqual({ total: 1, offset: 0, limit: 100 });
    expect(repo.createQueryBuilder).toHaveBeenCalled();
  });

  it('findById: lança NotFoundException quando não encontrada', async () => {
    const { svc, repo } = makeService();
    (repo.findOne as jest.Mock).mockResolvedValueOnce(null);

    await expect(svc.findById('tenant-1', 'missing')).rejects.toThrow(NotFoundException);
  });

  it('create: associa tenant_id e created_by/updated_by', async () => {
    const { svc, repo } = makeService();

    await svc.create('tenant-1', 'user-1', {
      keywords: ['ads'], transaction_type: 'RECEITA', category_id: 'cat-2',
    } as any);

    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      tenant_id: 'tenant-1', created_by: 'user-1', updated_by: 'user-1',
    }));
  });

  // find-de6031eb: category_id had no cross-tenant ownership check.
  it('create: rejeita category_id de outro tenant', async () => {
    const { svc, repo } = makeService();
    (repo.manager.connection.query as jest.Mock).mockResolvedValueOnce([]);

    await expect(svc.create('tenant-1', 'user-1', {
      keywords: ['ads'], transaction_type: 'RECEITA', category_id: 'cat-from-tenant-2',
    } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update: rejeita mudar category_id para outro tenant', async () => {
    const { svc, repo } = makeService();
    (repo.manager.connection.query as jest.Mock).mockResolvedValueOnce([]);

    await expect(svc.update('tenant-1', 'user-1', 'rule-1', {
      category_id: 'cat-from-tenant-2',
    } as any)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update: não revalida category_id quando o patch não o inclui', async () => {
    const { svc, repo } = makeService();
    await svc.update('tenant-1', 'user-1', 'rule-1', { priority: 50 } as any);
    expect(repo.manager.connection.query).not.toHaveBeenCalled();
  });

  it('update sem expectedUpdatedAt: aplica update incondicional', async () => {
    const { svc, repo } = makeService();

    await svc.update('tenant-1', 'user-1', 'rule-1', { priority: 50 } as any);

    const [criteria] = (repo.update as jest.Mock).mock.calls[0];
    expect(criteria).toEqual({ id: 'rule-1', tenant_id: 'tenant-1' });
  });

  it('update com expectedUpdatedAt correto: inclui updated_at no critério', async () => {
    const { svc, repo } = makeService();

    await svc.update('tenant-1', 'user-1', 'rule-1', {
      priority: 50,
      expectedUpdatedAt: NOW.toISOString(),
    } as any);

    const [criteria] = (repo.update as jest.Mock).mock.calls[0];
    expect(criteria.id).toBe('rule-1');
    expect(criteria.tenant_id).toBe('tenant-1');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const op = criteria.updated_at as any;
    expect(op._type).toBe('raw');
    expect(op._objectLiteralParameters).toEqual({ expected: NOW });
  });

  it('update com expectedUpdatedAt desatualizado (0 linhas afetadas): lança ConflictException', async () => {
    const { svc, repo } = makeService();
    (repo.update as jest.Mock).mockResolvedValueOnce({ affected: 0 });

    await expect(
      svc.update('tenant-1', 'user-1', 'rule-1', {
        priority: 50,
        expectedUpdatedAt: new Date('2026-08-16T11:00:00.000Z').toISOString(),
      } as any),
    ).rejects.toThrow(ConflictException);
  });

  it('softDelete: escopa por tenant e marca deleted_at', async () => {
    const { svc, repo } = makeService();

    await svc.softDelete('tenant-1', 'rule-1');

    const [criteria, patch] = (repo.update as jest.Mock).mock.calls[0];
    expect(criteria).toEqual({ id: 'rule-1', tenant_id: 'tenant-1' });
    expect(patch).toHaveProperty('deleted_at');
  });
});

// ── Task W — suggestCategoryForTransaction ─────────────────────────────────────

function makeJoinQueryBuilder(entities: unknown[], raw: unknown[]) {
  const qb: any = {
    innerJoin: jest.fn(() => qb),
    addSelect: jest.fn(() => qb),
    where: jest.fn(() => qb),
    andWhere: jest.fn(() => qb),
    orderBy: jest.fn(() => qb),
    addOrderBy: jest.fn(() => qb),
    limit: jest.fn(() => qb),
    getRawAndEntities: jest.fn(async () => ({ entities, raw })),
  };
  return qb;
}

function makeSuggestService(entities: unknown[], raw: unknown[]) {
  const repo = {
    createQueryBuilder: jest.fn(() => makeJoinQueryBuilder(entities, raw)),
  };
  const ds = { getRepository: jest.fn(() => repo) } as any;
  const svc = new FinanceCategoryRulesService(ds);
  return { svc, repo };
}

describe('FinanceCategoryRulesService.suggestCategoryForTransaction (Task W)', () => {
  const activeRule = {
    id: 'rule-1', category_id: 'cat-1', keywords: ['spotify'],
    transaction_type: 'DESPESA', priority: 100, active: true,
  };

  it('retorna a categoria (slug) da regra correspondente', async () => {
    const { svc, repo } = makeSuggestService([activeRule], [{ category_name: 'streaming' }]);

    const result = await svc.suggestCategoryForTransaction('tenant-1', 'DESPESA', 'Pagamento Spotify mensal');

    expect(result).toEqual({ categoryId: 'cat-1', categoryName: 'streaming', ruleId: 'rule-1' });
    expect(repo.createQueryBuilder).toHaveBeenCalled();
  });

  it('retorna null quando nenhuma regra corresponde à descrição', async () => {
    const { svc } = makeSuggestService([activeRule], [{ category_name: 'streaming' }]);
    const result = await svc.suggestCategoryForTransaction('tenant-1', 'DESPESA', 'Aluguel do escritório');
    expect(result).toBeNull();
  });

  it('retorna null para descrição vazia (não executa a query)', async () => {
    const { svc, repo } = makeSuggestService([activeRule], [{ category_name: 'streaming' }]);
    const result = await svc.suggestCategoryForTransaction('tenant-1', 'DESPESA', '');
    expect(result).toBeNull();
    expect(repo.createQueryBuilder).not.toHaveBeenCalled();
  });

  it('retorna null quando a categoria vinculada não tem slug (categoria removida)', async () => {
    const { svc } = makeSuggestService([activeRule], [{ category_name: null }]);
    const result = await svc.suggestCategoryForTransaction('tenant-1', 'DESPESA', 'Pagamento Spotify');
    expect(result).toBeNull();
  });
});

describe('FinanceCategoryRulesService.suggestCategoryForTransaction — where clauses (Task W)', () => {
  it('filtra por tenant_id, active=true e transaction_type na query', async () => {
    const qb: any = {
      innerJoin: jest.fn(() => qb),
      addSelect: jest.fn(() => qb),
      where: jest.fn(() => qb),
      andWhere: jest.fn(() => qb),
      orderBy: jest.fn(() => qb),
      addOrderBy: jest.fn(() => qb),
      limit: jest.fn(() => qb),
      getRawAndEntities: jest.fn(async () => ({ entities: [], raw: [] })),
    };
    const repo = { createQueryBuilder: jest.fn(() => qb) };
    const ds = { getRepository: jest.fn(() => repo) } as any;
    const svc = new FinanceCategoryRulesService(ds);

    await svc.suggestCategoryForTransaction('tenant-9', 'RECEITA', 'Recebimento de show');

    expect(qb.where).toHaveBeenCalledWith('r.tenant_id = :tenantId', { tenantId: 'tenant-9' });
    expect(qb.andWhere).toHaveBeenCalledWith('r.deleted_at IS NULL');
    expect(qb.andWhere).toHaveBeenCalledWith('r.active = true');
    expect(qb.andWhere).toHaveBeenCalledWith('r.transaction_type = :transactionType', { transactionType: 'RECEITA' });
  });
});
