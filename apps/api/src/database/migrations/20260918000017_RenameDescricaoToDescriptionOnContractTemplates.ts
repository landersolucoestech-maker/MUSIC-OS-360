import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000017_RenameDescricaoToDescriptionOnContractTemplates
 *
 * Cluster E (naming-normalization mandate, `descricao` -> `description`):
 * contract_templates.descricao is the template's own optional
 * description, a plain varchar passthrough with no boundary mapper —
 * same architecture as the name/active renames already applied to
 * this table this session.
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameDescricaoToDescriptionOnContractTemplates20260918000017 implements MigrationInterface {
  name = 'RenameDescricaoToDescriptionOnContractTemplates20260918000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'contract_templates' AND column_name = 'descricao'
        ) THEN
          ALTER TABLE "contract_templates" RENAME COLUMN "descricao" TO "description";
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
          WHERE table_name = 'contract_templates' AND column_name = 'description'
        ) THEN
          ALTER TABLE "contract_templates" RENAME COLUMN "description" TO "descricao";
        END IF;
      END $$;
    `);
  }
}
