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
import { appendFileSync } from 'fs';
import { MigrationExecutor } from 'typeorm';
import { AppDataSource } from '../src/database/datasource';
import {
  migrateApplication as migrateApplicationCore,
  checkApplication as checkApplicationCore,
  checkAppliedMigrationsKnown,
  planRollbackTo,
  preflightSchemaChange,
  type AppliedMigrationRow,
} from '../src/database/migrate-application';

/**
 * Every schema-changing command first checks that the connection role bypasses
 * RLS: data migrations on FORCE RLS tables would otherwise update zero rows and
 * still be recorded as applied — including the ones that run before the
 * per-migration guard (migration-guards.ts) of the CZ migrations.
 */
async function requireRlsBypassingRole(command: string): Promise<void> {
  const rows: Array<{ bypass: boolean }> = await AppDataSource.query(
    `SELECT (rolsuper OR rolbypassrls) AS bypass FROM pg_roles WHERE rolname = current_user`,
  );
  if (rows[0]?.bypass !== true) {
    throw new Error(`[${command}] the connection role must be superuser or BYPASSRLS (docs/engineering/database.md, pre-flight queries).`);
  }
}

const COMMAND = process.argv[2];
const ARG     = process.argv[3];
const isProduction = process.env['NODE_ENV'] === 'production';

async function migrate(): Promise<void> {
  console.log('\n[db:migrate] Inicializando DataSource…');
  await AppDataSource.initialize();

  const pending = await AppDataSource.showMigrations();
  if (!pending) {
    console.log('[db:migrate] No pending migrations. Schema is up to date.\n');
    return;
  }

  await requireRlsBypassingRole('db:migrate');
  console.log('[db:migrate] Aplicando migrations…');
  await AppDataSource.runMigrations({ transaction: 'each' });
  console.log('[db:migrate] Migrations applied successfully.\n');
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
  await requireRlsBypassingRole('db:migrate:application');

  const { applied, skippedNonApplication } = await migrateApplicationCore(AppDataSource);

  if (skippedNonApplication.length > 0) {
    console.log(
      `[db:migrate:application] ${skippedNonApplication.length} pending migration(s) outside APPLICATION ` +
      `(not applied by this command — see verify:realtime-external): ${skippedNonApplication.join(', ')}`,
    );
  }

  if (applied.length === 0) {
    console.log('[db:migrate:application] No pending APPLICATION migrations.\n');
    return;
  }

  console.log(`[db:migrate:application] Aplicadas: ${applied.join(', ')}`);
  console.log('[db:migrate:application] APPLICATION migrations applied successfully.\n');
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
      `ℹ ${nonApplicationPending.length} pending EXTERNAL_MANAGED/PRIVILEGED migration(s) ` +
      `(do not block this command): ${nonApplicationPending.join(', ')}`,
    );
  }

  if (applicationPending.length === 0) {
    console.log('✓ No pending APPLICATION migrations.\n');
  } else {
    console.log(`⚠ ${applicationPending.length} pending APPLICATION migration(s) — run: npm run db:migrate:application`);
    console.log(applicationPending.map((n) => `  [ ] ${n}`).join('\n') + '\n');
    process.exitCode = 1;
  }
}

function requireRollbackConfirmation(command: string): void {
  if (isProduction && process.env['CONFIRM_ROLLBACK'] !== 'YES_I_KNOW_WHAT_I_AM_DOING') {
    console.error(
      `\n[${command}] FORBIDDEN in production without explicit confirmation.\n` +
      'Set CONFIRM_ROLLBACK=YES_I_KNOW_WHAT_I_AM_DOING to proceed.\n',
    );
    process.exit(1);
  }
}

async function rollback(): Promise<void> {
  requireRollbackConfirmation('db:rollback');

  console.log('\n[db:rollback] Reverting the last migration…');
  await AppDataSource.initialize();
  await requireRlsBypassingRole('db:rollback');
  await AppDataSource.undoLastMigration({ transaction: 'each' });
  console.log('[db:rollback] Migration revertida.\n');
}

/**
 * Fails (exit 1) when the database is not exactly at this build's schema:
 * pending migrations (this build would run against an older schema) or applied
 * migrations this build does not ship (an older build over a newer schema —
 * roll the database back first, see docs/engineering/database.md). Deploy
 * gates rely on both directions.
 */
async function check(): Promise<void> {
  console.log('\n[db:check] Checking migration state…\n');
  await AppDataSource.initialize();

  const { unknown: unknownApplied, intentionallyUnregistered } = await checkAppliedMigrationsKnown(AppDataSource);
  const hasPending = await AppDataSource.showMigrations();
  if (intentionallyUnregistered.length > 0) {
    console.log(`ℹ Applied, intentionally unregistered (migration-registry-exceptions.ts): ${intentionallyUnregistered.join(', ')}\n`);
  }
  if (unknownApplied.length > 0) {
    console.log(
      `⚠ ${unknownApplied.length} applied migration(s) are not part of this build — the database is ahead of it:\n` +
      unknownApplied.map((n) => `  [x] ${n}`).join('\n') + '\n',
    );
  }
  if (hasPending) console.log('⚠ There are pending migrations — run: npm run db:migrate\n');
  if (!hasPending && unknownApplied.length === 0) {
    console.log('✓ No pending migrations — schema in sync.\n');
    return;
  }
  process.exit(1);
}

/**
 * check:state — schema/build state for deploy gates (changes no schema; like
 * every TypeORM command it creates the empty tracking table when missing): the number of
 * pending migrations and of applied migrations this build does not ship. Also
 * appended as `pending=<n>` / `unknown_applied=<n>` to $GITHUB_OUTPUT when set.
 * Always exits 0 on a readable state (the caller decides).
 */
async function checkState(): Promise<void> {
  await AppDataSource.initialize();
  const { unknown: unknownApplied } = await checkAppliedMigrationsKnown(AppDataSource);
  const queryRunner = AppDataSource.createQueryRunner();
  let pending: string[];
  try {
    pending = (await new MigrationExecutor(AppDataSource, queryRunner).getPendingMigrations()).map((m) => m.name);
  } finally {
    await queryRunner.release();
  }
  console.log(`[db:check:state] pending=${pending.length} unknown_applied=${unknownApplied.length}`);
  for (const name of pending) console.log(`  [ ] ${name}`);
  for (const name of unknownApplied) console.log(`  [x] ${name} (not part of this build)`);
  const outputFile = process.env['GITHUB_OUTPUT'];
  if (outputFile) appendFileSync(outputFile, `pending=${pending.length}\nunknown_applied=${unknownApplied.length}\n`);
}

/**
 * rollback:to <MigrationName> — reverts migrations one by one (each down() in
 * its own transaction) until <MigrationName> is the last applied one. The
 * target must be part of this build and currently applied. Same production
 * confirmation as db:rollback.
 */
async function rollbackTo(): Promise<void> {
  const target = ARG;
  if (!target) {
    console.error('\n[db:rollback:to] Usage: db-ops.ts rollback:to <MigrationName>\n');
    process.exit(1);
  }
  requireRollbackConfirmation('db:rollback:to');
  await AppDataSource.initialize();
  await requireRlsBypassingRole('db:rollback:to');
  const rows: AppliedMigrationRow[] = (await AppDataSource.query(
    `SELECT id, name, "timestamp" FROM musicos360_migrations ORDER BY id`,
  )).map((row: { id: number; name: string; timestamp: string | number }) => ({ id: Number(row.id), name: row.name, timestamp: Number(row.timestamp) }));
  // The whole revert list is computed and validated before anything is reverted.
  const plan = planRollbackTo(rows, target, AppDataSource.migrations.map((m) => m.name ?? m.constructor.name));
  console.log(`[db:rollback:to] Reverting ${plan.length} migration(s): ${plan.join(', ') || '(none)'}`);
  for (const expected of plan) {
    const last = (await AppDataSource.query(`SELECT name FROM musicos360_migrations ORDER BY id DESC LIMIT 1`))[0]?.name;
    if (last !== expected) throw new Error(`expected to revert ${expected} but the last applied migration is ${last}: stopped.`);
    console.log(`[db:rollback:to] Reverting ${expected}…`);
    await AppDataSource.undoLastMigration({ transaction: 'each' });
  }
  console.log(`[db:rollback:to] ${target} is now the last applied migration.\n`);
}

/**
 * preflight [migrate|rollback] — read-only checks run before the running build
 * is stopped for a schema change: exit 1 on a blocking condition (the build
 * must not be stopped for a change that would fail or do nothing), warnings
 * printed as such.
 */
async function preflight(): Promise<void> {
  const change = ARG ?? 'migrate';
  if (change !== 'migrate' && change !== 'rollback') throw new Error('usage: db-ops.ts preflight [migrate|rollback]');
  await AppDataSource.initialize();
  const { blocking, warnings } = await preflightSchemaChange(AppDataSource, change);
  for (const warning of warnings) console.log(`::warning::[db:preflight] ${warning}`);
  for (const problem of blocking) console.error(`::error::[db:preflight] ${problem}`);
  if (blocking.length > 0) process.exit(1);
  console.log('[db:preflight] OK — no blocking condition.');
}

async function reset(): Promise<void> {
  if (isProduction) {
    console.error('\n[db:reset] FORBIDDEN in production. Use db:migrate.\n');
    process.exit(1);
  }

  console.log('\n[db:reset] Inicializando DataSource…');
  await AppDataSource.initialize();

  console.log('[db:reset] Dropping every table (CASCADE)…');
  await AppDataSource.dropDatabase();

  console.log('[db:reset] Criando schema do zero…');
  await AppDataSource.runMigrations({ transaction: 'each' });

  console.log('[db:reset] Running seeds...');
  // Dynamic import to avoid automatic execution
  const { seedDefaultTenant } = await import('../src/database/seeds/01_default_tenant');
  const { seedAdminUser }     = await import('../src/database/seeds/02_admin_user');
  const tenant = await seedDefaultTenant(AppDataSource);
  await seedAdminUser(AppDataSource, tenant);

  console.log('\n[db:reset] Reset completed (dev).\n');
}

async function seedOperational(): Promise<void> {
  const env   = process.env['NODE_ENV'] ?? 'development';
  const force = process.argv.includes('--force');

  if (env === 'production' && !force) {
    console.error('\n[seed:operational] Seeds in production require --force.\n');
    process.exit(1);
  }

  console.log(`\n[seed:operational] Starting operational seed (env=${env})…`);

  if (!AppDataSource.isInitialized) await AppDataSource.initialize();

  // seedOperational() assumes the default tenant/org already seeded (same IDs
  // as 01_default_tenant.ts) -- it needs the SeedResult returned by it,
  // not only the DataSource (same pattern already used in resetDb() above).
  const { seedDefaultTenant } = await import('../src/database/seeds/01_default_tenant');
  const { seedOperational: runSeed } = await import('../src/database/seeds/03_operational_seed');
  const tenant = await seedDefaultTenant(AppDataSource);
  await runSeed(AppDataSource, tenant);

  console.log('[seed:operational] Done.\n');
}

async function generate(): Promise<void> {
  const name = ARG ?? 'AutoMigration';
  console.log(
    `\n[db:generate] To generate migration '${name}', run manually:\n` +
    `  npx typeorm migration:generate -d src/database/datasource.ts src/database/migrations/${Date.now()}_${name}\n` +
    '\nNote: ts-node must be installed globally, or use npx ts-node.\n',
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
      case 'check:state':        await checkState();           break;
      case 'rollback:to':        await rollbackTo();           break;
      case 'preflight':          await preflight();            break;
      case 'check:application':  await checkApplication();     break;
      case 'reset':              await reset();                break;
      case 'generate':           await generate();             break;
      case 'seed:operational':   await seedOperational();      break;
      default:
        console.error(`\n[db-ops] Unknown command: '${COMMAND ?? ''}'`);
        console.error('Valid commands: migrate | migrate:application | rollback | rollback:to | preflight | check | check:state | check:application | reset | generate | seed:operational\n');
        process.exit(1);
    }
  } catch (err) {
    console.error(`\n[db-ops:${COMMAND}] Error:`, (err as Error).message);
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
