import { BadRequestException } from '@nestjs/common';
import { ContentDetectionsService } from './content-detections.service';
import type { CreateContentDetectionDto } from './dto/create-content-detection.dto';

/**
 * find-20d3d9bd: work_id/artist_id had no cross-tenant ownership check — a
 * content detection could silently reference another tenant's work/artist.
 */
describe('ContentDetectionsService — cross-tenant FK ownership (find-20d3d9bd)', () => {
  function makeService(queryImpl: jest.Mock) {
    const qb: Record<string, jest.Mock> = {};
    const chain = () => qb;
    qb['where'] = jest.fn(chain);
    qb['andWhere'] = jest.fn(chain);
    qb['getOne'] = jest.fn(async () => ({ id: 'detection-1', tenant_id: 'tenant-1' }));
    const repo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ id: 'detection-1', ...(v as object) })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => qb),
    };
    const ds = { getRepository: jest.fn(() => repo), query: queryImpl };
    const service = new ContentDetectionsService(ds as never);
    return { service, repo };
  }

  it('create: rejects a work_id belonging to another tenant', async () => {
    const { service } = makeService(jest.fn(async () => []));
    await expect(
      service.create('tenant-1', {
        plataforma: 'youtube', work_id: '323e4567-e89b-12d3-a456-426614174000',
      } as unknown as CreateContentDetectionDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create: rejects an artist_id belonging to another tenant', async () => {
    const { service } = makeService(jest.fn(async () => []));
    await expect(
      service.create('tenant-1', {
        plataforma: 'youtube', artist_id: '323e4567-e89b-12d3-a456-426614174000',
      } as unknown as CreateContentDetectionDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create: allows a work_id/artist_id that belong to the same tenant', async () => {
    const { service, repo } = makeService(jest.fn(async () => [{ exists: 1 }]));
    await expect(
      service.create('tenant-1', {
        plataforma: 'youtube',
        work_id: '123e4567-e89b-12d3-a456-426614174000',
        artist_id: '223e4567-e89b-12d3-a456-426614174000',
      } as unknown as CreateContentDetectionDto),
    ).resolves.toBeDefined();
    expect(repo.save).toHaveBeenCalled();
  });

  it('update: does not re-validate work_id/artist_id when the patch omits them (unchanged)', async () => {
    const query = jest.fn();
    const { service } = makeService(query);
    await expect(
      service.update('tenant-1', 'detection-1', { status: 'confirmed' }),
    ).resolves.toBeDefined();
    expect(query).not.toHaveBeenCalled();
  });
});
