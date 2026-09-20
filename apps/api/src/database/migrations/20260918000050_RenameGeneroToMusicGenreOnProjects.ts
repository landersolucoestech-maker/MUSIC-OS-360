import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000050_RenameGeneroToMusicGenreOnProjects
 *
 * Cluster H (naming-normalization mandate, `genero`/`genero_musical` ->
 * `music_genre`). projects.genero is a direct DTO passthrough
 * (ProjectsService.baseQb-equivalent list filter/create/update) that
 * mirrors the musical genre of the project's tracks (persisted as a
 * shortcut on the parent row — see migration
 * 20260719000005_RebuildProjectsInCanonicalFormOrder).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameGeneroToMusicGenreOnProjects20260918000050 implements MigrationInterface {
  name = 'RenameGeneroToMusicGenreOnProjects20260918000050';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'projects' AND column_name = 'genero'
        ) THEN
          ALTER TABLE "projects" RENAME COLUMN "genero" TO "music_genre";
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
          WHERE table_name = 'projects' AND column_name = 'music_genre'
        ) THEN
          ALTER TABLE "projects" RENAME COLUMN "music_genre" TO "genero";
        END IF;
      END $$;
    `);
  }
}
