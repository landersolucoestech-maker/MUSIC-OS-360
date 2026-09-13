import { BadRequestException } from '@nestjs/common';
import { BriefingsService } from './briefings.service';
import type { CreateBriefingDto } from './dto/briefings.dto';

/**
 * find-50dd3726: briefings.campaign_id had no cross-tenant ownership check —
 * a briefing in one tenant could silently reference a campaign owned by a
 * different tenant.
 */
describe('BriefingsService — cross-tenant FK ownership (find-50dd3726)', () => {
  function makeService(queryImpl: jest.Mock) {
    const repo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ id: 'briefing-1', ...(v as object) })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => {
        const qb: Record<string, jest.Mock> = {};
        const chain = () => qb;
        qb['where'] = jest.fn(chain);
        qb['andWhere'] = jest.fn(chain);
        qb['getOne'] = jest.fn(async () => ({ id: 'briefing-1', tenant_id: 'tenant-1' }));
        return qb;
      }),
    };
    const ds = { getRepository: jest.fn(() => repo), query: queryImpl };
    const service = new BriefingsService(ds as never);
    return { service, repo };
  }

  it('create: rejects a campaignId belonging to another tenant', async () => {
    const { service } = makeService(jest.fn(async () => []));
    await expect(
      service.create('tenant-1', 'user-1', {
        title: 'T', campaignId: '323e4567-e89b-12d3-a456-426614174000',
      } as unknown as CreateBriefingDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create: allows a campaignId that belongs to the same tenant', async () => {
    const { service, repo } = makeService(jest.fn(async () => [{ exists: 1 }]));
    await expect(
      service.create('tenant-1', 'user-1', {
        title: 'T', campaignId: '223e4567-e89b-12d3-a456-426614174000',
      } as unknown as CreateBriefingDto),
    ).resolves.toBeDefined();
    expect(repo.save).toHaveBeenCalled();
  });

  it('update: rejects changing campaignId to another tenant\'s campaign', async () => {
    const { service } = makeService(jest.fn(async () => []));
    await expect(
      service.update('tenant-1', 'briefing-1', {
        campaignId: '323e4567-e89b-12d3-a456-426614174000',
      } as unknown as CreateBriefingDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update: does not re-validate campaignId when the patch omits it (unchanged)', async () => {
    const query = jest.fn();
    const { service } = makeService(query);
    await expect(
      service.update('tenant-1', 'briefing-1', { title: 'New Title' } as unknown as CreateBriefingDto),
    ).resolves.toBeDefined();
    expect(query).not.toHaveBeenCalled();
  });
});
