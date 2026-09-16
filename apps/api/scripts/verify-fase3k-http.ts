import 'reflect-metadata';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Module,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { assertDatabaseCommandEnv } from '../src/core/config/env.schema';
import * as jwt from 'jsonwebtoken';
import type { Request } from 'express';
import { AppModule } from '../src/app.module';
import { RequireRole } from '../src/core/decorators/roles.decorator';
import { DATA_SOURCE } from '../src/database/database.tokens';

const TENANT_A = '10000000-0000-0000-0000-000000000002';
const TENANT_B = 'fb6f3d4f-6161-4b55-8e4f-b4443c509b7c';

function env(key: string): string {
  // An explicitly-provided process env (CI, or a shell export pointing at a
  // disposable local Postgres) must always win over .env.development.
  const envPath = path.resolve(process.cwd(), '.env.development');
  const text = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
  return (process.env[key] ?? text.match(new RegExp(`^${key}=(.+)$`, 'm'))?.[1] ?? '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function unwrap<T>(value: { data?: T } | T): T {
  return value && typeof value === 'object' && 'data' in value
    ? (value as { data: T }).data
    : value as T;
}

class Phase3kHttpProbeController {
  constructor(private readonly ds: DataSource) {}

  async context(req: Request) {
    const subjectPrefix = String(req.query['subjectPrefix'] ?? '');
    const context = await this.ds.query(`
      SELECT
        private_get_tenant_id()::text AS private_tenant_id,
        current_user AS connection_role,
        NULLIF(current_setting('app.current_role', true), '') AS request_role
    `);
    const rows = await this.ds.query(
      `SELECT id, tenant_id, subject
         FROM conversations
        WHERE subject LIKE $1
        ORDER BY subject`,
      [`${subjectPrefix}%`],
    );
    return {
      tenantJwt: req.auth?.orgId ?? null,
      tenantRequest: String(req.tenant?.['id'] ?? ''),
      ...context[0],
      query: 'SELECT id, tenant_id, subject FROM conversations WHERE subject LIKE $1',
      rows,
    };
  }

  async insert(body: { tenantId: string; subject: string }) {
    try {
      const rows = await this.ds.query(
        `INSERT INTO conversations (tenant_id, subject, status, channel)
         VALUES ($1, $2, 'pending', 'whatsapp')
         RETURNING id, tenant_id, subject`,
        [body.tenantId, body.subject],
      );
      return { ok: true, rows };
    } catch (error) {
      const code = (error as { driverError?: { code?: string }; code?: string }).driverError?.code
        ?? (error as { code?: string }).code
        ?? '';
      return { ok: false, code };
    }
  }

  async update(body: { id: string; subject: string }) {
    const result = await this.ds.query(
      `UPDATE conversations
          SET subject = $2, updated_at = now()
        WHERE id = $1
        RETURNING id, tenant_id, subject`,
      [body.id, body.subject],
    );
    const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
    return { rows };
  }

  async musicchat(req: Request) {
    const conversationIds = String(req.query['conversationIds'] ?? '')
      .split(',')
      .filter(Boolean);
    const context = await this.ds.query(`
      SELECT
        private_get_tenant_id()::text AS private_tenant_id,
        current_user AS connection_role,
        NULLIF(current_setting('app.current_role', true), '') AS request_role
    `);
    const settings = await this.ds.query(
      `SELECT id, tenant_id, enabled
         FROM musicchat_automation_settings
        ORDER BY tenant_id`,
    );
    const events = await this.ds.query(
      `SELECT id, tenant_id, conversation_id, event_type
         FROM musicchat_automation_events
        WHERE conversation_id = ANY($1::uuid[])
        ORDER BY created_at`,
      [conversationIds],
    );
    const notifications = await this.ds.query(
      `SELECT id, tenant_id, conversation_id, level, title
         FROM musicchat_automation_notifications
        WHERE conversation_id = ANY($1::uuid[])
        ORDER BY created_at`,
      [conversationIds],
    );
    return {
      tenantJwt: req.auth?.orgId ?? null,
      tenantRequest: String(req.tenant?.['id'] ?? ''),
      ...context[0],
      query: 'SELECT MusicChat rows scoped by the request tenant context',
      settings,
      events,
      notifications,
    };
  }

  async executions(req: Request) {
    const tag = String(req.query['tag'] ?? '');
    const context = await this.ds.query(`
      SELECT
        private_get_tenant_id()::text AS private_tenant_id,
        current_user AS connection_role,
        NULLIF(current_setting('app.current_role', true), '') AS request_role
    `);
    const skillRuns = await this.ds.query(
      `SELECT id, tenant_id, skill_name, status
         FROM skill_runs
        WHERE skill_name LIKE $1
        ORDER BY skill_name`,
      [`${tag}%`],
    );
    const workflowExecutions = await this.ds.query(
      `SELECT id, tenant_id, rule_id, status
         FROM workflow_executions
        WHERE rule_id LIKE $1
        ORDER BY rule_id`,
      [`${tag}%`],
    );
    return {
      tenantJwt: req.auth?.orgId ?? null,
      tenantRequest: String(req.tenant?.['id'] ?? ''),
      ...context[0],
      skillRuns,
      workflowExecutions,
    };
  }

  async createExecution(body: { table: string; tenantId: string; tag: string }) {
    try {
      const rows = body.table === 'skill_runs'
        ? await this.ds.query(
          `INSERT INTO skill_runs (tenant_id, skill_name, status)
           VALUES ($1, $2, 'running')
           RETURNING id, tenant_id, skill_name, status`,
          [body.tenantId, body.tag],
        )
        : await this.ds.query(
          `INSERT INTO workflow_executions
            (tenant_id, rule_id, rule_name, event_type, status)
           VALUES ($1, $2, 'HTTP_RLS_TEST', 'http.rls.test', 'running')
           RETURNING id, tenant_id, rule_id, status`,
          [body.tenantId, body.tag],
        );
      return { ok: true, rows };
    } catch (error) {
      const code = (error as { driverError?: { code?: string }; code?: string }).driverError?.code
        ?? (error as { code?: string }).code
        ?? '';
      return { ok: false, code };
    }
  }

  async updateExecution(body: { table: string; id: string }) {
    const table = body.table === 'skill_runs' ? 'skill_runs' : 'workflow_executions';
    const result = await this.ds.query(
      `UPDATE "${table}" SET status = 'success' WHERE id = $1 RETURNING id, tenant_id, status`,
      [body.id],
    );
    const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
    return { rows };
  }

  async deleteExecution(body: { table: string; id: string }) {
    const table = body.table === 'skill_runs' ? 'skill_runs' : 'workflow_executions';
    const result = await this.ds.query(
      `DELETE FROM "${table}" WHERE id = $1 RETURNING id, tenant_id`,
      [body.id],
    );
    const rows = Array.isArray(result) && Array.isArray(result[0]) ? result[0] : result;
    return { rows };
  }
}

Controller('_phase3k/http')(Phase3kHttpProbeController);
Inject(DATA_SOURCE)(Phase3kHttpProbeController, undefined, 0);
Req()(Phase3kHttpProbeController.prototype, 'context', 0);
Body()(Phase3kHttpProbeController.prototype, 'insert', 0);
Get('context')(
  Phase3kHttpProbeController.prototype,
  'context',
  Object.getOwnPropertyDescriptor(Phase3kHttpProbeController.prototype, 'context')!,
);
RequireRole('viewer')(
  Phase3kHttpProbeController.prototype,
  'context',
  Object.getOwnPropertyDescriptor(Phase3kHttpProbeController.prototype, 'context')!,
);
Post('conversations')(
  Phase3kHttpProbeController.prototype,
  'insert',
  Object.getOwnPropertyDescriptor(Phase3kHttpProbeController.prototype, 'insert')!,
);
RequireRole('editor')(
  Phase3kHttpProbeController.prototype,
  'insert',
  Object.getOwnPropertyDescriptor(Phase3kHttpProbeController.prototype, 'insert')!,
);
Body()(Phase3kHttpProbeController.prototype, 'update', 0);
Patch('conversations')(
  Phase3kHttpProbeController.prototype,
  'update',
  Object.getOwnPropertyDescriptor(Phase3kHttpProbeController.prototype, 'update')!,
);
Req()(Phase3kHttpProbeController.prototype, 'musicchat', 0);
Get('musicchat')(
  Phase3kHttpProbeController.prototype,
  'musicchat',
  Object.getOwnPropertyDescriptor(Phase3kHttpProbeController.prototype, 'musicchat')!,
);
RequireRole('viewer')(
  Phase3kHttpProbeController.prototype,
  'musicchat',
  Object.getOwnPropertyDescriptor(Phase3kHttpProbeController.prototype, 'musicchat')!,
);
Req()(Phase3kHttpProbeController.prototype, 'executions', 0);
Get('executions')(
  Phase3kHttpProbeController.prototype,
  'executions',
  Object.getOwnPropertyDescriptor(Phase3kHttpProbeController.prototype, 'executions')!,
);
RequireRole('viewer')(
  Phase3kHttpProbeController.prototype,
  'executions',
  Object.getOwnPropertyDescriptor(Phase3kHttpProbeController.prototype, 'executions')!,
);
Body()(Phase3kHttpProbeController.prototype, 'createExecution', 0);
Post('executions')(
  Phase3kHttpProbeController.prototype,
  'createExecution',
  Object.getOwnPropertyDescriptor(Phase3kHttpProbeController.prototype, 'createExecution')!,
);
RequireRole('editor')(
  Phase3kHttpProbeController.prototype,
  'createExecution',
  Object.getOwnPropertyDescriptor(Phase3kHttpProbeController.prototype, 'createExecution')!,
);
Body()(Phase3kHttpProbeController.prototype, 'updateExecution', 0);
Patch('executions')(
  Phase3kHttpProbeController.prototype,
  'updateExecution',
  Object.getOwnPropertyDescriptor(Phase3kHttpProbeController.prototype, 'updateExecution')!,
);
RequireRole('editor')(
  Phase3kHttpProbeController.prototype,
  'updateExecution',
  Object.getOwnPropertyDescriptor(Phase3kHttpProbeController.prototype, 'updateExecution')!,
);
Body()(Phase3kHttpProbeController.prototype, 'deleteExecution', 0);
Delete('executions')(
  Phase3kHttpProbeController.prototype,
  'deleteExecution',
  Object.getOwnPropertyDescriptor(Phase3kHttpProbeController.prototype, 'deleteExecution')!,
);
RequireRole('editor')(
  Phase3kHttpProbeController.prototype,
  'deleteExecution',
  Object.getOwnPropertyDescriptor(Phase3kHttpProbeController.prototype, 'deleteExecution')!,
);
RequireRole('editor')(
  Phase3kHttpProbeController.prototype,
  'update',
  Object.getOwnPropertyDescriptor(Phase3kHttpProbeController.prototype, 'update')!,
);

class Phase3kHttpModule {}
Module({
  imports: [AppModule],
  controllers: [Phase3kHttpProbeController],
})(Phase3kHttpModule);

async function main(): Promise<void> {
  const tag = `PHASE3K_HTTP_${Date.now()}`;
  const userA = `phase3k-a-${randomUUID()}`;
  const userB = `phase3k-b-${randomUUID()}`;
  assertDatabaseCommandEnv('verify-fase3k-http', { ...process.env, DATABASE_URL: env('DATABASE_URL') });
  const owner = await new DataSource({
    type: 'postgres',
    url: env('DATABASE_URL'),
    ssl: false,
  }).initialize();
  let app: Awaited<ReturnType<typeof NestFactory.create>> | null = null;
  const createdSettingsIds: string[] = [];
  const settingsSnapshots = new Map<string, { enabled: boolean; updated_by: string | null }>();

  try {
    const tenants = await owner.query(
      `SELECT id::text, org_id::text
         FROM tenants
        WHERE id = ANY($1::uuid[]) AND active = true AND deleted_at IS NULL`,
      [[TENANT_A, TENANT_B]],
    );
    const orgA = tenants.find((row: { id: string }) => row.id === TENANT_A)?.org_id ?? '';
    const orgB = tenants.find((row: { id: string }) => row.id === TENANT_B)?.org_id ?? '';
    assert(orgA && orgB, 'Tenants reais A/B nao encontrados ou inativos');

    await owner.query(
      `INSERT INTO org_members
        (id, org_id, tenant_id, auth_user_id, email, full_name, role, is_active, joined_at)
       VALUES
        (gen_random_uuid(), $1, $2, $3, $4, 'Phase 3K A', 'owner', true, now()),
        (gen_random_uuid(), $5, $6, $7, $8, 'Phase 3K B', 'owner', true, now())`,
      [
        orgA, TENANT_A, userA, `${userA}@phase3k.local`,
        orgB, TENANT_B, userB, `${userB}@phase3k.local`,
      ],
    );
    const seededConversations = await owner.query(
      `INSERT INTO conversations (tenant_id, subject, status, channel)
       VALUES ($1, $2, 'pending', 'whatsapp'), ($3, $4, 'pending', 'whatsapp')
       RETURNING id, tenant_id`,
      [TENANT_A, `${tag}_A`, TENANT_B, `${tag}_B`],
    );
    const conversationA = seededConversations.find(
      (row: { tenant_id: string }) => row.tenant_id === TENANT_A,
    )?.id as string;
    const conversationB = seededConversations.find(
      (row: { tenant_id: string }) => row.tenant_id === TENANT_B,
    )?.id as string;
    assert(conversationA && conversationB, 'Conversas A/B nao foram semeadas');

    const sign = (userId: string, orgId: string) => jwt.sign(
      {
        sub: userId,
        session_id: `phase3k-${userId}`,
        app_metadata: { org_id: orgId, role: 'owner' },
        email: `${userId}@phase3k.local`,
      },
      env('ENCRYPTION_KEY'),
      { algorithm: 'HS256', issuer: 'music-os-360-dev', expiresIn: '15m' },
    );

    app = await NestFactory.create(Phase3kHttpModule, {
      logger: ['error', 'warn', 'log'],
    });
    app.setGlobalPrefix('api/v1');
    await app.listen(0, '127.0.0.1');
    const baseUrl = await app.getUrl();

    const request = async (
      method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
      route: string,
      authToken: string,
      tenantId: string,
      body?: unknown,
    ) => {
      const response = await fetch(`${baseUrl}/api/v1${route}`, {
        method,
        headers: {
          Authorization: `Bearer ${authToken}`,
          'X-Tenant-ID': tenantId,
          'Content-Type': 'application/json',
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return {
        status: response.status,
        body: await response.json() as unknown,
      };
    };

    const tokenA = sign(userA, orgA);
    const tokenB = sign(userB, orgB);
    const contextRoute = `/_phase3k/http/context?subjectPrefix=${encodeURIComponent(tag)}`;
    await owner.query(
      `INSERT INTO skill_runs (tenant_id, skill_name, status)
       VALUES ($1, $2, 'success'), ($3, $4, 'success')`,
      [TENANT_A, `${tag}_SKILL_A`, TENANT_B, `${tag}_SKILL_B`],
    );
    const seededWorkflowExecutions = await owner.query(
      `INSERT INTO workflow_executions
        (tenant_id, rule_id, rule_name, event_type, status)
       VALUES
        ($1, $2, 'HTTP_RLS_TEST', 'http.rls.test', 'success'),
        ($3, $4, 'HTTP_RLS_TEST', 'http.rls.test', 'success')
       RETURNING id, tenant_id`,
      [TENANT_A, `${tag}_WORKFLOW_A`, TENANT_B, `${tag}_WORKFLOW_B`],
    );
    const existingSettingsRows = await owner.query(
        `SELECT id, tenant_id, enabled, updated_by
           FROM musicchat_automation_settings
          WHERE tenant_id = ANY($1::uuid[])`,
        [[TENANT_A, TENANT_B]],
      );
    const existingSettings = new Set<string>(
      existingSettingsRows.map((row: { id: string }) => row.id),
    );
    for (const row of existingSettingsRows as Array<{
      tenant_id: string;
      enabled: boolean;
      updated_by: string | null;
    }>) {
      settingsSnapshots.set(row.tenant_id, {
        enabled: row.enabled,
        updated_by: row.updated_by,
      });
    }

    const unknownTenantId = randomUUID();
    const unknownTenant = await request(
      'GET',
      contextRoute,
      sign(`phase3k-unknown-${randomUUID()}`, unknownTenantId),
      unknownTenantId,
    );
    console.log('[3L][TENANT_INEXISTENTE]', JSON.stringify(unknownTenant.body));
    assert(unknownTenant.status === 401, `Tenant inexistente status=${unknownTenant.status}`);

    const invalidMember = await request(
      'GET',
      contextRoute,
      sign(`phase3k-no-member-${randomUUID()}`, orgA),
      TENANT_A,
    );
    console.log('[3L][MEMBERSHIP_INVALIDA]', JSON.stringify(invalidMember.body));
    assert(invalidMember.status === 403, `Membership invalida status=${invalidMember.status}`);

    const responseA = await request('GET', contextRoute, tokenA, TENANT_A);
    const evidenceA = unwrap(responseA.body as Record<string, unknown>) as Record<string, any>;
    console.log('[3K-A][TENANT_A]', JSON.stringify(evidenceA));

    const responseB = await request('GET', contextRoute, tokenB, TENANT_B);
    const evidenceB = unwrap(responseB.body as Record<string, unknown>) as Record<string, any>;
    console.log('[3K-A][TENANT_B]', JSON.stringify(evidenceB));
    assert(responseA.status === 200, `Tenant A HTTP status=${responseA.status}`);
    assert(evidenceA.tenantJwt === orgA, 'Tenant A JWT divergente');
    assert(evidenceA.tenantRequest === TENANT_A, 'Tenant A request divergente');
    assert(evidenceA.private_tenant_id === TENANT_A, 'private_get_tenant_id() nao retornou A');
    assert(evidenceA.connection_role === 'musicos_app', `Role inesperada: ${evidenceA.connection_role}`);
    assert(evidenceA.request_role === 'owner', `Request role inesperada: ${evidenceA.request_role}`);
    assert(
      JSON.stringify(evidenceA.rows.map((row: { subject: string }) => row.subject))
        === JSON.stringify([`${tag}_A`]),
      'Tenant A nao ficou isolado pela RLS',
    );
    assert(responseB.status === 200, `Tenant B HTTP status=${responseB.status}`);
    assert(evidenceB.tenantJwt === orgB, 'Tenant B JWT divergente');
    assert(evidenceB.tenantRequest === TENANT_B, 'Tenant B request divergente');
    assert(evidenceB.private_tenant_id === TENANT_B, 'private_get_tenant_id() nao retornou B');
    assert(evidenceB.connection_role === 'musicos_app', `Role inesperada: ${evidenceB.connection_role}`);
    assert(evidenceB.request_role === 'owner', `Request role inesperada: ${evidenceB.request_role}`);
    assert(
      JSON.stringify(evidenceB.rows.map((row: { subject: string }) => row.subject))
        === JSON.stringify([`${tag}_B`]),
      'Tenant B nao ficou isolado pela RLS',
    );

    const executionEvidence: Record<string, Record<string, any>> = {};
    for (const [label, authToken, tenantId, orgId] of [
      ['A', tokenA, TENANT_A, orgA],
      ['B', tokenB, TENANT_B, orgB],
    ] as const) {
      const response = await request(
        'GET',
        `/_phase3k/http/executions?tag=${encodeURIComponent(tag)}`,
        authToken,
        tenantId,
      );
      const evidence = unwrap(response.body as Record<string, unknown>) as Record<string, any>;
      executionEvidence[label] = evidence;
      console.log(`[3R][HTTP_${label}]`, JSON.stringify(evidence));
      assert(response.status === 200, `Executions HTTP ${label} status=${response.status}`);
      assert(evidence.tenantJwt === orgId, `Executions HTTP ${label} JWT incorreto`);
      assert(evidence.tenantRequest === tenantId, `Executions HTTP ${label} request tenant incorreto`);
      assert(evidence.private_tenant_id === tenantId, `Executions HTTP ${label} contexto incorreto`);
      assert(evidence.connection_role === 'musicos_app', `Executions HTTP ${label} role incorreta`);
      assert(evidence.skillRuns.length === 1, `Executions HTTP ${label} skill_runs sem isolamento`);
      assert(evidence.workflowExecutions.length === 1, `Executions HTTP ${label} workflow sem isolamento`);
      assert(evidence.skillRuns[0].tenant_id === tenantId, `Executions HTTP ${label} skill tenant incorreto`);
      assert(
        evidence.workflowExecutions[0].tenant_id === tenantId,
        `Executions HTTP ${label} workflow tenant incorreto`,
      );
    }

    for (const table of ['skill_runs', 'workflow_executions'] as const) {
      const create = await request(
        'POST',
        '/_phase3k/http/executions',
        tokenA,
        TENANT_A,
        { table, tenantId: TENANT_A, tag: `${tag}_${table}_CRUD` },
      );
      const created = unwrap(create.body as Record<string, unknown>) as Record<string, any>;
      assert(create.status === 201 && created.ok === true, `${table} HTTP create falhou`);
      const id = created.rows[0].id as string;

      const update = await request(
        'PATCH',
        '/_phase3k/http/executions',
        tokenA,
        TENANT_A,
        { table, id },
      );
      const updated = unwrap(update.body as Record<string, unknown>) as Record<string, any>;
      assert(update.status === 200 && updated.rows.length === 1, `${table} HTTP update falhou`);

      const remove = await request(
        'DELETE',
        '/_phase3k/http/executions',
        tokenA,
        TENANT_A,
        { table, id },
      );
      const removed = unwrap(remove.body as Record<string, unknown>) as Record<string, any>;
      assert(remove.status === 200 && removed.rows.length === 1, `${table} HTTP delete falhou`);

      const cross = await request(
        'POST',
        '/_phase3k/http/executions',
        tokenA,
        TENANT_A,
        { table, tenantId: TENANT_B, tag: `${tag}_${table}_CROSS` },
      );
      const crossed = unwrap(cross.body as Record<string, unknown>) as Record<string, any>;
      assert(cross.status === 201, `${table} HTTP cross status=${cross.status}`);
      assert(crossed.ok === false && crossed.code === '42501', `${table} HTTP cross nao retornou 42501`);
    }

    const workflowBId = seededWorkflowExecutions.find(
      (row: { tenant_id: string }) => row.tenant_id === TENANT_B,
    )?.id as string;
    const crossWorkflowUpdate = await request(
      'PATCH',
      '/_phase3k/http/executions',
      tokenA,
      TENANT_A,
      { table: 'workflow_executions', id: workflowBId },
    );
    const crossWorkflowResult = unwrap(
      crossWorkflowUpdate.body as Record<string, unknown>,
    ) as Record<string, any>;
    assert(crossWorkflowResult.rows.length === 0, 'workflow HTTP cross update afetou Tenant B');

    const conversationsA = await request('GET', '/conversations?limit=10', tokenA, TENANT_A);
    console.log('[3L][CONVERSATIONS_RUNTIME]', JSON.stringify({
      status: conversationsA.status,
      tenant: TENANT_A,
    }));
    assert(conversationsA.status === 200, `Conversations runtime status=${conversationsA.status}`);

    for (const [label, authToken, tenantId] of [
      ['TENANT_A', tokenA, TENANT_A],
      ['TENANT_B', tokenB, TENANT_B],
    ] as const) {
      const settingsResponse = await request(
        'GET',
        '/conversations/musicchat/automation/settings',
        authToken,
        tenantId,
      );
      const settings = unwrap(settingsResponse.body as Record<string, unknown>) as Record<string, any>;
      console.log(`[3L][MUSICCHAT_${label}]`, JSON.stringify({
        status: settingsResponse.status,
        tenant_id: settings.tenant_id,
        id: settings.id,
      }));
      assert(settingsResponse.status === 200, `MusicChat ${label} status=${settingsResponse.status}`);
      assert(settings.tenant_id === tenantId, `MusicChat ${label} retornou tenant incorreto`);
      if (typeof settings.id === 'string' && !existingSettings.has(settings.id)) {
        createdSettingsIds.push(settings.id);
      }

      const patchResponse = await request(
        'PATCH',
        '/conversations/musicchat/automation/settings',
        authToken,
        tenantId,
        { enabled: Boolean(settings.enabled) },
      );
      const patched = unwrap(patchResponse.body as Record<string, unknown>) as Record<string, any>;
      console.log(`[3K-B][SETTINGS_PATCH_${label}]`, JSON.stringify({
        status: patchResponse.status,
        tenant_id: patched.tenant_id,
        enabled: patched.enabled,
      }));
      assert(patchResponse.status === 200, `PATCH settings ${label} status=${patchResponse.status}`);
      assert(patched.tenant_id === tenantId, `PATCH settings ${label} retornou tenant incorreto`);
    }

    const inbound = async (
      label: 'A' | 'B',
      authToken: string,
      tenantId: string,
    ): Promise<string> => {
      const response = await request(
        'POST',
        '/conversations/musicchat/automation/inbound',
        authToken,
        tenantId,
        {
          externalContactId: `${tag}_CONTACT_${label}`,
          customerName: `${tag}_CUSTOMER_${label}`,
          channel: 'whatsapp',
          body: 'menu',
          metadata: { phase: '3K-B', label },
        },
      );
      const result = unwrap(response.body as Record<string, unknown>) as Record<string, any>;
      console.log(`[3K-B][INBOUND_${label}]`, JSON.stringify({
        status: response.status,
        action: result.action,
        conversationId: result.conversation?.id,
        tenant_id: result.conversation?.tenant_id,
      }));
      assert(response.status === 201, `Inbound ${label} status=${response.status}`);
      assert(result.conversation?.tenant_id === tenantId, `Inbound ${label} tenant incorreto`);
      return String(result.conversation.id);
    };

    const inboundConversationA = await inbound('A', tokenA, TENANT_A);
    const inboundConversationB = await inbound('B', tokenB, TENANT_B);

    const notify = async (
      label: 'A' | 'B',
      authToken: string,
      tenantId: string,
      conversationId: string,
    ) => {
      const response = await request(
        'POST',
        '/conversations/musicchat/automation/notifications',
        authToken,
        tenantId,
        {
          conversationId,
          level: `phase3kb-${label.toLowerCase()}`,
          recipientUserId: label === 'A' ? userA : userB,
          channel: 'sms',
          title: `${tag}_NOTIFICATION_${label}`,
          body: `Phase 3K-B ${label}`,
          metadata: { phase: '3K-B', label },
        },
      );
      const result = response.body as Record<string, any>;
      console.log(`[3K-B][NOTIFICATION_${label}]`, JSON.stringify({
        status: response.status,
        created: result.created,
        tenant_id: result.data?.tenant_id,
        conversation_id: result.data?.conversation_id,
      }));
      assert(response.status === 201, `Notification ${label} status=${response.status}`);
      assert(result.created === true, `Notification ${label} nao foi criada`);
      assert(result.data?.tenant_id === tenantId, `Notification ${label} tenant incorreto`);
    };

    await notify('A', tokenA, TENANT_A, inboundConversationA);
    await notify('B', tokenB, TENANT_B, inboundConversationB);

    const musicchatProbeRoute =
      `/_phase3k/http/musicchat?conversationIds=${inboundConversationA},${inboundConversationB}`;
    for (const [label, authToken, tenantId, ownConversationId, otherConversationId, orgId] of [
      ['A', tokenA, TENANT_A, inboundConversationA, inboundConversationB, orgA],
      ['B', tokenB, TENANT_B, inboundConversationB, inboundConversationA, orgB],
    ] as const) {
      const response = await request('GET', musicchatProbeRoute, authToken, tenantId);
      const evidence = unwrap(response.body as Record<string, unknown>) as Record<string, any>;
      console.log(`[3K-B][HTTP_ISOLATION_${label}]`, JSON.stringify(evidence));
      assert(response.status === 200, `MusicChat probe ${label} status=${response.status}`);
      assert(evidence.tenantJwt === orgId, `MusicChat probe ${label} JWT incorreto`);
      assert(evidence.tenantRequest === tenantId, `MusicChat probe ${label} request tenant incorreto`);
      assert(evidence.private_tenant_id === tenantId, `MusicChat probe ${label} contexto incorreto`);
      assert(evidence.connection_role === 'musicos_app', `MusicChat probe ${label} role incorreta`);
      assert(evidence.settings.length === 1, `MusicChat probe ${label} settings nao isolado`);
      assert(evidence.settings[0].tenant_id === tenantId, `MusicChat probe ${label} settings cross-tenant`);
      assert(
        evidence.events.some((row: Record<string, any>) => row.conversation_id === ownConversationId),
        `MusicChat probe ${label} nao encontrou evento proprio`,
      );
      assert(
        evidence.events.every((row: Record<string, any>) => row.conversation_id !== otherConversationId),
        `MusicChat probe ${label} enxergou evento cross-tenant`,
      );
      assert(
        evidence.notifications.some(
          (row: Record<string, any>) => row.conversation_id === ownConversationId,
        ),
        `MusicChat probe ${label} nao encontrou notificacao propria`,
      );
      assert(
        evidence.notifications.every(
          (row: Record<string, any>) => row.conversation_id !== otherConversationId,
        ),
        `MusicChat probe ${label} enxergou notificacao cross-tenant`,
      );
    }

    const persisted = await owner.query(
      `SELECT
         (SELECT count(*)::int FROM musicchat_automation_events
           WHERE conversation_id = ANY($1::uuid[])) AS events,
         (SELECT count(*)::int FROM musicchat_automation_notifications
           WHERE conversation_id = ANY($1::uuid[])) AS notifications`,
      [[inboundConversationA, inboundConversationB]],
    );
    console.log('[3K-B][PERSISTENCE]', JSON.stringify(persisted[0]));
    assert(persisted[0].events > 0, 'Eventos HTTP nao foram persistidos');
    assert(persisted[0].notifications === 2, 'Notificacoes HTTP nao foram persistidas');

    const validInsert = await request(
      'POST',
      '/_phase3k/http/conversations',
      tokenA,
      TENANT_A,
      { tenantId: TENANT_A, subject: `${tag}_INSERT_A` },
    );
    const validResult = unwrap(validInsert.body as Record<string, unknown>) as Record<string, any>;
    console.log('[3K-A][INSERT_VALIDO]', JSON.stringify(validResult));
    assert(validInsert.status === 201, `INSERT valido HTTP status=${validInsert.status}`);
    assert(validResult.ok === true, 'INSERT valido foi negado');
    assert(validResult.rows[0].tenant_id === TENANT_A, 'INSERT valido gravou tenant incorreto');

    const validUpdate = await request(
      'PATCH',
      '/_phase3k/http/conversations',
      tokenA,
      TENANT_A,
      { id: conversationA, subject: `${tag}_A_UPDATED` },
    );
    const validUpdateResult = unwrap(validUpdate.body as Record<string, unknown>) as Record<string, any>;
    console.log('[3L][UPDATE_VALIDO]', JSON.stringify(validUpdateResult));
    assert(validUpdate.status === 200, `UPDATE valido HTTP status=${validUpdate.status}`);
    assert(validUpdateResult.rows.length === 1, 'UPDATE valido nao afetou a conversa A');
    assert(validUpdateResult.rows[0].tenant_id === TENANT_A, 'UPDATE valido afetou tenant incorreto');

    const crossUpdate = await request(
      'PATCH',
      '/_phase3k/http/conversations',
      tokenA,
      TENANT_A,
      { id: conversationB, subject: `${tag}_B_CROSS_UPDATED` },
    );
    const crossUpdateResult = unwrap(crossUpdate.body as Record<string, unknown>) as Record<string, any>;
    console.log('[3L][UPDATE_CROSS]', JSON.stringify(crossUpdateResult));
    assert(crossUpdate.status === 200, `UPDATE cross HTTP status=${crossUpdate.status}`);
    assert(crossUpdateResult.rows.length === 0, 'UPDATE cross-tenant afetou linha B');

    const crossInsert = await request(
      'POST',
      '/_phase3k/http/conversations',
      tokenA,
      TENANT_A,
      { tenantId: TENANT_B, subject: `${tag}_INSERT_CROSS` },
    );
    const crossResult = unwrap(crossInsert.body as Record<string, unknown>) as Record<string, any>;
    console.log('[3K-A][INSERT_CROSS]', JSON.stringify(crossResult));
    assert(crossInsert.status === 201, `INSERT cross HTTP status=${crossInsert.status}`);
    assert(crossResult.ok === false && crossResult.code === '42501', 'Cross-tenant nao retornou 42501');
    const leaked = await owner.query(
      `SELECT count(*)::int AS count FROM conversations WHERE subject = $1`,
      [`${tag}_INSERT_CROSS`],
    );
    assert(leaked[0].count === 0, 'INSERT cross-tenant vazou linha');

    console.log('\nHTTP_CONTEXT_OK');
  } finally {
    if (app) await app.close();
    await owner.query(`DELETE FROM conversations WHERE subject LIKE $1`, [`${tag}%`]).catch(() => undefined);
    await owner.query(`DELETE FROM skill_runs WHERE skill_name LIKE $1`, [`${tag}%`]).catch(() => undefined);
    await owner.query(`DELETE FROM workflow_executions WHERE rule_id LIKE $1`, [`${tag}%`]).catch(() => undefined);
    await owner.query(
      `DELETE FROM org_members WHERE auth_user_id = ANY($1::text[])`,
      [[userA, userB]],
    ).catch(() => undefined);
    if (createdSettingsIds.length > 0) {
      await owner.query(
        `DELETE FROM musicchat_automation_settings WHERE id = ANY($1::uuid[])`,
        [createdSettingsIds],
      ).catch(() => undefined);
    }
    for (const [tenantId, snapshot] of settingsSnapshots) {
      await owner.query(
        `UPDATE musicchat_automation_settings
            SET enabled = $2, updated_by = $3
          WHERE tenant_id = $1`,
        [tenantId, snapshot.enabled, snapshot.updated_by],
      ).catch(() => undefined);
    }
    await owner.query(
      `DELETE FROM musicchat_automation_events WHERE actor_id = ANY($1::text[])`,
      [[userA, userB]],
    ).catch(() => undefined);
    await owner.destroy().catch(() => undefined);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\nHTTP_CONTEXT_QUEBRADO');
    console.error(error instanceof Error ? error.stack : error);
    process.exit(1);
  });
