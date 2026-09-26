import { MarketingCampaignBuilderService } from './marketing-campaign-builder.service';

describe('MarketingCampaignBuilderService tenant persistence', () => {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue([]),
  };
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
    update: jest.fn(),
  };
  const dataSource = { getRepository: jest.fn(() => repo) };

  beforeEach(() => jest.clearAllMocks());

  it('filters list queries by tenant and canonical builder type', async () => {
    const service = new MarketingCampaignBuilderService(dataSource as never);
    await service.list('tenant-a');
    expect(qb.where).toHaveBeenCalledWith('campaign.tenant_id = :tenantId', {
      tenantId: 'tenant-a',
    });
    expect(qb.andWhere).toHaveBeenCalledWith('campaign.type = :type', {
      type: 'marketing_builder',
    });
  });

  it('does not return a campaign belonging to another tenant', async () => {
    repo.findOne.mockResolvedValue(null);
    const service = new MarketingCampaignBuilderService(dataSource as never);
    await expect(service.find('tenant-a', 'campaign-b')).rejects.toThrow('Campanha não encontrada.');
    expect(repo.findOne).toHaveBeenCalledWith({
      where: expect.objectContaining({ tenant_id: 'tenant-a', id: 'campaign-b' }),
    });
  });
});
