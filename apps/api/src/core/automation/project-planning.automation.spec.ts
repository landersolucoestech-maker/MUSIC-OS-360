import 'reflect-metadata';
import { ProjectPlanningAutomation } from './project-planning.automation';
import { passThroughTenantContext } from '../../../test/helpers/tenant-context.mock';

// ─── Boundary mocks (DB / SkillRunService / AIService) ────────────────────────

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
  return { complete: jest.fn(async () => { throw new Error('Nenhum provider de AI configurado'); }) };
}

/**
 * DataSource mock that routes by SQL:
 *  - SELECT ... FROM skill_runs → skillRunRows (idempotency guard)
 *  - SELECT ... FROM projects   → projectRows
 *  - UPDATE                     → undefined
 */
function makeDs(projectRows: unknown[], skillRunRows: unknown[] = []) {
  const query = jest.fn(async (sql: string) => {
    if (/FROM\s+skill_runs/i.test(sql)) return skillRunRows;
    if (/FROM\s+projects/i.test(sql)) return projectRows;
    return undefined;
  });
  return { ds: { query }, query };
}

function makeEvent(type = 'lancamento') {
  return {
    tenantId: 't1',
    payload: {
      projectId: 'p1',
      tenantId: 't1',
      title: 'Single Aurora',
      type,
      artistId: null,
      completedBy: 'u1',
      completedAt: new Date().toISOString(),
    },
  };
}

const PROJECT_ROW = {
  nome: 'Single Aurora',
  type: 'lancamento',
  descricao: 'Lançamento do single Aurora',
  artist_id: null,
  end_date: null,
  metadata: {},
};

const VALID_PLAN_JSON = JSON.stringify({
  summary: 'Plano operacional do lançamento',
  phases: [{ name: 'Pré-lançamento', description: 'preparar', order: 1 }],
  tasks: [{ title: 'Pitch playlists', description: 'enviar', department: 'Marketing', priority: 'high' }],
  dependencies: [],
  risks: [],
  suggestedOwners: [],
  milestones: [],
  checklist: ['Confirmar metadados'],
});

const IDEMPOTENCY_KEY = 'project.completed:t1:p1';

describe('ProjectPlanningAutomation (project.completed → project-planning)', () => {
  it('Item 6/7: executes, records skill_run and writes projects.metadata.aiPlan on success', async () => {
    const { ds, query } = makeDs([PROJECT_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_PLAN_JSON);
    const handler = new ProjectPlanningAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onProjectCompleted(makeEvent() as never);

    // skill_run start with the correct fields
    expect(skillRun.start).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 't1',
        skillName: 'project-planning',
        entityType: 'project',
        entityId: 'p1',
        input: { idempotencyKey: IDEMPOTENCY_KEY },
      }),
    );
    // success recorded, no failure
    expect(skillRun.succeed).toHaveBeenCalledWith(
      'run-1', 't1', 'project-planning',
      expect.objectContaining({ idempotencyKey: IDEMPOTENCY_KEY, status: 'generated' }),
    );
    expect(skillRun.fail).not.toHaveBeenCalled();

    // aiPlan written via UPDATE
    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string));
    expect(updateCall).toBeDefined();
    const params = (updateCall as unknown as [string, string[]])[1];
    const meta = JSON.parse(params[0]);
    expect(meta.aiPlan).toBeDefined();
    expect(meta.aiPlan.source).toBe('native-automation');
    expect(meta.aiPlan.skill).toBe('project-planning');
    expect(meta.aiPlan.event).toBe('project.completed');
    expect(meta.aiPlan.idempotencyKey).toBe(IDEMPOTENCY_KEY);
    expect(meta.aiPlan.status).toBe('generated');
    expect(meta.aiPlan.parsed.summary).toContain('Plano operacional');
  });

  it('Item 8: idempotency — does not reprocess if aiPlan with the same key already exists', async () => {
    const rowWithPlan = {
      ...PROJECT_ROW,
      metadata: { aiPlan: { idempotencyKey: IDEMPOTENCY_KEY, status: 'generated' } },
    };
    const { ds, query } = makeDs([rowWithPlan]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_PLAN_JSON);
    const handler = new ProjectPlanningAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onProjectCompleted(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    // only the SELECT; no UPDATE
    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string));
    expect(updateCall).toBeUndefined();
  });

  it('R2: idempotency (skill_runs) — does not reprocess if a successful run with the same key already exists', async () => {
    const { ds, query } = makeDs([PROJECT_ROW], [{ '1': 1 }]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_PLAN_JSON);
    const handler = new ProjectPlanningAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onProjectCompleted(makeEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string));
    expect(updateCall).toBeUndefined();
  });

  it('Item 9: AI failure records fail, does not rethrow and does not write aiPlan', async () => {
    const { ds, query } = makeDs([PROJECT_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const handler = new ProjectPlanningAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    // Must not throw (project.completed is not rolled back)
    await expect(handler.onProjectCompleted(makeEvent() as never)).resolves.toBeUndefined();

    expect(skillRun.start).toHaveBeenCalled();
    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'project-planning', expect.any(Error));
    expect(skillRun.succeed).not.toHaveBeenCalled();
    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string));
    expect(updateCall).toBeUndefined();
  });

  it('Guard: non-music project is ignored (no run, no query)', async () => {
    const { ds, query } = makeDs([PROJECT_ROW]);
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_PLAN_JSON);
    const handler = new ProjectPlanningAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onProjectCompleted(makeEvent('financeiro') as never);

    // M2: isEligible=false blocks BEFORE any load/AI/start.
    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
