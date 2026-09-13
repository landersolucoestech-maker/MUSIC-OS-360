import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { PhonogramsService } from './phonograms.service';

/**
 * find-f81eebf2: phonograms.work_id/artist_id had no FK (DB or app-layer) —
 * a phonogram in one tenant could silently reference a work/artist owned by
 * a different tenant, with nothing at the DB or service layer preventing it.
 */
describe('PhonogramsService — cross-tenant FK ownership (find-f81eebf2)', () => {
  function makeService(queryImpl: jest.Mock) {
    const repo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ id: 'phono-1', ...(v as object) })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => {
        const qb: Record<string, jest.Mock> = {};
        const chain = () => qb;
        qb['where'] = jest.fn(chain);
        qb['andWhere'] = jest.fn(chain);
        qb['getOne'] = jest.fn(async () => ({ id: 'phono-1', tenant_id: 'tenant-1', work_id: '123e4567-e89b-12d3-a456-426614174000' }));
        return qb;
      }),
    };
    const ds = { getRepository: jest.fn(() => repo), query: queryImpl };
    const service = new PhonogramsService(ds as never, { emitTyped: jest.fn() } as never);
    return { service, repo };
  }

  it('create: rejects a work_id belonging to another tenant', async () => {
    const { service } = makeService(jest.fn(async () => [])); // not found in this tenant
    await expect(
      service.create('tenant-1', 'user-1', { title: 'T', workId: '323e4567-e89b-12d3-a456-426614174000' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create: rejects an artist_id belonging to another tenant', async () => {
    const { service } = makeService(jest.fn(async () => [])); // artist_id check fails (no work_id provided, that check short-circuits)
    await expect(
      service.create('tenant-1', 'user-1', { title: 'T', artistId: '423e4567-e89b-12d3-a456-426614174000' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create: allows a work_id/artist_id that belong to the same tenant', async () => {
    const { service, repo } = makeService(jest.fn(async () => [{ exists: 1 }]));
    await expect(
      service.create('tenant-1', 'user-1', { title: 'T', workId: '123e4567-e89b-12d3-a456-426614174000', artistId: '223e4567-e89b-12d3-a456-426614174000' } as never),
    ).resolves.toBeDefined();
    expect(repo.save).toHaveBeenCalled();
  });

  it('update: rejects changing work_id to another tenant\'s work', async () => {
    const { service } = makeService(jest.fn(async () => []));
    await expect(
      service.update('tenant-1', 'user-1', 'phono-1', { workId: '323e4567-e89b-12d3-a456-426614174000' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update: does not re-validate work_id/artist_id when the patch omits them (unchanged)', async () => {
    const query = jest.fn();
    const { service } = makeService(query);
    await expect(
      service.update('tenant-1', 'user-1', 'phono-1', { title: 'New Title' } as never),
    ).resolves.toBeDefined();
    expect(query).not.toHaveBeenCalled();
  });
});

describe('PhonogramsService — ISRC normalization/validation (find-1e77a856)', () => {
  function makeService() {
    const repo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ id: 'phono-1', ...(v as object) })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => {
        const qb: Record<string, jest.Mock> = {};
        const chain = () => qb;
        qb['where'] = jest.fn(chain);
        qb['andWhere'] = jest.fn(chain);
        qb['getOne'] = jest.fn(async () => ({ id: 'phono-1', tenant_id: 'tenant-1' }));
        return qb;
      }),
    };
    const ds = { getRepository: jest.fn(() => repo), query: jest.fn(async () => [{ exists: 1 }]) };
    const service = new PhonogramsService(ds as never, { emitTyped: jest.fn() } as never);
    return { service, repo };
  }

  it('normalizes hyphenated/lowercase ISRC to canonical uppercase-no-separator form before persist', async () => {
    const { service, repo } = makeService();
    await service.create('tenant-1', 'user-1', { title: 'T', isrc: 'br-abc-26-00001' } as never);
    expect((repo.create as jest.Mock).mock.calls[0][0]).toEqual(
      expect.objectContaining({ isrc: 'BRABC2600001' }),
    );
  });

  it('rejects a malformed ISRC', async () => {
    const { service } = makeService();
    await expect(
      service.create('tenant-1', 'user-1', { title: 'T', isrc: 'not-an-isrc' } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('leaves an absent ISRC untouched (optional field)', async () => {
    const { service, repo } = makeService();
    await service.create('tenant-1', 'user-1', { title: 'T' } as never);
    expect((repo.create as jest.Mock).mock.calls[0][0]).not.toHaveProperty('isrc');
  });
});
