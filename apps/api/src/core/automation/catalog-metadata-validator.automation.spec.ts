import 'reflect-metadata';
import { CatalogMetadataValidatorAutomation } from './catalog-metadata-validator.automation';
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
  return { complete: jest.fn(async () => { throw new Error('No AI provider configured'); }) };
}

/**
 * DataSource mock that routes by SQL:
 *  - SELECT ... FROM skill_runs → skillRunRows
 *  - SELECT ... FROM works      → workRows
 *  - SELECT ... FROM phonograms → recordingRows
 *  - UPDATE                     → undefined
 */
function makeDs(opts: { works?: unknown[]; recordings?: unknown[]; skillRuns?: unknown[] }) {
  const query = jest.fn(async (sql: string) => {
    if (/FROM\s+skill_runs/i.test(sql)) return opts.skillRuns ?? [];
    if (/FROM\s+works/i.test(sql)) return opts.works ?? [];
    if (/FROM\s+phonograms/i.test(sql)) return opts.recordings ?? [];
    return undefined;
  });
  return { ds: { query }, query };
}

const WORK_ROW = {
  title: 'Aurora',
  // `compositor` (singular, free-text) genuinely has a writer -- the Reports
  // bulk-import engine writes raw SQL against col()/importable fields,
  // bypassing CreateWorkDto (see work-participants-normalization.spec.ts).
  // Merged with `compositores` (plural, the real form's own field),
  // deduplicated by name -- 'Ana Lima' appears in both on purpose.
  compositor: 'Ana Lima; Carla Dias',
  compositores: ['Ana Lima', 'Bruno Sá'],
  editora: 'Editora X',
  isrc: null,
  metadata: {},
};

const RECORDING_ROW = {
  title: 'Aurora (Ao Vivo)',
  participacao: {
    interprete: [{ name: 'Banda Aurora' }, { name: 'Convidado Y' }],
    produtorFonografico: [{ name: 'Produtor Z' }],
  },
  isrc: 'BR-ABC-24-00001',
  gravadora: 'Selo Y',
  metadata: {},
};

const VALID_JSON = JSON.stringify({
  isValid: true,
  score: 88,
  errors: [],
  warnings: [],
  missingFields: [],
  duplicateRisks: [],
  rightsRisks: [],
  normalizedMetadata: { title: 'Aurora', type: 'work', composers: [{ name: 'Ana Lima' }], performers: [], producers: [], shares: [] },
  recommendedFixes: [],
});

function workEvent() {
  return { tenantId: 't1', payload: { tenantId: 't1', workId: 'w1', createdBy: 'u1' } };
}
function recordingEvent() {
  return { tenantId: 't1', payload: { tenantId: 't1', recordingId: 'r1', createdBy: 'u1' } };
}

describe('CatalogMetadataValidatorAutomation', () => {
  // ── Work ────────────────────────────────────────────────────────────────────

  it('work: executes, records skill_run and writes works.metadata.aiCatalogValidation', async () => {
    const { ds, query } = makeDs({ works: [WORK_ROW] });
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new CatalogMetadataValidatorAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onWorkCreated(workEvent() as never);

    expect(skillRun.start).toHaveBeenCalledWith(
      expect.objectContaining({
        skillName: 'catalog-metadata-validator',
        entityType: 'work',
        entityId: 'w1',
        input: { idempotencyKey: 'catalog.work.created:t1:w1' },
      }),
    );
    expect(skillRun.succeed).toHaveBeenCalled();
    expect(skillRun.fail).not.toHaveBeenCalled();

    // input: type=work + compositores (plural, real form field) merged with
    // compositor (singular, bulk-import), deduplicated by name in the prompt
    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string; jsonMode: boolean }]>;
    expect(aiCalls[0][0].prompt).toContain('obra musical (work)');
    expect(aiCalls[0][0].prompt).toContain('Ana Lima');
    expect(aiCalls[0][0].prompt).toContain('Bruno Sá');
    expect(aiCalls[0][0].prompt).toContain('Carla Dias');
    expect((aiCalls[0][0].prompt.match(/Ana Lima/g) ?? []).length).toBe(1);

    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE\s+works/i.test(c[0] as string));
    expect(updateCall).toBeDefined();
    const meta = JSON.parse((updateCall as unknown as [string, string[]])[1][0]);
    expect(meta.aiCatalogValidation.skill).toBe('catalog-metadata-validator');
    expect(meta.aiCatalogValidation.event).toBe('catalog.work.created');
    expect(meta.aiCatalogValidation.idempotencyKey).toBe('catalog.work.created:t1:w1');
    expect(meta.aiCatalogValidation.status).toBe('generated');
  });

  it('work: metadata idempotency — does not reprocess if already generated with the same key', async () => {
    const row = { ...WORK_ROW, metadata: { aiCatalogValidation: { idempotencyKey: 'catalog.work.created:t1:w1', status: 'generated' } } };
    const { ds, query } = makeDs({ works: [row] });
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new CatalogMetadataValidatorAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onWorkCreated(workEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('work: AI failure records fail, does not rethrow and does not write', async () => {
    const { ds, query } = makeDs({ works: [WORK_ROW] });
    const skillRun = makeSkillRun();
    const ai = makeFailingAi();
    const handler = new CatalogMetadataValidatorAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await expect(handler.onWorkCreated(workEvent() as never)).resolves.toBeUndefined();

    expect(skillRun.fail).toHaveBeenCalledWith('run-1', 't1', 'catalog-metadata-validator', expect.any(Error));
    expect(skillRun.succeed).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  // ── Recording ───────────────────────────────────────────────────────────────

  it('recording: executes and writes phonograms.metadata.aiCatalogValidation with type=recording', async () => {
    const { ds, query } = makeDs({ recordings: [RECORDING_ROW] });
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new CatalogMetadataValidatorAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onRecordingCreated(recordingEvent() as never);

    expect(skillRun.start).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'recording',
        entityId: 'r1',
        input: { idempotencyKey: 'catalog.recording.created:t1:r1' },
      }),
    );
    expect(skillRun.succeed).toHaveBeenCalled();

    // input: type=recording + performers/producer (from participacao, structured
    // jsonb -- replaced the legacy interpretes/produtores free-text columns,
    // dropped for having no real writer) + label in the prompt
    const aiCalls = ai.complete.mock.calls as unknown as Array<[{ prompt: string }]>;
    expect(aiCalls[0][0].prompt).toContain('fonograma/gravação (recording)');
    expect(aiCalls[0][0].prompt).toContain('Banda Aurora');
    expect(aiCalls[0][0].prompt).toContain('Selo Y');

    const updateCall = query.mock.calls.find((c: unknown[]) => /UPDATE\s+phonograms/i.test(c[0] as string));
    expect(updateCall).toBeDefined();
    const meta = JSON.parse((updateCall as unknown as [string, string[]])[1][0]);
    expect(meta.aiCatalogValidation.event).toBe('catalog.recording.created');
    expect(meta.aiCatalogValidation.idempotencyKey).toBe('catalog.recording.created:t1:r1');
  });

  it('recording: no performer in participacao records fail (skill requires non-empty performers for type=recording)', async () => {
    const noInterpreter = { ...RECORDING_ROW, participacao: { interprete: [], produtorFonografico: [] } };
    const { ds } = makeDs({ recordings: [noInterpreter] });
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new CatalogMetadataValidatorAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onRecordingCreated(recordingEvent() as never);

    expect(skillRun.fail).toHaveBeenCalled();
    expect(skillRun.succeed).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
  });

  it('recording: skill_runs idempotency — an in-progress/successful run blocks', async () => {
    const { ds, query } = makeDs({ recordings: [RECORDING_ROW], skillRuns: [{ '1': 1 }] });
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new CatalogMetadataValidatorAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onRecordingCreated(recordingEvent() as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(ai.complete).not.toHaveBeenCalled();
    expect(query.mock.calls.find((c: unknown[]) => /UPDATE/i.test(c[0] as string))).toBeUndefined();
  });

  it('guard: missing tenantId/entityId is ignored (no run, no query)', async () => {
    const { ds, query } = makeDs({ works: [WORK_ROW] });
    const skillRun = makeSkillRun();
    const ai = makeAi(VALID_JSON);
    const handler = new CatalogMetadataValidatorAutomation(ds as never, skillRun as never, ai as never, passThroughTenantContext(ds) as never);

    await handler.onWorkCreated({ tenantId: 't1', payload: { workId: '' } } as never);

    expect(skillRun.start).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });
});
