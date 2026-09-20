import 'reflect-metadata';
import { ReleaseReadinessService } from './release-readiness.service';
import { PhonogramEntity, WorkEntity } from '../../database/entities';

const skillRuns = () => ({
  run: jest.fn(async (_p: unknown, fn: (ctx: { runId: string; log: () => Promise<void> }) => Promise<{ result: unknown }>) => {
    const out = await fn({ runId: 'r1', log: async () => undefined });
    return out.result;
  }),
});

function assetLinking(assets: Array<{ assetType: string; status: string }>) {
  return { getProjectAssetsDetailed: jest.fn(async () => assets) };
}

function makeDs(phonogram: Record<string, unknown> | null, work: Record<string, unknown> | null = null) {
  const repos = new Map<unknown, { findOne: jest.Mock }>();
  repos.set(PhonogramEntity, { findOne: jest.fn(async () => phonogram) });
  repos.set(WorkEntity, { findOne: jest.fn(async () => work) });
  return { getRepository: jest.fn((e: unknown) => repos.get(e)) };
}

const fullPhonogram = {
  id: 'ph-1',
  tenant_id: 't1',
  title: 'Música X',
  isrc: 'BR-ABC-26-00001',
  music_genre: 'Pop',
  interpretes: 'Artista X',
  artist_id: 'art-1',
  work_id: null,
};

const goodAssets = [
  { assetType: 'cover_art', status: 'active' },
  { assetType: 'master', status: 'active' },
];

describe('ReleaseReadinessService.evaluate', () => {
  it('ready=true quando todos os requisitos obrigatórios estão atendidos', async () => {
    const svc = new ReleaseReadinessService(makeDs(fullPhonogram) as never, skillRuns() as never, assetLinking(goodAssets) as never);
    const out = await svc.evaluate('t1', { projectId: 'proj-1', phonogramId: 'ph-1' });
    expect(out.ready).toBe(true);
    expect(out.missing).toHaveLength(0);
    expect(out.requirements.find((r) => r.id === 'work')?.status).toBe('not_applicable');
  });

  it('ready=false quando falta capa', async () => {
    const assets = [{ assetType: 'master', status: 'active' }];
    const svc = new ReleaseReadinessService(makeDs(fullPhonogram) as never, skillRuns() as never, assetLinking(assets) as never);
    const out = await svc.evaluate('t1', { projectId: 'proj-1', phonogramId: 'ph-1' });
    expect(out.ready).toBe(false);
    expect(out.missing).toContain('cover_art');
  });

  it('ready=false quando falta ISRC', async () => {
    const svc = new ReleaseReadinessService(makeDs({ ...fullPhonogram, isrc: null }) as never, skillRuns() as never, assetLinking(goodAssets) as never);
    const out = await svc.evaluate('t1', { projectId: 'proj-1', phonogramId: 'ph-1' });
    expect(out.ready).toBe(false);
    expect(out.missing).toContain('isrc');
  });

  it('obra obrigatória quando há work_id: met se a obra existe', async () => {
    const ph = { ...fullPhonogram, work_id: 'work-1' };
    const svc = new ReleaseReadinessService(makeDs(ph, { id: 'work-1', tenant_id: 't1' }) as never, skillRuns() as never, assetLinking(goodAssets) as never);
    const out = await svc.evaluate('t1', { projectId: 'proj-1', phonogramId: 'ph-1' });
    expect(out.requirements.find((r) => r.id === 'work')?.status).toBe('met');
    expect(out.ready).toBe(true);
  });

  it('sem fonograma → bloqueia (phonogram + isrc + metadados missing)', async () => {
    const svc = new ReleaseReadinessService(makeDs(null) as never, skillRuns() as never, assetLinking(goodAssets) as never);
    const out = await svc.evaluate('t1', { projectId: 'proj-1', phonogramId: null });
    expect(out.ready).toBe(false);
    expect(out.missing).toEqual(expect.arrayContaining(['phonogram', 'isrc', 'metadata']));
  });
});
