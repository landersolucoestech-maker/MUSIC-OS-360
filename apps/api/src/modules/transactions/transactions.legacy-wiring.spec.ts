import 'reflect-metadata';
import { TransactionsService } from './transactions.service';

/**
 * Older clients / internal callers that bypass the zod preprocess still send legacy values
 * (receita/despesa, kebab-case PT category slugs). The service itself must canonicalize them
 * before filtering and persisting.
 */
describe('TransactionsService legacy value wiring', () => {
  const EXISTING = { id: 'tx-1', tenant_id: 't1', status: 'pending', updated_at: new Date('2026-01-01T00:00:00Z') };

  function build() {
    const qb: Record<string, jest.Mock> = {};
    for (const m of ['where', 'andWhere', 'orderBy', 'addOrderBy', 'skip', 'take']) qb[m] = jest.fn(() => qb);
    qb['getManyAndCount'] = jest.fn(async () => [[], 0]);
    qb['getOne'] = jest.fn(async () => EXISTING);
    const repo = {
      createQueryBuilder: jest.fn(() => qb),
      create: jest.fn((v: Record<string, unknown>) => v),
      save: jest.fn(async (v: Record<string, unknown>) => ({ id: 'tx-new', ...v })),
      update: jest.fn(async () => ({ affected: 1 })),
      manager: { connection: { query: jest.fn(async () => [{}]) } },
    };
    const svc = new TransactionsService({ getRepository: jest.fn(() => repo) } as never, undefined as never, undefined as never, undefined as never);
    return { svc, qb, repo };
  }
  const patchOf = (repo: { update: jest.Mock }) => (repo.update.mock.calls[0] as unknown[])[1] as Record<string, unknown>;

  it.each([
    ['despesa', 'expense'],
    ['receita', 'revenue'],
    ['imposto', 'tax'],
    ['expense', 'expense'],
  ])('list(type=%s) filters t.type = %s', async (legacy, canonical) => {
    const { svc, qb } = build();
    await svc.list('t1', { type: legacy } as never);
    expect(qb['andWhere']).toHaveBeenCalledWith('t.type = :type', { type: canonical });
  });

  it('update(category=caches) persists performance_fees', async () => {
    const { svc, repo } = build();
    await svc.update('t1', 'u1', 'tx-1', { category: 'caches' } as never);
    expect(patchOf(repo)['category']).toBe('performance_fees');
  });

  it('patch(category=caches) persists performance_fees', async () => {
    const { svc, repo } = build();
    await svc.patch('t1', 'u1', 'tx-1', { category: 'caches' } as never);
    expect(patchOf(repo)['category']).toBe('performance_fees');
  });

  it('update with an empty category falls back to the canonical uncategorized slug, never to a legacy one', async () => {
    const { svc, repo } = build();
    await svc.update('t1', 'u1', 'tx-1', { category: '' } as never);
    expect(patchOf(repo)['category']).toBe('other');
  });

  it('create(category=caches) persists performance_fees', async () => {
    const { svc, repo } = build();
    await svc.create('t1', 'u1', { category: 'caches', description: 'x', amount: 1 } as never);
    expect((repo.create.mock.calls[0][0] as Record<string, unknown>)['category']).toBe('performance_fees');
  });

  it('a custom (non platform) category slug is persisted untouched', async () => {
    const { svc, repo } = build();
    await svc.update('t1', 'u1', 'tx-1', { category: 'my-own-bucket' } as never);
    expect(patchOf(repo)['category']).toBe('my-own-bucket');
  });
});
