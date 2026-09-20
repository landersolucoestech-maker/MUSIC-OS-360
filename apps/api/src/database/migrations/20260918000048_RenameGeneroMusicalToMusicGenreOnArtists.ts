import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000048_RenameGeneroMusicalToMusicGenreOnArtists
 *
 * Cluster H (naming-normalization mandate, `genero`/`genero_musical` ->
 * `music_genre`). artists.genero_musical is unambiguously the artist's
 * musical genre (not to be confused with the artist's own PERSONAL gender,
 * which is a completely separate concept stored under `artists.metadata`'s
 * `genero` JSON key — out of scope for this cluster, which targets only the
 * `genero`/`genero_musical` PHYSICAL COLUMN tokens).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameGeneroMusicalToMusicGenreOnArtists20260918000048 implements MigrationInterface {
  name = 'RenameGeneroMusicalToMusicGenreOnArtists20260918000048';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'artists' AND column_name = 'genero_musical'
        ) THEN
          ALTER TABLE "artists" RENAME COLUMN "genero_musical" TO "music_genre";
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
          WHERE table_name = 'artists' AND column_name = 'music_genre'
        ) THEN
          ALTER TABLE "artists" RENAME COLUMN "music_genre" TO "genero_musical";
        END IF;
      END $$;
    `);
  }
}
