import { BadRequestException } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import type { CreateCampaignDto } from './dto/campaigns.dto';

/**
 * find-c06511bf: CreateCampaignDto/UpdateCampaignDto's EN camelCase fields
 * (title/artistId/budget/currency/startsAt/endsAt) never matched
 * CampaignEntity's real PT snake_case columns (nome/artist_id/orcamento/
 * start_date/end_date) — TypeORM silently drops unrecognized plain
 * properties, so every campaign created via this DTO persisted with no
 * title/artist/budget/dates. find-50dd3726: artist_id also had no
 * cross-tenant ownership check.
 */
describe('CampaignsService', () => {
  function makeService(queryImpl: jest.Mock) {
    const repo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ id: 'campaign-1', ...(v as object) })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      createQueryBuilder: jest.fn(() => {
        const qb: Record<string, jest.Mock> = {};
        const chain = () => qb;
        qb['where'] = jest.fn(chain);
        qb['andWhere'] = jest.fn(chain);
        qb['getOne'] = jest.fn(async () => ({ id: 'campaign-1', tenant_id: 'tenant-1', status: 'draft' }));
        return qb;
      }),
    };
    const ds = { getRepository: jest.fn(() => repo), query: queryImpl };
    const workflowService = { getAllowedTransitions: jest.fn(() => []) };
    const events = { emitTyped: jest.fn() };
    const service = new CampaignsService(ds as never, workflowService as never, events as never);
    return { service, repo };
  }

  describe('create — DTO field mapping (find-c06511bf)', () => {
    it('maps title/artistId/budget/startsAt/endsAt to the real PT columns', async () => {
      const { service, repo } = makeService(jest.fn(async () => [{ exists: 1 }]));
      await service.create('tenant-1', 'user-1', {
        title: 'Lançamento X', type: 'launch', artistId: '223e4567-e89b-12d3-a456-426614174000',
        budget: 5000, startsAt: new Date('2026-01-01'), endsAt: new Date('2026-02-01'),
      } as unknown as CreateCampaignDto);

      const row = (repo.create as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      expect(row['nome']).toBe('Lançamento X');
      expect(row['artist_id']).toBe('223e4567-e89b-12d3-a456-426614174000');
      expect(row['orcamento']).toBe(5000);
      expect(row['start_date']).toEqual(new Date('2026-01-01'));
      expect(row['end_date']).toEqual(new Date('2026-02-01'));
      expect(row).not.toHaveProperty('title');
      expect(row).not.toHaveProperty('artistId');
      expect(row).not.toHaveProperty('budget');
    });

    it('folds currency/platforms (no dedicated column) into metadata instead of dropping them', async () => {
      const { service, repo } = makeService(jest.fn(async () => [{ exists: 1 }]));
      await service.create('tenant-1', 'user-1', {
        title: 'X', type: 'ads', currency: 'BRL', platforms: ['instagram'],
      } as unknown as CreateCampaignDto);

      const row = (repo.create as jest.Mock).mock.calls[0][0] as Record<string, unknown>;
      expect(row['metadata']).toEqual({ currency: 'BRL', platforms: ['instagram'] });
    });
  });

  describe('create — cross-tenant FK (find-50dd3726)', () => {
    it('rejects an artistId belonging to another tenant', async () => {
      const { service } = makeService(jest.fn(async () => []));
      await expect(
        service.create('tenant-1', 'user-1', {
          title: 'X', type: 'ads', artistId: '323e4567-e89b-12d3-a456-426614174000',
        } as unknown as CreateCampaignDto),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('allows an artistId that belongs to the same tenant', async () => {
      const { service, repo } = makeService(jest.fn(async () => [{ exists: 1 }]));
      await expect(
        service.create('tenant-1', 'user-1', {
          title: 'X', type: 'ads', artistId: '223e4567-e89b-12d3-a456-426614174000',
        } as unknown as CreateCampaignDto),
      ).resolves.toBeDefined();
      expect(repo.save).toHaveBeenCalled();
    });
  });

  describe('update — metadata read-modify-write (find-e0f93ecc)', () => {
    it('preserves previously stored metadata keys not mentioned in this PATCH', async () => {
      const { service, repo } = makeService(jest.fn(async () => [{ exists: 1 }]));
      repo.createQueryBuilder = jest.fn(() => {
        const qb: Record<string, jest.Mock> = {};
        const chain = () => qb;
        qb['where'] = jest.fn(chain);
        qb['andWhere'] = jest.fn(chain);
        qb['getOne'] = jest.fn(async () => ({
          id: 'campaign-1', tenant_id: 'tenant-1', status: 'draft',
          metadata: { platforms: ['instagram'], currency: 'BRL' },
        }));
        return qb;
      });

      await service.update('tenant-1', 'user-1', 'campaign-1', { currency: 'USD' } as never);

      const [, payload] = (repo.update as jest.Mock).mock.calls[0];
      expect(payload.metadata).toEqual({ platforms: ['instagram'], currency: 'USD' });
    });
  });
});
