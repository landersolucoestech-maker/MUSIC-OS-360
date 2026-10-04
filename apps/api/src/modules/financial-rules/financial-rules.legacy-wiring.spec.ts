import 'reflect-metadata';
import { FinancialRulesService } from './financial-rules.service';

/**
 * Pre-rename clients send the legacy field names and values. The service must normalize them
 * before filtering and persisting (list filter, create and update).
 */
describe('FinancialRulesService legacy wiring', () => {
  const RULE = { id: 'rule-1', tenant_id: 'tenant-1', deleted_at: null, updated_at: new Date('2026-08-14T12:00:00.000Z') };
  const LEGACY = { name: 'Imposto', 'calculo': 'percentual', type: 'imposto', 'condicoes': { min: 1 }, value: 5 };

  function make() {
    const qb: Record<string, jest.Mock> = {};
    for (const m of ['where', 'andWhere', 'orderBy', 'skip', 'take']) qb[m] = jest.fn(() => qb);
    qb['getManyAndCount'] = jest.fn(async () => [[], 0]);
    const repo = {
      createQueryBuilder: jest.fn(() => qb),
      findOne: jest.fn(async () => RULE),
      create: jest.fn((v: unknown) => ({ ...(v as object) })),
      save: jest.fn(async (v: unknown) => v),
      update: jest.fn(async () => ({ affected: 1 })),
    };
    const svc = new FinancialRulesService({ getRepository: () => repo } as never, { emitTyped: jest.fn() } as never);
    return { svc, repo, qb };
  }

  it('list maps a legacy type filter to the canonical value (canonical values are untouched)', async () => {
    const { svc, qb } = make();
    await svc.list('tenant-1', { type: 'imposto' } as never);
    expect(qb['andWhere']).toHaveBeenCalledWith('r.type = :type', { type: 'tax' });
    qb['andWhere'].mockClear();
    await svc.list('tenant-1', { type: 'tax' } as never);
    expect(qb['andWhere']).toHaveBeenCalledWith('r.type = :type', { type: 'tax' });
  });

  it('create persists canonical calculation_method/type/conditions for a legacy payload', async () => {
    const { svc, repo } = make();
    await svc.create('tenant-1', 'user-1', { ...LEGACY } as never);
    const persisted = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(persisted).toMatchObject({ calculation_method: 'percentage', type: 'tax', conditions: { min: 1 }, value: 5 });
    expect(persisted).not.toHaveProperty('calculo');
    expect(persisted).not.toHaveProperty('condicoes');
  });

  it('update persists canonical calculation_method/type/conditions for a legacy payload', async () => {
    const { svc, repo } = make();
    await svc.update('tenant-1', 'user-1', 'rule-1', { ...LEGACY } as never);
    const patch = (repo.update.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(patch).toMatchObject({ calculation_method: 'percentage', type: 'tax', conditions: { min: 1 }, value: 5 });
    expect(patch).not.toHaveProperty('calculo');
    expect(patch).not.toHaveProperty('condicoes');
  });
});
