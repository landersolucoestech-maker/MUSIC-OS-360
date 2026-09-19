import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000013_RenameNomeToNameOnProjectTracksAndParticipants
 *
 * Cluster D (naming-normalization mandate, `nome` -> `name`):
 * project_tracks.nome (a track's own title) and
 * project_track_participants.nome (a track participant's own name —
 * composer/performer/producer) are both plain varchar passthroughs
 * with no boundary mapper. Same rationale as work_participants
 * (20260918000012): ProjectsService's "para que o contrato de API não
 * mude" comment was about the prior JSONB->table normalization
 * (20260718000013), not a permanent constraint.
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameNomeToNameOnProjectTracksAndParticipants20260918000013 implements MigrationInterface {
  name = 'RenameNomeToNameOnProjectTracksAndParticipants20260918000013';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'project_tracks' AND column_name = 'nome'
        ) THEN
          ALTER TABLE "project_tracks" RENAME COLUMN "nome" TO "name";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'project_track_participants' AND column_name = 'nome'
        ) THEN
          ALTER TABLE "project_track_participants" RENAME COLUMN "nome" TO "name";
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
          WHERE table_name = 'project_track_participants' AND column_name = 'name'
        ) THEN
          ALTER TABLE "project_track_participants" RENAME COLUMN "name" TO "nome";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'project_tracks' AND column_name = 'name'
        ) THEN
          ALTER TABLE "project_tracks" RENAME COLUMN "name" TO "nome";
        END IF;
      END $$;
    `);
  }
}
