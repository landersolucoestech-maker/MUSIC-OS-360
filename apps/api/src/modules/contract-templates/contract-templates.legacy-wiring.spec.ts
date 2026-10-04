import 'reflect-metadata';
import { ContractTemplatesService } from './contract-templates.service';
import { CONTRACT_TEMPLATE_DEPRECATED_FIELDS } from './dto/create-contract-template.dto';

/** Deploy-skew wiring: legacy field names must reach the repository under the canonical columns (create and update). */
describe('ContractTemplatesService legacy field wiring', () => {
  const contentLegacy = 'conteudo';
  const typeLegacy = 'tipo_servico';

  function make() {
    const qb: Record<string, jest.Mock> = {};
    qb['where'] = jest.fn(() => qb);
    qb['andWhere'] = jest.fn(() => qb);
    qb['getOne'] = jest.fn(async () => ({ id: 'tpl-1', tenant_id: 'tenant-1' }));
    const repo = {
      create: jest.fn((v: unknown) => ({ ...(v as object) })),
      save: jest.fn(async (v: unknown) => ({ id: 'tpl-new', ...(v as object) })),
      update: jest.fn(async () => ({ affected: 1 })),
      createQueryBuilder: jest.fn(() => qb),
    };
    const ds = { getRepository: jest.fn(() => repo) };
    return { service: new ContractTemplatesService(ds as never), repo };
  }

  it('the alias table is exactly the expected legacy -> canonical pairs', () => {
    expect({ ...CONTRACT_TEMPLATE_DEPRECATED_FIELDS }).toEqual({ [typeLegacy]: 'service_type', [contentLegacy]: 'content' });
  });

  it('create: legacy keys alone are persisted in the canonical columns; legacy keys dropped', async () => {
    const { service, repo } = make();
    await service.create('tenant-1', 'user-1', { name: 'T', [contentLegacy]: 'BODY', [typeLegacy]: 'distribution' } as never);
    const persisted = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(persisted['content']).toBe('BODY');
    expect(persisted['service_type']).toEqual(expect.any(String));
    expect(persisted['service_type']).toBeTruthy();
    expect(persisted).not.toHaveProperty(contentLegacy);
    expect(persisted).not.toHaveProperty(typeLegacy);
  });

  it('update: legacy keys alone are persisted in the canonical columns; legacy keys dropped', async () => {
    const { service, repo } = make();
    await service.update('tenant-1', 'tpl-1', { [contentLegacy]: 'BODY', [typeLegacy]: 'distribution' } as never);
    const patch = (repo.update.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(patch['content']).toBe('BODY');
    expect(patch['service_type']).toBeTruthy();
    expect(patch).not.toHaveProperty(contentLegacy);
    expect(patch).not.toHaveProperty(typeLegacy);
  });

  it('canonical wins over legacy on create and update', async () => {
    const { service, repo } = make();
    await service.create('tenant-1', 'user-1', { name: 'T', content: 'CANON', [contentLegacy]: 'LEGACY' } as never);
    await service.update('tenant-1', 'tpl-1', { content: 'CANON', [contentLegacy]: 'LEGACY' } as never);
    expect((repo.create.mock.calls[0][0] as Record<string, unknown>)['content']).toBe('CANON');
    expect(((repo.update.mock.calls[0] as unknown[])[1] as Record<string, unknown>)['content']).toBe('CANON');
  });
  it('create and update store the canonical service_type for a legacy category slug (and keep custom slugs untouched)', async () => {
    const { service, repo } = make();
    await service.create('tenant-1', 'user-1', { name: 'T', content: 'B', service_type: 'distribuicao' } as never);
    expect((repo.create.mock.calls[0][0] as Record<string, unknown>)['service_type']).toBe('distribution');
    await service.update('tenant-1', 'tpl-1', { service_type: 'distribuicao' } as never);
    expect(((repo.update.mock.calls[0] as unknown[])[1] as Record<string, unknown>)['service_type']).toBe('distribution');
    await service.update('tenant-1', 'tpl-1', { service_type: 'my-custom-slug' } as never);
    expect(((repo.update.mock.calls[1] as unknown[])[1] as Record<string, unknown>)['service_type']).toBe('my-custom-slug');
  });

  it('list(type) expands a platform category to every persisted spelling and filters a custom slug exactly', async () => {
    const qb: Record<string, jest.Mock> = {};
    for (const m of ['where', 'andWhere', 'orderBy', 'skip', 'take']) qb[m] = jest.fn(() => qb);
    qb['getManyAndCount'] = jest.fn(async () => [[], 0]);
    const repo = { createQueryBuilder: jest.fn(() => qb) };
    const service = new ContractTemplatesService({ getRepository: () => repo } as never);

    await service.list('tenant-1', { type: 'distribution' });
    expect(qb['andWhere']).toHaveBeenCalledWith('t.service_type IN (:...types)', { types: ['distribution', 'distribuicao'] });

    qb['andWhere'].mockClear();
    await service.list('tenant-1', { type: 'distribuicao' });
    expect(qb['andWhere']).toHaveBeenCalledWith('t.service_type IN (:...types)', { types: ['distribution', 'distribuicao'] });

    qb['andWhere'].mockClear();
    await service.list('tenant-1', { type: 'my-custom-slug' });
    expect(qb['andWhere']).toHaveBeenCalledWith('t.service_type = :type', { type: 'my-custom-slug' });
  });
});
