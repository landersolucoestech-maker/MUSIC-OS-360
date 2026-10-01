import 'reflect-metadata';
import { ArtistProfileAnalysisAutomation } from './artist-profile-analysis.automation';
import { passThroughTenantContext } from '../../../test/helpers/tenant-context.mock';

// ─── Boundary mocks (DB / SkillRunService / AIService) ──────────────────────────

function makeSkillRun() {
  return {
    start: jest.fn(async () => 'run-1'),
    succeed: jest.fn(async () => undefined),
    fail: jest.fn(async () => undefined),
    log: jest.fn(async () => undefined),
  };
}

function makeAi(content: string) {
  return {
    complete: jest.fn(async () => ({
      content,
      provider: 'openai',
      model: 'gpt-4o-mini',
      inputTokens: 1,
      outputTokens: 1,
      costUsd: 0,
      latencyMs: 1,
    })),
  };
}

function makeFailingAi() {
  return { complete: jest.fn(async () => { throw new Error('No AI provider configured'); }) };
}

/**
 * DataSource mock that routes by SQL:
 *  - SELECT ... FROM skill_runs → skillRunRows (idempotency guard)
 *  - SELECT ... FROM artists    → artistRows
 *  - UPDATE                     → undefined
 */
function makeDs(artistRows: unknown[], skillRunRows: unknown[] = []) {
  const query = jest.fn(async (sql: string) => {
    if (/FROM\s+skill_runs/i.test(sql)) return skillRunRows;
    if (/FROM\s+artists/i.test(sql)) return artistRows;
    return undefined;
  });
  return { ds: { query }, query };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 't1',
    payload: {
      artistId: 'a1',
      tenantId: 't1',
      stageName: 'Banda Aurora',
      status: 'active',
      createdBy: 'u1',
      ...overrides,
    },
  };
}

const ARTIST_ROW = {
  stage_name: 'Banda Aurora',
  music_genre: 'MPB',
  spotify_url: 'https://open.spotify.com/artist/4NHQUGzhtTLFvgF5SZesLK',
  youtube_url: null,
  deezer_url: null,
  apple_music_url: null,
  soundcloud_url: null,
  notes: 'Artista em desenvolvimento na cena independente.',
  metadata: {},
};

const VALID_ANALYSIS_JSON = JSON.stringify({
  positioning: 'Artista independente de MPB com identidade autoral',
  audienceAnalysis: 'Público jovem-adulto urbano',
  strengths: [{ point: 'Composição autoral', impact: 'Diferenciação no gênero' }],
  weaknesses: [{ point: 'Baixa presença em vídeo', risk: 'Alcance limitado', recommendation: 'Investir em clipes' }],
  opportunities: [{ opportunity: 'Playlists editoriais', priority: 'high', rationale: 'Encaixe de gênero' }],
  risks: [{ risk: 'Dependência de um único canal', severity: 'medium', mitigation: 'Diversificar plataformas' }],
  brandNarrative: 'A voz da nova MPB independente',
  recommendedActions: [{ action: 'Plano de conteúdo audiovisual', area: 'Marketing', priority: 'high' }],
  platformRecommendations: [{ platform: 'spotify', recommendation: 'Pitch para playlists', priority: 'high' }],
});

const IDEMPOTENCY_KEY = 'artist.created:t1:a1';

describe('ArtistProfileAnalysisAutomation (artist.created → artist-profile-analysis)', () => {
  it('flow: runs, records skill_run and stores artists.metadata.aiProfileAnalysis on success', async () => {
    const { ds, query } = makeDs([ARTIST_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_ANALYSIS_JSON);
    const handler = new ArtistProfileAnalysisAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onArtistCreated(makeEvent() as never);

    expect(skillRun.start).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        skillName: 'artist-profile-analysis',
        entityType: 'artist',
        entityId: 'a1',
        input: { idempotencyKey: IDEMPOTENCY_KEY },
      }),
    );
    expect(skillRun.succeed).toHaveBeenCalledWith(
      'run-1', 't1', 'artist-profile-analysis',
      expect.objectContaining({ idempotencyKey: IDEMPOTENCY_KEY, status: 'generated' }),
    );
    expect(skillRun.fail).not.toHaveBeenCalled();

    // assembled input: artistName, genre (MPB) and derived platform (spotify) in the prompt
    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string; jsonMode: boolean }]>;
    const aiArg = aiCalls[0][0];
    expect(aiArg.jsonMode).toBe(true);
    expect(aiArg.prompt).toContain('Banda Aurora');
    expect(aiArg.prompt).toContain('MPB');
    expect(aiArg.prompt).toContain('spotify');

    // aiProfileAnalysis gravado via UPDATE
    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string));
    expect(updateCall).toBeDefined();
    const params = (updateCall as unknown as [string, string[]])[1];
    const meta = JSON.parse(params[0]);
    expect(meta.aiProfileAnalysis).toBeDefined();
    expect(meta.aiProfileAnalysis.source).toBe('native-automation');
    expect(meta.aiProfileAnalysis.skill).toBe('artist-profile-analysis');
    expect(meta.aiProfileAnalysis.event).toBe('artist.created');
    expect(meta.aiProfileAnalysis.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(meta.aiProfileAnalysis.status).toBe('generated');
    expect(meta.aiProfileAnalysis.parsed.positioning).toContain('MPB');
  });

  it('Idempotency (metadata): does not reprocess if an aiProfileAnalysis with the same key exists', async () => {
    const rowWithAnalysis = {
      ...ARTIST_ROW,
      metadata: { aiProfileAnalysis: { idempotencyKey: IDEMPOTENCY_KEY, status: 'generated' } },
    };
    const { ds, query } = makeDs([rowWithAnalysis]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_ANALYSIS_JSON);
    const handler = new ArtistProfileAnalysisAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onArtistCreated(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string));
    expect(updateCall).toBeUndefined();
  });

  it('Idempotency (skill_runs): does not reprocess if an in-progress/successful run with the same key exists', async () => {
    const { ds, query } = makeDs([ARTIST_ROW], [{ '1': 1 }]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_ANALYSIS_JSON);
    const handler = new ArtistProfileAnalysisAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onArtistCreated(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string));
    expect(updateCall).toBeUndefined();
  });

  it('an AI failure records fail, does not rethrow and does not write aiProfileAnalysis', async () => {
    const { ds, query } = makeDs([ARTIST_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const handler = new ArtistProfileAnalysisAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    // Must not throw (artist.created is not reverted)
    await expect(handler.onArtistCreated(makeEvent() as never)).resolves.toBeUndefined();

    expect(skillRun.start).toHaveBeenCalled();
    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'artist-profile-analysis', expect.any(Error));
    expect(skillRun.succeed).not.toHaveBeenCalled();
    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string));
    expect(updateCall).toBeUndefined();
  });

  it('Guard: absent tenantId/artistId is ignored (no run, no query)', async () => {
    const { ds, query } = makeDs([ARTIST_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_ANALYSIS_JSON);
    const handler = new ArtistProfileAnalysisAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onArtistCreated({ tenantId: 't1', payload: { artistId: '' } } as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
