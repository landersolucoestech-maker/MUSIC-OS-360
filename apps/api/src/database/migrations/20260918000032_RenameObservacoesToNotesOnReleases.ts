import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000032_RenameObservacoesToNotesOnReleases
 *
 * Cluster F (naming-normalization mandate, `observacoes` -> `notes`):
 * releases.observacoes ("Notas de distribuição") is a plain optional
 * free-text field, direct DTO passthrough (ReleasesService.create/update
 * — no field mapping beyond a straight `dto.notes ?? null`).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameObservacoesToNotesOnReleases20260918000032 implements MigrationInterface {
  name = 'RenameObservacoesToNotesOnReleases20260918000032';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'releases' AND column_name = 'observacoes'
        ) THEN
          ALTER TABLE "releases" RENAME COLUMN "observacoes" TO "notes";
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
          WHERE table_name = 'releases' AND column_name = 'notes'
        ) THEN
          ALTER TABLE "releases" RENAME COLUMN "notes" TO "observacoes";
        END IF;
      END $$;
    `);
  }
}
