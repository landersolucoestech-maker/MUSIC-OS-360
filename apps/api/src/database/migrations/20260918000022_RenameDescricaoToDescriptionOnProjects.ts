import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000022_RenameDescricaoToDescriptionOnProjects
 *
 * Cluster E (naming-normalization mandate, `descricao` -> `description`):
 * projects.descricao is the project's own free-text description — a
 * plain passthrough with no boundary mapper. Distinct from the earlier
 * musicas[] JSONB use of this same column (normalized away into
 * project_tracks by migration ProjectsFormFieldAlignment20260718000013;
 * descricao/now description reverted to plain free text after that).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameDescricaoToDescriptionOnProjects20260918000022 implements MigrationInterface {
  name = 'RenameDescricaoToDescriptionOnProjects20260918000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'projects' AND column_name = 'descricao'
        ) THEN
          ALTER TABLE "projects" RENAME COLUMN "descricao" TO "description";
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
          WHERE table_name = 'projects' AND column_name = 'description'
        ) THEN
          ALTER TABLE "projects" RENAME COLUMN "description" TO "descricao";
        END IF;
      END $$;
    `);
  }
}
