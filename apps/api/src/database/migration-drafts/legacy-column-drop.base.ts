import { QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';

/**
 * DRAFT BASE, GATED, NOT REGISTERED (LC1). Design and authorization checklist:
 * docs/engineering/legacy-column-drop-plan.md.
 *
 * Shared skeleton of the destructive legacy_* column drops. The drafts under migration-drafts/ are NOT part
 * of ALL_MIGRATIONS (migrations/index.ts); nothing imports them except their own spec. Registering one is the
 * release step of the plan and is allowed only after every gate of the authorization checklist is evidenced.
 * Second lock: up() and down() throw unless the operator exports LEGACY_DROP_CONFIRM=<CONFIRM_TOKEN>.
 *
 * up(), in this order (everything before the DROP is read-only or additive):
 *   1. confirmation gate, RLS-bypass guard (every tenant is archived), SET LOCAL lock_timeout '15s';
 *   2. column presence: none present -> table skipped (idempotent re-run); some present -> abort (unknown state);
 *   3. zero-use / reconciliation preconditions: every check counts rows that would LOSE information (a legacy
 *      value with no canonical counterpart); any count > 0 aborts with counts only (no row values, no PII);
 *   4. archive side table `<table>_legacy_archive_20260930` (id, tenant_id, the legacy columns, archived_at),
 *      RLS ENABLED + FORCED with NO policy and every app role revoked (same pattern as
 *      contract_service_types_taxonomy_backup_20260930): only the BYPASSRLS migration role can read it;
 *   5. archive every row that holds a non-NULL legacy value (ON CONFLICT DO NOTHING keeps an existing archive row),
 *      then verify by VALUE (IS NOT DISTINCT FROM per archived column) that every such row is covered by an archive
 *      row holding the same values, and that no archive row is stale (differs from its live row, NULLs included).
 *      A stale archive row (left by an earlier up/down/up cycle whose live values changed since) ABORTS: the operator
 *      reviews it and retires/renames that archive table; old values are never silently frozen over new ones;
 *   6. ALTER TABLE ... DROP COLUMN IF EXISTS (the only destructive statement, last).
 * down(): re-adds each column (same type, nullable) and restores the values by id from the archive (rows
 * created after the drop have no archive row and stay NULL). The archive tables are NEVER dropped here: they
 * are retired by a separate later migration after the retention window.
 */
export const CONFIRM_ENV = 'LEGACY_DROP_CONFIRM';
export const CONFIRM_TOKEN = 'drop-legacy-columns-gates-satisfied';
export const ARCHIVE_SUFFIX = '_legacy_archive_20260930';
export const MAX_MESSAGE = 600;

export interface LegacyColumn {
  readonly name: string;
  /** Exact PostgreSQL type of the live column (also used to re-add it on rollback). */
  readonly type: string;
}

export interface PreflightCheck {
  readonly label: string;
  /** Rows matching this predicate would lose information on drop (must be 0). */
  readonly where: string;
  /** Set when the check cannot prove the canonical counterpart (it only guards an obvious gap); the owner census is the real gate. */
  readonly informational?: string;
}

export interface DropTablePlan {
  readonly table: string;
  readonly columns: readonly LegacyColumn[];
  readonly checks: readonly PreflightCheck[];
}

export function archiveTableOf(table: string): string {
  return `${table}${ARCHIVE_SUFFIX}`;
}

export function bounded(text: string): string {
  return text.length <= MAX_MESSAGE ? text : `${text.slice(0, MAX_MESSAGE)}...(+${text.length - MAX_MESSAGE} chars)`;
}

export function assertConfirmed(migrationName: string): void {
  if (process.env[CONFIRM_ENV] !== CONFIRM_TOKEN) {
    throw new Error(`${migrationName}: gated draft. Set ${CONFIRM_ENV} only after the gates of docs/engineering/legacy-column-drop-plan.md are evidenced.`);
  }
}

const sameValues = (plan: DropTablePlan, left: string, right: string): string =>
  plan.columns.map((c) => `${left}."${c.name}" IS NOT DISTINCT FROM ${right}."${c.name}"`).join(' AND ');

const anyLegacyValue = (plan: DropTablePlan): string => plan.columns.map((c) => `"${c.name}" IS NOT NULL`).join(' OR ');

export async function lockDownArchiveTable(queryRunner: QueryRunner, archive: string): Promise<void> {
  await queryRunner.query(`ALTER TABLE "${archive}" ENABLE ROW LEVEL SECURITY`);
  await queryRunner.query(`ALTER TABLE "${archive}" FORCE ROW LEVEL SECURITY`);
  await queryRunner.query(`REVOKE ALL ON TABLE "${archive}" FROM PUBLIC`);
  await queryRunner.query(`
    DO $$
    DECLARE r text;
    BEGIN
      FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'musicos_app'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
          EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', '${archive}', r);
        END IF;
      END LOOP;
    END $$;`);
}

async function presentColumns(queryRunner: QueryRunner, plan: DropTablePlan): Promise<string[]> {
  const rows: Array<{ column_name: string }> = await queryRunner.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = '${plan.table}' AND column_name = ANY($1::text[])`,
    [plan.columns.map((c) => c.name)],
  );
  return rows.map((r) => r.column_name);
}

/** Runs the whole destructive skeleton for one or more tables. Returns the tables actually dropped. */
export async function runDrop(queryRunner: QueryRunner, migrationName: string, plans: readonly DropTablePlan[]): Promise<string[]> {
  assertConfirmed(migrationName);
  await assertMigrationRoleBypassesRls(queryRunner, migrationName);
  await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

  // (2) presence, for every table before anything is written.
  const active: DropTablePlan[] = [];
  for (const plan of plans) {
    const present = await presentColumns(queryRunner, plan);
    if (present.length === 0) continue;
    if (present.length !== plan.columns.length) {
      throw new Error(bounded(`${migrationName}: ${plan.table} is in a partial state (${present.length}/${plan.columns.length} legacy columns present); refusing to continue.`));
    }
    active.push(plan);
  }

  // (3) preconditions for every table before any write.
  const failures: string[] = [];
  for (const plan of active) {
    for (const check of plan.checks) {
      const rows: Array<{ n: number }> = await queryRunner.query(`SELECT count(*)::int AS n FROM "${plan.table}" WHERE ${check.where}`);
      const n = rows[0]?.n ?? 0;
      if (n > 0) failures.push(`${plan.table}:${check.label}=${n}`);
    }
  }
  if (failures.length > 0) {
    throw new Error(bounded(`${migrationName}: precondition failed, reconcile before dropping (rows that would lose data): ${failures.join(', ')}`));
  }

  // (4)+(5) archive and verify, then (6) drop.
  for (const plan of active) {
    const archive = archiveTableOf(plan.table);
    const columnDdl = plan.columns.map((c) => `"${c.name}" ${c.type}`).join(',\n        ');
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${archive}" (
        "id" uuid PRIMARY KEY,
        "tenant_id" uuid NOT NULL,
        ${columnDdl},
        "archived_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await lockDownArchiveTable(queryRunner, archive);
    const names = plan.columns.map((c) => `"${c.name}"`).join(', ');
    await queryRunner.query(`
      INSERT INTO "${archive}" ("id", "tenant_id", ${names})
      SELECT "id", "tenant_id", ${names} FROM "${plan.table}" WHERE ${anyLegacyValue(plan)}
      ON CONFLICT ("id") DO NOTHING`);
    // Value coverage: a live row with a legacy value must have an archive row with the SAME values (id alone is not enough).
    const missing: Array<{ n: number }> = await queryRunner.query(
      `SELECT count(*)::int AS n FROM "${plan.table}" t
       WHERE (${anyLegacyValue(plan)}) AND NOT EXISTS (SELECT 1 FROM "${archive}" a WHERE a."id" = t."id" AND ${sameValues(plan, 'a', 't')})`,
    );
    if ((missing[0]?.n ?? 0) > 0) {
      throw new Error(bounded(`${migrationName}: archive verification failed for ${plan.table} (${missing[0].n} row(s) not archived with their current values; a stale archive row from an earlier cycle must be reviewed and retired); nothing dropped.`));
    }
    // Staleness: an archive row that differs from its live row (including a live row whose legacy values are now all NULL)
    // would be restored by down() over newer data. Aborts instead of refreshing silently.
    const stale: Array<{ n: number }> = await queryRunner.query(
      `SELECT count(*)::int AS n FROM "${archive}" a JOIN "${plan.table}" t ON t."id" = a."id"
       WHERE NOT (${sameValues(plan, 'a', 't')})`,
    );
    if ((stale[0]?.n ?? 0) > 0) {
      throw new Error(bounded(`${migrationName}: stale archive rows for ${plan.table} (${stale[0].n} row(s) differ from the live values); review and retire ${archive} before retrying; nothing dropped.`));
    }
  }
  for (const plan of active) {
    await queryRunner.query(`ALTER TABLE "${plan.table}" ${plan.columns.map((c) => `DROP COLUMN IF EXISTS "${c.name}"`).join(', ')}`);
  }
  return active.map((p) => p.table);
}

/** Reverse of runDrop: re-add the columns (nullable) and restore the archived values by id. */
export async function runRestore(queryRunner: QueryRunner, migrationName: string, plans: readonly DropTablePlan[]): Promise<void> {
  assertConfirmed(migrationName);
  await assertMigrationRoleBypassesRls(queryRunner, migrationName);
  await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
  for (const plan of plans) {
    const archive = archiveTableOf(plan.table);
    const exists: Array<{ ok: boolean }> = await queryRunner.query(`SELECT to_regclass('public.${archive}') IS NOT NULL AS ok`);
    if (!exists[0]?.ok) {
      throw new Error(bounded(`${migrationName}: refusing down(): archive table ${archive} is missing, values cannot be restored.`));
    }
  }
  for (const plan of plans) {
    const archive = archiveTableOf(plan.table);
    await queryRunner.query(`ALTER TABLE "${plan.table}" ${plan.columns.map((c) => `ADD COLUMN IF NOT EXISTS "${c.name}" ${c.type}`).join(', ')}`);
    const sets = plan.columns.map((c) => `"${c.name}" = a."${c.name}"`).join(', ');
    await queryRunner.query(`UPDATE "${plan.table}" t SET ${sets} FROM "${archive}" a WHERE a."id" = t."id"`);
  }
}
