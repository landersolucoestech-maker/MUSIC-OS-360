import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000034_RenameObservacoesToNotesOnTakedowns
 *
 * Cluster F (naming-normalization mandate, `observacoes` -> `notes`):
 * takedowns.observacoes is a plain optional free-text field, direct DTO
 * passthrough (TakedownsService.create/update spread `...dto`/`...rest`
 * straight onto the entity, no explicit field mapping).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameObservacoesToNotesOnTakedowns20260918000034 implements MigrationInterface {
  name = 'RenameObservacoesToNotesOnTakedowns20260918000034';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'takedowns' AND column_name = 'observacoes'
        ) THEN
          ALTER TABLE "takedowns" RENAME COLUMN "observacoes" TO "notes";
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
          WHERE table_name = 'takedowns' AND column_name = 'notes'
        ) THEN
          ALTER TABLE "takedowns" RENAME COLUMN "notes" TO "observacoes";
        END IF;
      END $$;
    `);
  }
}
