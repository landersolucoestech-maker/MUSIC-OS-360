import 'reflect-metadata';
import { ReleaseChecklistAutomation } from './release-checklist.automation';
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
 *  - SELECT ... FROM releases   → releaseRows
 *  - SELECT ... FROM skill_runs → skillRunRows (idempotency guard)
 *  - UPDATE                     → undefined
 */
function makeDs(releaseRows: unknown[], skillRunRows: unknown[] = []) {
  const query = jest.fn(async (sql: string) => {
    if (/FROM\s+skill_runs/i.test(sql)) return skillRunRows;
    if (/FROM\s+releases/i.test(sql)) return releaseRows;
    return undefined;
  });
  return { ds: { query }, query };
}

/** The runner's stale window (kept in sync with STALE_RUNNING_MINUTES). */
const STALE_RUNNING_MINUTES = 15;

/**
 * Status-aware mock (M1): emulates the runner's guard over the given runs —
 * 'success' always blocks; 'running' blocks only if RECENT (ageMinutes within the
 * window); stale 'running' and 'failed'/'cancelled' do not block.
 */
function makeDsWithRuns(
  releaseRows: unknown[],
  runs: Array<{ status: string; ageMinutes?: number }>,
) {
  const query = jest.fn(async (sql: string) => {
    if (/FROM\s+skill_runs/i.test(sql)) {
      const blocking = runs.filter(
        (r) =>
          r.status === 'success' ||
          (r.status === 'running' && (r.ageMinutes ?? 0) < STALE_RUNNING_MINUTES),
      );
      return blocking.length ? [{ '1': 1 }] : [];
    }
    if (/FROM\s+releases/i.test(sql)) return releaseRows;
    return undefined;
  });
  return { ds: { query }, query };
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    tenantId: 't1',
    payload: {
      releaseId: 'r1',
      tenantId: 't1',
      title: 'Aurora',
      type: 'single',
      artistId: 'a1',
      createdBy: 'u1',
      createdAt: new Date().toISOString(),
      ...overrides,
    },
  };
}

const RELEASE_ROW = {
  title: 'Aurora',
  type: 'single',
  release_date: null,
  upc: null,
  cover_url: null,
  artist_id: 'a1',
  artist_name: 'Banda Aurora',
  metadata: {},
};

const VALID_CHECKLIST_JSON = JSON.stringify({
  readinessScore: 42,
  status: 'needs-attention',
  missingItems: [{ item: 'ISRC', area: 'metadata', severity: 'high', reason: 'não emitido' }],
  criticalIssues: [],
  warnings: [],
  checklist: [{ item: 'Capa', completed: false, area: 'artwork', required: true }],
  recommendedActions: [{ action: 'Emitir ISRC', priority: 'high', ownerArea: 'A&R' }],
  metadataReview: { hasMinimumMetadata: false, missingMetadata: ['ISRC'], notes: [] },
});

const IDEMPOTENCY_KEY = 'release.created:t1:r1';

describe('ReleaseChecklistAutomation (release.created → release-checklist)', () => {
  it('flow: runs, records skill_run and stores releases.metadata.aiChecklist on success', async () => {
    const { ds, query } = makeDs([RELEASE_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_CHECKLIST_JSON);
    const handler = new ReleaseChecklistAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onReleaseCreated(makeEvent() as never);

    expect(skillRun.start).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        skillName: 'release-checklist',
        entityType: 'release',
        entityId: 'r1',
        input: { idempotencyKey: IDEMPOTENCY_KEY },
      }),
    );
    expect(skillRun.succeed).toHaveBeenCalledWith(
      'run-1', 't1', 'release-checklist',
      expect.objectContaining({ idempotencyKey: IDEMPOTENCY_KEY, status: 'generated' }),
    );
    expect(skillRun.fail).not.toHaveBeenCalled();

    // input montado a partir do release: artistName via join, hasUPC=false (upc null)
    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string; jsonMode: boolean }]>;
    const aiArg = aiCalls[0][0];
    expect(aiArg.jsonMode).toBe(true);
    expect(aiArg.prompt).toContain('Banda Aurora');

    // aiChecklist gravado via UPDATE
    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string));
    expect(updateCall).toBeDefined();
    const params = (updateCall as unknown as [string, string[]])[1];
    const meta = JSON.parse(params[0]);
    expect(meta.aiChecklist).toBeDefined();
    expect(meta.aiChecklist.source).toBe('native-automation');
    expect(meta.aiChecklist.skill).toBe('release-checklist');
    expect(meta.aiChecklist.event).toBe('release.created');
    expect(meta.aiChecklist.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(meta.aiChecklist.status).toBe('generated');
    expect(meta.aiChecklist.parsed.readinessScore).toBe(42);
  });

  it('Idempotency (metadata): does not reprocess if an aiChecklist with the same key already exists', async () => {
    const rowWithChecklist = {
      ...RELEASE_ROW,
      metadata: { aiChecklist: { idempotencyKey: IDEMPOTENCY_KEY, status: 'generated' } },
    };
    const { ds, query } = makeDs([rowWithChecklist]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_CHECKLIST_JSON);
    const handler = new ReleaseChecklistAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onReleaseCreated(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string));
    expect(updateCall).toBeUndefined();
  });

  it('Idempotency (skill_runs): does not reprocess if a successful run with the same key exists', async () => {
    const { ds, query } = makeDs([RELEASE_ROW], [{ '1': 1 }]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_CHECKLIST_JSON);
    const handler = new ReleaseChecklistAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onReleaseCreated(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string));
    expect(updateCall).toBeUndefined();
  });

  it('M1: a RECENT IN-PROGRESS run (running) with the same key blocks execution', async () => {
    const { ds, query } = makeDsWithRuns([RELEASE_ROW], [{ status: 'running', ageMinutes: 1 }]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_CHECKLIST_JSON);
    const handler = new ReleaseChecklistAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onReleaseCreated(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    // The SQL guard must always block 'success' and block 'running' only within the window (M1).
    const guardCall = query.mock.calls.find((c: unknown[]) => /FROM\s+skill_runs/i.test(c[0] as string));
    expect(guardCall).toBeDefined();
    const guardSql = guardCall ? (guardCall[0] as string) : '';
    expect(guardSql).toMatch(/status = 'success'/);
    expect(guardSql).toMatch(/status = 'running' AND started_at >= NOW\(\) -/);
    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string));
    expect(updateCall).toBeUndefined();
  });

  it('M1: an OLD/STALE IN-PROGRESS run (running) does NOT block (safe retry)', async () => {
    const { ds, query } = makeDsWithRuns([RELEASE_ROW], [{ status: 'running', ageMinutes: 60 }]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_CHECKLIST_JSON);
    const handler = new ReleaseChecklistAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onReleaseCreated(makeEvent() as never);

    // orphan 'running' (> window) does not count → runs again normally.
    expect(skillRun.start).toHaveBeenCalled();
    expect(ai.complete).toHaveBeenCalled();
    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string));
    expect(updateCall).toBeDefined();
  });

  it('M1: a SUCCESSFUL run (success) with the same key always blocks', async () => {
    const { ds } = makeDsWithRuns([RELEASE_ROW], [{ status: 'success' }]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_CHECKLIST_JSON);
    const handler = new ReleaseChecklistAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onReleaseCreated(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it('M1: a FAILED run (failed) with the same key does NOT block (safe retry)', async () => {
    const { ds, query } = makeDsWithRuns([RELEASE_ROW], [{ status: 'failed' }]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_CHECKLIST_JSON);
    const handler = new ReleaseChecklistAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onReleaseCreated(makeEvent() as never);

    // 'failed' does not count → runs again normally.
    expect(skillRun.start).toHaveBeenCalled();
    expect(ai.complete).toHaveBeenCalled();
    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string));
    expect(updateCall).toBeDefined();
  });

  it('B1: an error BEFORE start (load throws) does not propagate and records a best-effort fail', async () => {
    const boom = new Error('db unavailable during load');
    const query = jest.fn(async (sql: string) => {
      if (/FROM\s+skill_runs/i.test(sql)) return [];
      if (/FROM\s+releases/i.test(sql)) throw boom; // load() throws
      return undefined;
    });
    const ds = { query };
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_CHECKLIST_JSON);
    const handler = new ReleaseChecklistAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    // Must not throw (release.created is not reverted).
    await expect(handler.onReleaseCreated(makeEvent() as never)).resolves.toBeUndefined();

    // B1: recorded the best-effort fail of the pre-start skill_run.
    expect(skillRun.start).toHaveBeenCalledWith(
      expect.objectContaining({ skillName: 'release-checklist', entityId: 'r1' }),
    );
    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'release-checklist', boom);
    expect(skillRun.succeed).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string));
    expect(updateCall).toBeUndefined();
  });

  it('an AI failure records fail, does not rethrow and does not write aiChecklist', async () => {
    const { ds, query } = makeDs([RELEASE_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const handler = new ReleaseChecklistAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    // Must not throw (release.created is not reverted)
    await expect(handler.onReleaseCreated(makeEvent() as never)).resolves.toBeUndefined();

    expect(skillRun.start).toHaveBeenCalled();
    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'release-checklist', expect.any(Error));
    expect(skillRun.succeed).not.toHaveBeenCalled();
    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string));
    expect(updateCall).toBeUndefined();
  });

  it('Guard: absent tenantId/releaseId is ignored (no run, no query)', async () => {
    const { ds, query } = makeDs([RELEASE_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_CHECKLIST_JSON);
    const handler = new ReleaseChecklistAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onReleaseCreated({ tenantId: 't1', payload: { releaseId: '' } } as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
