import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260918000004_RenameCategoriaToCategoryOnInventoryItems
 *
 * Naming-normalization mandate, `categoria` cluster — `inventory_items`
 * is a plain passthrough field (DTO exposes it directly, no boundary
 * mapper), propagating the Portuguese identifier straight into the
 * application/API/frontend vocabulary. Canonical: `category`.
 *
 * The other 3 tables carrying `categoria` are handled differently, per
 * their own real semantics/architecture (see this batch's sibling
 * migrations/commits):
 *   - `clients.categoria`: already isolated behind ClientsService's
 *     mapClient() boundary mapper (nome/tipo_pessoa/categoria/
 *     endereco_completo all map PT physical -> EN application field) —
 *     application/frontend already only ever see `category`, so this
 *     is LEGACY_DB_BOUNDARY_ALLOWED, not renamed.
 *   - `transactions.categoria` / `financial_rules.categoria`: renamed
 *     separately (own migrations), given their cross-table coupling via
 *     FinancialRulesService.evaluateRules() and the shared accounting
 *     frontend module.
 *
 * `RENAME COLUMN` is metadata-only in Postgres (no rewrite, no data
 * movement); the composite index on `(tenant_id, categoria)` continues
 * to work unchanged (Postgres indexes reference columns by internal
 * attnum, not name). Guarded with `IF EXISTS` so this is safe to re-run
 * and a no-op if the column is already renamed or absent.
 */
export class RenameCategoriaToCategoryOnInventoryItems20260918000004 implements MigrationInterface {
  name = 'RenameCategoriaToCategoryOnInventoryItems20260918000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'inventory_items' AND column_name = 'categoria'
        ) THEN
          ALTER TABLE "inventory_items" RENAME COLUMN "categoria" TO "category";
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
          WHERE table_name = 'inventory_items' AND column_name = 'category'
        ) THEN
          ALTER TABLE "inventory_items" RENAME COLUMN "category" TO "categoria";
        END IF;
      END $$;
    `);
  }
}
