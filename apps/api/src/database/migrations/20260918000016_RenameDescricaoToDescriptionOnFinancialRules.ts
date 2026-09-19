import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000016_RenameDescricaoToDescriptionOnFinancialRules
 *
 * Cluster E (naming-normalization mandate, `descricao` -> `description`):
 * financial_rules.descricao is the rule's own optional free-text
 * description, a plain varchar passthrough with no boundary mapper
 * (same architecture as the categoria/ativo/nome renames already
 * applied to this table this session).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameDescricaoToDescriptionOnFinancialRules20260918000016 implements MigrationInterface {
  name = 'RenameDescricaoToDescriptionOnFinancialRules20260918000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'financial_rules' AND column_name = 'descricao'
        ) THEN
          ALTER TABLE "financial_rules" RENAME COLUMN "descricao" TO "description";
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
          WHERE table_name = 'financial_rules' AND column_name = 'description'
        ) THEN
          ALTER TABLE "financial_rules" RENAME COLUMN "description" TO "descricao";
        END IF;
      END $$;
    `);
  }
}
