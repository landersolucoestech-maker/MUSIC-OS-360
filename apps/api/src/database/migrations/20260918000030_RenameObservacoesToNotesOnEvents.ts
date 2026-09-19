import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000030_RenameObservacoesToNotesOnEvents
 *
 * Cluster F (naming-normalization mandate, `observacoes` -> `notes`):
 * events.observacoes is a plain optional free-text field, "1 form field
 * = 1 physical column, nome exato" passthrough (EventsService.dtoToEntity
 * — direct 1:1 copy from the DTO field).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameObservacoesToNotesOnEvents20260918000030 implements MigrationInterface {
  name = 'RenameObservacoesToNotesOnEvents20260918000030';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'events' AND column_name = 'observacoes'
        ) THEN
          ALTER TABLE "events" RENAME COLUMN "observacoes" TO "notes";
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
          WHERE table_name = 'events' AND column_name = 'notes'
        ) THEN
          ALTER TABLE "events" RENAME COLUMN "notes" TO "observacoes";
        END IF;
      END $$;
    `);
  }
}
