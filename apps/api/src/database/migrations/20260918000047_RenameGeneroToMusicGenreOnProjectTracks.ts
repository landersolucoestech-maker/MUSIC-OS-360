import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000047_RenameGeneroToMusicGenreOnProjectTracks
 *
 * Cluster H (naming-normalization mandate, `genero`/`genero_musical` ->
 * `music_genre`). project_tracks.genero is read/written exclusively via
 * raw SQL in projects-musicas.field.ts (report import/export computed
 * field) — no TypeORM decorator path elsewhere references it besides the
 * ProjectTrackEntity column itself.
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameGeneroToMusicGenreOnProjectTracks20260918000047 implements MigrationInterface {
  name = 'RenameGeneroToMusicGenreOnProjectTracks20260918000047';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'project_tracks' AND column_name = 'genero'
        ) THEN
          ALTER TABLE "project_tracks" RENAME COLUMN "genero" TO "music_genre";
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
          WHERE table_name = 'project_tracks' AND column_name = 'music_genre'
        ) THEN
          ALTER TABLE "project_tracks" RENAME COLUMN "music_genre" TO "genero";
        END IF;
      END $$;
    `);
  }
}
