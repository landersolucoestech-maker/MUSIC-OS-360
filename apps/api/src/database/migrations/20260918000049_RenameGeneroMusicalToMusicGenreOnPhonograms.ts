import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000049_RenameGeneroMusicalToMusicGenreOnPhonograms
 *
 * Cluster H (naming-normalization mandate, `genero`/`genero_musical` ->
 * `music_genre`). phonograms.genero_musical is unambiguously the
 * recording's musical genre.
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameGeneroMusicalToMusicGenreOnPhonograms20260918000049 implements MigrationInterface {
  name = 'RenameGeneroMusicalToMusicGenreOnPhonograms20260918000049';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'phonograms' AND column_name = 'genero_musical'
        ) THEN
          ALTER TABLE "phonograms" RENAME COLUMN "genero_musical" TO "music_genre";
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
          WHERE table_name = 'phonograms' AND column_name = 'music_genre'
        ) THEN
          ALTER TABLE "phonograms" RENAME COLUMN "music_genre" TO "genero_musical";
        END IF;
      END $$;
    `);
  }
}
