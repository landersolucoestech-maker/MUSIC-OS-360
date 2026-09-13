import type { MigrationInterface, QueryRunner } from 'typeorm';
import { OPERATIONAL_LIST_DEFAULTS } from '../../modules/operational-lists/operational-lists.defaults';

/**
 * Correção do achado B01 da auditoria técnica (2026-07-12): `storage.getRaw`/
 * `storage.setRaw` no frontend sempre lançavam exceção; o hook
 * `useOperationalSettings` (consumido por Leads, Contatos, Eventos e
 * Marketing) dependia desse stub sem tratamento, quebrando o render dessas
 * telas.
 *
 * Esta migration cria a tabela real (tenant-scoped, com RLS) que passa a
 * armazenar a taxonomia hoje hardcoded em `DEFAULT_OPERATIONAL_LISTS` no
 * frontend, e semeia (bootstrap idempotente) os itens padrão para cada
 * tenant já existente — cada tenant pode então customizar/desativar itens
 * via a API real, em vez de depender de um array estático no navegador.
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
    // musicos_migrator precisa de policy própria para o bootstrap de seeds
    // abaixo (INSERT multi-tenant não tem app.current_tenant_id() resolvido
    // na conexão de migração) — mesmo papel de bypass usado nas demais tabelas.
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

    // Bootstrap idempotente: semeia os itens padrão para cada tenant já
    // existente. Novos tenants recebem o mesmo bootstrap sob demanda no
    // primeiro GET (OperationalListsService.list), a partir da mesma fonte
    // canônica (OPERATIONAL_LIST_DEFAULTS), nunca duplicando a lista.
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
