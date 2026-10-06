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

  it('accepts the stored tracks with their keys in another order', async () => {
    const { svc, repo } = build(baseRow({ metadata: { tracks: [{ id: 1, title: 'One', artist: 'Ana', isrc: 'BRABC2600001' }] } }));
    await svc.update('t1', 'u1', 'r1', { metadata: { tracks: [{ isrc: 'BRABC2600001', artist: 'Ana', title: 'One', id: 1 }] }, notes: 'ok' } as never);
    expect((repo.update as jest.Mock).mock.calls[0][1]).toMatchObject({ notes: 'ok' });
  });

  describe('assets and schedule of a frozen release', () => {
    const stored = { assets: { cover_url: 'https://cdn.example.test/a.jpg', audio_master_url: 'https://cdn.example.test/a.wav', press_release: 'old' }, schedule: { distributor_delivery_date: '2026-09-01', recording_date: '2026-05-01' } };

    it.each([
      ['a changed cover', { assets: { cover_url: 'https://cdn.example.test/new.jpg' } }, 'assets.cover_url'],
      ['a changed master audio', { assets: { audio_master_url: 'https://cdn.example.test/new.wav' } }, 'assets.audio_master_url'],
      ['a first lyrics text', { assets: { lyrics: 'new lyrics' } }, 'assets.lyrics'],
      ['a changed distributor delivery date', { schedule: { distributor_delivery_date: '2026-09-15' } }, 'schedule.distributor_delivery_date'],
    ])('rejects %s', async (_label, payload, field) => {
      const { svc, repo } = build(baseRow(stored));
      await expect(svc.update('t1', 'u1', 'r1', payload as never))
        .rejects.toMatchObject({ response: { code: 'RELEASE_DISTRIBUTED_IMMUTABLE', fields: expect.arrayContaining([field]) } });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('accepts a notes-only edit when the cover lives only in the column and the form posts it back inside assets', async () => {
      const { svc, repo } = build(baseRow({ cover_url: 'https://cdn.example.test/col.jpg', assets: null }));
      await svc.update('t1', 'u1', 'r1', { notes: 'ok', coverUrl: 'https://cdn.example.test/col.jpg', assets: { cover_url: 'https://cdn.example.test/col.jpg' } } as never);
      expect(repo.update).toHaveBeenCalled();
    });

    it('still rejects a different cover when the stored one lives only in the column', async () => {
      const { svc, repo } = build(baseRow({ cover_url: 'https://cdn.example.test/col.jpg', assets: {} }));
      await expect(svc.update('t1', 'u1', 'r1', { assets: { cover_url: 'https://cdn.example.test/other.jpg' } } as never))
        .rejects.toMatchObject({ response: { fields: expect.arrayContaining(['assets.cover_url']) } });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('does not report a change for surrounding whitespace in a stored value', async () => {
      const { svc, repo } = build(baseRow({ assets: { lyrics: 'La la la\n', credits: ' Ana ' } }));
      await svc.update('t1', 'u1', 'r1', { assets: { lyrics: 'La la la', credits: 'Ana' } } as never);
      expect(repo.update).toHaveBeenCalled();
    });

    it('pins the decision that a frozen key cannot be filled for the first time after distribution', async () => {
      const { svc, repo } = build(baseRow({ assets: {} }));
      await expect(svc.update('t1', 'u1', 'r1', { assets: { lyrics: 'late lyrics' } } as never))
        .rejects.toMatchObject({ response: { fields: expect.arrayContaining(['assets.lyrics']) } });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('accepts the form posting the stored values, blank keys and the keys that are not distribution data', async () => {
      const { svc, repo } = build(baseRow(stored));
      await svc.update('t1', 'u1', 'r1', {
        assets: { cover_url: 'https://cdn.example.test/a.jpg', lyrics: null, credits: '', press_release: 'new press text', epk_url: 'https://epk.example.test' },
        schedule: { distributor_delivery_date: '2026-09-01T00:00:00.000Z', recording_date: '2026-06-01', mix_master_date: null },
      } as never);
      expect(repo.update).toHaveBeenCalled();
    });
  });

  describe('a distributed release with no stored tracklist (created by import or API)', () => {
    const placeholder = {
      id: 1760000000000, title: '', artist: '', isrc: '', isAlternateVersion: false, versionType: '', versionCustomName: '',
      additionalArtists: [], producers: [], composers: [''], musicians: [], aiAssistanceLevel: '', instrumental: false,
      language: 'pt-br', lyrics: '', explicit: 'no', audioFile: null,
    };

    it('can still be edited from the form, which posts one untouched placeholder track', async () => {
      const { svc, repo } = build(baseRow({ metadata: { note: 'kept' } }));
      await svc.update('t1', 'u1', 'r1', { metadata: { tracks: [placeholder] }, notes: 'internal follow-up' } as never);
      expect((repo.update as jest.Mock).mock.calls[0][1]).toMatchObject({ notes: 'internal follow-up' });
    });

    it('treats an empty stored list the same way', async () => {
      const { svc, repo } = build(baseRow({ metadata: { tracks: [] } }));
      await svc.update('t1', 'u1', 'r1', { metadata: { tracks: [placeholder] }, notes: 'ok' } as never);
      expect(repo.update).toHaveBeenCalled();
    });

    it('rejects more than the single untouched placeholder, which would add tracks to a frozen release', async () => {
      const { svc, repo } = build(baseRow({ metadata: { tracks: [] } }));
      await expect(svc.update('t1', 'u1', 'r1', { metadata: { tracks: [placeholder, { ...placeholder, id: 2 }] } } as never))
        .rejects.toMatchObject({ response: { code: 'RELEASE_DISTRIBUTED_IMMUTABLE' } });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it.each([
      ['a title', { ...placeholder, title: 'New track' }],
      ['an isrc', { ...placeholder, isrc: 'BRABC2600001' }],
      ['a credited artist', { ...placeholder, additionalArtists: [{ name: 'X' }] }],
      ['an audio file', { ...placeholder, audioFile: { name: 'a.wav' } }],
      ['lyrics', { ...placeholder, lyrics: 'text' }],
      ['the instrumental flag set', { ...placeholder, instrumental: true }],
      ['the explicit flag set', { ...placeholder, explicit: 'yes' }],
      ['the alternate-version flag set', { ...placeholder, isAlternateVersion: true }],
    ])('still rejects a track with %s', async (_label, track) => {
      const { svc, repo } = build(baseRow({ metadata: { note: 'kept' } }));
      await expect(svc.update('t1', 'u1', 'r1', { metadata: { tracks: [track] } } as never))
        .rejects.toMatchObject({ response: { code: 'RELEASE_DISTRIBUTED_IMMUTABLE', fields: expect.arrayContaining(['metadata.tracks']) } });
      expect(repo.update).not.toHaveBeenCalled();
    });

    it('still rejects adding a real track next to a placeholder', async () => {
      const { svc } = build(baseRow({ metadata: { note: 'kept' } }));
      await expect(svc.update('t1', 'u1', 'r1', { metadata: { tracks: [placeholder, { ...placeholder, title: 'Real' }] } } as never))
        .rejects.toMatchObject({ response: { code: 'RELEASE_DISTRIBUTED_IMMUTABLE' } });
    });
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
