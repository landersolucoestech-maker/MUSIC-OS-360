import { BadRequestException } from '@nestjs/common';
import { ArtistGoalsService } from './artist-goals.service';
import type { CreateArtistGoalDto } from './dto/create-artist-goal.dto';

/**
 * find-78ff8a1e: artist_id had no cross-tenant ownership check — an artist
 * goal could silently reference (or be repointed to) another tenant's artist.
 */
describe('ArtistGoalsService — cross-tenant FK ownership (find-78ff8a1e)', () => {
  function makeService(queryImpl: jest.Mock) {
    const qb: Record<string, jest.Mock> = {};
    const chain = () => qb;
    qb['where'] = jest.fn(chain);
    qb['andWhere'] = jest.fn(chain);
    qb['getOne'] = jest.fn(async () => ({ id: 'goal-1', tenant_id: 'tenant-1' }));
    const repo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ id: 'goal-1', ...(v as object) })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => qb),
    };
    const ds = { getRepository: jest.fn(() => repo), query: queryImpl };
    const service = new ArtistGoalsService(ds as never);
    return { service, repo };
  }

  it('create: rejects an artist_id belonging to another tenant', async () => {
    const { service } = makeService(jest.fn(async () => []));
    await expect(
      service.create('tenant-1', 'user-1', {
        artist_id: '323e4567-e89b-12d3-a456-426614174000', title: 'Goal', type: 'revenue',
      } as unknown as CreateArtistGoalDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create: allows an artist_id that belongs to the same tenant', async () => {
    const { service, repo } = makeService(jest.fn(async () => [{ exists: 1 }]));
    await expect(
      service.create('tenant-1', 'user-1', {
        artist_id: '123e4567-e89b-12d3-a456-426614174000', title: 'Goal', type: 'revenue',
      } as unknown as CreateArtistGoalDto),
    ).resolves.toBeDefined();
    expect(repo.save).toHaveBeenCalled();
  });

  it('update: rejects repointing artist_id to another tenant', async () => {
    const { service } = makeService(jest.fn(async () => []));
    await expect(
      service.update('tenant-1', 'goal-1', { artist_id: '323e4567-e89b-12d3-a456-426614174000' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update: does not re-validate artist_id when the patch omits it (unchanged)', async () => {
    const query = jest.fn();
    const { service } = makeService(query);
    await expect(service.update('tenant-1', 'goal-1', { status: 'active' })).resolves.toBeDefined();
    expect(query).not.toHaveBeenCalled();
  });
});
