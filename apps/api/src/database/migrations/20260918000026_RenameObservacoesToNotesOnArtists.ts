import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000026_RenameObservacoesToNotesOnArtists
 *
 * Cluster F (naming-normalization mandate, `observacoes` -> `notes`):
 * artists.observacoes is a plain optional free-text bio field,
 * "1 form field = 1 physical column" passthrough (ArtistsService's
 * NULLABLE_COLUMNS reads `dto[col]` directly by column name).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameObservacoesToNotesOnArtists20260918000026 implements MigrationInterface {
  name = 'RenameObservacoesToNotesOnArtists20260918000026';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'artists' AND column_name = 'observacoes'
        ) THEN
          ALTER TABLE "artists" RENAME COLUMN "observacoes" TO "notes";
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
          WHERE table_name = 'artists' AND column_name = 'notes'
        ) THEN
          ALTER TABLE "artists" RENAME COLUMN "notes" TO "observacoes";
        END IF;
      END $$;
    `);
  }
}
