import 'reflect-metadata';
import { AssetClassificationService } from './asset-classification.service';
import { AssetEntity, AssetUsageLogEntity } from '../../database/entities';

function repo(overrides: Record<string, unknown> = {}) {
  return {
    create: jest.fn((x: Record<string, unknown>) => x),
    save: jest.fn(async (x: Record<string, unknown>) => ({ id: 'id', ...x })),
    findOne: jest.fn(async () => ({ id: 'asset-1', tenant_id: 't1', metadata: {} })),
    update: jest.fn(async () => undefined),
    ...overrides,
  };
}

function makeDs() {
  const repos = new Map<unknown, ReturnType<typeof repo>>();
  repos.set(AssetEntity, repo());
  repos.set(AssetUsageLogEntity, repo());
  return { ds: { getRepository: jest.fn((e: unknown) => repos.get(e)) }, repos };
}

const skillRuns = () => ({
  run: jest.fn(async (_p: unknown, fn: (ctx: { runId: string; log: () => Promise<void> }) => Promise<{ result: unknown }>) => {
    const out = await fn({ runId: 'r1', log: async () => undefined });
    return out.result;
  }),
});

describe('AssetClassificationService.classify (heuristic)', () => {
  const cases: Array<[string, string, string]> = [
    ['audio/wav', 'track.wav', 'wav'],
    ['audio/mpeg', 'track.mp3', 'mp3'],
    ['audio/wav', 'song_master.wav', 'master'],
    ['audio/wav', 'voz_guia.wav', 'guide_track'],
    ['audio/wav', 'beat_instrumental.wav', 'instrumental'],
    ['image/png', 'cover_art.png', 'cover_art'],
    ['image/jpeg', 'banner_topo.jpg', 'banner'],
    ['video/mp4', 'teaser_30s.mp4', 'teaser'],
    ['video/mp4', 'reels_final.mp4', 'reel'],
    ['video/mp4', 'lyric_oficial.mp4', 'lyric_video'],
    ['video/mp4', 'visualizer.mp4', 'visualizer'],
    ['video/mp4', 'videoclipe_oficial.mp4', 'music_video'],
    ['application/pdf', 'contrato_edicao.pdf', 'contract'],
    ['application/pdf', 'rider.pdf', 'document'],
    ['application/zip', 'pacote.zip', 'unknown'],
  ];
  it.each(cases)('classifies %s / %s → %s', (mime, name, expected) => {
    expect(AssetClassificationService.classify(mime, name).assetType).toBe(expected);
  });
});

describe('AssetClassificationService.classifyAndApply', () => {
  it('persists the type and logs a "classified" usage entry', async () => {
    const { ds, repos } = makeDs();
    const svc = new AssetClassificationService(ds as never, skillRuns() as never);

    const result = await svc.classifyAndApply('t1', 'asset-1', 'audio/wav', 'song_master.wav', 'audio', 'user-1');

    expect(result.assetType).toBe('master');
    expect(repos.get(AssetEntity)!.update).toHaveBeenCalledWith(
      { id: 'asset-1', tenant_id: 't1' },
      expect.objectContaining({ asset_type: 'master' }),
    );
    expect(repos.get(AssetUsageLogEntity)!.save).toHaveBeenCalled();
  });
});

describe('AssetClassificationService.review (manual)', () => {
  it.each([['guia', 'guide_track'], ['videoclipe', 'music_video'], ['contrato', 'contract'], ['guide_track', 'guide_track']])(
    'legacy input %s is persisted as canonical %s',
    async (sent, stored) => {
      const { ds, repos } = makeDs();
      const svc = new AssetClassificationService(ds as never, skillRuns() as never);
      const result = await svc.review('t1', 'asset-1', sent, 'user-1');
      expect(result.assetType).toBe(stored);
      expect(repos.get(AssetEntity)!.update).toHaveBeenCalledWith(
        { id: 'asset-1', tenant_id: 't1' },
        expect.objectContaining({ asset_type: stored, metadata: expect.objectContaining({ classification: expect.objectContaining({ assetType: stored }) }) }),
      );
    },
  );

  it('applies manual classification (confidence 1, method manual)', async () => {
    const { ds, repos } = makeDs();
    const svc = new AssetClassificationService(ds as never, skillRuns() as never);

    const result = await svc.review('t1', 'asset-1', 'cover_art', 'user-1');

    expect(result).toEqual({ assetType: 'cover_art', confidence: 1, method: 'manual' });
    expect(repos.get(AssetEntity)!.update).toHaveBeenCalledWith(
      { id: 'asset-1', tenant_id: 't1' },
      expect.objectContaining({ asset_type: 'cover_art' }),
    );
  });

  it('without DATA_SOURCE does not break (persistence noop)', async () => {
    const svc = new AssetClassificationService(null, skillRuns() as never);
    const result = await svc.review('t1', 'asset-1', 'wav', 'user-1');
    expect(result.method).toBe('manual');
  });
});
