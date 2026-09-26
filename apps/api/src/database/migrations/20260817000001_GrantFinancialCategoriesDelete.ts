import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Task Z — finding from real runtime validation.
 *
 * 20260718000007_FinancialRls granted only SELECT/INSERT/UPDATE on
 * "financial_categories" ("deletion is logical" — archiving via is_active,
 * already implemented in FinancialCategoriesService.archive()). But the
 * service ALSO has a genuinely distinct remove() — a hard delete
 * guarded by application checks (zero subcategories, zero
 * linked transactions, and now — Task Z — zero linked categorization
 * rules) for the case of a category created by mistake and never used.
 * Without the GRANT, even a 100% unused category could never be
 * deleted: every call broke with "permission denied for table
 * financial_categories" (42501) — it never even got to test the FK. RLS
 * (tenant_id = private_get_tenant_id()) already guarantees the DELETE never
 * crosses tenants, so granting here is safe.
 */
export class GrantFinancialCategoriesDelete20260817000001
  implements MigrationInterface
{
  name = 'GrantFinancialCategoriesDelete20260817000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_app') THEN
          GRANT DELETE ON "financial_categories" TO "musicos_app";
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_app') THEN
          REVOKE DELETE ON "financial_categories" FROM "musicos_app";
        END IF;
      END $$;
    `);
  }
}
