import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000009_RenameNomeToNameOnContractTemplates
 *
 * Cluster D (naming-normalization mandate, `nome` -> `name`):
 * contract_templates.nome is the template's own name, a plain varchar
 * passthrough with no boundary mapper (same architecture as
 * contract_templates.active, already normalized this session).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameNomeToNameOnContractTemplates20260918000009 implements MigrationInterface {
  name = 'RenameNomeToNameOnContractTemplates20260918000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'contract_templates' AND column_name = 'nome'
        ) THEN
          ALTER TABLE "contract_templates" RENAME COLUMN "nome" TO "name";
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
          WHERE table_name = 'contract_templates' AND column_name = 'name'
        ) THEN
          ALTER TABLE "contract_templates" RENAME COLUMN "name" TO "nome";
        END IF;
      END $$;
    `);
  }
}
