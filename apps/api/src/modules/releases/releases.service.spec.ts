import { ReleaseStatus } from '@music-os-360/types';
import { ReleasesService } from './releases.service';

/**
 * find-ed7823e9 — proof of the real initial state: every created release starts
 * in DRAFT, regardless of what the client sends. Any consumer that treats
 * "just created" as distributed is wrong by construction.
 */
describe('ReleasesService.create — initial state', () => {
  function build() {
    const repo = {
      create: jest.fn((v: Record<string, unknown>) => v),
      save: jest.fn(async (v: Record<string, unknown>) => ({ id: 'r-new', created_at: new Date(), ...v })),
    };
    const ds = { getRepository: jest.fn(() => repo) };
    const events = { emitTyped: jest.fn() };
    const workflow = { getAllowedTransitions: jest.fn(() => []), transitionInTx: jest.fn() };
    const svc = new ReleasesService(ds as never, workflow as never, events as never);
    return { svc, repo, events, workflow };
  }

  it('persists status DRAFT even if the payload tries another status', async () => {
    const { svc, repo } = build();
    await svc.create('t1', 'u1', { title: 'X', type: 'single', status: 'distributed' } as never);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ status: ReleaseStatus.DRAFT, tenant_id: 't1' }));
  });

  it('does not emit RELEASE_DISTRIBUTED on creation', async () => {
    const { svc, events } = build();
    await svc.create('t1', 'u1', { title: 'X', type: 'single' } as never);
    const emitted = events.emitTyped.mock.calls.map((c) => c[0]);
    expect(emitted).not.toContain('release.distributed');
  });
});

// ─── Post-distribution freeze ───────────────────────────────────────────────────

describe('ReleasesService.update: distribution data is frozen after distribution', () => {
  function makeQb(rows: Record<string, unknown>[]) {
    const qb: Record<string, jest.Mock> = {};
    const chain = () => qb;
    for (const name of ['leftJoinAndMapOne', 'select', 'where', 'andWhere']) qb[name] = jest.fn(chain);
    qb['getOne'] = jest.fn(async () => rows[0] ?? null);
    return qb;
  }

  function build(row: Record<string, unknown>) {
    const qb = makeQb([row]);
    const repo = {
      createQueryBuilder: jest.fn(() => qb),
      update: jest.fn(async () => ({ affected: 1 })),
    };
    const ds = { getRepository: jest.fn(() => repo) };
    const events = { emitTyped: jest.fn() };
    const workflow = { getAllowedTransitions: jest.fn(() => []), transitionInTx: jest.fn() };
    const svc = new ReleasesService(ds as never, workflow as never, events as never);
    return { svc, repo };
  }

  const baseRow = (overrides: Record<string, unknown> = {}) => ({
    id: 'r1',
    tenant_id: 't1',
    title: 'Album One',
    type: 'album',
    status: ReleaseStatus.DISTRIBUTED,
    artist_id: 'a1',
    upc: '123456789012',
    distributor: 'Distributor X',
    release_date: new Date('2026-08-01T00:00:00.000Z'),
    cover_url: 'https://r2/cover.jpg',
    platforms: ['spotify'],
    metadata: { tracks: [{ title: 'One' }], note: 'kept' },
    ...overrides,
  });

  it.each([
    ['title', { title: 'Another Title' }],
    ['upc', { upc: '999999999999' }],
    ['distributor', { distributor: 'Distributor Y' }],
    ['release_date', { releasedAt: '2026-09-15' }],
    ['cover_url', { coverUrl: 'https://r2/other.jpg' }],
    ['platforms', { platforms: ['apple'] }],
    ['metadata.tracks', { metadata: { tracks: [{ title: 'Two' }] } }],
  ])('rejects a change of %s on a distributed release and writes nothing', async (field, patch) => {
    const { svc, repo } = build(baseRow());
    await expect(svc.update('t1', 'u1', 'r1', patch as never))
      .rejects.toMatchObject({ response: { code: 'RELEASE_DISTRIBUTED_IMMUTABLE', fields: expect.arrayContaining([field]) } });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it.each([ReleaseStatus.DISTRIBUTED, ReleaseStatus.RELEASED, ReleaseStatus.ARCHIVED])('is enforced in status %s', async (status) => {
    const { svc, repo } = build(baseRow({ status }));
    await expect(svc.update('t1', 'u1', 'r1', { title: 'Changed' } as never))
      .rejects.toMatchObject({ response: { code: 'RELEASE_DISTRIBUTED_IMMUTABLE' } });
    expect(repo.update).not.toHaveBeenCalled();
  });

  it('accepts the stored values again (same day for the release date), so the whole-form save keeps working', async () => {
    const { svc, repo } = build(baseRow());
    await svc.update('t1', 'u1', 'r1', {
      title: 'Album One',
      upc: '123456789012',
      releasedAt: '2026-08-01',
      platforms: ['spotify'],
      metadata: { tracks: [{ title: 'One' }] },
      notes: 'internal follow-up',
    } as never);
    expect((repo.update as jest.Mock).mock.calls[0][1]).toMatchObject({ notes: 'internal follow-up' });
  });

  it('still allows notes and unrelated metadata keys on a distributed release', async () => {
    const { svc, repo } = build(baseRow());
    await svc.update('t1', 'u1', 'r1', { notes: 'ticket 4471 opened', metadata: { follow_up: 'waiting' } } as never);
    const written = (repo.update as jest.Mock).mock.calls[0][1] as Record<string, unknown>;
    expect(written['notes']).toBe('ticket 4471 opened');
    expect(written['metadata']).toEqual({ tracks: [{ title: 'One' }], note: 'kept', follow_up: 'waiting' });
  });

  it.each([ReleaseStatus.DRAFT, ReleaseStatus.REVIEW, ReleaseStatus.APPROVED, ReleaseStatus.SCHEDULED])('does not freeze a release in %s', async (status) => {
    const { svc, repo } = build(baseRow({ status }));
    await svc.update('t1', 'u1', 'r1', { title: 'Changed' } as never);
    expect((repo.update as jest.Mock).mock.calls[0][1]).toMatchObject({ title: 'Changed' });
  });
});
