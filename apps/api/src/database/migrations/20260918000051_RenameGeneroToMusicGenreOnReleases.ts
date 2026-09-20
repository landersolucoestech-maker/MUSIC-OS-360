import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000051_RenameGeneroToMusicGenreOnReleases
 *
 * Cluster H (naming-normalization mandate, `genero`/`genero_musical` ->
 * `music_genre`) — final table in this cluster. releases.genero is a direct
 * DTO passthrough (ReleasesService.create/update, stats() readiness check).
 * Distinct from the unrelated `generoSecundario` metadata field (secondary
 * genre, a separate concept never persisted as its own physical column).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameGeneroToMusicGenreOnReleases20260918000051 implements MigrationInterface {
  name = 'RenameGeneroToMusicGenreOnReleases20260918000051';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'releases' AND column_name = 'genero'
        ) THEN
          ALTER TABLE "releases" RENAME COLUMN "genero" TO "music_genre";
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
          WHERE table_name = 'releases' AND column_name = 'music_genre'
        ) THEN
          ALTER TABLE "releases" RENAME COLUMN "music_genre" TO "genero";
        END IF;
      END $$;
    `);
  }
}
