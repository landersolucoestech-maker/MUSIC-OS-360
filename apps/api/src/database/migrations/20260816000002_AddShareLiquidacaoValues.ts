import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Task T (continuity) — "Registrar Recebimento"/"Registrar Envio" in
 * GestaoShares.tsx already called updateShare({ status, valor_liquidado, ... }),
 * but `valor_liquidado` (and the `valor_total` its quick action derives from)
 * never existed as a column: the status change persisted, the settled
 * value was silently discarded by the DTO. Same product rule
 * as 20260712000004 — a physical column per form field.
 */
export class AddShareLiquidacaoValues20260816000002 implements MigrationInterface {
  name = 'AddShareLiquidacaoValues20260816000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "shares"
        ADD COLUMN IF NOT EXISTS "valor_total" decimal(12,2),
        ADD COLUMN IF NOT EXISTS "valor_liquidado" decimal(12,2)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "shares"
        DROP COLUMN IF EXISTS "valor_total",
        DROP COLUMN IF EXISTS "valor_liquidado"
    `);
  }
}
