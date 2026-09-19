import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000031_RenameObservacoesToNotesOnProjects
 *
 * Cluster F (naming-normalization mandate, `observacoes` -> `notes`):
 * projects.observacoes is a plain optional free-text field, a direct
 * DTO passthrough (ProjectsService.create/update spread `...rest`
 * straight onto the entity, no explicit field mapping).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameObservacoesToNotesOnProjects20260918000031 implements MigrationInterface {
  name = 'RenameObservacoesToNotesOnProjects20260918000031';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'projects' AND column_name = 'observacoes'
        ) THEN
          ALTER TABLE "projects" RENAME COLUMN "observacoes" TO "notes";
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
          WHERE table_name = 'projects' AND column_name = 'notes'
        ) THEN
          ALTER TABLE "projects" RENAME COLUMN "notes" TO "observacoes";
        END IF;
      END $$;
    `);
  }
}
