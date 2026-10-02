import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';
import { backfillRows, createBackfillLogTable, restoreRows, type RowBackfillSpec } from '../jsonb-row-backfill';

/**
 * 20260930000035_BackfillContractSignedTransactionCategoryToContractualRevenue
 *
 * The CONTRACT_SIGNED handler creates a provisional revenue transaction for the contract. It wrote the ad-hoc
 * category `contratos` (never a platform taxonomy slug) and, since the previous normalization patch, the literal
 * translation `contracts` (still not in the canonical set). The canonical transaction category for revenue that
 * comes from a contract is `contractual_revenue` (the platform slug `receitas-contratuais`, label "Receitas
 * Contratuais"); that is what the handler now writes, so the rows display with their label and match financial rules
 * and filters on the real category instead of a raw token.
 *
 * Provenance-scoped, not value-scoped: `transactions.category` is free text and a tenant may have typed `contracts`
 * itself. Only rows the handler created are rewritten: `category` is exactly `contratos` or `contracts` AND
 * `metadata.source` is exactly `contract.signed` (stamped by the handler). Everything else is untouched.
 *
 * Expand/contract, backfill step; no CHECK is added (transactions.category stays free text, see
 * 20260930000018). Rules of jsonb-row-backfill.ts: candidate rows only, idempotent, `updated_at` untouched,
 * guarded UPDATE, BEFORE/AFTER of `category` in the locked-down side table
 * `contract_signed_transaction_category_backfill_20260930`, counts-only logs. down() restores BEFORE for rows still
 * holding exactly AFTER; the side table is kept.
 */
const MIGRATION = 'BackfillContractSignedTransactionCategoryToContractualRevenue20260930000035';
const LOG_TABLE = 'contract_signed_transaction_category_backfill_20260930';

const LEGACY_CATEGORIES = ['contratos', 'contracts'] as const;
const CANONICAL_CATEGORY = 'contractual_revenue';
const SOURCE = 'contract.signed';

/** Exported for the unit spec only. */
export const CONTRACT_SIGNED_CATEGORY_BACKFILL = { LEGACY_CATEGORIES, CANONICAL_CATEGORY, SOURCE } as const;

const SPEC: RowBackfillSpec = {
  migration: MIGRATION,
  table: 'transactions',
  logTable: LOG_TABLE,
  columns: ['category'],
  jsonbColumns: [],
  candidatePredicate: `"category" IN (${LEGACY_CATEGORIES.map((c) => `'${c}'`).join(', ')}) AND ("metadata" ->> 'source') = '${SOURCE}'`,
  transform(row) {
    return (LEGACY_CATEGORIES as readonly unknown[]).includes(row['category']) ? { set: { category: CANONICAL_CATEGORY }, conflicts: 0 } : null;
  },
};

export class BackfillContractSignedTransactionCategoryToContractualRevenue20260930000035 implements MigrationInterface {
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
