import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { TakedownsService } from './takedowns.service';
import type { CreateTakedownDto } from './dto/takedowns.dto';

/**
 * P1: create() accepted work_id/artist_id from the DTO with no check that
 * the referenced row belongs to the same tenant.
 */
function makeService(queryImpl: jest.Mock) {
  const repo = {
    create: jest.fn((data: unknown) => ({ ...(data as object) })),
    save: jest.fn(async (entity: unknown) => ({ id: 'takedown-new', ...(entity as object) })),
  };
  const ds = { getRepository: jest.fn(() => repo), query: queryImpl } as never;
  return new TakedownsService(ds);
}

describe('TakedownsService.create — FK cross-tenant (P1)', () => {
  it('rejects a work_id from another tenant (or nonexistent)', async () => {
    const svc = makeService(jest.fn(async () => []));
    await expect(svc.create('tenant-1', 'user-1', {
      work_id: 'work-from-another-tenant', title: 'X',
    } as unknown as CreateTakedownDto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an artist_id from another tenant (or nonexistent)', async () => {
    const svc = makeService(jest.fn(async () => []));
    await expect(svc.create('tenant-1', 'user-1', {
      artist_id: 'artist-from-another-tenant', title: 'X',
    } as unknown as CreateTakedownDto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows when every reference belongs to the tenant', async () => {
    const svc = makeService(jest.fn(async () => [{ exists: 1 }]));
    await expect(svc.create('tenant-1', 'user-1', {
      work_id: 'work-1', artist_id: 'artist-1', title: 'X',
    } as unknown as CreateTakedownDto)).resolves.toBeDefined();
  });
});
