import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000008_RenameNomeToNameOnInventoryItems
 *
 * Cluster D (naming-normalization mandate, `nome` -> `name`):
 * inventory_items.nome is the item's own name, a plain varchar
 * passthrough with no boundary mapper (same architecture as
 * inventory_items.categoria, already normalized this session).
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement). Guarded with `IF EXISTS` so this is safe to re-run and a
 * no-op if the column is already renamed or absent.
 */
export class RenameNomeToNameOnInventoryItems20260918000008 implements MigrationInterface {
  name = 'RenameNomeToNameOnInventoryItems20260918000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'inventory_items' AND column_name = 'nome'
        ) THEN
          ALTER TABLE "inventory_items" RENAME COLUMN "nome" TO "name";
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
          WHERE table_name = 'inventory_items' AND column_name = 'name'
        ) THEN
          ALTER TABLE "inventory_items" RENAME COLUMN "name" TO "nome";
        END IF;
      END $$;
    `);
  }
}
