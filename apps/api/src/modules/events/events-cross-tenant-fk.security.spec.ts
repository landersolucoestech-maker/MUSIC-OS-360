import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { EventsService } from './events.service';

/**
 * find-50dd3726: events.artist_id had no cross-tenant ownership check — an
 * event could silently reference another tenant's artist.
 */
describe('EventsService — cross-tenant FK ownership (find-50dd3726)', () => {
  function makeService(queryImpl: jest.Mock) {
    const qb: Record<string, jest.Mock> = {};
    const chain = () => qb;
    qb['where'] = jest.fn(chain);
    qb['andWhere'] = jest.fn(chain);
    qb['getOne'] = jest.fn(async () => ({ id: 'event-1', tenant_id: 'tenant-1' }));
    const repo = {
      createQueryBuilder: jest.fn(() => qb),
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ id: 'event-1', ...(v as object) })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const ds = { getRepository: jest.fn(() => repo), query: queryImpl };
    const service = new EventsService(ds as never);
    return { service, repo };
  }

  it('create: rejects an artistId belonging to another tenant', async () => {
    const { service } = makeService(jest.fn(async () => []));
    await expect(
      service.create('tenant-1', 'user-1', {
        title: 'T', type: 'show', artistId: '323e4567-e89b-12d3-a456-426614174000',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create: allows an artistId that belongs to the same tenant', async () => {
    const { service, repo } = makeService(jest.fn(async () => [{ exists: 1 }]));
    await expect(
      service.create('tenant-1', 'user-1', {
        title: 'T', type: 'show', artistId: '223e4567-e89b-12d3-a456-426614174000',
      } as never),
    ).resolves.toBeDefined();
    expect(repo.save).toHaveBeenCalled();
  });

  it('update: rejects changing artistId to another tenant\'s artist', async () => {
    const { service } = makeService(jest.fn(async () => []));
    await expect(
      service.update('tenant-1', 'user-1', 'event-1', {
        artistId: '323e4567-e89b-12d3-a456-426614174000',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update: does not re-validate artistId when the patch omits it (unchanged)', async () => {
    const query = jest.fn();
    const { service } = makeService(query);
    await expect(
      service.update('tenant-1', 'user-1', 'event-1', { title: 'New Title' } as never),
    ).resolves.toBeDefined();
    expect(query).not.toHaveBeenCalled();
  });
});
