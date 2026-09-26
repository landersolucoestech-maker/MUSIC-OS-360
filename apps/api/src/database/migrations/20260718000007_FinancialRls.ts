import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 13A / M7 — RLS, policies and grants of the financial core (Phase 12 §8).
 *
 * The project's AUDITED pattern (same as operational_list_items):
 * - ENABLE + FORCE ROW LEVEL SECURITY on every tenant-owned table;
 * - a "<table>_isolation" policy with private_get_tenant_id() (tenant context
 *   resolved SERVER-SIDE by the chain — never from data sent by the client);
 * - a "migrator_admin_all" policy and GRANTs CONDITIONAL on the existence of the
 *   musicos_app/musicos_migrator roles (DOCUMENTED provisioning dependency:
 *   cluster roles are never created in a migration and no credential appears
 *   here; without the roles, grants are skipped and the isolation policy remains).
 * - global templates: read-only for the app role.
 *
 * Physical DELETE granted ONLY where the domain allows it:
 * transaction_allocations (audited delete). Elsewhere, deletion is logical.
 */
export class FinancialRls20260718000007 implements MigrationInterface {
  name = 'FinancialRls20260718000007';

  private static readonly TENANT_TABLES = [
    'financial_categories',
    'financial_accounts',
    'counterparties',
    'cost_centers',
    'financial_transactions',
    'transaction_allocations',
    'budgets',
    'budget_revisions',
  ] as const;

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const table of FinancialRls20260718000007.TENANT_TABLES) {
      await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`
        CREATE POLICY "${table}_isolation" ON "${table}"
          USING ("tenant_id" = private_get_tenant_id())
          WITH CHECK ("tenant_id" = private_get_tenant_id())
      `);
      await queryRunner.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_migrator') THEN
            CREATE POLICY "migrator_admin_all" ON "${table}"
              FOR ALL TO "musicos_migrator" USING (true) WITH CHECK (true);
          END IF;
        END $$;
      `);
    }

    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_app') THEN
          GRANT SELECT, INSERT, UPDATE ON "financial_categories" TO "musicos_app";
          GRANT SELECT, INSERT, UPDATE ON "financial_accounts" TO "musicos_app";
          GRANT SELECT, INSERT, UPDATE ON "counterparties" TO "musicos_app";
          GRANT SELECT, INSERT, UPDATE ON "cost_centers" TO "musicos_app";
          GRANT SELECT, INSERT, UPDATE ON "financial_transactions" TO "musicos_app";
          GRANT SELECT, INSERT, UPDATE, DELETE ON "transaction_allocations" TO "musicos_app";
          GRANT SELECT, INSERT, UPDATE ON "budgets" TO "musicos_app";
          GRANT SELECT, INSERT ON "budget_revisions" TO "musicos_app";
        END IF;
      END $$;
    `);

    // Global templates: RLS enabled with free reads and writes restricted to the
    // migrator (factory catalog, immutable for tenants).
    await queryRunner.query(`ALTER TABLE "financial_category_templates" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "financial_category_templates" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "financial_category_templates_read_all" ON "financial_category_templates"
        FOR SELECT USING (true)
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_migrator') THEN
          CREATE POLICY "migrator_admin_all" ON "financial_category_templates"
            FOR ALL TO "musicos_migrator" USING (true) WITH CHECK (true);
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_app') THEN
          GRANT SELECT ON "financial_category_templates" TO "musicos_app";
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS "migrator_admin_all" ON "financial_category_templates"`);
    await queryRunner.query(`DROP POLICY "financial_category_templates_read_all" ON "financial_category_templates"`);
    await queryRunner.query(`ALTER TABLE "financial_category_templates" NO FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "financial_category_templates" DISABLE ROW LEVEL SECURITY`);
    for (const table of [...FinancialRls20260718000007.TENANT_TABLES].reverse()) {
      await queryRunner.query(`DROP POLICY IF EXISTS "migrator_admin_all" ON "${table}"`);
      await queryRunner.query(`DROP POLICY "${table}_isolation" ON "${table}"`);
      await queryRunner.query(`ALTER TABLE "${table}" NO FORCE ROW LEVEL SECURITY`);
      await queryRunner.query(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
    }
    // Grants are not revoked individually: the tables are dropped in the downs of
    // M2–M6 and the privileges go with them (no broad REVOKE here).
  }
}
