import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000024_RenameObservacoesToNotesOnTransactions
 *
 * Cluster F (naming-normalization mandate, `observacoes` -> `notes`):
 * transactions.observacoes (plural) is a distinct, currently dead
 * physical column — TransactionsService never reads or writes it
 * (the transaction's actual "note" concept lives in
 * metadata.observacao, singular, mapped to `note` by
 * toTransactionDetails(), or falls back to the `referencia` column).
 * Renamed for schema consistency; entity-to-form.mapper.ts's
 * `t.observacao ?? t.observacoes` defensive fallback (reading the raw
 * list entity) is updated to `t.observacao ?? t.notes` in the same
 * commit.
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameObservacoesToNotesOnTransactions20260918000024 implements MigrationInterface {
  name = 'RenameObservacoesToNotesOnTransactions20260918000024';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'transactions' AND column_name = 'observacoes'
        ) THEN
          ALTER TABLE "transactions" RENAME COLUMN "observacoes" TO "notes";
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
          WHERE table_name = 'transactions' AND column_name = 'notes'
        ) THEN
          ALTER TABLE "transactions" RENAME COLUMN "notes" TO "observacoes";
        END IF;
      END $$;
    `);
  }
}
