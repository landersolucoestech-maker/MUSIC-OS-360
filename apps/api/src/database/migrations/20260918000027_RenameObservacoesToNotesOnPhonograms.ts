import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000027_RenameObservacoesToNotesOnPhonograms
 *
 * Cluster F (naming-normalization mandate, `observacoes` -> `notes`):
 * phonograms.observacoes is a plain optional free-text field, "1 form
 * field = 1 physical column, nome exato" passthrough (regra 2026-07-12
 * — PhonogramsService.buildEntityPayload has no explicit mapping for
 * fields outside the alias-resolved title/work_id/artist_id trio).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameObservacoesToNotesOnPhonograms20260918000027 implements MigrationInterface {
  name = 'RenameObservacoesToNotesOnPhonograms20260918000027';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'phonograms' AND column_name = 'observacoes'
        ) THEN
          ALTER TABLE "phonograms" RENAME COLUMN "observacoes" TO "notes";
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
          WHERE table_name = 'phonograms' AND column_name = 'notes'
        ) THEN
          ALTER TABLE "phonograms" RENAME COLUMN "notes" TO "observacoes";
        END IF;
      END $$;
    `);
  }
}
