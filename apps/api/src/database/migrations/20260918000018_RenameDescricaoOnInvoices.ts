import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000018_RenameDescricaoOnInvoices
 *
 * Cluster E (naming-normalization mandate, `descricao` -> semantic
 * English decomposition): invoices.descricao is a generic top-level
 * text column with no write path in InvoicesService (dead/orphaned —
 * CreateInvoiceDto never declared a plain `descricao` field, only
 * InvoiceItemDto.descricao nested inside `itens[]`, and no reports
 * contract or service code reads/writes it). Renamed to `description`
 * anyway for schema consistency.
 *
 * invoices.descricao_servicos (the invoice's overall services
 * description, actively used by InvoicesService's search filter and
 * the real InvoiceFormModal) renamed to `service_description` —
 * distinct from InvoiceItemDto.descricao (each line item's own
 * description, inside the `itens` JSONB array, not a physical column
 * so out of scope for a column rename).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameDescricaoOnInvoices20260918000018 implements MigrationInterface {
  name = 'RenameDescricaoOnInvoices20260918000018';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'descricao'
        ) THEN
          ALTER TABLE "invoices" RENAME COLUMN "descricao" TO "description";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'descricao_servicos'
        ) THEN
          ALTER TABLE "invoices" RENAME COLUMN "descricao_servicos" TO "service_description";
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
          WHERE table_name = 'invoices' AND column_name = 'service_description'
        ) THEN
          ALTER TABLE "invoices" RENAME COLUMN "service_description" TO "descricao_servicos";
        END IF;
      END $$;
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'invoices' AND column_name = 'description'
        ) THEN
          ALTER TABLE "invoices" RENAME COLUMN "description" TO "descricao";
        END IF;
      END $$;
    `);
  }
}
