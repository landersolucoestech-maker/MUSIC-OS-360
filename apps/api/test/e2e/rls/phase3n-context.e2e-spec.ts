import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import {
  ALL_ENTITIES,
  SkillRunEntity,
  WorkflowExecutionEntity,
} from '../../../src/database/entities';
import { DatabaseContextService } from '../../../src/database/database-context.service';
import { makeTenantAwareDataSource } from '../../../src/database/tenant-als';
import { SkillRunService } from '../../../src/core/skills/skill-run.service';
import { runNativeSkillAutomation } from '../../../src/core/automation/native-skill-automation.runner';
import { WorkflowExecutionService } from '../../../src/core/workflow/workflow-execution.service';
import { WorkflowAutomationService } from '../../../src/core/workflow/workflow-automation.service';
import { AutentiqueService } from '../../../src/modules/integrations/autentique/autentique.service';
import { AssetLinkingHandler } from '../../../src/modules/assets/handlers/asset-linking.handler';
import { TenantBootstrapResolver } from '../../../src/database/tenant-bootstrap.resolver';

const TENANT_A = '10000000-0000-0000-0000-000000000002';

function env(key: string): string {
  // An explicitly-provided process env must always win over .env.development.
  const envPath = path.resolve(process.cwd(), '.env.development');
  const text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  return (process.env[key] ?? text.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1] ?? '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

describe('FASE 3N - runtime tenant context (PostgreSQL real)', () => {
  let owner: DataSource;
  let appReal: DataSource;
  let app: DataSource;
  let dbContext: DatabaseContextService;
  let skillRuns: SkillRunService;
  let workflowExecutions: WorkflowExecutionService;

  const tag = `fase3n_${Date.now()}`;
  const events = { emitTyped: jest.fn(), on: jest.fn() };

  beforeAll(async () => {
    owner = await new DataSource({
      type: 'postgres',
      url: env('DATABASE_URL'),
      ssl: false,
      entities: ALL_ENTITIES,
    }).initialize();
    appReal = await new DataSource({
      type: 'postgres',
      url: env('APP_DATABASE_URL'),
      ssl: false,
      entities: ALL_ENTITIES,
      synchronize: false,
    }).initialize();
    app = makeTenantAwareDataSource(appReal);
    dbContext = new DatabaseContextService(
      app,
      { get: () => 'true' } as never,
    );
    skillRuns = new SkillRunService(app, events as never);
    workflowExecutions = new WorkflowExecutionService(app, events as never);
  }, 30000);

  afterAll(async () => {
    if (owner?.isInitialized) {
      await owner.query(
        `DELETE FROM skill_run_logs
          WHERE skill_run_id IN (SELECT id FROM skill_runs WHERE skill_name LIKE $1)`,
        [`${tag}%`],
      );
      await owner.query(`DELETE FROM skill_runs WHERE skill_name LIKE $1`, [`${tag}%`]);
      await owner.query(
        `DELETE FROM workflow_execution_logs
          WHERE execution_id IN (SELECT id FROM workflow_executions WHERE rule_id LIKE $1)`,
        [`${tag}%`],
      );
      await owner.query(`DELETE FROM workflow_executions WHERE rule_id LIKE $1`, [`${tag}%`]);
      await owner.query(`DELETE FROM contracts WHERE autentique_doc_id = $1`, [`${tag}_doc`]);
      await owner.destroy();
    }
    if (appReal?.isInitialized) await appReal.destroy();
  });

  it('executa start, log, complete e fail de skill com tenant e role corretos', async () => {
    const evidence = await dbContext.runInTenantContext(
      { tenantId: TENANT_A, orgId: null, role: 'system' },
      async () => {
        const context = (await app.query(`
          SELECT private_get_tenant_id()::text AS tenant_id, current_user AS role
        `))[0] as { tenant_id: string; role: string };

        const successId = await skillRuns.start({
          tenantId: TENANT_A,
          skillName: `${tag}_success`,
          input: { phase: 'runtime' },
        });
        await skillRuns.log(successId, 'info', 'phase3n runtime');
        await skillRuns.succeed(successId, TENANT_A, `${tag}_success`, { ok: true });

        const failedId = await skillRuns.start({
          tenantId: TENANT_A,
          skillName: `${tag}_failed`,
          input: { phase: 'runtime' },
        });
        await skillRuns.fail(failedId, TENANT_A, `${tag}_failed`, new Error('expected'));

        return { ...context, successId, failedId };
      },
    );

    expect(evidence.tenant_id).toBe(TENANT_A);
    expect(evidence.role).toBe('musicos_app');
    const rows = await owner.query(
      `SELECT status, count(*)::int AS total
         FROM skill_runs
        WHERE skill_name LIKE $1
        GROUP BY status`,
      [`${tag}%`],
    );
    expect(rows).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'success', total: 1 }),
      expect.objectContaining({ status: 'failed', total: 1 }),
    ]));
    console.log('FASE3N_SKILL_EVIDENCE', evidence);
  });

  it('registra falha pre-start em uma nova transacao tenant-scoped', async () => {
    await runNativeSkillAutomation({
      ds: app,
      dbContext,
      skillRun: skillRuns,
      ai: {} as never,
    }, {
      eventName: `${tag}.pre_start`,
      skillName: `${tag}_pre_start`,
      tenantId: TENANT_A,
      userId: null,
      entityType: 'phase3n',
      entityId: tag,
      metadataKey: 'phase3n',
      systemPrompt: 'unused',
      load: async () => {
        const context = (await app.query(`
          SELECT private_get_tenant_id()::text AS tenant_id, current_user AS role
        `))[0];
        console.log('FASE3N_PRESTART_CONTEXT', context);
        throw new Error('expected pre-start failure');
      },
      getMetadata: () => ({}),
      buildInput: () => ({}),
      buildPrompt: () => '',
      parseResponse: () => ({}),
      saveMetadata: async () => undefined,
    });

    const rows = await owner.query(
      `SELECT tenant_id::text, status, error_message
         FROM skill_runs
        WHERE skill_name = $1`,
      [`${tag}_pre_start`],
    );
    expect(rows).toEqual([
      expect.objectContaining({
        tenant_id: TENANT_A,
        status: 'failed',
        error_message: 'expected pre-start failure',
      }),
    ]);
  });

  it('executa AssetLinkingHandler somente depois de abrir o tenant context', async () => {
    let contextEvidence: { tenant_id: string; role: string } | null = null;
    const assetLinking = {
      processUpload: jest.fn(async () => {
        contextEvidence = (await app.query(`
          SELECT private_get_tenant_id()::text AS tenant_id, current_user AS role
        `))[0];
      }),
    };
    const handler = new AssetLinkingHandler(assetLinking as never, dbContext);

    await handler.onAssetUploaded({
      tenantId: TENANT_A,
      payload: { tenantId: TENANT_A, uploadId: `${tag}_upload` },
      correlationId: null,
    } as never);

    expect(assetLinking.processUpload).toHaveBeenCalledTimes(1);
    expect(contextEvidence).toEqual({
      tenant_id: TENANT_A,
      role: 'musicos_app',
    });
    console.log('FASE3P_ASSET_LINKING_EVIDENCE', contextEvidence);
  });

  it('executa workflow listener, start, logAction e finish no contexto do evento', async () => {
    const automation = new WorkflowAutomationService(
      app,
      events as never,
      {} as never,
      workflowExecutions,
      null,
      dbContext,
    );
    automation.register({
      id: `${tag}_rule`,
      name: 'FASE 3N runtime',
      event: `${tag}.event`,
      actions: [{ type: 'notify', template: 'phase3n' }],
    });

    await automation.processEvent(`${tag}.event`, {
      type: `${tag}.event`,
      tenantId: TENANT_A,
      payload: {},
      occurredAt: new Date().toISOString(),
    });

    const rows = await owner.query(
      `SELECT tenant_id::text, status, actions_succeeded, actions_failed
         FROM workflow_executions
        WHERE rule_id = $1`,
      [`${tag}_rule`],
    );
    expect(rows).toEqual([
      expect.objectContaining({
        tenant_id: TENANT_A,
        status: 'success',
        actions_succeeded: 1,
        actions_failed: 0,
      }),
    ]);

    const contextEvidence = await dbContext.runInTenantContext(
      { tenantId: TENANT_A, orgId: null, role: 'system' },
      async () => (await app.query(`
        SELECT private_get_tenant_id()::text AS tenant_id, current_user AS role
      `))[0],
    );
    console.log('FASE3N_WORKFLOW_EVIDENCE', contextEvidence);
  });

  it('resolve webhook Autentique por OWNER read-only e executa negócio com tenant context', async () => {
    await owner.query(
      `INSERT INTO contracts (tenant_id, title, type, autentique_doc_id)
       VALUES ($1, $2, 'teste', $3)`,
      [TENANT_A, tag, `${tag}_doc`],
    );

    let contextEvidence: { tenant_id: string; role: string } | null = null;
    const activityLogs = {
      create: jest.fn(async () => {
        contextEvidence = (await app.query(`
          SELECT private_get_tenant_id()::text AS tenant_id, current_user AS role
        `))[0];
      }),
    };
    const webhookEvents = { emitTyped: jest.fn() };
    const service = new AutentiqueService(
      app,
      {} as never,
      { get: jest.fn(() => 'phase3n-secret') } as never,
      webhookEvents as never,
      activityLogs as never,
      null as never,
      dbContext,
      owner,
      new TenantBootstrapResolver(owner),
    );

    await service.handleWebhook({
      event: 'document.signed',
      event_id: `${tag}_event`,
      document_id: `${tag}_doc`,
    }, 'phase3n-secret');

    expect(contextEvidence).toEqual({
      tenant_id: TENANT_A,
      role: 'musicos_app',
    });
    const rows = await owner.query(
      `SELECT tenant_id::text, status
         FROM contracts
        WHERE autentique_doc_id = $1`,
      [`${tag}_doc`],
    );
    expect(rows).toEqual([
      expect.objectContaining({ tenant_id: TENANT_A, status: 'signed' }),
    ]);
    expect(webhookEvents.emitTyped).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ tenantId: TENANT_A }),
    );
    console.log('FASE3N_AUTENTIQUE_EVIDENCE', contextEvidence);
  });
});
