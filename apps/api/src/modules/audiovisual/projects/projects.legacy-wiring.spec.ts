import { AudiovisualProjectsService } from './projects.service';
import { AUDIOVISUAL_PROJECT_DEPRECATED_FIELDS } from '../dto/audiovisual.dto';

/**
 * Deploy-skew wiring: a pre-rename web build still sends the legacy field name; the service must persist it under
 * the canonical column. Asserts what reaches the repository (persistence boundary), not the alias util in isolation.
 */
describe('AudiovisualProjectsService legacy field wiring', () => {
  const [[legacyKey, canonicalKey]] = Object.entries(AUDIOVISUAL_PROJECT_DEPRECATED_FIELDS);

  function make() {
    const repo = {
      create: jest.fn((v: unknown) => ({ ...(v as object) })),
      save: jest.fn(async (v: unknown) => ({ id: 'p1', ...(v as object) })),
      update: jest.fn(async () => ({ affected: 1 })),
      findOne: jest.fn(async () => ({ id: 'p1', tenant_id: 'tenant-1' })),
    };
    const ds = { getRepository: jest.fn(() => repo) };
    return { service: new AudiovisualProjectsService(ds as never, {} as never), repo };
  }

  it('the alias table is the expected legacy -> canonical pair', () => {
    expect([legacyKey, canonicalKey]).toEqual(['videomaker', 'videographer']);
  });

  it('create: legacy key alone is persisted in the canonical column and the legacy key is dropped', async () => {
    const { service, repo } = make();
    await service.create('tenant-1', 'user-1', { title: 'Clip', [legacyKey]: 'Ana' } as never);
    const persisted = repo.create.mock.calls[0][0] as Record<string, unknown>;
    expect(persisted[canonicalKey]).toBe('Ana');
    expect(persisted).not.toHaveProperty(legacyKey);
    const saved = repo.save.mock.calls[0][0] as Record<string, unknown>;
    expect(saved[canonicalKey]).toBe('Ana');
  });

  it('update: legacy key alone is persisted in the canonical column and the legacy key is dropped', async () => {
    const { service, repo } = make();
    await service.update('tenant-1', 'user-1', 'p1', { [legacyKey]: 'Ana' } as never);
    const patch = (repo.update.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
    expect(patch[canonicalKey]).toBe('Ana');
    expect(patch).not.toHaveProperty(legacyKey);
  });

  it('canonical wins over legacy on create and update', async () => {
    const { service, repo } = make();
    await service.create('tenant-1', 'user-1', { title: 'Clip', [canonicalKey]: 'Canon', [legacyKey]: 'Legacy' } as never);
    await service.update('tenant-1', 'user-1', 'p1', { [canonicalKey]: 'Canon', [legacyKey]: 'Legacy' } as never);
    expect((repo.create.mock.calls[0][0] as Record<string, unknown>)[canonicalKey]).toBe('Canon');
    expect(((repo.update.mock.calls[0] as unknown[])[1] as Record<string, unknown>)[canonicalKey]).toBe('Canon');
  });
});
