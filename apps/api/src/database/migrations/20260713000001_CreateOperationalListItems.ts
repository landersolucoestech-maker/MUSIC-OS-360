import type { MigrationInterface, QueryRunner } from 'typeorm';
import { OPERATIONAL_LIST_DEFAULTS } from '../../modules/operational-lists/operational-lists.defaults';

/**
 * Fix for finding B01 of the technical audit (2026-07-12): `storage.getRaw`/
 * `storage.setRaw` in the frontend always threw; the
 * `useOperationalSettings` hook (consumed by Leads, Contacts, Events and
 * Marketing) depended on that stub without handling, breaking the render of those
 * screens.
 *
 * This migration creates the real table (tenant-scoped, with RLS) that now
 * stores the taxonomy currently hardcoded in `DEFAULT_OPERATIONAL_LISTS` in the
 * frontend, and seeds (idempotent bootstrap) the default items for every
 * already existing tenant — each tenant can then customize/deactivate items
 * through the real API, instead of depending on a static array in the browser.
 */
export class CreateOperationalListItems20260713000001
  implements MigrationInterface
{
  name = 'CreateOperationalListItems20260713000001';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS "operational_list_items" (
        "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id" UUID NOT NULL REFERENCES "tenants" ("id") ON DELETE CASCADE,
        "kind" VARCHAR(50) NOT NULL,
        "name" VARCHAR(150) NOT NULL,
        "slug" VARCHAR(100) NOT NULL,
        "description" TEXT,
        "active" BOOLEAN NOT NULL DEFAULT true,
        "order" INTEGER NOT NULL DEFAULT 0,
        "group" VARCHAR(100),
        "metadata" JSONB NOT NULL DEFAULT '{}',
        "created_by" VARCHAR(255),
        "updated_by" VARCHAR(255),
        "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "deleted_at" TIMESTAMPTZ
      )
    `);
    await qr.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "uq_operational_list_items_tenant_kind_slug"
        ON "operational_list_items" ("tenant_id", "kind", "slug")
        WHERE "deleted_at" IS NULL
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS "idx_operational_list_items_tenant_kind"
        ON "operational_list_items" ("tenant_id", "kind", "order")
    `);
    await qr.query(`ALTER TABLE "operational_list_items" ENABLE ROW LEVEL SECURITY`);
    await qr.query(`ALTER TABLE "operational_list_items" FORCE ROW LEVEL SECURITY`);
    await qr.query(`
      DROP POLICY IF EXISTS "operational_list_items_isolation" ON "operational_list_items"
    `);
    await qr.query(`
      CREATE POLICY "operational_list_items_isolation"
        ON "operational_list_items"
        USING ("tenant_id" = private_get_tenant_id())
        WITH CHECK ("tenant_id" = private_get_tenant_id())
    `);
    await qr.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_app') THEN
          GRANT SELECT, INSERT, UPDATE, DELETE ON "operational_list_items" TO "musicos_app";
        END IF;
      END $$;
    `);
    // musicos_migrator needs its own policy for the seed bootstrap
    // below (a multi-tenant INSERT has no resolved app.current_tenant_id()
    // on the migration connection) — the same bypass role used on the other tables.
    await qr.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_migrator') THEN
          DROP POLICY IF EXISTS "migrator_admin_all" ON "operational_list_items";
          CREATE POLICY "migrator_admin_all" ON "operational_list_items"
            FOR ALL TO "musicos_migrator" USING (true) WITH CHECK (true);
        END IF;
      END $$;
    `);

    // Idempotent bootstrap: seeds the default items for every already
    // existing tenant. New tenants receive the same bootstrap on demand on the
    // first GET (OperationalListsService.list), from the same canonical
    // source (OPERATIONAL_LIST_DEFAULTS), never duplicating the list.
    const { rows: tenants } = { rows: await qr.query(`SELECT "id" FROM "tenants"`) } as {
      rows: Array<{ id: string }>;
    };
    for (const { id: tenantId } of tenants) {
      for (const item of OPERATIONAL_LIST_DEFAULTS) {
        await qr.query(
          `INSERT INTO "operational_list_items"
             ("tenant_id", "kind", "name", "slug", "description", "active", "order", "group", "metadata")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT ("tenant_id", "kind", "slug") WHERE "deleted_at" IS NULL DO NOTHING`,
          [
            tenantId,
            item.kind,
            item.name,
            item.slug,
            item.description ?? null,
            item.active,
            item.order,
            item.group ?? null,
            JSON.stringify(item.metadata ?? {}),
          ],
        );
      }
    }
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS "operational_list_items"`);
  }
}
