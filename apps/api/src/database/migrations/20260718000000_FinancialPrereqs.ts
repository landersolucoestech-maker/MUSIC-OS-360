import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 13A / M0 — prerequisites of the financial domain (Phase 12 §14).
 *
 * 1. pgcrypto (idempotent, already present in the chain — restated here because the
 *    financial domain depends on gen_random_uuid()).
 * 2. UNIQUE ("tenant_id","id") on the target tables of the financial domain's COMPOSITE
 *    FKs (invariant I6: a cross-tenant link is impossible in the database, not
 *    only in RLS). Additive constraint: changes neither data nor behavior.
 *
 * External dependency: no cluster role is required here. Ownership
 * of the objects stays with the migration executor (no transfer).
 */
export class FinancialPrereqs20260718000000 implements MigrationInterface {
  name = 'FinancialPrereqs20260718000000';

  private static readonly TARGETS = [
    'projects',
    'artists',
    'phonograms',
    'releases',
    'clients',
    'contracts',
    'events',
  ] as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
    for (const table of FinancialPrereqs20260718000000.TARGETS) {
      await queryRunner.query(`
        ALTER TABLE "${table}"
          ADD CONSTRAINT "uq_${table}_tenant_id_id" UNIQUE ("tenant_id", "id")
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse order; the pgcrypto extension is shared by the platform and is NOT
    // removed (Phase 13A Step 14 — global objects are not dropped).
    for (const table of [...FinancialPrereqs20260718000000.TARGETS].reverse()) {
      await queryRunner.query(`
        ALTER TABLE "${table}" DROP CONSTRAINT "uq_${table}_tenant_id_id"
      `);
    }
  }
}
