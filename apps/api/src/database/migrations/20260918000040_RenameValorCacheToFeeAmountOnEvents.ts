import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000040_RenameValorCacheToFeeAmountOnEvents
 *
 * Cluster G (naming-normalization mandate, `valor_cache` -> `fee_amount`):
 * events.valor_cache ("Valor do Cachê" in SchedulerFormModal.tsx — the
 * artist/performer's booking fee for the event) is a direct DTO
 * passthrough (EventsService.dtoToEntity — 1:1 copy from the DTO
 * field, "1 coluna por campo" convention).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameValorCacheToFeeAmountOnEvents20260918000040 implements MigrationInterface {
  name = 'RenameValorCacheToFeeAmountOnEvents20260918000040';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'events' AND column_name = 'valor_cache'
        ) THEN
          ALTER TABLE "events" RENAME COLUMN "valor_cache" TO "fee_amount";
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
          WHERE table_name = 'events' AND column_name = 'fee_amount'
        ) THEN
          ALTER TABLE "events" RENAME COLUMN "fee_amount" TO "valor_cache";
        END IF;
      END $$;
    `);
  }
}
