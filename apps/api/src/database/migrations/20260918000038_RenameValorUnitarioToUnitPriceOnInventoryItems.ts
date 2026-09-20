import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000038_RenameValorUnitarioToUnitPriceOnInventoryItems
 *
 * Cluster G (naming-normalization mandate, `valor_unitario` -> `unit_price`):
 * direct DTO passthrough (InventoryService.create/update spread
 * `...dto`/`...rest` straight onto the entity, no explicit mapping).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameValorUnitarioToUnitPriceOnInventoryItems20260918000038 implements MigrationInterface {
  name = 'RenameValorUnitarioToUnitPriceOnInventoryItems20260918000038';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'inventory_items' AND column_name = 'valor_unitario'
        ) THEN
          ALTER TABLE "inventory_items" RENAME COLUMN "valor_unitario" TO "unit_price";
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
          WHERE table_name = 'inventory_items' AND column_name = 'unit_price'
        ) THEN
          ALTER TABLE "inventory_items" RENAME COLUMN "unit_price" TO "valor_unitario";
        END IF;
      END $$;
    `);
  }
}
