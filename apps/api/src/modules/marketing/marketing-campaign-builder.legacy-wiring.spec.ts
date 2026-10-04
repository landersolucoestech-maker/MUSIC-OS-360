import { MarketingCampaignBuilderService } from './marketing-campaign-builder.service';

/**
 * Legacy wiring: update(id, patch) must persist the canonical vocabulary even when the
 * patch (older web build) and/or the stored state carry pre-20260930000028 Portuguese values.
 */
describe('MarketingCampaignBuilderService.update legacy wiring', () => {
  const T = 'type';
  const P = 'platforms';
  const E = 'promotedEntityType';

  const makeRow = (payload: Record<string, unknown>) => ({
    id: 'c-1',
    tenant_id: 'tenant-a',
    name: 'Camp',
    objective: null,
    status: 'DRAFT',
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-02T00:00:00Z'),
    metadata: { marketingBuilder: { payload, validation: { valid: true, errors: [], warnings: [] } } },
  });

  const build = (stored: Record<string, unknown>) => {
    const repo = {
      findOne: jest.fn().mockResolvedValue(makeRow(stored)),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const service = new MarketingCampaignBuilderService({ getRepository: () => repo } as never);
    return { repo, service };
  };

  const validation = { valid: true, errors: [], warnings: [] };

  it('persists canonical type/platforms/entity type when the PATCH is legacy-shaped', async () => {
    const { repo, service } = build({ name: 'Camp' });
    await service.update('tenant-a', 'u-1', 'c-1', {
      [T]: 'trafego_pago',
      [P]: ['portal_noticias', 'bastidores'],
      [E]: 'artista',
    } as never, validation);

    const written = repo.update.mock.calls[0][1].metadata.marketingBuilder.payload;
    expect(written[T]).toBe('paid_traffic');
    expect(written[P]).toEqual(['news_portal', 'behind_the_scenes']);
    expect(written[E]).toBe('ARTIST');
    // negative: no legacy slug survives anywhere in the persisted blob
    const serialized = JSON.stringify(repo.update.mock.calls[0][1].metadata);
    expect(serialized).not.toContain('trafego_pago');
    expect(serialized).not.toContain('portal_noticias');
    expect(serialized).not.toContain('bastidores');
  });

  it('keeps a stored legacy campaign canonical when the patch touches an unrelated field', async () => {
    const { repo, service } = build({ name: 'Camp', [T]: 'lancamento_musical', [P]: ['campanha'] });
    await service.update('tenant-a', 'u-1', 'c-1', { name: 'Novo nome' } as never, validation);

    const written = repo.update.mock.calls[0][1].metadata.marketingBuilder.payload;
    expect(written.name).toBe('Novo nome');
    expect(written[T]).toBe('music_release');
    expect(written[P]).toEqual(['campaign']);
  });

  it('canonical patch values pass through unchanged (control)', async () => {
    const { repo, service } = build({ name: 'Camp' });
    await service.update('tenant-a', 'u-1', 'c-1', { [T]: 'organic', [P]: ['instagram'] } as never, validation);
    const written = repo.update.mock.calls[0][1].metadata.marketingBuilder.payload;
    expect(written[T]).toBe('organic');
    expect(written[P]).toEqual(['instagram']);
  });
});
