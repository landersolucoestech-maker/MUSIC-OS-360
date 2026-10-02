import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';
import { backfillRows, createBackfillLogTable, restoreRows, type RowBackfillSpec } from '../jsonb-row-backfill';

/**
 * 20260930000034_BackfillContractTypeOutroToOther
 *
 * `ContractsService.create()` defaulted an absent `contracts.type` (NOT NULL; the wizard may not have a
 * service type) to the singular Portuguese `outro`. That spelling is neither the canonical category
 * `other` nor a registered legacy alias (the platform alias is the plural `outros`), so those rows were
 * invisible to the alias-expanding category filters. The code that ships with this migration writes `other`,
 * reads `outro` as `other` (API + web alias maps) and this migration rewrites the stored rows.
 *
 * EXACT, case-sensitive match on `outro` only: every other `contracts.type` value (platform legacy slugs such as
 * `outros`/`distribuicao`, and the tenant-authored slugs of the browser registry) is untouched, because those are
 * governed by the contract category registry decision, not by this migration. `contract_templates.service_type`
 * never received this default and is not touched.
 *
 * Expand/contract, backfill step: the contract step (drop the `outro` alias) is gated on the census
 * `SELECT count(*) FROM contracts WHERE type = 'outro'` returning 0 in every environment. Rules of
 * jsonb-row-backfill.ts: candidate rows only, idempotent, `updated_at` untouched, guarded UPDATE, BEFORE/AFTER of
 * `type` in the locked-down side table `contract_type_backfill_20260930`, counts-only logs. down() restores BEFORE
 * for rows still holding exactly AFTER; the side table is kept.
 */
const MIGRATION = 'BackfillContractTypeOutroToOther20260930000034';
const LOG_TABLE = 'contract_type_backfill_20260930';

const LEGACY_TYPE = 'outro';
const CANONICAL_TYPE = 'other';

/** Exported for the unit spec only. */
export const CONTRACT_TYPE_BACKFILL = { LEGACY_TYPE, CANONICAL_TYPE } as const;

const SPEC: RowBackfillSpec = {
  migration: MIGRATION,
  table: 'contracts',
  logTable: LOG_TABLE,
  columns: ['type'],
  jsonbColumns: [],
  candidatePredicate: `"type" = '${LEGACY_TYPE}'`,
  transform(row) {
    return row['type'] === LEGACY_TYPE ? { set: { type: CANONICAL_TYPE }, conflicts: 0 } : null;
  },
};

export class BackfillContractTypeOutroToOther20260930000034 implements MigrationInterface {
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
