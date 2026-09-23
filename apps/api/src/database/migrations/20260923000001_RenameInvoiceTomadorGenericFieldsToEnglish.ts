import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Naming-closure Cluster F: invoices.tomador_endereco/tomador_cidade were
 * generic technical tokens (address/city) incorrectly caught inside the
 * `tomador_*` legal cluster -- `tomador` itself (the legal service-recipient/
 * payer-of-record role in an NFS-e) stays LEGAL_DOMAIN_INTENTIONAL, as do
 * tomador_uf (UF is an official Brazilian state-code designator) and
 * tomador_cep (CEP is an official postal-code designator), neither renamed
 * here. tomador_email was already English. Only the two generic PT suffixes
 * (_endereco/_cidade) are translated, keeping the tomador_ legal root intact:
 * tomador_endereco -> tomador_address, tomador_cidade -> tomador_city.
 *
 * Plain rename, no data transformation (free-text address/city strings).
 *
 * invoices.numero_nota_fiscal, also named in this cluster's original scope,
 * does not exist on this table -- the only numero_nota_fiscal column in the
 * schema lives on inventory_items (an unrelated, fully-Portuguese-named
 * table: quantidade/localizacao/responsavel/setor/local_compra/...).
 * Renaming just that one column's prefix there would be an isolated,
 * inconsistent change out of this cluster's scope (invoices/fiscal module),
 * not executed -- documented in the canonical map instead.
 */
export class RenameInvoiceTomadorGenericFieldsToEnglish20260923000001 implements MigrationInterface {
  name = 'RenameInvoiceTomadorGenericFieldsToEnglish20260923000001';

  public async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'tomador_endereco'
        ) THEN
          ALTER TABLE "invoices" RENAME COLUMN "tomador_endereco" TO "tomador_address";
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'tomador_cidade'
        ) THEN
          ALTER TABLE "invoices" RENAME COLUMN "tomador_cidade" TO "tomador_city";
        END IF;
      END $$;
    `);
  }

  public async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'tomador_address'
        ) THEN
          ALTER TABLE "invoices" RENAME COLUMN "tomador_address" TO "tomador_endereco";
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'invoices' AND column_name = 'tomador_city'
        ) THEN
          ALTER TABLE "invoices" RENAME COLUMN "tomador_city" TO "tomador_cidade";
        END IF;
      END $$;
    `);
  }
}
