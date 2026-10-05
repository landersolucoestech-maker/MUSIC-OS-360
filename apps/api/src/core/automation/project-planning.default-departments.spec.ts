import 'reflect-metadata';
import { ProjectPlanningAutomation } from './project-planning.automation';
import { passThroughTenantContext } from '../../../test/helpers/tenant-context.mock';

/**
 * Behavioral proof of DEFAULT_DEPARTMENTS in project-planning.automation.ts: the department values `Distribuição`, `Jurídico`
 * and `Administrativo` (accented/PT-BR, as the departments are persisted and shown) are what the automation sends to the AI
 * prompt and writes into projects.metadata.aiPlan.parsed.suggestedOwners when the project does not declare its departments.
 * The automation, the skill runner and the real ai-skills prompt/parser run for real; only DB I/O, SkillRunService and the AI
 * gateway are doubles that record what crosses them.
 */
const DEFAULTS = ['A&R', 'Marketing', 'Audiovisual', 'Distribuição', 'Jurídico', 'Administrativo'];

function setup(metadata: Record<string, unknown>, aiContent: string) {
  const row = { title: 'Single Aurora', type: 'lancamento', description: 'd', artist_id: null, metadata };
  const query = jest.fn(async (sql: string) => {
    if (/FROM\s+skill_runs/i.test(sql)) return [];
    if (/FROM\s+projects/i.test(sql)) return [row];
    return undefined;
  });
  const ds = { query };
  const skillRun = {
    start: jest.fn(async () => 'run-1'), succeed: jest.fn(async () => undefined),
    fail: jest.fn(async () => undefined), log: jest.fn(async () => undefined),
  };
  const ai = {
    complete: jest.fn(async () => ({ content: aiContent, provider: 'openai', model: 'm', inputTokens: 1, outputTokens: 1, costUsd: 0, latencyMs: 1 })),
  };
  const handler = new ProjectPlanningAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);
  const event = { tenantId: 't1', payload: { projectId: 'p1', tenantId: 't1', title: 'Single Aurora', type: 'lancamento', artistId: null, completedBy: 'u1', completedAt: new Date().toISOString() } };
  return { handler, event, query, ai, skillRun };
}

async function persisted(query: jest.Mock): Promise<{ aiPlan: { parsed: { suggestedOwners: Array<{ department: string; responsibility: string }> } } }> {
  const update = query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string)) as unknown as [string, string[]];
  expect(update).toBeDefined();
  return JSON.parse(update[1][0]);
}

describe('ProjectPlanningAutomation default departments (platform department values)', () => {
  it('sends the exact default departments to the AI prompt when the project declares none', async () => {
    const { handler, event, ai } = setup({}, '{}');
    await handler.onProjectCompleted(event as never);
    const prompt = (ai.complete.mock.calls[0] as unknown as [{ prompt: string }])[0].prompt;
    expect(prompt).toContain(`Departamentos envolvidos: ${DEFAULTS.join(', ')}.`);
  });

  it('persists the exact default departments as suggestedOwners when the model returns no owners (fallback path)', async () => {
    const { handler, event, query } = setup({}, 'not json at all');
    await handler.onProjectCompleted(event as never);
    const meta = await persisted(query);
    expect(meta.aiPlan.parsed.suggestedOwners.map((o) => o.department)).toEqual(DEFAULTS);
    for (const d of ['Distribuição', 'Jurídico', 'Administrativo']) expect(meta.aiPlan.parsed.suggestedOwners.map((o) => o.department)).toContain(d);
  });

  it.each([
    ['empty departments array', { departments: [] }],
    ['departments not an array', { departments: 'Marketing' }],
  ])('falls back to the defaults for %s', async (_n, metadata) => {
    const { handler, event, ai } = setup(metadata, '{}');
    await handler.onProjectCompleted(event as never);
    const prompt = (ai.complete.mock.calls[0] as unknown as [{ prompt: string }])[0].prompt;
    expect(prompt).toContain(`Departamentos envolvidos: ${DEFAULTS.join(', ')}.`);
  });

  it('declared departments win: the defaults (and near-miss spellings) are not injected', async () => {
    const { handler, event, ai, query } = setup({ departments: ['Marketing', 'Financeiro'] }, 'not json');
    await handler.onProjectCompleted(event as never);
    const prompt = (ai.complete.mock.calls[0] as unknown as [{ prompt: string }])[0].prompt;
    expect(prompt).toContain('Departamentos envolvidos: Marketing, Financeiro.');
    for (const d of ['Distribuição', 'Jurídico', 'Administrativo']) expect(prompt).not.toContain(d);
    expect((await persisted(query)).aiPlan.parsed.suggestedOwners.map((o) => o.department)).toEqual(['Marketing', 'Financeiro']);
  });

  it('the defaults are the accented PT-BR values: unaccented near-misses never appear', async () => {
    const { handler, event, ai } = setup({}, '{}');
    await handler.onProjectCompleted(event as never);
    const prompt = (ai.complete.mock.calls[0] as unknown as [{ prompt: string }])[0].prompt;
    for (const bad of ['Distribuicao', 'Juridico', 'Administrativa', 'Administracao', 'Legal', 'Distribution']) expect(prompt).not.toContain(bad);
  });
});
