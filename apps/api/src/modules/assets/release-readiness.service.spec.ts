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
  artist_id: 'art-1',
  work_id: null,
  participacao: { interprete: [{ id: 'p1', name: 'Banda Aurora', percentual: '100' }] },
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

  // ── Requisito de intérprete (participacao.interprete[]) ─────────────────────
  // Real shape confirmada contra FonogramaFormModal.tsx (ParticipacaoCategoria)
  // e contra o fix da DTO em create-phonogram.dto.ts (ParticipacaoDto) --
  // um objeto com categorias de array, não um array como a antiga
  // `@IsArray() participacao?: unknown[]` esperava.
  describe('metadados obrigatórios exigem ao menos um intérprete real (participacao.interprete)', () => {
    it('participacao ausente (undefined) → missing', async () => {
      const ph = { ...fullPhonogram, participacao: undefined };
      const svc = new ReleaseReadinessService(makeDs(ph) as never, skillRuns() as never, assetLinking(goodAssets) as never);
      const out = await svc.evaluate('t1', { projectId: 'proj-1', phonogramId: 'ph-1' });
      expect(out.requirements.find((r) => r.id === 'metadata')?.status).toBe('missing');
      expect(out.ready).toBe(false);
    });

    it('participacao null → missing', async () => {
      const ph = { ...fullPhonogram, participacao: null };
      const svc = new ReleaseReadinessService(makeDs(ph) as never, skillRuns() as never, assetLinking(goodAssets) as never);
      const out = await svc.evaluate('t1', { projectId: 'proj-1', phonogramId: 'ph-1' });
      expect(out.requirements.find((r) => r.id === 'metadata')?.status).toBe('missing');
    });

    it('participacao com todas as categorias vazias → missing', async () => {
      const ph = { ...fullPhonogram, participacao: { produtorFonografico: [], interprete: [], musicoAcompanhante: [] } };
      const svc = new ReleaseReadinessService(makeDs(ph) as never, skillRuns() as never, assetLinking(goodAssets) as never);
      const out = await svc.evaluate('t1', { projectId: 'proj-1', phonogramId: 'ph-1' });
      expect(out.requirements.find((r) => r.id === 'metadata')?.status).toBe('missing');
    });

    it('participantes presentes mas sem nenhum intérprete (só produtor) → missing', async () => {
      const ph = { ...fullPhonogram, participacao: { produtorFonografico: [{ id: 'p1', name: 'Produtor Y', percentual: '100' }], interprete: [] } };
      const svc = new ReleaseReadinessService(makeDs(ph) as never, skillRuns() as never, assetLinking(goodAssets) as never);
      const out = await svc.evaluate('t1', { projectId: 'proj-1', phonogramId: 'ph-1' });
      expect(out.requirements.find((r) => r.id === 'metadata')?.status).toBe('missing');
      expect(out.requirements.find((r) => r.id === 'metadata')?.detail).toContain('intérpretes');
    });

    it('interprete com nome em branco não conta como intérprete real → missing', async () => {
      const ph = { ...fullPhonogram, participacao: { interprete: [{ id: 'p1', name: '   ', percentual: '100' }] } };
      const svc = new ReleaseReadinessService(makeDs(ph) as never, skillRuns() as never, assetLinking(goodAssets) as never);
      const out = await svc.evaluate('t1', { projectId: 'proj-1', phonogramId: 'ph-1' });
      expect(out.requirements.find((r) => r.id === 'metadata')?.status).toBe('missing');
    });

    it('um intérprete válido → met', async () => {
      const ph = { ...fullPhonogram, participacao: { interprete: [{ id: 'p1', name: 'Banda Aurora', percentual: '100' }] } };
      const svc = new ReleaseReadinessService(makeDs(ph) as never, skillRuns() as never, assetLinking(goodAssets) as never);
      const out = await svc.evaluate('t1', { projectId: 'proj-1', phonogramId: 'ph-1' });
      expect(out.requirements.find((r) => r.id === 'metadata')?.status).toBe('met');
      expect(out.ready).toBe(true);
    });

    it('múltiplos intérpretes → met', async () => {
      const ph = {
        ...fullPhonogram,
        participacao: {
          interprete: [
            { id: 'p1', name: 'Banda Aurora', percentual: '60' },
            { id: 'p2', name: 'Convidado Y', percentual: '40' },
          ],
        },
      };
      const svc = new ReleaseReadinessService(makeDs(ph) as never, skillRuns() as never, assetLinking(goodAssets) as never);
      const out = await svc.evaluate('t1', { projectId: 'proj-1', phonogramId: 'ph-1' });
      expect(out.requirements.find((r) => r.id === 'metadata')?.status).toBe('met');
    });

    it('demais campos obrigatórios ausentes individualmente ainda bloqueiam mesmo com intérprete presente', async () => {
      const semTitulo = { ...fullPhonogram, title: null };
      const out1 = await new ReleaseReadinessService(makeDs(semTitulo) as never, skillRuns() as never, assetLinking(goodAssets) as never)
        .evaluate('t1', { projectId: 'proj-1', phonogramId: 'ph-1' });
      expect(out1.requirements.find((r) => r.id === 'metadata')?.status).toBe('missing');

      const semGenero = { ...fullPhonogram, music_genre: null };
      const out2 = await new ReleaseReadinessService(makeDs(semGenero) as never, skillRuns() as never, assetLinking(goodAssets) as never)
        .evaluate('t1', { projectId: 'proj-1', phonogramId: 'ph-1' });
      expect(out2.requirements.find((r) => r.id === 'metadata')?.status).toBe('missing');

      const semArtista = { ...fullPhonogram, artist_id: null };
      const out3 = await new ReleaseReadinessService(makeDs(semArtista) as never, skillRuns() as never, assetLinking(goodAssets) as never)
        .evaluate('t1', { projectId: 'proj-1', phonogramId: 'ph-1' });
      expect(out3.requirements.find((r) => r.id === 'metadata')?.status).toBe('missing');
    });
  });
});
