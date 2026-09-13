import { BadRequestException } from '@nestjs/common';
import { MarketingAssetsService } from './marketing-assets.service';
import type { CreateMarketingAssetDto, UpdateMarketingAssetDto } from './dto/marketing-assets.dto';

/**
 * find-d0c3ebb4: marketing_project_id/artist_id/campaign_id/
 * audiovisual_project_id/source_upload_id had no cross-tenant ownership
 * check on either create() or update().
 */
describe('MarketingAssetsService — cross-tenant FK ownership (find-d0c3ebb4)', () => {
  function makeService(queryImpl: jest.Mock, findOneValue: unknown = { id: 'asset-1', tenant_id: 'tenant-1', status: 'draft', file_url: 'https://x/y.png' }) {
    const assetRepo = {
      findOne: jest.fn(async () => findOneValue),
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ id: 'asset-1', ...(v as object) })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const versionRepo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: unknown) => ({ id: 'version-1', ...(v as object) })),
      find: jest.fn().mockResolvedValue([]),
    };
    const approvalRepo = { find: jest.fn().mockResolvedValue([]) };
    const getRepository = jest.fn((entity: { name?: string }) => {
      if (entity?.name === 'MarketingAssetVersionEntity') return versionRepo;
      if (entity?.name === 'MarketingAssetApprovalEntity') return approvalRepo;
      return assetRepo;
    });
    const ds = {
      getRepository,
      transaction: jest.fn((cb: (m: unknown) => unknown) => cb({ getRepository })),
      query: queryImpl,
    };
    const events = { emitTyped: jest.fn() };
    const service = new MarketingAssetsService(ds as never, events as never);
    return { service, assetRepo };
  }

  it('create: rejects an artistId belonging to another tenant', async () => {
    const { service } = makeService(jest.fn(async () => []));
    await expect(
      service.create('tenant-1', 'user-1', {
        title: 'T', assetType: 'image', fileUrl: 'https://x/y.png',
        artistId: '323e4567-e89b-12d3-a456-426614174000',
      } as unknown as CreateMarketingAssetDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create: allows an artistId that belongs to the same tenant', async () => {
    const { service, assetRepo } = makeService(jest.fn(async () => [{ exists: 1 }]));
    await expect(
      service.create('tenant-1', 'user-1', {
        title: 'T', assetType: 'image', fileUrl: 'https://x/y.png',
        artistId: '223e4567-e89b-12d3-a456-426614174000',
      } as unknown as CreateMarketingAssetDto),
    ).resolves.toBeDefined();
    expect(assetRepo.save).toHaveBeenCalled();
  });

  it('update: rejects changing campaignId to another tenant\'s campaign', async () => {
    const { service } = makeService(jest.fn(async () => []));
    await expect(
      service.update('tenant-1', 'user-1', 'asset-1', {
        campaignId: '323e4567-e89b-12d3-a456-426614174000',
      } as unknown as UpdateMarketingAssetDto),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('update: does not re-validate FK fields when the patch omits them (unchanged)', async () => {
    const query = jest.fn();
    const { service } = makeService(query);
    await expect(
      service.update('tenant-1', 'user-1', 'asset-1', { title: 'New Title' } as unknown as UpdateMarketingAssetDto),
    ).resolves.toBeDefined();
    expect(query).not.toHaveBeenCalled();
  });
});
