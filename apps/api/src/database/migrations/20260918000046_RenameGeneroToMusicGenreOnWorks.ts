import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000046_RenameGeneroToMusicGenreOnWorks
 *
 * Cluster H (naming-normalization mandate, `genero`/`genero_musical` ->
 * `music_genre`). Every occurrence of this token in the schema refers
 * exclusively to musical genre (this is a music-industry platform) —
 * no table uses `genero` for human gender, confirmed via repo-wide
 * search before starting this cluster. `music_genre` matches the
 * frontend's already-established `musicGenre` internal name
 * (artist.mapper.ts's wireToArtist/artistToWirePayload).
 *
 * works.genero is a direct DTO passthrough (WorksService.baseQb/
 * distinctMusicGenres — no explicit field mapping).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameGeneroToMusicGenreOnWorks20260918000046 implements MigrationInterface {
  name = 'RenameGeneroToMusicGenreOnWorks20260918000046';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'works' AND column_name = 'genero'
        ) THEN
          ALTER TABLE "works" RENAME COLUMN "genero" TO "music_genre";
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
          WHERE table_name = 'works' AND column_name = 'music_genre'
        ) THEN
          ALTER TABLE "works" RENAME COLUMN "music_genre" TO "genero";
        END IF;
      END $$;
    `);
  }
}
