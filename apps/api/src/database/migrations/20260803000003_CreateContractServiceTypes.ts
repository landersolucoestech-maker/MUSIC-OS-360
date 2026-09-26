import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates "contract_service_types" — the frontend (useContractServiceTypes.ts,
 * ContratoFormModal "Tipo de Serviço") already depended on this table, but it
 * had never been created: every opening of the new contract form
 * triggered a synthetic 503 (PENDING_TABLES) in the mandatory dropdown.
 */
export class CreateContractServiceTypes20260803000003
  implements MigrationInterface
{
  name = 'CreateContractServiceTypes20260803000003';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "contract_service_types" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" UUID NOT NULL REFERENCES "tenants" ("id") ON DELETE CASCADE,
        "name" VARCHAR(255) NOT NULL,
        "slug" VARCHAR(255) NOT NULL,
        "description" TEXT,
        "category" VARCHAR(100),
        "client_types" JSONB NOT NULL DEFAULT '[]',
        "financial_model" VARCHAR(50) NOT NULL DEFAULT 'valor_fixo',
        "requires_external_rights_terms" BOOLEAN NOT NULL DEFAULT FALSE,
        "requires_fixed_value" BOOLEAN NOT NULL DEFAULT FALSE,
        "requires_advance" BOOLEAN NOT NULL DEFAULT FALSE,
        "requires_financial_support" BOOLEAN NOT NULL DEFAULT FALSE,
        "allow_installments" BOOLEAN NOT NULL DEFAULT FALSE,
        "default_financial_category" VARCHAR(100),
        "active" BOOLEAN NOT NULL DEFAULT TRUE,
        "sort_order" INTEGER NOT NULL DEFAULT 0,
        "header_image_url" TEXT,
        "footer_image_url" TEXT,
        "conteudo" TEXT NOT NULL DEFAULT '',
        "participants" JSONB NOT NULL DEFAULT '[]',
        "variables" JSONB NOT NULL DEFAULT '[]',
        "music_work" JSONB,
        "signature_settings" JSONB,
        "branding_settings" JSONB,
        "financial_currency" VARCHAR(10) NOT NULL DEFAULT 'BRL',
        "financial_payment_frequency" VARCHAR(50) NOT NULL DEFAULT 'unico',
        "financial_penalty_percentage" NUMERIC(5,2),
        "financial_interest_percentage" NUMERIC(5,2),
        "financial_due_days" INTEGER,
        "deleted_at" TIMESTAMPTZ,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await qr.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_contract_service_types_tenant_slug"
        ON "contract_service_types" ("tenant_id", "slug")
        WHERE "deleted_at" IS NULL
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS "idx_contract_service_types_tenant_active"
        ON "contract_service_types" ("tenant_id", "active", "sort_order")
    `);
    await qr.query(`ALTER TABLE "contract_service_types" ENABLE ROW LEVEL SECURITY`);
    await qr.query(`ALTER TABLE "contract_service_types" FORCE ROW LEVEL SECURITY`);
    await qr.query(`
      DROP POLICY IF EXISTS "contract_service_types_isolation" ON "contract_service_types"
    `);
    await qr.query(`
      CREATE POLICY "contract_service_types_isolation"
        ON "contract_service_types"
        USING ("tenant_id" = private_get_tenant_id())
        WITH CHECK ("tenant_id" = private_get_tenant_id())
    `);
    await qr.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_app') THEN
          GRANT SELECT, INSERT, UPDATE, DELETE ON "contract_service_types" TO "musicos_app";
        END IF;
      END $$;
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS "contract_service_types"`);
  }
}
