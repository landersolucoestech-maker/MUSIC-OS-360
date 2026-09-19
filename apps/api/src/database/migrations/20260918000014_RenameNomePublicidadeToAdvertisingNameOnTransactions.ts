import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000014_RenameNomePublicidadeToAdvertisingNameOnTransactions
 *
 * Cluster D (naming-normalization mandate, `nome` -> semantic English
 * decomposition): transactions.nome_publicidade is the advertising
 * expense line item's own name/description ("Nome da publicidade" —
 * shown when subcategoria === 'publicidade' under a caches/artista
 * expense). Renamed to advertising_name — a plain 1-form-field-1-column
 * passthrough (same convention documented in
 * accounting/services/form-to-payload.mapper.ts), no boundary mapper.
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameNomePublicidadeToAdvertisingNameOnTransactions20260918000014 implements MigrationInterface {
  name = 'RenameNomePublicidadeToAdvertisingNameOnTransactions20260918000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'transactions' AND column_name = 'nome_publicidade'
        ) THEN
          ALTER TABLE "transactions" RENAME COLUMN "nome_publicidade" TO "advertising_name";
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
          WHERE table_name = 'transactions' AND column_name = 'advertising_name'
        ) THEN
          ALTER TABLE "transactions" RENAME COLUMN "advertising_name" TO "nome_publicidade";
        END IF;
      END $$;
    `);
  }
}
