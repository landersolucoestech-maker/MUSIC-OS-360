import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { LicensingService } from './licensing.service';
import type { CreateLicenseDto } from './dto/licensing.dto';

/**
 * P1: create() accepted work_id/artist_id/client_id from the DTO with no
 * check that the referenced row belongs to the same tenant. No read-side
 * leak (every list/get still filters by the license's own tenant_id), but
 * a tenant could create a license dangling-referencing another tenant's
 * work/artist/client.
 */
function makeService(queryImpl: jest.Mock) {
  const repo = {
    create: jest.fn((data: unknown) => ({ ...(data as object) })),
    save: jest.fn(async (entity: unknown) => ({ id: 'license-new', ...(entity as object) })),
  };
  const ds = { getRepository: jest.fn(() => repo), query: queryImpl } as never;
  return new LicensingService(ds);
}

describe('LicensingService.create — FK cross-tenant (P1)', () => {
  it('rejects a work_id from another tenant (or nonexistent)', async () => {
    const svc = makeService(jest.fn(async () => []));
    await expect(svc.create('tenant-1', 'user-1', {
      work_id: 'work-from-another-tenant', title: 'X',
    } as unknown as CreateLicenseDto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects an artist_id from another tenant (or nonexistent)', async () => {
    const svc = makeService(jest.fn(async () => []));
    await expect(svc.create('tenant-1', 'user-1', {
      artist_id: 'artist-from-another-tenant', title: 'X',
    } as unknown as CreateLicenseDto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a client_id from another tenant (or nonexistent)', async () => {
    const svc = makeService(jest.fn(async () => []));
    await expect(svc.create('tenant-1', 'user-1', {
      client_id: 'client-from-another-tenant', title: 'X',
    } as unknown as CreateLicenseDto)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows when every reference belongs to the tenant', async () => {
    const svc = makeService(jest.fn(async () => [{ exists: 1 }]));
    await expect(svc.create('tenant-1', 'user-1', {
      work_id: 'work-1', artist_id: 'artist-1', client_id: 'client-1', title: 'X',
    } as unknown as CreateLicenseDto)).resolves.toBeDefined();
  });

  it('queries nothing when no reference is sent', async () => {
    const queryImpl = jest.fn(async () => [{ exists: 1 }]);
    const svc = makeService(queryImpl);
    await svc.create('tenant-1', 'user-1', { title: 'X' } as unknown as CreateLicenseDto);
    expect(queryImpl).not.toHaveBeenCalled();
  });
});
