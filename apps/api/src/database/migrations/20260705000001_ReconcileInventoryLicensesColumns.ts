import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260705000001_ReconcileInventoryLicensesColumns
 *
 * schema↔entity reconciliation (2026-07-05 audit).
 *
 * Migration InventoryLicensingFinancialRules20260521000060 created
 * inventory_items/licenses with `CREATE TABLE IF NOT EXISTS`, but the tables already
 * existed in production with an earlier shape — the migration was recorded without
 * effect and the columns below existed only in the entity/DTO. Result: any
 * SELECT via the TypeORM repository (InventoryService/LicensingService use
 * createQueryBuilder) fails with 42703 in production.
 *
 * ADDITIVE fix (forward-only, nullable/idempotent columns), following the same
 * pattern as AddLeadsPipelineStage20260613000003.
 */
export class ReconcileInventoryLicensesColumns20260705000001 implements MigrationInterface {
  name = 'ReconcileInventoryLicensesColumns20260705000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE inventory_items
        ADD COLUMN IF NOT EXISTS local_compra       VARCHAR(255),
        ADD COLUMN IF NOT EXISTS numero_nota_fiscal VARCHAR(100)
    `);

    await queryRunner.query(`
      ALTER TABLE licenses
        ADD COLUMN IF NOT EXISTS obra_musical  VARCHAR(255),
        ADD COLUMN IF NOT EXISTS artista       VARCHAR(255),
        ADD COLUMN IF NOT EXISTS cliente       VARCHAR(255),
        ADD COLUMN IF NOT EXISTS projeto       VARCHAR(255),
        ADD COLUMN IF NOT EXISTS midia_destino VARCHAR(255),
        ADD COLUMN IF NOT EXISTS territorio    VARCHAR(150),
        ADD COLUMN IF NOT EXISTS moeda         VARCHAR(10) NOT NULL DEFAULT 'BRL'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE licenses
        DROP COLUMN IF EXISTS moeda,
        DROP COLUMN IF EXISTS territorio,
        DROP COLUMN IF EXISTS midia_destino,
        DROP COLUMN IF EXISTS projeto,
        DROP COLUMN IF EXISTS cliente,
        DROP COLUMN IF EXISTS artista,
        DROP COLUMN IF EXISTS obra_musical
    `);

    await queryRunner.query(`
      ALTER TABLE inventory_items
        DROP COLUMN IF EXISTS numero_nota_fiscal,
        DROP COLUMN IF EXISTS local_compra
    `);
  }
}
