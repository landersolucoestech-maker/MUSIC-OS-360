import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000006_RenameAtivoToActiveOnFinancialRules
 *
 * Completes the `ativo` -> `active` normalization started in
 * 20260918000002 (contract_templates). That migration deliberately
 * deferred financial_rules.ativo until financial_rules.categoria was
 * normalized in the same batch, to avoid leaving the entity half
 * English/half Portuguese mid-migration. categoria was renamed in
 * 20260918000005, so this table is now unblocked.
 *
 * Verified: `financial_rules` has no pre-existing `active`/`is_active`
 * column (no collision). `ativo` is a plain boolean passthrough — used
 * directly in FinancialRulesService's query filter and the
 * `evaluateRules()` active-rules lookup, with no dedicated
 * alias-resolver or boundary mapper.
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameAtivoToActiveOnFinancialRules20260918000006 implements MigrationInterface {
  name = 'RenameAtivoToActiveOnFinancialRules20260918000006';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'financial_rules' AND column_name = 'ativo'
        ) THEN
          ALTER TABLE "financial_rules" RENAME COLUMN "ativo" TO "active";
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'financial_rules' AND column_name = 'active'
        ) THEN
          ALTER TABLE "financial_rules" RENAME COLUMN "active" TO "ativo";
        END IF;
      END $$;
    `);
  }
}
