import 'reflect-metadata';
import { getMetadataArgsStorage } from 'typeorm';
import { PROJECT_PLANNING_COLUMNS, ProjectPlanningAutomation } from './project-planning.automation';
import { ProjectEntity } from '../../database/entities';
import { passThroughTenantContext } from '../../../test/helpers/tenant-context.mock';

// ─── Boundary mocks (DB / SkillRunService / AiService) ────────────────────────

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
  title: 'Single Aurora',
  type: 'lancamento',
  description: 'Lançamento do single Aurora',
  artist_id: null,
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

  it('the project SELECT reads only columns that exist on ProjectEntity (renamed nome/descricao/end_date never come back)', async () => {
    const entityColumns = new Set(
      getMetadataArgsStorage().columns.filter((c) => c.target === ProjectEntity).map((c) => c.propertyName),
    );
    const { ds, query } = makeDs([PROJECT_ROW]);
    const ai = makeAi(VALID_PLAN_JSON);
    const handler = new ProjectPlanningAutomation(ds as never, makeSkillRun() as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onProjectCompleted(makeEvent() as never);

    const select = query.mock.calls.map((c: unknown[]) => String(c[0])).find((sql) => /FROM\s+projects/i.test(sql) && /^\s*SELECT/i.test(sql));
    expect(select).toBeDefined();
    const selected = select!.match(/SELECT\s+([\s\S]+?)\s+FROM\s+projects/i)![1].split(',').map((c) => c.trim());
    expect(selected.length).toBeGreaterThan(0);
    for (const column of selected) expect(entityColumns).toContain(column);
    expect([...PROJECT_PLANNING_COLUMNS]).toEqual(selected);

    // The project title/description reach the skill prompt input.
    const prompt = JSON.stringify((ai.complete as jest.Mock).mock.calls[0]);
    expect(prompt).toContain('Single Aurora');
    expect(prompt).toContain('Lançamento do single Aurora');
  });
});

