import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { WorksService } from './works.service';

/**
 * find-f81eebf2: works.artist_id had no FK (DB or app-layer) — a work in one
 * tenant could silently reference an artist owned by a different tenant.
 */
describe('WorksService — cross-tenant FK ownership (find-f81eebf2)', () => {
  function makeService(queryImpl: jest.Mock) {
    const workRepo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ id: 'work-1', ...(v as object) })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => {
        const qb: Record<string, jest.Mock> = {};
        const chain = () => qb;
        qb['where'] = jest.fn(chain);
        qb['andWhere'] = jest.fn(chain);
        qb['getOne'] = jest.fn(async () => ({ id: 'work-1', tenant_id: 'tenant-1' }));
        return qb;
      }),
    };
    const participantsRepo = {
      createQueryBuilder: jest.fn(() => {
        const qb: Record<string, jest.Mock> = {};
        const chain = () => qb;
        qb['where'] = jest.fn(chain);
        qb['orderBy'] = jest.fn(chain);
        qb['getMany'] = jest.fn(async () => []);
        return qb;
      }),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const getRepository = jest.fn((entity: unknown) =>
      (entity as { name?: string })?.name === 'WorkParticipantEntity' ? participantsRepo : workRepo,
    );
    const ds = {
      getRepository,
      transaction: jest.fn((cb: (m: unknown) => unknown) => cb({ getRepository })),
      query: queryImpl,
    };
    const service = new WorksService(ds as never, { emitTyped: jest.fn() } as never);
    return { service, workRepo };
  }

  it('create: rejects an artist_id belonging to another tenant', async () => {
    const { service } = makeService(jest.fn(async () => []));
    await expect(
      service.create('tenant-1', 'user-1', {
        title: 'T', artist_id: '323e4567-e89b-12d3-a456-426614174000',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create: allows an artist_id that belongs to the same tenant', async () => {
    const { service, workRepo } = makeService(jest.fn(async () => [{ exists: 1 }]));
    await expect(
      service.create('tenant-1', 'user-1', {
        title: 'T', artist_id: '223e4567-e89b-12d3-a456-426614174000',
      } as never),
    ).resolves.toBeDefined();
    expect(workRepo.save).toHaveBeenCalled();
  });

  it('update: rejects changing artist_id to another tenant\'s artist', async () => {
    const { service } = makeService(jest.fn(async () => []));
    await expect(
      service.update('tenant-1', 'user-1', 'work-1', {
        artist_id: '323e4567-e89b-12d3-a456-426614174000',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update: does not re-validate artist_id when the patch omits it (unchanged)', async () => {
    const query = jest.fn();
    const { service } = makeService(query);
    await expect(
      service.update('tenant-1', 'user-1', 'work-1', { title: 'New Title' } as never),
    ).resolves.toBeDefined();
    expect(query).not.toHaveBeenCalled();
  });
});

describe('WorksService — ISRC normalization/validation (find-1e77a856)', () => {
  function makeService() {
    const workRepo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ id: 'work-1', ...(v as object) })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => {
        const qb: Record<string, jest.Mock> = {};
        const chain = () => qb;
        qb['where'] = jest.fn(chain);
        qb['andWhere'] = jest.fn(chain);
        qb['getOne'] = jest.fn(async () => ({ id: 'work-1', tenant_id: 'tenant-1' }));
        return qb;
      }),
    };
    const participantsRepo = {
      createQueryBuilder: jest.fn(() => {
        const qb: Record<string, jest.Mock> = {};
        const chain = () => qb;
        qb['where'] = jest.fn(chain);
        qb['orderBy'] = jest.fn(chain);
        qb['getMany'] = jest.fn(async () => []);
        return qb;
      }),
      delete: jest.fn().mockResolvedValue({ affected: 0 }),
    };
    const getRepository = jest.fn((entity: unknown) =>
      (entity as { name?: string })?.name === 'WorkParticipantEntity' ? participantsRepo : workRepo,
    );
    const ds = {
      getRepository,
      transaction: jest.fn((cb: (m: unknown) => unknown) => cb({ getRepository })),
      query: jest.fn(async () => [{ exists: 1 }]),
    };
    const service = new WorksService(ds as never, { emitTyped: jest.fn() } as never);
    return { service, workRepo };
  }

  it('normalizes hyphenated/lowercase ISRC to canonical uppercase-no-separator form before persist', async () => {
    const { service, workRepo } = makeService();
    await service.create('tenant-1', 'user-1', { title: 'T', isrc: 'br-abc-26-00001' } as never);
    expect((workRepo.create as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({ isrc: 'BRABC2600001' }),
    );
  });

  it('rejects a malformed ISRC', async () => {
    const { service } = makeService();
    await expect(
      service.create('tenant-1', 'user-1', { title: 'T', isrc: 'not-an-isrc' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
