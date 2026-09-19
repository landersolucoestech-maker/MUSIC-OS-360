import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000005_RenameCategoriaToCategoryOnTransactionsAndFinancialRules
 *
 * Naming-normalization mandate, `categoria` cluster (remainder) —
 * `financial_rules.categoria` only. `transactions.categoria` is
 * DELIBERATELY NOT touched here: TransactionEntity already has an
 * established, documented physical-PT/application-EN boundary
 * (`toTransactionDetails()` / `buildPersistencePayload()` in
 * transactions.service.ts, per transaction-details.dto.ts's own header
 * comment citing docs/NAMING_NORMALIZATION_CANONICAL_MAP.md) — the
 * physical `categoria` column stays, already correctly mapped to the
 * canonical `category` field at every application/API/event boundary
 * (this same commit finishes that alignment for the write-side DTOs,
 * which previously leaked the raw `categoria` name into the request
 * contract inconsistently with the read-side).
 *
 * `financial_rules.categoria` has no such boundary mapper — plain
 * passthrough (DTO exposes it directly, service reads
 * `query.categoria`/`r.categoria` raw) — propagating straight into the
 * application/API vocabulary, same pattern already fixed for
 * `inventory_items` and `contract_templates`. Canonical: `category`.
 *
 * `financial_rules.ativo` (the sibling outlier deferred alongside this
 * field in the earlier ativo/active migration) is handled separately.
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameCategoriaToCategoryOnTransactionsAndFinancialRules20260918000005 implements MigrationInterface {
  name = 'RenameCategoriaToCategoryOnTransactionsAndFinancialRules20260918000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'financial_rules' AND column_name = 'categoria'
        ) THEN
          ALTER TABLE "financial_rules" RENAME COLUMN "categoria" TO "category";
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
          WHERE table_name = 'financial_rules' AND column_name = 'category'
        ) THEN
          ALTER TABLE "financial_rules" RENAME COLUMN "category" TO "categoria";
        END IF;
      END $$;
    `);
  }
}
