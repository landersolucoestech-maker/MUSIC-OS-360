import 'reflect-metadata';
import { randomBytes } from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { DataSource } from 'typeorm';
import { assertDatabaseCommandEnv } from '../src/core/config/env.schema';

// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config();

function env(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function decodeJwt(token: string): Record<string, unknown> {
  const payload = token.split('.')[1];
  return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
}

async function apiCall(
  apiUrl: string,
  path: string,
  token: string,
  tenantId?: string,
  init: RequestInit = {},
) {
  const response = await fetch(`${apiUrl}/api/v1${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null) as
    | { data?: Record<string, unknown>; message?: string }
    | null;
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path} -> ${response.status}: ${JSON.stringify(body)}`);
  }
  return { status: response.status, data: body?.data ?? body };
}

async function main() {
  const apiUrl = (process.env['SIGNUP_SMOKE_API_URL'] ?? 'http://localhost:3001').replace(/\/+$/, '');
  const supabaseUrl = env('SUPABASE_URL');
  const anonKey = env('SUPABASE_ANON_KEY');
  const serviceRoleKey = env('SUPABASE_SERVICE_ROLE_KEY');
  const databaseUrl = env('DATABASE_URL');
  assertDatabaseCommandEnv('verify-signup-provisioning', { ...process.env, DATABASE_URL: databaseUrl });
  const suffix = `${Date.now()}-${randomBytes(3).toString('hex')}`;
  const email = `signup.smoke.${suffix.replace(/-/g, '.')}@gmail.com`;
  const password = `Signup!${randomBytes(8).toString('hex')}A1`;
  const slug = `signup-smoke-${suffix}`.slice(0, 90);

  const auth = createClient(supabaseUrl, anonKey);
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const db = new DataSource({
    type: 'postgres',
    url: databaseUrl,
    ssl: process.env['DB_SSL'] === 'false' ? false : { rejectUnauthorized: false },
  });
  await db.initialize();

  let userId: string | null = null;
  let tenantId: string | null = null;
  let orgId: string | null = null;
  try {
    const signup = await auth.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: 'Signup Smoke Owner',
          org_name: 'Signup Smoke Organization',
          trade_name: 'Signup Smoke',
          workspace_name: 'Signup Smoke Workspace',
          workspace_slug: slug,
          segment: 'record_label',
          corporate_email: email,
          requested_plan: 'trial_14',
          accepted_terms: true,
          accepted_lgpd: true,
        },
      },
    });
    if (signup.error || !signup.data.user) {
      throw new Error(`Supabase signup failed: ${signup.error?.message ?? 'user missing'}`);
    }
    userId = signup.data.user.id;

    let session = signup.data.session;
    if (!session) {
      const confirmation = await admin.auth.admin.updateUserById(userId, {
        email_confirm: true,
      });
      if (confirmation.error) throw confirmation.error;
      const login = await auth.auth.signInWithPassword({ email, password });
      if (login.error || !login.data.session) throw login.error ?? new Error('Session missing after confirmation');
      session = login.data.session;
    }

    const provisioned = await apiCall(
      apiUrl,
      '/auth/provision-workspace',
      session.access_token,
      undefined,
      {
        method: 'PATCH',
        body: JSON.stringify({
          organizationName: 'Signup Smoke Organization',
          workspaceName: 'Signup Smoke Workspace',
          workspaceSlug: slug,
          segment: 'record_label',
          corporateEmail: email,
          requestedPlan: 'trial_14',
          acceptedTerms: true,
          acceptedLgpd: true,
        }),
      },
    );
    tenantId = String((provisioned.data as Record<string, unknown>)['tenantId']);
    orgId = String((provisioned.data as Record<string, unknown>)['orgId']);

    const idempotent = await apiCall(
      apiUrl,
      '/auth/provision-workspace',
      session.access_token,
      undefined,
      {
        method: 'PATCH',
        body: JSON.stringify({
          organizationName: 'Ignored Duplicate',
          workspaceName: 'Ignored Duplicate',
          workspaceSlug: `${slug}-duplicate`,
        }),
      },
    );
    if ((idempotent.data as Record<string, unknown>)['created'] !== false) {
      throw new Error('Provisioning idempotency check failed');
    }

    const refreshed = await auth.auth.refreshSession();
    if (refreshed.error || !refreshed.data.session) throw refreshed.error ?? new Error('Refresh session missing');
    session = refreshed.data.session;
    const claims = decodeJwt(session.access_token);
    const appMetadata = claims['app_metadata'] as Record<string, unknown> | undefined;
    if (appMetadata?.['org_id'] !== tenantId || appMetadata?.['role'] !== 'owner') {
      throw new Error(`JWT claims mismatch: ${JSON.stringify(appMetadata)}`);
    }

    const context = await apiCall(apiUrl, '/auth/context', session.access_token, tenantId);
    const contextData = context.data as Record<string, any>;
    if (
      contextData.workspace?.id !== tenantId
      || contextData.membership?.role !== 'owner'
      || contextData.membership?.hierarchyLevel !== 90
    ) {
      throw new Error(`Auth context mismatch: ${JSON.stringify(contextData)}`);
    }

    await apiCall(apiUrl, '/auth/onboarding', session.access_token, tenantId, {
      method: 'PATCH',
      body: JSON.stringify({
        companyName: 'Signup Smoke Organization',
        segment: 'record_label',
        settings: { timezone: 'America/Sao_Paulo', locale: 'pt-BR', currency: 'BRL' },
      }),
    });

    const protectedChecks = [
      '/analytics/dashboard',
      '/reports/entities',
      '/rbac/roles',
    ];
    for (const path of protectedChecks) {
      await apiCall(apiUrl, path, session.access_token, tenantId);
    }

    const rows = await db.query(
      `SELECT tenant."id" AS "tenant_id", tenant."org_id",
              member."role", member."role_id", role."hierarchy_level",
              tenant."settings" -> 'onboarding' ->> 'completed' AS "onboarding_completed"
         FROM "tenants" tenant
         JOIN "org_members" member ON member."tenant_id" = tenant."id"
         JOIN "roles" role ON role."id" = member."role_id"
        WHERE tenant."id" = $1 AND member."auth_user_id" = $2`,
      [tenantId, userId],
    ) as Array<Record<string, unknown>>;
    if (
      rows.length !== 1
      || rows[0]['role'] !== 'owner'
      || Number(rows[0]['hierarchy_level']) !== 90
      || rows[0]['onboarding_completed'] !== 'true'
    ) {
      throw new Error(`Database verification failed: ${JSON.stringify(rows)}`);
    }

    console.log(JSON.stringify({
      status: 'OK',
      signup: true,
      tenantAutoCreate: true,
      membershipAutoCreate: true,
      ownerRole: true,
      jwtOrgId: true,
      tenantGuard: true,
      rbac: true,
      onboarding: true,
      authContext: true,
      userId,
      tenantId,
      orgId,
    }, null, 2));
  } finally {
    if (tenantId && orgId && userId) {
      await db.transaction(async (manager) => {
        await manager.query(`DELETE FROM "rbac_decision_logs" WHERE "tenant_id" = $1`, [tenantId]);
        await manager.query(`DELETE FROM "org_members" WHERE "tenant_id" = $1 AND "auth_user_id" = $2`, [tenantId, userId]);
        await manager.query(`DELETE FROM "tenants" WHERE "id" = $1`, [tenantId]);
        await manager.query(`DELETE FROM "organizations" WHERE "id" = $1`, [orgId]);
      });
    }
    if (userId) {
      await auth.auth.signOut().catch(() => undefined);
      await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    }
    await db.destroy();
    console.log(JSON.stringify({
      cleanup: 'completed',
      userId,
      tenantId,
      orgId,
    }));
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
