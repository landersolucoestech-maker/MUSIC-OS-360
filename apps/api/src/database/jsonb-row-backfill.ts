import type { QueryRunner } from 'typeorm';

/**
 * Shared machinery of the PJ1 persisted-vocabulary backfill migrations
 * (20260930000019, 20260930000025..): row-wise, idempotent, exact-match, guarded,
 * reversible rewrites of jsonb keys / enum values.
 *
 *  - Candidate rows are selected with a cheap SQL predicate (never a table scan
 *    without it) and read in id order, BATCH rows at a time.
 *  - The pure `transform(row)` returns the columns to change (or null when the
 *    row is already canonical -> skipped, so a re-run changes nothing).
 *  - Every rewritten row is first recorded in a side table with the BEFORE and AFTER
 *    value of the changed columns only. `ON CONFLICT DO UPDATE`: a row that is already
 *    canonical is skipped, so a conflict only happens when the row is transformed AGAIN
 *    (up -> down -> an older build edits it -> up) and its record must follow it; keeping
 *    the stale BEFORE/AFTER would make the second down() restore nothing for that row (L4).
 *    The side table is RLS-locked (enabled + forced, no policy, privileges revoked) and is
 *    NOT dropped by down(): forensic data, drop it in a later migration.
 *  - The UPDATE is guarded: it only applies while each changed column still holds
 *    the value that was read (a concurrent user edit wins and the row is retried
 *    on the next run). `updated_at` is never touched (vocabulary rewrite, not a
 *    user edit; bumping it would break optimistic concurrency of open editors).
 *  - restore() (down) puts BEFORE back only for rows whose changed columns still
 *    hold AFTER, i.e. never reverts a value the user edited afterwards.
 *  - Logs are bounded: counts only, never row values.
 */
export const BACKFILL_BATCH_SIZE = 500;

/** A canonical value that carries no data: null, '', [] or {}. A legacy key holding data beats it (L2). */
export function isEmptyJsonValue(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as object).length === 0;
  return false;
}

export interface RowBackfillSpec {
  /** Migration name, for log lines. */
  migration: string;
  /** Target table (identifier, not user input). */
  table: string;
  /** Side-table name (identifier). */
  logTable: string;
  /** Extra columns to read besides id and tenant_id. */
  columns: readonly string[];
  /** Subset of `columns` that are jsonb (compared/bound as jsonb). */
  jsonbColumns: readonly string[];
  /** SQL expression of the tenant id of a row (default the `tenant_id` column; `"id"` for `tenants`; a nil uuid for global tables). */
  tenantIdSql?: string;
  /** SQL predicate selecting candidate rows (static string). */
  candidatePredicate: string;
  /**
   * Pure rewrite: columns to change (value = new column value), or null to skip. `conflicts` counts keys where both
   * spellings existed; `emptyCanonicalReplaced` those where the canonical value was empty (null/''/[]/{}) and the legacy
   * value carried data, so the legacy value was kept.
   */
  transform(row: Record<string, unknown>): { set: Record<string, unknown>; conflicts: number; emptyCanonicalReplaced?: number } | null;
}

export async function createBackfillLogTable(queryRunner: QueryRunner, logTable: string): Promise<void> {
  await queryRunner.query(`
    CREATE TABLE IF NOT EXISTS "${logTable}" (
      "table_name" varchar(64) NOT NULL,
      "id" uuid NOT NULL,
      "tenant_id" uuid NOT NULL,
      "before" jsonb NOT NULL,
      "after" jsonb NOT NULL,
      "backed_up_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("table_name", "id")
    )`);
  await queryRunner.query(`ALTER TABLE "${logTable}" ENABLE ROW LEVEL SECURITY`);
  await queryRunner.query(`ALTER TABLE "${logTable}" FORCE ROW LEVEL SECURITY`);
  await queryRunner.query(`REVOKE ALL ON TABLE "${logTable}" FROM PUBLIC`);
  await queryRunner.query(`
    DO $$
    DECLARE r text;
    BEGIN
      FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'musicos_app'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
          EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', '${logTable}', r);
        END IF;
      END LOOP;
    END $$;`);
}

const isJson = (spec: RowBackfillSpec, column: string): boolean => spec.jsonbColumns.includes(column);

/** Guard predicate: column still holds the value that was read. `$n` is the bound parameter. */
function sameAs(spec: RowBackfillSpec, column: string, n: number): string {
  return isJson(spec, column) ? `"${column}" = $${n}::jsonb` : `"${column}" IS NOT DISTINCT FROM $${n}`;
}

function bind(spec: RowBackfillSpec, column: string, value: unknown): unknown {
  return isJson(spec, column) && value !== null && value !== undefined ? JSON.stringify(value) : value ?? null;
}

export async function backfillRows(
  queryRunner: QueryRunner,
  spec: RowBackfillSpec,
): Promise<{ rewritten: number; conflicts: number; emptyCanonicalReplaced: number; skippedConcurrent: number }> {
  const cols = [`"id"`, `${spec.tenantIdSql ?? '"tenant_id"'} AS "tenant_id"`, ...spec.columns.map((c) => `"${c}"`)].join(', ');
  let lastId = '00000000-0000-0000-0000-000000000000';
  let rewritten = 0;
  let conflicts = 0;
  let emptyReplaced = 0;
  let skippedConcurrent = 0;

  for (;;) {
    const rows: Array<Record<string, unknown>> = await queryRunner.query(
      `SELECT ${cols} FROM "${spec.table}" WHERE (${spec.candidatePredicate}) AND "id" > $1 ORDER BY "id" LIMIT ${BACKFILL_BATCH_SIZE}`,
      [lastId],
    );
    if (rows.length === 0) break;
    for (const row of rows) {
      lastId = String(row['id']);
      const change = spec.transform(row);
      if (!change) continue;
      const changed = Object.keys(change.set);
      const before: Record<string, unknown> = {};
      for (const c of changed) before[c] = row[c] ?? null;

      await queryRunner.query(
        `INSERT INTO "${spec.logTable}" ("table_name", "id", "tenant_id", "before", "after")
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
         ON CONFLICT ("table_name", "id") DO UPDATE SET "before" = EXCLUDED."before", "after" = EXCLUDED."after", "tenant_id" = EXCLUDED."tenant_id", "backed_up_at" = now()`,
        [spec.table, row['id'], row['tenant_id'], JSON.stringify(before), JSON.stringify(change.set)],
      );

      const params: unknown[] = [row['id']];
      const sets: string[] = [];
      const guards: string[] = [];
      for (const c of changed) {
        params.push(bind(spec, c, change.set[c]));
        sets.push(`"${c}" = $${params.length}${isJson(spec, c) ? '::jsonb' : ''}`);
        params.push(bind(spec, c, before[c]));
        guards.push(sameAs(spec, c, params.length));
      }
      const result: Array<{ id: string }> = await queryRunner.query(
        `UPDATE "${spec.table}" SET ${sets.join(', ')} WHERE "id" = $1 AND ${guards.join(' AND ')} RETURNING "id"`,
        params,
      );
      if (result.length > 0) {
        rewritten += 1;
        conflicts += change.conflicts;
        emptyReplaced += change.emptyCanonicalReplaced ?? 0;
      } else {
        skippedConcurrent += 1;
      }
    }
    if (rows.length < BACKFILL_BATCH_SIZE) break;
  }
  console.log(
    `[${spec.migration}] ${spec.table}: ${rewritten} row(s) rewritten, ${conflicts} key conflict(s) resolved canonical-wins (${emptyReplaced} of them kept the legacy value because the canonical one was empty), ${skippedConcurrent} skipped (changed concurrently)`,
  );
  return { rewritten, conflicts, emptyCanonicalReplaced: emptyReplaced, skippedConcurrent };
}

/** down(): restore BEFORE for the rows recorded in the side table whose changed columns still hold AFTER. */
export async function restoreRows(
  queryRunner: QueryRunner,
  spec: Pick<RowBackfillSpec, 'migration' | 'table' | 'logTable' | 'jsonbColumns'>,
): Promise<number> {
  const [{ present }]: Array<{ present: boolean }> = await queryRunner.query(`SELECT to_regclass($1) IS NOT NULL AS present`, [`public."${spec.logTable}"`]);
  if (!present) {
    console.log(`[${spec.migration}] ${spec.table}: no side table, nothing to restore`);
    return 0;
  }
  const logged: Array<{ id: string; before: Record<string, unknown>; after: Record<string, unknown> }> = await queryRunner.query(
    `SELECT "id", "before", "after" FROM "${spec.logTable}" WHERE "table_name" = $1 ORDER BY "id"`,
    [spec.table],
  );
  const full = spec as unknown as RowBackfillSpec;
  let restored = 0;
  for (const entry of logged) {
    const changed = Object.keys(entry.after);
    const params: unknown[] = [entry.id];
    const sets: string[] = [];
    const guards: string[] = [];
    for (const c of changed) {
      params.push(bind(full, c, entry.before[c]));
      sets.push(`"${c}" = $${params.length}${isJson(full, c) ? '::jsonb' : ''}`);
      params.push(bind(full, c, entry.after[c]));
      guards.push(sameAs(full, c, params.length));
    }
    const result: Array<{ id: string }> = await queryRunner.query(
      `UPDATE "${spec.table}" SET ${sets.join(', ')} WHERE "id" = $1 AND ${guards.join(' AND ')} RETURNING "id"`,
      params,
    );
    restored += result.length;
  }
  console.log(`[${spec.migration}] ${spec.table}: ${restored} row(s) restored of ${logged.length} recorded`);
  return restored;
}
