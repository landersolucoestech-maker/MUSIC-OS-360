#!/usr/bin/env ts-node
/**
 * scripts/db-ops.ts
 *
 * TypeScript wrapper for database operations.
 * Called by the npm scripts: db:migrate, db:rollback, db:seed, db:reset, db:check, db:generate
 *
 * Usage (via npm run):
 *   npm run db:migrate              — applies all pending migrations
 *   npm run db:rollback             — reverts the last migration
 *   npm run db:seed                 — runs seeds (dev/staging)
 *   npm run db:reset                — [dev only] drops everything + migrate + seed
 *   npm run db:check                — lists pending/applied migrations
 *   npm run db:generate -- MigName  — generates a new migration based on the entities
 */

import 'reflect-metadata';
import { AppDataSource } from '../src/database/datasource';
import { migrateApplication as migrateApplicationCore, checkApplication as checkApplicationCore } from '../src/database/migrate-application';

const COMMAND = process.argv[2];
const ARG     = process.argv[3];
const isProduction = process.env['NODE_ENV'] === 'production';

async function migrate(): Promise<void> {
  console.log('\n[db:migrate] Inicializando DataSource…');
  await AppDataSource.initialize();

  const pending = await AppDataSource.showMigrations();
  if (!pending) {
    console.log('[db:migrate] Nenhuma migration pendente. Schema está atualizado.\n');
    return;
  }

  console.log('[db:migrate] Aplicando migrations…');
  await AppDataSource.runMigrations({ transaction: 'each' });
  console.log('[db:migrate] Migrations aplicadas com sucesso.\n');
}

/**
 * migrate:application  (Part 72)
 *
 * Applies only migrations classified as APPLICATION (see
 * migration-classification.ts), skipping EXTERNAL_MANAGED/PRIVILEGED without
 * aborting the whole queue — unlike `db:migrate` (plain TypeORM), which
 * stops at the first failure, even when the next migration has no
 * real relation to the failed one.
 *
 * Uses only TypeORM's public API (MigrationExecutor.getPendingMigrations
 * + .insertMigration) — does not reimplement the tracking SQL. Each migration
 * runs in its own transaction (same semantics as `transaction: 'each'`):
 * tracking is only inserted after the physical up() succeeds, and both are
 * part of the same transaction — if the INSERT fails, up() is rolled back too.
 */
async function migrateApplication(): Promise<void> {
  console.log('\n[db:migrate:application] Inicializando DataSource…');
  await AppDataSource.initialize();

  const { applied, skippedNonApplication } = await migrateApplicationCore(AppDataSource);

  if (skippedNonApplication.length > 0) {
    console.log(
      `[db:migrate:application] ${skippedNonApplication.length} migration(s) pendente(s) fora de APPLICATION ` +
      `(não aplicadas por este comando — ver verify:realtime-external): ${skippedNonApplication.join(', ')}`,
    );
  }

  if (applied.length === 0) {
    console.log('[db:migrate:application] Nenhuma migration APPLICATION pendente.\n');
    return;
  }

  console.log(`[db:migrate:application] Aplicadas: ${applied.join(', ')}`);
  console.log('[db:migrate:application] Migrations APPLICATION aplicadas com sucesso.\n');
}

/**
 * check:application  (Part 72) — like db:check, but only considers APPLICATION
 * migrations. A pending EXTERNAL_MANAGED migration never makes this
 * command fail (see verify:realtime-external for its state).
 */
async function checkApplication(): Promise<void> {
  console.log('\n[db:check:application] Verificando migrations APPLICATION…\n');
  await AppDataSource.initialize();

  const { applicationPending, nonApplicationPending } = await checkApplicationCore(AppDataSource);

  if (nonApplicationPending.length > 0) {
    console.log(
      `ℹ ${nonApplicationPending.length} migration(s) EXTERNAL_MANAGED/PRIVILEGED pendente(s) ` +
      `(não bloqueiam este comando): ${nonApplicationPending.join(', ')}`,
    );
  }

  if (applicationPending.length === 0) {
    console.log('✓ Nenhuma migration APPLICATION pendente.\n');
  } else {
    console.log(`⚠ ${applicationPending.length} migration(s) APPLICATION pendente(s) — execute: npm run db:migrate:application`);
    console.log(applicationPending.map((n) => `  [ ] ${n}`).join('\n') + '\n');
    process.exitCode = 1;
  }
}

async function rollback(): Promise<void> {
  if (isProduction) {
    const confirm = process.env['CONFIRM_ROLLBACK'];
    if (confirm !== 'YES_I_KNOW_WHAT_I_AM_DOING') {
      console.error(
        '\n[db:rollback] PROIBIDO em produção sem confirmação explícita.\n' +
        'Defina CONFIRM_ROLLBACK=YES_I_KNOW_WHAT_I_AM_DOING para prosseguir.\n',
      );
      process.exit(1);
    }
  }

  console.log('\n[db:rollback] Revertendo última migration…');
  await AppDataSource.initialize();
  await AppDataSource.undoLastMigration({ transaction: 'each' });
  console.log('[db:rollback] Migration revertida.\n');
}

async function check(): Promise<void> {
  console.log('\n[db:check] Verificando estado das migrations…\n');
  await AppDataSource.initialize();

  const hasPending = await AppDataSource.showMigrations();
  if (!hasPending) {
    console.log('✓ Sem migrations pendentes — schema sincronizado.\n');
  } else {
    console.log('⚠ Existem migrations pendentes — execute: npm run db:migrate\n');
    process.exit(1);
  }
}

async function reset(): Promise<void> {
  if (isProduction) {
    console.error('\n[db:reset] PROIBIDO em produção. Use db:migrate.\n');
    process.exit(1);
  }

  console.log('\n[db:reset] Inicializando DataSource…');
  await AppDataSource.initialize();

  console.log('[db:reset] Dropando todas as tabelas (CASCADE)…');
  await AppDataSource.dropDatabase();

  console.log('[db:reset] Criando schema do zero…');
  await AppDataSource.runMigrations({ transaction: 'each' });

  console.log('[db:reset] Executando seeds…');
  // Dynamic import to avoid automatic execution
  const { seedDefaultTenant } = await import('../src/database/seeds/01_default_tenant');
  const { seedAdminUser }     = await import('../src/database/seeds/02_admin_user');
  const tenant = await seedDefaultTenant(AppDataSource);
  await seedAdminUser(AppDataSource, tenant);

  console.log('\n[db:reset] Reset concluído (dev).\n');
}

async function seedOperational(): Promise<void> {
  const env   = process.env['NODE_ENV'] ?? 'development';
  const force = process.argv.includes('--force');

  if (env === 'production' && !force) {
    console.error('\n[seed:operational] Seeds em produção requerem --force.\n');
    process.exit(1);
  }

  console.log(`\n[seed:operational] Iniciando seed operacional (env=${env})…`);

  if (!AppDataSource.isInitialized) await AppDataSource.initialize();

  // seedOperational() assumes the default tenant/org already seeded (same IDs
  // as 01_default_tenant.ts) -- it needs the SeedResult returned by it,
  // not only the DataSource (same pattern already used in resetDb() above).
  const { seedDefaultTenant } = await import('../src/database/seeds/01_default_tenant');
  const { seedOperational: runSeed } = await import('../src/database/seeds/03_operational_seed');
  const tenant = await seedDefaultTenant(AppDataSource);
  await runSeed(AppDataSource, tenant);

  console.log('[seed:operational] Concluído.\n');
}

async function generate(): Promise<void> {
  const name = ARG ?? 'AutoMigration';
  console.log(
    `\n[db:generate] Para gerar a migration '${name}', execute manualmente:\n` +
    `  npx typeorm migration:generate -d src/database/datasource.ts src/database/migrations/${Date.now()}_${name}\n` +
    '\nNota: ts-node deve estar instalado globalmente ou use npx ts-node.\n',
  );
  process.exit(0);
}

async function main(): Promise<void> {
  try {
    switch (COMMAND) {
      case 'migrate':            await migrate();              break;
      case 'migrate:application': await migrateApplication();  break;
      case 'rollback':           await rollback();             break;
      case 'check':              await check();                break;
      case 'check:application':  await checkApplication();     break;
      case 'reset':              await reset();                break;
      case 'generate':           await generate();             break;
      case 'seed:operational':   await seedOperational();      break;
      default:
        console.error(`\n[db-ops] Comando desconhecido: '${COMMAND ?? ''}'`);
        console.error('Comandos válidos: migrate | migrate:application | rollback | check | check:application | reset | generate | seed:operational\n');
        process.exit(1);
    }
  } catch (err) {
    console.error(`\n[db-ops:${COMMAND}] Erro:`, (err as Error).message);
    if (process.env['NODE_ENV'] !== 'production') {
      console.error((err as Error).stack);
    }
    process.exit(1);
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

main();
