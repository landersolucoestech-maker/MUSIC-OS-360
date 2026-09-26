import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 3B — safe removal of the `contacts` module and its 3 satellites
 * (`contact_attachments`, `contact_contracts`, `contact_timeline`).
 *
 * Decision (Phase 3): Contact = Client, unified in `clients`/ClientEntity.
 * `contacts` duplicated that domain without a proven distinct responsibility
 * (zero real consumers, zero mapping in TABLE_ENDPOINT, a raw-SQL service
 * without entity/repository). The 3 satellites never had a real consumer:
 * `attachments`/`interações` are already really served by
 * `clients.attachments`/`clients.interacoes` (jsonb); `contact_contracts`
 * (N:N contact↔contract) is redundant with the `cliente_id` already existing in
 * `ContractEntity` and never had a UI or a proven requirement.
 *
 * Confirmed via direct SQL before this migration: the 4 tables have 0 rows
 * across all tenants — no real data is discarded.
 *
 * The DROP order respects the FKs (children before the parent). DROP TABLE
 * automatically removes the 4 tables' own policies, constraints and indexes —
 * no shared object (tenant functions, `leads`/`contracts` indexes,
 * the `lead_uploads` table) is touched by this migration.
 *
 * DECISION (req-a6155d65, mission-e39d21fa, 2026-09-12): this file
 * deliberately REMAINS UNREGISTERED in `index.ts`/`ALL_MIGRATIONS`.
 * The 0-row check above is documented but was neither re-run
 * nor authorized in this session against a real environment — DROP TABLE is
 * destructive and irreversible in production (even with a working down(), data
 * written between the DROP and an eventual rollback would be
 * lost), requiring explicit operator authorization per
 * `.claude/rules/data-governance.md` (L5) before registration, not only
 * code review. A future agent must NOT register this file without
 * first: (1) confirming the 4 tables still have 0 rows across all
 * tenants in the target environment, and (2) obtaining explicit operator authorization
 * for the destructive operation. See the corresponding finding in
 * `.claude/ops/state.json` for the formal record of this decision.
 */
export class DropOrphanContactsSatelliteTables20260713000002
  implements MigrationInterface
{
  name = 'DropOrphanContactsSatelliteTables20260713000002';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS "contact_attachments"`);
    await qr.query(`DROP TABLE IF EXISTS "contact_contracts"`);
    await qr.query(`DROP TABLE IF EXISTS "contact_timeline"`);
    await qr.query(`DROP TABLE IF EXISTS "contacts"`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "contacts" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" UUID NOT NULL,
        "name" VARCHAR(255) NOT NULL,
        "company_name" VARCHAR(255),
        "contact_type" VARCHAR(80) NOT NULL,
        "document_type" VARCHAR(40),
        "document_number" VARCHAR(80),
        "phone" VARCHAR(50),
        "whatsapp" VARCHAR(50),
        "email_encrypted" TEXT,
        "instagram" VARCHAR(255),
        "website" VARCHAR(500),
        "address" VARCHAR(500),
        "city" VARCHAR(120),
        "state" VARCHAR(80),
        "country" VARCHAR(80),
        "zip_code" VARCHAR(30),
        "responsible" VARCHAR(255),
        "notes" TEXT,
        "tags" TEXT[] NOT NULL DEFAULT '{}',
        "status" VARCHAR(40) NOT NULL DEFAULT 'active',
        "priority" VARCHAR(40) NOT NULL DEFAULT 'medium',
        "linked_artist_id" UUID,
        "payload_operacional" JSONB NOT NULL DEFAULT '{}',
        "created_by" VARCHAR(255),
        "updated_by" VARCHAR(255),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ
      )
    `);
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "contact_timeline" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" UUID NOT NULL,
        "contact_id" UUID NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
        "event_type" VARCHAR(80) NOT NULL,
        "summary" VARCHAR(500),
        "payload" JSONB NOT NULL DEFAULT '{}',
        "actor_id" VARCHAR(255),
        "occurred_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "contact_attachments" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" UUID NOT NULL,
        "contact_id" UUID NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
        "file_name" VARCHAR(500) NOT NULL,
        "mime_type" VARCHAR(120) NOT NULL,
        "extension" VARCHAR(20) NOT NULL,
        "size" BIGINT NOT NULL,
        "url" TEXT,
        "metadata" JSONB NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        "deleted_at" TIMESTAMPTZ
      )
    `);
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "contact_contracts" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" UUID NOT NULL,
        "contact_id" UUID NOT NULL REFERENCES "contacts"("id") ON DELETE CASCADE,
        "contract_id" UUID NOT NULL,
        "relation_type" VARCHAR(80) NOT NULL DEFAULT 'related',
        "metadata" JSONB NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE("contact_id", "contract_id")
      )
    `);

    for (const table of ['contacts', 'contact_timeline', 'contact_attachments', 'contact_contracts']) {
      await qr.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
      await qr.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
      await qr.query(`DROP POLICY IF EXISTS "${table}_isolation" ON "${table}"`);
      await qr.query(`
        CREATE POLICY "${table}_isolation" ON "${table}"
          USING ("tenant_id" = private_get_tenant_id())
          WITH CHECK ("tenant_id" = private_get_tenant_id())
      `);
      await qr.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_migrator') THEN
            DROP POLICY IF EXISTS "migrator_admin_all" ON "${table}";
            CREATE POLICY "migrator_admin_all" ON "${table}"
              FOR ALL TO "musicos_migrator" USING (true) WITH CHECK (true);
          END IF;
        END $$;
      `);
      await qr.query(`
        DO $$
        BEGIN
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_app') THEN
            GRANT SELECT, INSERT, UPDATE, DELETE ON "${table}" TO "musicos_app";
          END IF;
        END $$;
      `);
    }
  }
}
