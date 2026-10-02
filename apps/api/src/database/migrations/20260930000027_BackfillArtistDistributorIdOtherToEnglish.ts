import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';
import { backfillRows, createBackfillLogTable, restoreRows, type RowBackfillSpec } from '../jsonb-row-backfill';

/**
 * 20260930000027_BackfillArtistDistributorIdOtherToEnglish (BUG1)
 *
 * The artist form's distributor option "Outros" was persisted with the Portuguese machine id
 * `outros` inside four jsonb columns of `artists` (no varchar column and no CHECK hold it):
 *
 *   general_distributors[].id
 *   relationships[].distributors[].id
 *   linked_contacts[].distributors[].id
 *   team_contacts[].distributors[].id
 *
 * Canonical id: `other` (web constants and the public signup already emit it). EXACT, case-sensitive
 * match on `id` only: every other key (email, customName, ...) and every other id is preserved, a
 * tenant-typed customName is never touched. The legacy checkbox maps selected_distributors /
 * company_selected_distributors (keyed by id) have no writer any more and are read through the web
 * mapper's dual-read; they are not rewritten here.
 *
 * Expand/contract, backfill step. The code that ships with this migration writes `other`; the API
 * keeps ACCEPTING `outros` (DTO Transform before validation) and the web readers keep reading it
 * (an older build keeps working while it is rolled out). The contract step (drop the legacy mapping)
 * is gated on the preflight census in docs/runbooks/staging-to-production.md#residue-census-20260930000027 returning 0. No CHECK is added.
 *
 * Rules (jsonb-row-backfill.ts): candidate rows only, idempotent, `updated_at` untouched, the UPDATE is
 * guarded by the value that was read, each rewritten row is recorded (BEFORE/AFTER of the changed
 * columns only) in the locked-down side table `artist_distributor_id_backfill_20260930`, logs are counts
 * only. down(): puts BEFORE back for the rows still holding exactly AFTER; the side table is kept.
 */
const MIGRATION = 'BackfillArtistDistributorIdOtherToEnglish20260930000027';
const LOG_TABLE = 'artist_distributor_id_backfill_20260930';

const LEGACY_ID = 'outros';
const CANONICAL_ID = 'other';

const NESTED_COLUMNS = ['relationships', 'linked_contacts', 'team_contacts'] as const;
const COLUMNS = ['general_distributors', ...NESTED_COLUMNS] as const;

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => v !== null && typeof v === 'object' && !Array.isArray(v);

const mapEntries = (entries: unknown): unknown[] | null => {
  if (!Array.isArray(entries)) return null;
  let changed = false;
  const out = entries.map((entry) => {
    if (isObject(entry) && entry['id'] === LEGACY_ID) {
      changed = true;
      return { ...entry, id: CANONICAL_ID };
    }
    return entry;
  });
  return changed ? out : null;
};

/** Exported for the unit spec only: the column value after the rewrite, or null when it is already canonical. */
export function canonicalDistributorColumnForBackfill(column: (typeof COLUMNS)[number], value: unknown): unknown[] | null {
  if (column === 'general_distributors') return mapEntries(value);
  if (!Array.isArray(value)) return null;
  let changed = false;
  const out = value.map((item) => {
    if (!isObject(item)) return item;
    const distributors = mapEntries(item['distributors']);
    if (!distributors) return item;
    changed = true;
    return { ...item, distributors };
  });
  return changed ? out : null;
}

const arr = (path: string): string => `CASE WHEN jsonb_typeof(${path}) = 'array' THEN ${path} ELSE '[]'::jsonb END`;

const PREDICATE = [
  `EXISTS (SELECT 1 FROM jsonb_array_elements(${arr('"general_distributors"')}) AS g(e) WHERE g.e ->> 'id' = '${LEGACY_ID}')`,
  ...NESTED_COLUMNS.map(
    (column) =>
      `EXISTS (SELECT 1 FROM jsonb_array_elements(${arr(`"${column}"`)}) AS i(item), ` +
      `jsonb_array_elements(${arr('i.item -> \'distributors\'')}) AS d(e) WHERE d.e ->> 'id' = '${LEGACY_ID}')`,
  ),
].join(' OR ');

const SPEC: RowBackfillSpec = {
  migration: MIGRATION,
  table: 'artists',
  logTable: LOG_TABLE,
  columns: COLUMNS,
  jsonbColumns: COLUMNS,
  candidatePredicate: PREDICATE,
  transform(row) {
    const set: Record<string, unknown> = {};
    for (const column of COLUMNS) {
      const next = canonicalDistributorColumnForBackfill(column, row[column]);
      if (next) set[column] = next;
    }
    return Object.keys(set).length > 0 ? { set, conflicts: 0 } : null;
  },
};

/** Exported for the unit spec only. */
export const ARTIST_DISTRIBUTOR_BACKFILL = { LEGACY_ID, CANONICAL_ID, LOG_TABLE, SPEC } as const;

export class BackfillArtistDistributorIdOtherToEnglish20260930000027 implements MigrationInterface {
  name = MIGRATION;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await createBackfillLogTable(queryRunner, LOG_TABLE);
    await backfillRows(queryRunner, SPEC);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await restoreRows(queryRunner, SPEC);
  }
}
