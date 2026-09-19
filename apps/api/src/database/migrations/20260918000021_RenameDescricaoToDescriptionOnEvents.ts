import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000021_RenameDescricaoToDescriptionOnEvents
 *
 * Cluster E (naming-normalization mandate, `descricao` -> `description`):
 * events.descricao is the event's own optional description, a plain
 * "1 form field = 1 physical column" passthrough with no boundary
 * mapper (EventsService.toEntityFields()-equivalent maps
 * `d['descricao']` straight through, no rename).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameDescricaoToDescriptionOnEvents20260918000021 implements MigrationInterface {
  name = 'RenameDescricaoToDescriptionOnEvents20260918000021';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'events' AND column_name = 'descricao'
        ) THEN
          ALTER TABLE "events" RENAME COLUMN "descricao" TO "description";
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
          WHERE table_name = 'events' AND column_name = 'description'
        ) THEN
          ALTER TABLE "events" RENAME COLUMN "description" TO "descricao";
        END IF;
      END $$;
    `);
  }
}
