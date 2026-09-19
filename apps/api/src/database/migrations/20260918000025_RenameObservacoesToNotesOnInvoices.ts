import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000025_RenameObservacoesToNotesOnInvoices
 *
 * Cluster F (naming-normalization mandate, `observacoes` -> `notes`):
 * invoices.observacoes is a plain optional free-text note field,
 * "1 form field = 1 physical column" passthrough with no boundary
 * mapper (InvoicesService has no explicit field mapping at all).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameObservacoesToNotesOnInvoices20260918000025 implements MigrationInterface {
  name = 'RenameObservacoesToNotesOnInvoices20260918000025';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'observacoes'
        ) THEN
          ALTER TABLE "invoices" RENAME COLUMN "observacoes" TO "notes";
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
          WHERE table_name = 'invoices' AND column_name = 'notes'
        ) THEN
          ALTER TABLE "invoices" RENAME COLUMN "notes" TO "observacoes";
        END IF;
      END $$;
    `);
  }
}
