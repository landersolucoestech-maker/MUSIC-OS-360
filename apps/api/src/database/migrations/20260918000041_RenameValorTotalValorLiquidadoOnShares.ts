import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000041_RenameValorTotalValorLiquidadoOnShares
 *
 * Cluster G (naming-normalization mandate):
 * shares.valor_total -> total_amount ("Valor combinado" — the agreed
 * amount for an external receivable share), shares.valor_liquidado ->
 * settled_amount (the amount actually settled/paid, set when a share
 * is marked received/sent — GestaoShares.tsx's handleRegistrarLiquidacao).
 * Both are direct DTO passthrough (SharesService.toColumns spreads
 * `{ ...d }` — neither is among its explicit EN-legacy aliases).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the columns are already renamed or absent.
 */
export class RenameValorTotalValorLiquidadoOnShares20260918000041 implements MigrationInterface {
  name = 'RenameValorTotalValorLiquidadoOnShares20260918000041';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'shares' AND column_name = 'valor_total'
        ) THEN
          ALTER TABLE "shares" RENAME COLUMN "valor_total" TO "total_amount";
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'shares' AND column_name = 'valor_liquidado'
        ) THEN
          ALTER TABLE "shares" RENAME COLUMN "valor_liquidado" TO "settled_amount";
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
          WHERE table_name = 'shares' AND column_name = 'total_amount'
        ) THEN
          ALTER TABLE "shares" RENAME COLUMN "total_amount" TO "valor_total";
        END IF;
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'shares' AND column_name = 'settled_amount'
        ) THEN
          ALTER TABLE "shares" RENAME COLUMN "settled_amount" TO "valor_liquidado";
        END IF;
      END $$;
    `);
  }
}
