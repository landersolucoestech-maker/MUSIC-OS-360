import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates "finance_category_keyword_rules" — rules for automatic categorization
 * of transactions by keyword (keywords → financial category), a
 * concept distinct from "financial_rules" (the fee/commission/tax engine,
 * computed as a percentage/fixed amount over transaction/invoice/contract events)
 * AND also distinct from "financial_category_rules" (migration
 * 20260526000003 — a dynamic taxonomy table seeded per tenant,
 * transaction_type/counterparty_type/category/subcategory, with no live service/
 * controller; the name was avoided on purpose so as not to collide).
 *
 * The frontend (TransacaoRules.tsx, FinanceCategoryRuleModal, and the
 * client-side matcher matchTransactionCategory in financialCategorizationRules.utils.ts)
 * already existed entirely ready, but called nonexistent endpoints at
 * /financial-categories/rules* — every action on the page resulted in 404/400.
 * The keyword→transaction matching is always evaluated on the client (there is no
 * server-side evaluation logic here, unlike financial_rules);
 * this table only needs to persist the rule definitions themselves.
 */
export class CreateFinancialCategoryRules20260816000001
  implements MigrationInterface
{
  name = 'CreateFinancialCategoryRules20260816000001';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "finance_category_keyword_rules" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" UUID NOT NULL REFERENCES "tenants" ("id") ON DELETE CASCADE,
        "keywords" TEXT[] NOT NULL DEFAULT '{}',
        "transaction_type" VARCHAR(20) NOT NULL,
        "category_id" UUID NOT NULL REFERENCES "financial_categories" ("id") ON DELETE RESTRICT,
        "priority" INTEGER NOT NULL DEFAULT 100,
        "active" BOOLEAN NOT NULL DEFAULT TRUE,
        "created_by" VARCHAR(255),
        "updated_by" VARCHAR(255),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ
      )
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS "idx_finance_category_keyword_rules_tenant_active"
        ON "finance_category_keyword_rules" ("tenant_id", "active")
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS "idx_finance_category_keyword_rules_tenant_type"
        ON "finance_category_keyword_rules" ("tenant_id", "transaction_type")
    `);
    await qr.query(`ALTER TABLE "finance_category_keyword_rules" ENABLE ROW LEVEL SECURITY`);
    await qr.query(`ALTER TABLE "finance_category_keyword_rules" FORCE ROW LEVEL SECURITY`);
    await qr.query(`
      DROP POLICY IF EXISTS "finance_category_keyword_rules_isolation" ON "finance_category_keyword_rules"
    `);
    await qr.query(`
      CREATE POLICY "finance_category_keyword_rules_isolation"
        ON "finance_category_keyword_rules"
        USING ("tenant_id" = private_get_tenant_id())
        WITH CHECK ("tenant_id" = private_get_tenant_id())
    `);
    await qr.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_app') THEN
          GRANT SELECT, INSERT, UPDATE, DELETE ON "finance_category_keyword_rules" TO "musicos_app";
        END IF;
      END $$;
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS "finance_category_keyword_rules"`);
  }
}
