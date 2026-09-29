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
import { INTENTIONALLY_UNREGISTERED_MIGRATIONS } from './migration-registry-exceptions';

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

/**
 * Applied migrations the build does not ship: the database is ahead of (or
 * diverged from) this build — e.g. an older build about to be deployed over a
 * newer schema. That build cannot read the schema, so a deploy gate must stop.
 * Intentionally unregistered migrations (migration-registry-exceptions.ts)
 * are not counted: no build ships them, by decision.
 */
export function unknownAppliedMigrations(
  appliedNames: readonly string[],
  buildNames: readonly string[],
  intentionallyUnregistered: readonly string[] = INTENTIONALLY_UNREGISTERED_MIGRATIONS,
): string[] {
  const known = new Set([...buildNames, ...intentionallyUnregistered]);
  return appliedNames.filter((name) => !known.has(name));
}

export interface AppliedMigrationsCheck {
  /** Applied migrations this build does not ship (database ahead of / diverged from the build). */
  unknown: string[];
  /** Applied migrations that are intentionally unregistered (reported, not a failure). */
  intentionallyUnregistered: string[];
}

/** Applied migrations that this build (dataSource.migrations) does not contain. */
export async function checkAppliedMigrationsKnown(dataSource: DataSource): Promise<AppliedMigrationsCheck> {
  const queryRunner = dataSource.createQueryRunner();
  const executor = new MigrationExecutor(dataSource, queryRunner);
  try {
    await executor.showMigrations(); // ensures the tracking table exists — see migrateApplication() above
    const applied = (await executor.getExecutedMigrations()).map((m: Migration) => m.name);
    const build = dataSource.migrations.map((m) => m.name ?? m.constructor.name);
    const exempt = new Set(INTENTIONALLY_UNREGISTERED_MIGRATIONS);
    return {
      unknown: unknownAppliedMigrations(applied, build),
      intentionallyUnregistered: applied.filter((name) => exempt.has(name)),
    };
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

export interface AppliedMigrationRow {
  id: number;
  name: string;
  timestamp: number;
}

/**
 * The migrations `rollback:to <target>` would revert, newest first — or an
 * error when that cannot be done safely (DB-M2 re-review L4). TypeORM reverts
 * by tracking-row id; that is only the same as reverting everything newer than
 * the target when the rows above the target were applied in timestamp order.
 * Refused: a target this build does not ship or that is not applied, rows
 * applied out of order around the target, a row this build does not ship (no
 * down() available), and an EXTERNAL_MANAGED migration (reverted only by the
 * DBA procedure).
 */
export function planRollbackTo(
  applied: readonly AppliedMigrationRow[],
  target: string,
  buildNames: readonly string[],
): string[] {
  if (!buildNames.includes(target)) throw new Error(`"${target}" is not a migration of this build.`);
  const targetRow = applied.find((row) => row.name === target);
  if (!targetRow) throw new Error(`"${target}" is not applied: nothing to roll back to.`);
  const newerById = applied.filter((row) => row.id > targetRow.id).sort((a, b) => b.id - a.id);
  const newerByTimestamp = new Set(applied.filter((row) => row.timestamp > targetRow.timestamp).map((row) => row.name));
  if (newerById.length !== newerByTimestamp.size || newerById.some((row) => !newerByTimestamp.has(row.name))) {
    throw new Error(
      `migrations around "${target}" were applied out of timestamp order; reverting by tracking order would not ` +
      'restore the target schema. Revert them manually (docs/engineering/database.md, "Reverse transition").',
    );
  }
  const build = new Set(buildNames);
  const unknown = newerById.filter((row) => !build.has(row.name));
  if (unknown.length > 0) throw new Error(`this build has no down() for: ${unknown.map((row) => row.name).join(', ')}.`);
  const external = newerById.filter((row) => getMigrationCategory(row.name) !== MigrationCategory.APPLICATION);
  if (external.length > 0) {
    throw new Error(`refusing to revert non-APPLICATION migration(s) ${external.map((row) => row.name).join(', ')} (DBA procedure).`);
  }
  return newerById.map((row) => row.name);
}

export interface PreflightResult {
  /** Conditions that would make the migration fail or silently do nothing: never stop the build for these. */
  blocking: string[];
  /** Conditions to resolve, which do not make the migration itself fail. */
  warnings: string[];
}

/**
 * Read-only checks run before the running build is stopped for a schema change
 * (docs/engineering/database.md, "Pre-flight queries"), so a predictable failure
 * never leaves staging down with a half-applied batch.
 */
export async function preflightSchemaChange(dataSource: DataSource, change: 'migrate' | 'rollback' = 'migrate'): Promise<PreflightResult> {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const role: Array<{ bypass: boolean }> = await dataSource.query(
    `SELECT (rolsuper OR rolbypassrls) AS bypass FROM pg_roles WHERE rolname = current_user`,
  );
  if (role[0]?.bypass !== true) {
    blocking.push('the migration role is neither superuser nor BYPASSRLS: data migrations on FORCE RLS tables would update zero rows');
  }
  const queryRunner = dataSource.createQueryRunner();
  try {
    const pending = change === 'migrate' ? await new MigrationExecutor(dataSource, queryRunner).getPendingMigrations() : [];
    const external = pending.filter((m: Migration) => getMigrationCategory(m.name) !== MigrationCategory.APPLICATION);
    if (external.length > 0) {
      blocking.push(`pending non-APPLICATION migration(s) ${external.map((m: Migration) => m.name).join(', ')} need the DBA procedure first`);
    }
  } finally {
    await queryRunner.release();
  }
  const types: Array<{ type: string | null; count: string }> = await dataSource.query(
    `SELECT "type", count(*)::text AS count FROM "transactions"
      WHERE lower("type") NOT IN ('receita','despesa','investimento','imposto','transferencia','revenue','expense','investment','tax','transfer')
      GROUP BY 1`,
  ).catch(() => []);
  if (types.length > 0) {
    warnings.push(`transactions with an unmapped type (chk_transactions_type is NOT VALID; they fail on their next UPDATE): ${types.map((t) => `${t.type}=${t.count}`).join(', ')}`);
  }
  return { blocking, warnings };
}
