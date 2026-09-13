import { BadRequestException } from '@nestjs/common';
import { EcadReportsService } from './ecad-reports.service';
import type { CreateEcadReportDto } from './dto/create-ecad-report.dto';

/**
 * find-1163c6ed: work_id had no cross-tenant ownership check — an ECAD
 * report could silently reference another tenant's work.
 */
describe('EcadReportsService — cross-tenant FK ownership (find-1163c6ed)', () => {
  function makeService(queryImpl: jest.Mock) {
    const qb: Record<string, jest.Mock> = {};
    const chain = () => qb;
    qb['where'] = jest.fn(chain);
    qb['andWhere'] = jest.fn(chain);
    qb['getOne'] = jest.fn(async () => ({ id: 'report-1', tenant_id: 'tenant-1' }));
    const repo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ id: 'report-1', ...(v as object) })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => qb),
    };
    const ds = { getRepository: jest.fn(() => repo), query: queryImpl };
    const service = new EcadReportsService(ds as never);
    return { service, repo };
  }

  it('create: rejects a work_id belonging to another tenant', async () => {
    const { service } = makeService(jest.fn(async () => []));
    await expect(
      service.create('tenant-1', 'user-1', {
        work_id: '323e4567-e89b-12d3-a456-426614174000', periodo: '2026-01',
      } as unknown as CreateEcadReportDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create: allows a work_id that belongs to the same tenant', async () => {
    const { service, repo } = makeService(jest.fn(async () => [{ exists: 1 }]));
    await expect(
      service.create('tenant-1', 'user-1', {
        work_id: '123e4567-e89b-12d3-a456-426614174000', periodo: '2026-01',
      } as unknown as CreateEcadReportDto),
    ).resolves.toBeDefined();
    expect(repo.save).toHaveBeenCalled();
  });

  it('update: does not re-validate work_id when the patch omits it (unchanged)', async () => {
    const query = jest.fn();
    const { service } = makeService(query);
    await expect(service.update('tenant-1', 'report-1', { status: 'sent' })).resolves.toBeDefined();
    expect(query).not.toHaveBeenCalled();
  });
});
