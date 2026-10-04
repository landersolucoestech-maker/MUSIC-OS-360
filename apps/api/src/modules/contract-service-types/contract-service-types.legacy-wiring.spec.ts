import { ContractServiceTypesService } from './contract-service-types.service';
import { CONTRACT_SERVICE_TYPE_DEPRECATED_FIELDS } from './dto/create-contract-service-type.dto';

/** Deploy-skew wiring: the legacy field name must reach the repository under the canonical column (create and update). */
describe('ContractServiceTypesService legacy field wiring', () => {
  const [[legacyKey, canonicalKey]] = Object.entries(CONTRACT_SERVICE_TYPE_DEPRECATED_FIELDS);

  function make() {
    const qb: Record<string, jest.Mock> = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    };
    const repo = {
      createQueryBuilder: jest.fn(() => qb),
      create: jest.fn((v: unknown) => ({ ...(v as object) })),
      save: jest.fn(async (v: unknown) => ({ id: 'cst-1', ...(v as object) })),
      update: jest.fn(async () => ({ affected: 1 })),
    };
    const ds = { getRepository: jest.fn(() => repo) };
    return { service: new ContractServiceTypesService(ds as never), repo, qb };
  }

  it('the alias table is the expected legacy -> canonical pair', () => {
    expect([legacyKey, canonicalKey]).toEqual(['conteudo', 'content']);
  });

  it('create: legacy key alone is persisted in the canonical column; legacy key dropped', async () => {
    const { service, repo } = make();
    await service.create('tenant-1', { name: 'N', slug: 's', [legacyKey]: 'BODY' } as never);
    const persisted = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(persisted[canonicalKey]).toBe('BODY');
    expect(persisted).not.toHaveProperty(legacyKey);
  });

  it('update: legacy key alone is persisted in the canonical column; legacy key dropped', async () => {
    const { service, repo, qb } = make();
    qb.getOne.mockResolvedValue({ id: 'cst-1', tenant_id: 'tenant-1' });
    await service.update('tenant-1', 'cst-1', { [legacyKey]: 'BODY' } as never);
    const patch = (repo.update.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(patch[canonicalKey]).toBe('BODY');
    expect(patch).not.toHaveProperty(legacyKey);
  });

  it('canonical wins over legacy on create and update', async () => {
    const { service, repo, qb } = make();
    await service.create('tenant-1', { name: 'N', slug: 's', [canonicalKey]: 'CANON', [legacyKey]: 'LEGACY' } as never);
    qb.getOne.mockResolvedValue({ id: 'cst-1', tenant_id: 'tenant-1' });
    await service.update('tenant-1', 'cst-1', { [canonicalKey]: 'CANON', [legacyKey]: 'LEGACY' } as never);
    expect((repo.create.mock.calls[0][0] as Record<string, unknown>)[canonicalKey]).toBe('CANON');
    expect(((repo.update.mock.calls[0] as unknown[])[1] as Record<string, unknown>)[canonicalKey]).toBe('CANON');
  });
});
