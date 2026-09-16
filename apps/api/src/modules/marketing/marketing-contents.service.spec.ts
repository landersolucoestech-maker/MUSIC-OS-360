import { MarketingContentsService } from './marketing-contents.service';

describe('MarketingContentsService.update — metadata merge', () => {
  const current = {
    id: 'c1',
    tenant_id: 't1',
    title: 'Existing',
    target_type: 'empresa',
    target_name: 'Empresa',
    channel: 'instagram',
    content_type: 'feed',
    status: 'agendado',
    publication_status: 'queued',
    publish_date: '2026-01-01',
    publish_time: '10:00',
    scheduled_for: new Date('2026-01-01T10:00:00Z'),
    copy: 'copy',
    notes: null,
    owner: null,
    campaign_id: null,
    project_id: null,
    format: null,
    files: [],
    metadata: { unrelatedKey: 'keep-me', creative: { version: 1, mode: 'template' } },
    publication_error: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  };
  const repo = {
    findOne: jest.fn().mockResolvedValue(current),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const dataSource = { getRepository: jest.fn(() => repo) };
  const publishingQueue = { enqueueContentPublish: jest.fn() };
  const events = { emitTyped: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('merges dto.metadata into current.metadata instead of replacing it wholesale', async () => {
    repo.findOne.mockResolvedValueOnce(current).mockResolvedValueOnce(current);
    const service = new MarketingContentsService(dataSource as never, publishingQueue as never, events as never);

    await service.update('t1', 'u1', 'c1', { metadata: { creative: { version: 1, mode: 'simple' } } } as never);

    const payload = repo.update.mock.calls[0][1];
    expect(payload.metadata).toEqual({
      unrelatedKey: 'keep-me', // preserved, not wiped
      creative: { version: 1, mode: 'simple' }, // updated key overwritten
    });
  });

  it('an update that never touches metadata leaves it completely untouched', async () => {
    repo.findOne.mockResolvedValueOnce(current).mockResolvedValueOnce(current);
    const service = new MarketingContentsService(dataSource as never, publishingQueue as never, events as never);

    await service.update('t1', 'u1', 'c1', { title: 'Renamed' } as never);

    const payload = repo.update.mock.calls[0][1];
    expect(payload.metadata).toBe(current.metadata);
  });
});

describe('MarketingContentsService.create — evento de domínio', () => {
  const savedRow = {
    id: 'c1',
    tenant_id: 't1',
    title: 'Novo post',
    target_type: 'artista',
    target_name: 'Banda Aurora',
    channel: 'instagram',
    content_type: 'feed',
    status: 'agendado',
    publication_status: 'queued',
    publish_date: '2026-01-01',
    publish_time: '10:00',
    scheduled_for: new Date('2026-01-01T10:00:00Z'),
    copy: 'Legenda inicial',
    notes: null,
    owner: null,
    campaign_id: null,
    project_id: null,
    format: null,
    files: [],
    metadata: {},
    publication_error: null,
    published_at: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z'),
  };
  const repo = {
    create: jest.fn((v: unknown) => v),
    save: jest.fn().mockResolvedValue(savedRow),
    findOne: jest.fn().mockResolvedValue(savedRow),
  };
  const dataSource = { getRepository: jest.fn(() => repo) };
  const publishingQueue = { enqueueContentPublish: jest.fn() };
  const events = { emitTyped: jest.fn() };

  beforeEach(() => jest.clearAllMocks());

  it('emite marketing.content_created com o id/canal/título reais do post salvo', async () => {
    const service = new MarketingContentsService(dataSource as never, publishingQueue as never, events as never);

    await service.create('t1', 'u1', {
      title: 'Novo post',
      targetType: 'artista',
      targetName: 'Banda Aurora',
      channel: 'instagram',
      type: 'feed',
      publishDate: '2026-01-01',
      publishTime: '10:00',
      copy: 'Legenda inicial',
    } as never);

    expect(events.emitTyped).toHaveBeenCalledWith(
      'marketing.content_created',
      expect.objectContaining({
        tenantId: 't1',
        userId: 'u1',
        aggregateType: 'marketing_content_post',
        aggregateId: 'c1',
        payload: { contentId: 'c1', tenantId: 't1', title: 'Novo post', channel: 'instagram', createdBy: 'u1' },
      }),
    );
  });
});
