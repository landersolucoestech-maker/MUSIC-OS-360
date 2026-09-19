import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000007_RenameNomeToNameOnFinancialRules
 *
 * Cluster D (naming-normalization mandate, `nome` -> `name`):
 * financial_rules.nome is the rule's own name, a plain varchar
 * passthrough with no boundary mapper (same architecture as
 * financial_rules.categoria/ativo, already normalized in this batch).
 * Used directly in FinancialRulesService's search filter, orderBy, and
 * FINANCIAL_RULE_TRIGGERED event payload (ruleName).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameNomeToNameOnFinancialRules20260918000007 implements MigrationInterface {
  name = 'RenameNomeToNameOnFinancialRules20260918000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'financial_rules' AND column_name = 'nome'
        ) THEN
          ALTER TABLE "financial_rules" RENAME COLUMN "nome" TO "name";
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
          WHERE table_name = 'financial_rules' AND column_name = 'name'
        ) THEN
          ALTER TABLE "financial_rules" RENAME COLUMN "name" TO "nome";
        END IF;
      END $$;
    `);
  }
}
