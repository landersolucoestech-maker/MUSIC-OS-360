import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * find-bc7c20a6 (CRITICAL): `ExternalDataExchangeService.ingestWebhook`
 * resolved the target tenant from a client-supplied `X-Tenant-ID` header.
 * The HMAC signature check only proves the payload was signed with the
 * shared per-provider secret — it proves nothing about which tenant the
 * webhook belongs to. Anyone holding that secret could pick an arbitrary
 * target tenant via the header and write into that tenant's data.
 *
 * This table gives the webhook path the same server-side reverse-lookup
 * pattern already used by AutentiqueService/DocuSignService (which resolve
 * tenant from a provider-issued identifier stored on the entity itself,
 * never from client input): one row per (provider, submission_id) recorded
 * at submit time, so the webhook handler can resolve tenant_id/entity_id
 * itself instead of trusting the caller.
 */
export class CreateExternalDataSubmissions20260910000001
  implements MigrationInterface
{
  name = 'CreateExternalDataSubmissions20260910000001';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "external_data_submissions" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" UUID NOT NULL REFERENCES "tenants" ("id") ON DELETE CASCADE,
        "provider" VARCHAR(100) NOT NULL,
        "entity_type" VARCHAR(30) NOT NULL,
        "entity_id" UUID NOT NULL,
        "submission_id" VARCHAR(255) NOT NULL,
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await qr.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_external_data_submissions_provider_submission_entity"
        ON "external_data_submissions" ("provider", "submission_id", "entity_type", "entity_id")
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS "idx_external_data_submissions_provider_submission"
        ON "external_data_submissions" ("provider", "submission_id")
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS "idx_external_data_submissions_tenant_id"
        ON "external_data_submissions" ("tenant_id")
    `);
    await qr.query(`ALTER TABLE "external_data_submissions" ENABLE ROW LEVEL SECURITY`);
    await qr.query(`ALTER TABLE "external_data_submissions" FORCE ROW LEVEL SECURITY`);
    await qr.query(`
      DROP POLICY IF EXISTS "external_data_submissions_isolation" ON "external_data_submissions"
    `);
    await qr.query(`
      CREATE POLICY "external_data_submissions_isolation"
        ON "external_data_submissions"
        USING ("tenant_id" = private_get_tenant_id())
        WITH CHECK ("tenant_id" = private_get_tenant_id())
    `);
    // The webhook path resolves tenant BEFORE tenant context is set on the
    // connection (that's the whole point of this table), so it must read
    // through the same admin/migrator bypass other cross-tenant-resolution
    // lookups use (see AutentiqueService/DocuSignService's adminDataSource).
    await qr.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_app') THEN
          GRANT SELECT, INSERT, UPDATE, DELETE ON "external_data_submissions" TO "musicos_app";
        END IF;
      END $$;
    `);
    await qr.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_migrator') THEN
          DROP POLICY IF EXISTS "migrator_admin_all" ON "external_data_submissions";
          CREATE POLICY "migrator_admin_all" ON "external_data_submissions"
            FOR ALL TO "musicos_migrator" USING (true) WITH CHECK (true);
        END IF;
      END $$;
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS "external_data_submissions"`);
  }
}
