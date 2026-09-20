import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000044_RenameValorToValueOnFinancialRules
 *
 * Cluster G (naming-normalization mandate, `valor` -> `value`) — final
 * table. financial_rules.valor is a polymorphic amount: depending on
 * the sibling `calculo` discriminator ('percentual' | 'fixo' | 'faixa'),
 * it holds either a percentage rate or a fixed monetary amount. Unlike
 * every other Cluster G field (which decomposed to a concrete term like
 * `amount`/`fixed_value`/`fee_amount`), the generic English word
 * "value" is the semantically correct translation here — not a
 * cop-out, since the concrete meaning genuinely varies by row. Direct
 * DTO passthrough (FinancialRulesService.create/update spread
 * `...dto` straight onto the entity).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameValorToValueOnFinancialRules20260918000044 implements MigrationInterface {
  name = 'RenameValorToValueOnFinancialRules20260918000044';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'financial_rules' AND column_name = 'valor'
        ) THEN
          ALTER TABLE "financial_rules" RENAME COLUMN "valor" TO "value";
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
          WHERE table_name = 'financial_rules' AND column_name = 'value'
        ) THEN
          ALTER TABLE "financial_rules" RENAME COLUMN "value" TO "valor";
        END IF;
      END $$;
    `);
  }
}
