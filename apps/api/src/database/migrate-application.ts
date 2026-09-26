/**
 * migrate-application.ts  (Part 72 — decoupling of externally managed migrations)
 *
 * Segmented executor and verifier: they operate only on migrations
 * classified as APPLICATION (see migration-classification.ts),
 * leaving EXTERNAL_MANAGED/PRIVILEGED out without aborting the whole queue —
 * unlike a plain `dataSource.runMigrations()`, which stops at the first
 * failure even when the next migration does not depend on the failed one.
 *
 * Uses only TypeORM's public API (MigrationExecutor.getPendingMigrations +
 * .insertMigration) — does not reimplement the tracking SQL. Tracking is only
 * inserted after the physical up() succeeds, inside the same transaction
 * (same semantics as `transaction: 'each'`): if the INSERT fails, up()
 * is rolled back too.
 *
 * Pure functions receiving an already prepared DataSource — no connection I/O —
 * so they are testable without depending on the import-time-guard module of
 * datasource.ts (same pattern as bootstrap-tenant-zero.ts).
 */
import type { DataSource, Migration } from 'typeorm';
import { MigrationExecutor } from 'typeorm';
import { getMigrationCategory, MigrationCategory } from './migration-classification';

export interface MigrateApplicationResult {
  applied: string[];
  skippedNonApplication: string[];
}

export async function migrateApplication(dataSource: DataSource): Promise<MigrateApplicationResult> {
  const queryRunner = dataSource.createQueryRunner();
  const executor = new MigrationExecutor(dataSource, queryRunner);
  executor.transaction = 'each';

  try {
    // showMigrations() is the public method that creates the tracking table
    // (and the typeorm_metadata table) if it doesn't exist yet — the same
    // bootstrap executePendingMigrations() does internally before it calls
    // getPendingMigrations(). Calling it here (ignoring its boolean return)
    // is required on a genuinely fresh database; on Supabase DEV/STAGING the
    // table already exists, so this is a fast no-op there.
    await executor.showMigrations();

    const pending = await executor.getPendingMigrations();
    const applicationPending = pending.filter((m: Migration) => getMigrationCategory(m.name) === MigrationCategory.APPLICATION);
    const nonApplicationPending = pending.filter((m: Migration) => getMigrationCategory(m.name) !== MigrationCategory.APPLICATION);

    const applied: string[] = [];
    for (const migration of applicationPending) {
      if (!migration.instance) {
        throw new Error(`Migration "${migration.name}" has no loaded instance — check migrations/index.ts.`);
      }

      // Respects the per-migration override (e.g. `transaction = false` in
      // PerformanceIndexes20260521000030, which uses CREATE INDEX CONCURRENTLY —
      // forbidden inside a transaction block). The same rule
      // MigrationExecutor.executePendingMigrations() applies internally;
      // ignoring it makes any such migration always fail in this executor.
      const useTransaction = migration.instance.transaction !== false;

      if (useTransaction) await queryRunner.startTransaction();
      try {
        await migration.instance.up(queryRunner);
        await executor.insertMigration(migration);
        if (useTransaction) await queryRunner.commitTransaction();
        applied.push(migration.name);
      } catch (err) {
        if (useTransaction) await queryRunner.rollbackTransaction().catch(() => { /* we rethrow the original error below */ });
        throw new Error(`APPLICATION migration "${migration.name}" failed: ${(err as Error).message}`);
      }
    }

    return { applied, skippedNonApplication: nonApplicationPending.map((m: Migration) => m.name) };
  } finally {
    await queryRunner.release();
  }
}

export interface CheckApplicationResult {
  applicationPending: string[];
  nonApplicationPending: string[];
}

export async function checkApplication(dataSource: DataSource): Promise<CheckApplicationResult> {
  const queryRunner = dataSource.createQueryRunner();
  const executor = new MigrationExecutor(dataSource, queryRunner);

  try {
    await executor.showMigrations(); // ensures the tracking table exists — see migrateApplication() above
    const pending = await executor.getPendingMigrations();
    return {
      applicationPending: pending.filter((m: Migration) => getMigrationCategory(m.name) === MigrationCategory.APPLICATION).map((m) => m.name),
      nonApplicationPending: pending.filter((m: Migration) => getMigrationCategory(m.name) !== MigrationCategory.APPLICATION).map((m) => m.name),
    };
  } finally {
    await queryRunner.release();
  }
}
