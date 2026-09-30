import { MarketingContentsService } from './marketing-contents.service';

describe('MarketingContentsService.update — metadata merge', () => {
  const current = {
    id: 'c1',
    tenant_id: 't1',
    title: 'Existing',
    target_type: 'company',
    target_name: 'Empresa',
    channel: 'instagram',
    content_type: 'feed',
    status: 'scheduled',
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

describe('MarketingContentsService.create — domain event', () => {
  const savedRow = {
    id: 'c1',
    tenant_id: 't1',
    title: 'Novo post',
    target_type: 'artist',
    target_name: 'Banda Aurora',
    channel: 'instagram',
    content_type: 'feed',
    status: 'scheduled',
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

  it('emits marketing.content_created with the saved post\'s real id/channel/title', async () => {
    const service = new MarketingContentsService(dataSource as never, publishingQueue as never, events as never);

    await service.create('t1', 'u1', {
      title: 'Novo post',
      targetType: 'artist',
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


describe('MarketingContentsService — canonical status lifecycle (S8)', () => {
  const row = (over: Record<string, unknown> = {}) => ({
    id: 'c1', tenant_id: 't1', title: 'T', target_type: 'company', target_name: 'Empresa', channel: 'instagram',
    content_type: 'feed', status: 'scheduled', publication_status: 'queued', publish_date: '2026-01-01', publish_time: '10:00',
    scheduled_for: new Date('2026-01-01T10:00:00Z'), copy: 'c', notes: null, owner: null, campaign_id: null, project_id: null,
    format: null, files: [], metadata: {}, publication_error: null, published_at: null,
    created_at: new Date('2026-01-01T00:00:00Z'), updated_at: new Date('2026-01-01T00:00:00Z'), ...over,
  });
  const make = (current = row()) => {
    const repo = {
      create: jest.fn((v: unknown) => v),
      save: jest.fn(async (v: Record<string, unknown>) => ({ ...current, ...v })),
      findOne: jest.fn().mockResolvedValue(current),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const publishingQueue = { enqueueContentPublish: jest.fn().mockResolvedValue('job-1') };
    const events = { emitTyped: jest.fn() };
    const service = new MarketingContentsService({ getRepository: () => repo } as never, publishingQueue as never, events as never);
    return { service, repo, publishingQueue };
  };
  const dto = { title: 'T', targetType: 'company', targetName: 'Empresa', channel: 'instagram', type: 'feed', publishDate: '2026-01-01', publishTime: '10:00', copy: 'c' };

  beforeEach(() => jest.clearAllMocks());

  it("creates with the canonical default 'scheduled', queued, and enqueues the publish job", async () => {
    const { service, repo, publishingQueue } = make();
    await service.create('t1', 'u1', dto as never);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'scheduled', publication_status: 'queued' }));
    expect(publishingQueue.enqueueContentPublish).toHaveBeenCalledTimes(1);
  });

  it("a 'draft' is created pending and is never enqueued", async () => {
    const { service, repo, publishingQueue } = make(row({ status: 'draft', publication_status: 'pending' }));
    await service.create('t1', 'u1', { ...dto, status: 'draft' } as never);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'draft', publication_status: 'pending' }));
    expect(publishingQueue.enqueueContentPublish).not.toHaveBeenCalled();
  });

  it("re-queues when a content is set back to 'scheduled' after a failure", async () => {
    const { service, repo, publishingQueue } = make(row({ status: 'failed', publication_status: 'failed' }));
    // 1st read = current row, 2nd read (after the UPDATE) = the row as persisted by it.
    repo.findOne.mockResolvedValueOnce(row({ status: 'failed', publication_status: 'failed' }))
      .mockResolvedValueOnce(row({ status: 'scheduled', publication_status: 'queued' }));
    await service.update('t1', 'u1', 'c1', { status: 'scheduled' } as never);
    expect(repo.update.mock.calls[0][1]).toMatchObject({ status: 'scheduled', publication_status: 'queued', publication_error: null });
    expect(publishingQueue.enqueueContentPublish).toHaveBeenCalledTimes(1);
  });

  it('does not re-queue a published content', async () => {
    const { service, repo, publishingQueue } = make(row({ status: 'published', publication_status: 'published' }));
    await service.update('t1', 'u1', 'c1', { title: 'Renamed' } as never);
    expect(repo.update.mock.calls[0][1]).toMatchObject({ status: 'published', publication_status: 'published' });
    expect(publishingQueue.enqueueContentPublish).not.toHaveBeenCalled();
  });

  it("archives with the canonical 'cancelled' status", async () => {
    const { service, repo } = make();
    await service.archive('t1', 'u1', 'c1');
    expect(repo.update).toHaveBeenCalledWith(
      { id: 'c1', tenant_id: 't1' },
      expect.objectContaining({ status: 'cancelled', publication_status: 'cancelled', deleted_at: expect.any(Date) }),
    );
  });
});
