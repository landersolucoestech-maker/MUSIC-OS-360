import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';
import { backfillRows, createBackfillLogTable, restoreRows, type RowBackfillSpec } from '../jsonb-row-backfill';

/**
 * 20260930000036_BackfillContractCategorySlugsToEnglish
 *
 * `contracts.type` and `contract_templates.service_type` hold the contract category slug. The ten
 * platform-owned categories are canonical English ids since R3-04 (contract-category-slugs.ts); rows written
 * before that still carry the Portuguese spelling, and every reader keeps resolving both. This migration rewrites
 * those stored rows so the legacy aliases can be retired.
 *
 * Why a server-side registry is NOT needed for this step: the mapping of the ten platform-owned slugs is a single,
 * frozen, spec-asserted table (API and web maps are identical); no server code joins `contracts.type` to
 * `contract_service_types.slug` by value; the list filters expand both spellings; the web resolvers
 * (`sameContractCategory`, `contractCategoryLabel`, `findServiceTypeByCategory`) are alias-aware and canonicalize the
 * browser registry on load; neither column has a unique index or CHECK. Tenant-authored slugs (the browser registry
 * and `contract_service_types` rows, e.g. `parceria`, `empresariamento_360`) are NEVER in the map and stay
 * byte-for-byte; so do the pre-canonical spellings that have no platform alias (see the owner decision recorded in
 * the canonical map). The singular `outro` is handled by 20260930000034.
 *
 * Expand/contract, backfill step: the contract step (drop the legacy entries of LEGACY_CONTRACT_CATEGORY_SLUGS, API
 * and web) is gated on the census
 *   SELECT type, count(*) FROM contracts WHERE type IN (<legacy slugs>) GROUP BY 1 (and service_type of templates)
 * returning 0 in every environment, plus the retirement of old builds and of browser-held registries. Rules of
 * jsonb-row-backfill.ts: candidate rows only, idempotent, `updated_at` untouched, guarded UPDATE, BEFORE/AFTER of the
 * changed column in the locked-down side table `contract_category_slug_backfill_20260930` (one table, rows keyed by
 * table name + id), counts-only logs. down() restores BEFORE for rows still holding exactly AFTER; the side table is
 * kept.
 */
const MIGRATION = 'BackfillContractCategorySlugsToEnglish20260930000036';
const LOG_TABLE = 'contract_category_slug_backfill_20260930';

/** Frozen copy of the platform-owned legacy -> canonical slugs (the spec asserts it equals the application map minus `outro`). */
const LEGACY_TO_CANONICAL: Readonly<Record<string, string>> = {
  gravacao: 'recording',
  cessao_direitos: 'rights_assignment',
  producao: 'production',
  exclusividade: 'exclusivity',
  publicitario: 'advertising',
  semantico: 'semantic',
  distribuicao: 'distribution',
  licenciamento: 'licensing',
  gestao: 'management',
  outros: 'other',
};

/** Exported for the unit spec only. */
export const CONTRACT_CATEGORY_SLUG_BACKFILL = { LEGACY_TO_CANONICAL, LOG_TABLE } as const;

const legacySlugs = Object.keys(LEGACY_TO_CANONICAL);
const quoted = legacySlugs.map((slug) => `'${slug}'`).join(', ');

function specFor(table: 'contracts' | 'contract_templates', column: 'type' | 'service_type'): RowBackfillSpec {
  return {
    migration: MIGRATION,
    table,
    logTable: LOG_TABLE,
    columns: [column],
    jsonbColumns: [],
    candidatePredicate: `"${column}" IN (${quoted})`,
    transform(row) {
      const value = row[column];
      return typeof value === 'string' && Object.prototype.hasOwnProperty.call(LEGACY_TO_CANONICAL, value)
        ? { set: { [column]: LEGACY_TO_CANONICAL[value] }, conflicts: 0 }
        : null;
    },
  };
}

const SPECS: readonly RowBackfillSpec[] = [specFor('contracts', 'type'), specFor('contract_templates', 'service_type')];

export class BackfillContractCategorySlugsToEnglish20260930000036 implements MigrationInterface {
  name = MIGRATION;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await createBackfillLogTable(queryRunner, LOG_TABLE);
    for (const spec of SPECS) await backfillRows(queryRunner, spec);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    for (const spec of SPECS) await restoreRows(queryRunner, spec);
  }
}
