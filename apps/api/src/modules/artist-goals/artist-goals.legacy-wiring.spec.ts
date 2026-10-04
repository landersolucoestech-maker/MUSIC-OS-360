import { ArtistGoalsService } from './artist-goals.service';

/**
 * The service must run every create/update payload through normalizeArtistGoalInput so a pre-rename
 * web build (periodo, PT values, PT metadata keys) is persisted in the canonical vocabulary.
 */
describe('ArtistGoalsService legacy payload wiring', () => {
  const LEGACY = {
    'periodo': 'mensal',
    type: 'receita',
    status: 'ativa',
    metadata: { 'descricao': 'Meta de caixa', 'categoria': 'financeiro', 'unidade': 'BRL' },
  };

  function build() {
    const created: Record<string, unknown>[] = [];
    const updated: Record<string, unknown>[] = [];
    const qb: Record<string, jest.Mock> = {};
    for (const m of ['where', 'andWhere']) qb[m] = jest.fn(() => qb);
    qb['getOne'] = jest.fn(async () => ({ id: 'g1', tenant_id: 't1' }));
    const repo = {
      createQueryBuilder: jest.fn(() => qb),
      create: jest.fn((e: Record<string, unknown>) => { created.push(e); return e; }),
      save: jest.fn(async (e: unknown) => e),
      update: jest.fn(async (_where: unknown, patch: Record<string, unknown>) => { updated.push(patch); }),
    };
    const ds = { getRepository: jest.fn(() => repo), query: jest.fn(async () => [{}]) };
    return { service: new ArtistGoalsService(ds as never), created, updated };
  }

  it('create persists canonical period/type/status/metadata for a legacy payload', async () => {
    const { service, created } = build();
    await service.create('t1', 'u1', { ...LEGACY } as never);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      tenant_id: 't1',
      created_by: 'u1',
      period: 'monthly',
      type: 'revenue',
      status: 'in_progress',
      metadata: { description: 'Meta de caixa', category: 'financial', unit: 'BRL' },
    });
    expect(created[0]).not.toHaveProperty('periodo');
    expect(Object.keys(created[0]['metadata'] as object).sort()).toEqual(['category', 'description', 'unit']);
  });

  it('update persists canonical period/type/status/metadata for a legacy payload', async () => {
    const { service, updated } = build();
    await service.update('t1', 'g1', { ...LEGACY });
    expect(updated).toHaveLength(1);
    expect(updated[0]).toMatchObject({
      period: 'monthly',
      type: 'revenue',
      status: 'in_progress',
      metadata: { description: 'Meta de caixa', category: 'financial', unit: 'BRL' },
    });
    expect(updated[0]).not.toHaveProperty('periodo');
    expect(Object.keys(updated[0]['metadata'] as object).sort()).toEqual(['category', 'description', 'unit']);
  });
});
