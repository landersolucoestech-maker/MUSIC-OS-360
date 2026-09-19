import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000020_RenameDescricaoToContentOnBriefings
 *
 * Cluster E (naming-normalization mandate, `descricao` -> semantic
 * English decomposition): briefings.descricao is the briefing's own
 * body text. CreateBriefingDto already accepted this as `content`
 * (BriefingsService.toEntityFields() explicitly mapped
 * `out.descricao = dto.content`) — this migration renames the
 * physical column to match the term already established at the DTO
 * boundary, closing the remaining read-side gap where list()/
 * findById() (no boundary mapper) still exposed `descricao`.
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameDescricaoToContentOnBriefings20260918000020 implements MigrationInterface {
  name = 'RenameDescricaoToContentOnBriefings20260918000020';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'briefings' AND column_name = 'descricao'
        ) THEN
          ALTER TABLE "briefings" RENAME COLUMN "descricao" TO "content";
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
          WHERE table_name = 'briefings' AND column_name = 'content'
        ) THEN
          ALTER TABLE "briefings" RENAME COLUMN "content" TO "descricao";
        END IF;
      END $$;
    `);
  }
}
