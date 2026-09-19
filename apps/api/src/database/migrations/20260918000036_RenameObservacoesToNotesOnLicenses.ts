import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000036_RenameObservacoesToNotesOnLicenses
 *
 * Cluster F (naming-normalization mandate, `observacoes` -> `notes`) —
 * the final table in this cluster. licenses.observacoes is a plain
 * optional free-text field, direct DTO passthrough
 * (LicensingService.normalizePayload spreads `...rest` straight onto
 * the entity — not among its explicit amount/currency/percentage
 * legacy-column aliases).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameObservacoesToNotesOnLicenses20260918000036 implements MigrationInterface {
  name = 'RenameObservacoesToNotesOnLicenses20260918000036';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'licenses' AND column_name = 'observacoes'
        ) THEN
          ALTER TABLE "licenses" RENAME COLUMN "observacoes" TO "notes";
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
          WHERE table_name = 'licenses' AND column_name = 'notes'
        ) THEN
          ALTER TABLE "licenses" RENAME COLUMN "notes" TO "observacoes";
        END IF;
      END $$;
    `);
  }
}
