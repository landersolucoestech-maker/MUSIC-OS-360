import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';
import { backfillRows, createBackfillLogTable, restoreRows, type RowBackfillSpec } from '../jsonb-row-backfill';

/**
 * 20260930000025_BackfillAssetTypesToEnglish (PJ1)
 *
 * The central asset classification (AssetClassificationService) persisted three
 * Portuguese values, both in `assets.asset_type` (varchar(50), no CHECK) and mirrored in
 * `assets.metadata.classification.assetType` (jsonb):
 *   guia -> guide_track, videoclipe -> music_video, contrato -> contract.
 * (The other classifier values -- wav, mp3, master, instrumental, cover_art, banner, teaser, ...
 * -- are already English and are not touched. `marketing_assets.asset_type` is a different
 * table with its own upper-case vocabulary and is out of scope.)
 *
 * Expand/contract, backfill step. The code that ships with this migration writes the canonical
 * values and keeps accepting/reading the legacy ones (common/compat/asset-type.ts: manual review
 * input, asset responses). Contract step gated on the census in docs/runbooks/staging-to-production.md#residue-census-20260930000025.
 *
 * EXACT, case-sensitive matches only; rows whose columns are already canonical are skipped
 * (idempotent); only the two touched values change, every other metadata key is preserved;
 * `updated_at` is left alone; the UPDATE is guarded by the values that were read; every
 * rewritten row is recorded (BEFORE/AFTER) in the locked-down side table
 * `assets_asset_type_backfill_20260930`; logs are counts only. No CHECK is added (the column has
 * never been restricted and tenants' integrations may write other types).
 *
 * down(): restores BEFORE only for rows still holding AFTER. The side table is kept.
 */
const MIGRATION = 'BackfillAssetTypesToEnglish20260930000025';
const LOG_TABLE = 'assets_asset_type_backfill_20260930';
const MAP: Readonly<Record<string, string>> = { guia: 'guide_track', videoclipe: 'music_video', contrato: 'contract' };
const LEGACY = Object.keys(MAP);
const list = LEGACY.map((v) => `'${v}'`).join(', ');

type Json = Record<string, unknown>;
const has = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);

/** Exported for the unit spec only. */
export function canonicalAssetRowForBackfill(row: { asset_type: unknown; metadata: unknown }): { set: Record<string, unknown> } | null {
  const set: Record<string, unknown> = {};
  if (typeof row.asset_type === 'string' && has(MAP, row.asset_type)) set['asset_type'] = MAP[row.asset_type];
  const metadata = row.metadata;
  if (metadata !== null && typeof metadata === 'object' && !Array.isArray(metadata)) {
    const classification = (metadata as Json)['classification'];
    if (classification !== null && typeof classification === 'object' && !Array.isArray(classification)) {
      const current = (classification as Json)['assetType'];
      if (typeof current === 'string' && has(MAP, current)) {
        set['metadata'] = { ...(metadata as Json), classification: { ...(classification as Json), assetType: MAP[current] } };
      }
    }
  }
  return Object.keys(set).length > 0 ? { set } : null;
}

const SPEC: RowBackfillSpec = {
  migration: MIGRATION,
  table: 'assets',
  logTable: LOG_TABLE,
  columns: ['asset_type', 'metadata'],
  jsonbColumns: ['metadata'],
  candidatePredicate: `"asset_type" IN (${list}) OR ("metadata" #>> '{classification,assetType}') IN (${list})`,
  transform(row) {
    const change = canonicalAssetRowForBackfill({ asset_type: row['asset_type'], metadata: row['metadata'] });
    return change ? { set: change.set, conflicts: 0 } : null;
  },
};

export class BackfillAssetTypesToEnglish20260930000025 implements MigrationInterface {
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
