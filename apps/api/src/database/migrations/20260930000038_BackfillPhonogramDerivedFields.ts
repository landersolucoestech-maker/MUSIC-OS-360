import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';
import {
  BACKFILL_BATCH_SIZE,
  backfillRows,
  createBackfillLogTable,
  restoreRows,
  type RowBackfillSpec,
} from '../jsonb-row-backfill';

/**
 * 20260930000038_BackfillPhonogramDerivedFields
 *
 * BLK-PHONOGRAMS-DERIVED-FIELDS. `phonograms.duration_seconds` and the compact `phonograms.isrc` are the
 * authoritative fields; `duration_text` and the four `isrc_*` parts are derived and rewritten by every write path
 * (registry-fields.util.ts). Rows written before that rule may hold only the derived shape. This step fills the
 * authoritative/derived gaps and never overwrites a disagreement:
 *   - `duration_seconds` IS NULL and `duration_text` is well-formed MM:SS (or HH:MM:SS)  -> duration_seconds.
 *   - an `isrc` that is valid and whose parts are NULL                                    -> the NULL parts (2/3/2/5).
 *   - stored duration_seconds vs parsed duration_text, or a stored isrc part vs the part derived from a valid isrc,
 *     that DISAGREE are recorded in `phonogram_derived_field_conflicts_20260930` (stored vs derived value) and the
 *     row's columns of that group stay untouched, for a human to decide.
 * Non-destructive: only NULL columns are set, `duration_text`/`isrc` are never rewritten, `updated_at` untouched
 * (rules of jsonb-row-backfill.ts: candidate rows only, idempotent, guarded UPDATE, BEFORE/AFTER of the changed
 * columns in `phonogram_derived_fields_backfill_20260930`, counts-only logs). down() restores BEFORE for rows still
 * holding exactly AFTER; both side tables are kept (forensic data, drop in a later migration).
 *
 * Contract step: entity-validators.ts `hasDuration` may read `duration_seconds` alone once
 *   SELECT count(*) FROM phonograms WHERE duration_seconds IS NULL AND duration_text IS NOT NULL
 * returns only the rows listed as unparseable, in every environment.
 */
const MIGRATION = 'BackfillPhonogramDerivedFields20260930000038';
const LOG_TABLE = 'phonogram_derived_fields_backfill_20260930';
const CONFLICT_TABLE = 'phonogram_derived_field_conflicts_20260930';

const ISRC_PART_COLUMNS = ['isrc_country_code', 'isrc_registrant_code', 'isrc_year', 'isrc_designation_code'] as const;
const COLUMNS = ['duration_seconds', 'duration_text', 'isrc', ...ISRC_PART_COLUMNS] as const;

/** Frozen copy of the application rules (no application import from a migration). Exported for the spec. */
export function parseWellFormedDuration(text: unknown): number | null {
  if (typeof text !== 'string') return null;
  const match = /^(?:(\d{1,3}):)?(\d{1,4}):([0-5]?\d)$/.exec(text.trim());
  if (!match) return null;
  const hours = match[1] === undefined ? 0 : Number(match[1]);
  return hours * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

export function deriveIsrcPartsOf(isrc: unknown): Record<(typeof ISRC_PART_COLUMNS)[number], string> | null {
  if (typeof isrc !== 'string') return null;
  const compact = isrc.toUpperCase().replace(/[\s-]/g, '');
  if (!/^[A-Z]{2}[A-Z0-9]{3}\d{2}\d{5}$/.test(compact)) return null;
  return {
    isrc_country_code: compact.slice(0, 2),
    isrc_registrant_code: compact.slice(2, 5),
    isrc_year: compact.slice(5, 7),
    isrc_designation_code: compact.slice(7, 12),
  };
}

const blank = (v: unknown): boolean => v === null || v === undefined || (typeof v === 'string' && v.trim() === '');

/** Disagreements of one row, by field group. Pure. */
export function phonogramConflicts(row: Record<string, unknown>): Array<{ group: 'duration' | 'isrc'; stored: Record<string, unknown>; derived: Record<string, unknown> }> {
  const out: Array<{ group: 'duration' | 'isrc'; stored: Record<string, unknown>; derived: Record<string, unknown> }> = [];
  const parsed = parseWellFormedDuration(row['duration_text']);
  if (typeof row['duration_seconds'] === 'number' && parsed !== null && parsed !== row['duration_seconds']) {
    out.push({ group: 'duration', stored: { duration_seconds: row['duration_seconds'], duration_text: row['duration_text'] }, derived: { duration_seconds: parsed } });
  }
  const parts = deriveIsrcPartsOf(row['isrc']);
  if (parts) {
    const diverging = ISRC_PART_COLUMNS.filter((c) => !blank(row[c]) && String(row[c]).toUpperCase() !== parts[c]);
    if (diverging.length > 0) {
      out.push({
        group: 'isrc',
        stored: Object.fromEntries([['isrc', row['isrc']], ...diverging.map((c) => [c, row[c]])]),
        derived: Object.fromEntries(diverging.map((c) => [c, parts[c]])),
      });
    }
  }
  return out;
}

/** Pure rewrite: only NULL columns are set; a group that disagrees is left untouched. */
export function transformPhonogram(row: Record<string, unknown>): { set: Record<string, unknown>; conflicts: number } | null {
  const conflicts = phonogramConflicts(row);
  const set: Record<string, unknown> = {};
  if (row['duration_seconds'] === null || row['duration_seconds'] === undefined) {
    const parsed = parseWellFormedDuration(row['duration_text']);
    if (parsed !== null) set['duration_seconds'] = parsed;
  }
  if (!conflicts.some((c) => c.group === 'isrc')) {
    const parts = deriveIsrcPartsOf(row['isrc']);
    if (parts) for (const c of ISRC_PART_COLUMNS) if (blank(row[c])) set[c] = parts[c];
  }
  return Object.keys(set).length > 0 ? { set, conflicts: 0 } : null;
}

const CANDIDATE_PREDICATE = `("duration_text" IS NOT NULL) OR ("isrc" IS NOT NULL)`;

/** Exported for the spec. */
export const PHONOGRAM_DERIVED_FIELDS_BACKFILL = { LOG_TABLE, CONFLICT_TABLE, COLUMNS } as const;

const SPEC: RowBackfillSpec = {
  migration: MIGRATION,
  table: 'phonograms',
  logTable: LOG_TABLE,
  columns: COLUMNS,
  jsonbColumns: [],
  candidatePredicate: CANDIDATE_PREDICATE,
  transform: transformPhonogram,
};

async function createConflictTable(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`
    CREATE TABLE IF NOT EXISTS "${CONFLICT_TABLE}" (
      "id" uuid NOT NULL,
      "tenant_id" uuid NOT NULL,
      "field_group" varchar(16) NOT NULL,
      "stored" jsonb NOT NULL,
      "derived" jsonb NOT NULL,
      "detected_at" timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY ("id", "field_group")
    )`);
  await queryRunner.query(`ALTER TABLE "${CONFLICT_TABLE}" ENABLE ROW LEVEL SECURITY`);
  await queryRunner.query(`ALTER TABLE "${CONFLICT_TABLE}" FORCE ROW LEVEL SECURITY`);
  await queryRunner.query(`REVOKE ALL ON TABLE "${CONFLICT_TABLE}" FROM PUBLIC`);
  await queryRunner.query(`
    DO $$
    DECLARE r text;
    BEGIN
      FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'musicos_app'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
          EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', '${CONFLICT_TABLE}', r);
        END IF;
      END LOOP;
    END $$;`);
}

/** Records every disagreement (read-only on phonograms). Idempotent: the record follows the row's current values. */
async function logConflicts(queryRunner: QueryRunner): Promise<number> {
  let lastId = '00000000-0000-0000-0000-000000000000';
  let logged = 0;
  for (;;) {
    const rows: Array<Record<string, unknown>> = await queryRunner.query(
      `SELECT "id", "tenant_id" AS "tenant_id", ${COLUMNS.map((c) => `"${c}"`).join(', ')} FROM "phonograms" WHERE (${CANDIDATE_PREDICATE}) AND "id" > $1 ORDER BY "id" LIMIT ${BACKFILL_BATCH_SIZE}`,
      [lastId],
    );
    if (rows.length === 0) break;
    for (const row of rows) {
      lastId = String(row['id']);
      for (const conflict of phonogramConflicts(row)) {
        await queryRunner.query(
          `INSERT INTO "${CONFLICT_TABLE}" ("id", "tenant_id", "field_group", "stored", "derived")
           VALUES ($1, $2, $3, $4::jsonb, $5::jsonb)
           ON CONFLICT ("id", "field_group") DO UPDATE SET "stored" = EXCLUDED."stored", "derived" = EXCLUDED."derived", "detected_at" = now()`,
          [row['id'], row['tenant_id'], conflict.group, JSON.stringify(conflict.stored), JSON.stringify(conflict.derived)],
        );
        logged += 1;
      }
    }
    if (rows.length < BACKFILL_BATCH_SIZE) break;
  }
  console.log(`[${MIGRATION}] phonograms: ${logged} disagreement(s) recorded in ${CONFLICT_TABLE} (left untouched)`);
  return logged;
}

export class BackfillPhonogramDerivedFields20260930000038 implements MigrationInterface {
  name = MIGRATION;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await createBackfillLogTable(queryRunner, LOG_TABLE);
    await createConflictTable(queryRunner);
    await logConflicts(queryRunner);
    await backfillRows(queryRunner, SPEC);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await restoreRows(queryRunner, SPEC);
  }
}
