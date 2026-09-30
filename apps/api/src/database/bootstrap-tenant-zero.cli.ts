/**
 * bootstrap-tenant-zero.cli.ts
 *
 * Entry point of `npm run db:bootstrap:tenant-zero`. Deliberately separate from
 * `bootstrap-tenant-zero.ts`: that module is pure (it only receives
 * an already prepared `DataSource`) so it can be unit tested without opening
 * any connection; this file is the one that imports `./datasource`
 * (which validates env/DATABASE_URL on import — see datasource.ts:43), talks to
 * the Supabase Admin API when a real owner is requested, and decides when to
 * open/close the real connection.
 *
 * Real owner (Part 73): when TENANT_ZERO_OWNER_EMAIL is defined,
 * creates (or finds, if it already exists) a real Supabase Auth user
 * for that e-mail, with a strong temporary password and
 * `app_metadata.must_change_password = true`, and passes it to the pure
 * function instead of the synthetic owner. The temporary password:
 *   - is never logged, committed or persisted by this script;
 *   - is only printed to stdout when running interactively in a local
 *     terminal (`process.stdout.isTTY`) — never in CI/non-interactive runs,
 *     where the log would be a persistent artifact visible to anyone
 *     with read access to the repository;
 *   - explicit, opt-in EXCEPTION: TENANT_ZERO_PRINT_PASSWORD_I_ACCEPT_THE_RISK=yes
 *     forces printing even outside a TTY. It exists only for a single,
 *     deliberate run where the operator has already decided to accept the risk (equivalent to the
 *     CONFIRM_ROLLBACK=YES_I_KNOW_WHAT_I_AM_DOING pattern of db-ops.ts) — the
 *     password still expires on the first login (must_change_password=true), but
 *     stays visible in the log until then. Never use this as an operational default.
 */
import 'reflect-metadata';
import { createClient } from '@supabase/supabase-js';
import { AppDataSource } from './datasource';
import { extractSupabaseRef, SUPABASE_PROD_REF } from '../core/config/env.schema';
import { bootstrapTenantZero, type RealOwnerInput } from './bootstrap-tenant-zero';
import { generateStrongPassword } from '../core/security/generate-strong-password';
import { normalizeEmail } from '../core/security/normalize-email';

async function resolveRealOwner(rawEmail: string): Promise<{ owner: RealOwnerInput; created: boolean; provisionalPassword: string | null }> {
  const email = normalizeEmail(rawEmail);
  const supabaseUrl = process.env['SUPABASE_URL'];
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to provision a real owner (TENANT_ZERO_OWNER_EMAIL).');
  }
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // There is no getUserByEmail in the Admin API — searches the first page of
  // listUsers(). Adequate in this phase (few users); if that stops
  // being true, paginate here.
  const { data: existing, error: listError } = await supabase.auth.admin.listUsers({ perPage: 200 });
  if (listError) {
    throw new Error(`Failed to list Supabase Auth users: ${listError.message}`);
  }
  const found = existing.users.find((u) => u.email && normalizeEmail(u.email) === email);
  if (found) {
    return { owner: { authUserId: found.id, email, fullName: null }, created: false, provisionalPassword: null };
  }

  // app_metadata (org_id/role/must_change_password) is set later, by
  // applyOwnerAppMetadata() — only after the relational bootstrap has
  // succeeded (see run()), never here.
  const provisionalPassword = generateStrongPassword();
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password: provisionalPassword,
    email_confirm: true,
  });
  if (createError || !created.user) {
    throw new Error(`Failed to create Supabase Auth user for "${email}": ${createError?.message ?? 'empty response'}`);
  }

  return { owner: { authUserId: created.user.id, email, fullName: null }, created: true, provisionalPassword };
}

async function applyOwnerAppMetadata(authUserId: string, orgId: string): Promise<void> {
  const supabaseUrl = process.env['SUPABASE_URL'];
  const serviceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!supabaseUrl || !serviceRoleKey) return; // already validated in resolveRealOwner; guard for robustness
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { error } = await supabase.auth.admin.updateUserById(authUserId, {
    app_metadata: { org_id: orgId, role: 'owner', must_change_password: true },
  });
  if (error) {
    throw new Error(`Failed to set the real owner's app_metadata: ${error.message}`);
  }
}

async function run(): Promise<void> {
  const env = process.env['NODE_ENV'] ?? 'development';
  const force = process.argv.includes('--force');
  const ownerEmail = process.env['TENANT_ZERO_OWNER_EMAIL']?.trim();

  if (env === 'production' && !force) {
    console.error(
      '\n[MUSIC OS 360] Bootstrapping tenant-zero in production requires the --force flag ' +
      'e TENANT_ZERO_OWNER_EMAIL.\n',
    );
    process.exit(1);
  }
  if (env === 'production' && !ownerEmail) {
    console.error('\n[MUSIC OS 360] In production, TENANT_ZERO_OWNER_EMAIL is required.\n');
    process.exit(1);
  }

  const targetRef = extractSupabaseRef(process.env['DATABASE_URL']);
  if (targetRef === SUPABASE_PROD_REF) {
    console.error(
      '\n[MUSIC OS 360] Refused: DATABASE_URL points to the Supabase MAIN branch. ' +
      'The tenant-zero bootstrap can never run against MAIN.\n',
    );
    process.exit(1);
  }

  console.log(`\n[MUSIC OS 360] Tenant-zero bootstrap — LANDER RECORDS (env=${env}, owner=${ownerEmail ? 'real' : 'synthetic'})…`);

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
  }

  try {
    let realOwner: RealOwnerInput | null = null;
    let provisionalPassword: string | null = null;
    let ownerCreated = false;

    if (ownerEmail) {
      const resolved = await resolveRealOwner(ownerEmail);
      realOwner = resolved.owner;
      provisionalPassword = resolved.provisionalPassword;
      ownerCreated = resolved.created;
    }

    const result = await bootstrapTenantZero(AppDataSource, realOwner);

    if (realOwner) {
      // app_metadata (org_id/role/must_change_password) is set after the
      // relational bootstrap succeeds — never leaves a "half-configured" Supabase
      // Auth user pointing to a tenant that failed to be created.
      await applyOwnerAppMetadata(realOwner.authUserId, result.orgId);
    }

    console.log(
      result.created
        ? `  ✓ LANDER RECORDS criada — org=${result.orgId} tenant=${result.tenantId}`
        : `  ✓ LANDER RECORDS already existed and was validated — org=${result.orgId} tenant=${result.tenantId}`,
    );

    if (realOwner) {
      console.log(`  ✓ Real owner: ${realOwner.email} (${ownerCreated ? 'created now' : 'already existed, reused'})`);
      if (provisionalPassword) {
        const acceptedRisk = process.env['TENANT_ZERO_PRINT_PASSWORD_I_ACCEPT_THE_RISK'] === 'yes';
        if (process.stdout.isTTY || acceptedRisk) {
          console.log('\n  ⚠ TEMPORARY PASSWORD (shown only once, not persisted anywhere):');
          console.log(`    ${provisionalPassword}`);
          console.log('  A password change will be required on first login.\n');
          if (acceptedRisk && !process.stdout.isTTY) {
            console.log('  ⚠ Printed in a non-interactive run because TENANT_ZERO_PRINT_PASSWORD_I_ACCEPT_THE_RISK=yes — change it as soon as possible.\n');
          }
        } else {
          console.log('  ⚠ Temporary password generated but NOT printed (non-interactive/CI run) — run this script locally to see it.');
        }
      }
    }
  } catch (err) {
    console.error('\n[MUSIC OS 360] Tenant-zero bootstrap error:', (err as Error).message);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

run();
