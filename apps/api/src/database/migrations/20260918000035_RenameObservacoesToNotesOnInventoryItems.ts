import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000035_RenameObservacoesToNotesOnInventoryItems
 *
 * Cluster F (naming-normalization mandate, `observacoes` -> `notes`):
 * inventory_items.observacoes is a plain optional free-text field,
 * direct DTO passthrough (InventoryService.create/update spread
 * `...dto`/`...rest` straight onto the entity, no explicit mapping).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameObservacoesToNotesOnInventoryItems20260918000035 implements MigrationInterface {
  name = 'RenameObservacoesToNotesOnInventoryItems20260918000035';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'inventory_items' AND column_name = 'observacoes'
        ) THEN
          ALTER TABLE "inventory_items" RENAME COLUMN "observacoes" TO "notes";
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
          WHERE table_name = 'inventory_items' AND column_name = 'notes'
        ) THEN
          ALTER TABLE "inventory_items" RENAME COLUMN "notes" TO "observacoes";
        END IF;
      END $$;
    `);
  }
}
