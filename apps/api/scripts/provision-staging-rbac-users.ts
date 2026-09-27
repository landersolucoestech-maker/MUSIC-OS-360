/**
 * Provisions one real Supabase user per RBAC role and grants that identity a
 * membership in each staging tenant. All tenants must belong to one organization
 * so a single JWT org_id can select any tenant through X-Tenant-ID.
 */
import 'reflect-metadata';
import { createClient } from '@supabase/supabase-js';
import { DataSource } from 'typeorm';
import { randomBytes } from 'crypto';
import { SUPABASE_STAGING_REF, extractSupabaseRef } from '../src/core/config/env.schema';

const ROLES = ['owner', 'admin', 'manager', 'editor', 'viewer', 'accounting', 'artist'] as const;
const PASSWORD = process.env['PROVISION_PASSWORD']
  ?? `Homolog!${randomBytes(9).toString('base64url')}`;

function reqEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required variable: ${name}`);
  return value;
}

async function main(): Promise<void> {
  if (process.env['PROVISION_CONFIRM'] !== 'YES') {
    throw new Error('Refused: set PROVISION_CONFIRM=YES to confirm the disposable staging.');
  }

  const supabaseUrl = reqEnv('STAGING_SUPABASE_URL');
  const serviceKey = reqEnv('STAGING_SUPABASE_SERVICE_ROLE_KEY');
  const dbUrl = reqEnv('STAGING_DATABASE_URL');
  const tenantIds = reqEnv('STAGING_TENANT_IDS')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
  if (tenantIds.length < 1) {
    throw new Error('STAGING_TENANT_IDS must contain at least 1 tenant.');
  }
  const emailSuffix = process.env['EMAIL_SUFFIX'] ?? '';

  // Fail-closed guard: this script may ONLY reach the canonical STAGING project.
  // MAIN, DEV, PROD, unknown refs or URLs without an extractable ref are refused.
  for (const [name, value] of [['STAGING_SUPABASE_URL', supabaseUrl], ['STAGING_DATABASE_URL', dbUrl]] as const) {
    const ref = extractSupabaseRef(value);
    if (ref !== SUPABASE_STAGING_REF) {
      throw new Error(
        `Refused: ${name} resolves to ref "${ref ?? 'unidentifiable'}" — only the staging project "${SUPABASE_STAGING_REF}" is accepted.`,
      );
    }
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const ds = new DataSource({
    type: 'postgres',
    url: dbUrl,
    ssl: process.env['DB_SSL'] === 'false' ? false : { rejectUnauthorized: false },
  });
  await ds.initialize();
  const query = (sql: string, params?: unknown[]) => ds.query(sql, params);

  try {
    const tenantRows = (await query(
      `SELECT id, org_id
         FROM tenants
        WHERE id = ANY($1::uuid[])
          AND active = TRUE
          AND deleted_at IS NULL`,
      [tenantIds],
    )) as Array<{ id: string; org_id: string }>;
    if (tenantRows.length !== tenantIds.length) {
      throw new Error('Every STAGING_TENANT_IDS entry must exist and be active.');
    }

    const orgIds = [...new Set(tenantRows.map((tenant) => tenant.org_id))];
    if (orgIds.length !== 1) {
      throw new Error('The harness tenants must belong to the same organization.');
    }
    const orgId = orgIds[0];
    const credentials: string[] = [];

    for (const role of ROLES) {
      const email = `rbac-${role}${emailSuffix}@homolog.local`;
      const { data: created, error } = await supabase.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
        app_metadata: { org_id: orgId, role },
      });

      let userId = created?.user?.id;
      if (error && /already/i.test(error.message)) {
        const { data: users } = await supabase.auth.admin.listUsers();
        userId = users.users.find((user) => user.email === email)?.id;
        if (userId) {
          const { error: metadataError } = await supabase.auth.admin.updateUserById(userId, {
            app_metadata: { org_id: orgId, role },
          });
          if (metadataError) throw metadataError;
        }
      } else if (error) {
        throw error;
      }
      if (!userId) throw new Error(`Supabase did not return a userId for ${email}`);

      for (const tenantId of tenantIds) {
        await query(
          `INSERT INTO org_members (
             org_id, tenant_id, auth_user_id, email, full_name, role, role_id, is_active
           )
           VALUES (
             $1, $2, $3, $4, $5, $6::varchar,
             (
               SELECT id
                 FROM roles
                WHERE slug = $6::varchar
                  AND tenant_id IS NULL
                  AND deleted_at IS NULL
                  AND archived_at IS NULL
                LIMIT 1
             ),
             TRUE
           )
           ON CONFLICT (tenant_id, auth_user_id) DO UPDATE
             SET role = EXCLUDED.role,
                 role_id = EXCLUDED.role_id,
                 is_active = TRUE`,
          [orgId, tenantId, userId, email, `Homolog ${role}`, role],
        );
      }

      credentials.push(`RBAC_HARNESS_${role.toUpperCase()}_EMAIL=${email}`);
    }

    console.log('\n# Credentials for the harness:');
    // Never print the password (CWE-312/532). Set PROVISION_PASSWORD explicitly
    // so you control/know the value; it is not echoed to logs.
    console.log('# RBAC_HARNESS_*_PASSWORD = (set/read via env PROVISION_PASSWORD)');
    console.log(credentials.join('\n'));
    console.log(`# RBAC_HARNESS_TENANT_A/B/C=${tenantIds.slice(0, 3).join(' / ')}`);
  } finally {
    await ds.destroy();
  }
}

main().catch((error: unknown) => {
  console.error('ERROR:', error instanceof Error ? error.message : error);
  process.exit(1);
});
