/**
 * seeds/index.ts
 *
 * Seed runner — runs all seeds in order.
 * Invoked by the npm run db:seed script.
 *
 * Flags:
 *   --force   Runs even with NODE_ENV=production (requires explicit confirmation)
 */

import 'reflect-metadata';
import { AppDataSource } from '../datasource';
import { seedDefaultTenant }  from './01_default_tenant';
import { seedAdminUser }      from './02_admin_user';
import { seedOperational }    from './03_operational_seed';
import { seedRbac }           from './04_rbac_seed';
import { seedOrgStructure }   from './05_org_structure_seed';
import { extractSupabaseRef, SUPABASE_PROD_REF } from '../../core/config/env.schema';

async function run(): Promise<void> {
  const env    = process.env['NODE_ENV'] ?? 'development';
  const force  = process.argv.includes('--force');

  if (env === 'production' && !force) {
    console.error(
      '\n[MUSIC OS 360] Seeds em produção requerem a flag --force.\n' +
      'Exemplo: npm run db:seed -- --force\n' +
      'ATENÇÃO: seeds sobrescrevem dados existentes.\n',
    );
    process.exit(1);
  }

  // Fail-closed regardless of NODE_ENV/--force: no run of this
  // runner may reach the MAIN Supabase branch, even if someone runs it with
  // --force by mistake. --force exists to allow legitimate production
  // (outside the MAIN project), not to bypass this guard.
  const targetRef = extractSupabaseRef(process.env['DATABASE_URL']);
  if (targetRef === SUPABASE_PROD_REF) {
    console.error(
      '\n[MUSIC OS 360] Recusado: DATABASE_URL aponta para a branch MAIN do Supabase.\n' +
      'Seeds nunca podem rodar contra MAIN, independente de NODE_ENV ou --force.\n',
    );
    process.exit(1);
  }

  console.log(`\n[MUSIC OS 360] Iniciando seeds (env=${env})…`);

  if (!AppDataSource.isInitialized) {
    await AppDataSource.initialize();
    console.log('  ✓ DataSource inicializado');
  }

  try {
    const tenant = await seedDefaultTenant(AppDataSource);
    await seedAdminUser(AppDataSource, tenant);
    await seedOperational(AppDataSource, tenant);
    console.log('  ✓ Operacional: org/tenant/billing/artista/contato/campanha/contrato/transação demo');

    // FASE 8 — RBAC global (permissions/roles/role_permissions) + organograma por tenant.
    const rbac = await seedRbac(AppDataSource);
    console.log(`  ✓ RBAC: ${rbac.permissions} permissions, ${rbac.roles} roles, ${rbac.rolePermissions} role_permissions`);
    const org = await seedOrgStructure(AppDataSource);
    console.log(`  ✓ Organograma: ${org.tenants} tenant(s) × (${org.perTenant.departments} departments, ${org.perTenant.positions} positions, ${org.perTenant.jobFunctions} job_functions)`);

    console.log('\n[MUSIC OS 360] Seeds concluídos com sucesso.\n');
  } catch (err) {
    console.error('\n[MUSIC OS 360] Erro durante seeds:', (err as Error).message);
    process.exit(1);
  } finally {
    await AppDataSource.destroy();
  }
}

run();
