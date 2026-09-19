import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000023_RenameDescricaoToDescriptionOnTakedowns
 *
 * Cluster E (naming-normalization mandate, `descricao` -> `description`):
 * takedowns.descricao is an optional free-text detail field, distinct
 * from the required `motivo` (the takedown's reason) — a plain
 * "1 form field = 1 physical column" passthrough with no boundary
 * mapper.
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameDescricaoToDescriptionOnTakedowns20260918000023 implements MigrationInterface {
  name = 'RenameDescricaoToDescriptionOnTakedowns20260918000023';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'takedowns' AND column_name = 'descricao'
        ) THEN
          ALTER TABLE "takedowns" RENAME COLUMN "descricao" TO "description";
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
          WHERE table_name = 'takedowns' AND column_name = 'description'
        ) THEN
          ALTER TABLE "takedowns" RENAME COLUMN "description" TO "descricao";
        END IF;
      END $$;
    `);
  }
}
