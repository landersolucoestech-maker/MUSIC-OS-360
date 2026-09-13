import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Fase 3B — remoção segura do módulo `contacts` e dos 3 satélites
 * (`contact_attachments`, `contact_contracts`, `contact_timeline`).
 *
 * Decisão (Fase 3): Contato = Cliente, unificado em `clients`/ClientEntity.
 * `contacts` duplicava esse domínio sem responsabilidade distinta comprovada
 * (zero consumidor real, zero mapeamento em TABLE_ENDPOINT, service em raw
 * SQL sem entity/repository). Os 3 satélites nunca tiveram consumidor real:
 * `attachments`/`interações` já são servidos de verdade por
 * `clients.attachments`/`clients.interacoes` (jsonb); `contact_contracts`
 * (N:N contato↔contrato) é redundante com o `cliente_id` já existente em
 * `ContractEntity` e nunca teve UI ou requisito comprovado.
 *
 * Confirmado via SQL direto antes desta migration: as 4 tabelas têm 0 linhas
 * em todos os tenants — nenhum dado real é descartado.
 *
 * Ordem de DROP respeita as FKs (filhas antes do pai). O DROP TABLE remove
 * automaticamente policies, constraints e índices próprios das 4 tabelas —
 * nenhum objeto compartilhado (funções de tenant, índices de `leads`/
 * `contracts`, tabela `lead_uploads`) é tocado por esta migration.
 *
 * DECISÃO (req-a6155d65, mission-e39d21fa, 2026-09-12): este arquivo
 * PERMANECE NÃO REGISTRADO em `index.ts`/`ALL_MIGRATIONS` deliberadamente.
 * A verificação de 0 linhas acima está documentada mas não foi re-executada
 * nem autorizada nesta sessão contra um ambiente real — DROP TABLE é
 * destrutivo e irreversível em produção (mesmo com down() funcional, dados
 * gravados no intervalo entre o DROP e um eventual rollback seriam
 * perdidos), exigindo autorização explícita do operador por
 * `.claude/rules/data-governance.md` (L5) antes do registro, não apenas a
 * revisão de código. Um agente futuro NÃO deve registrar este arquivo sem
 * antes: (1) confirmar que as 4 tabelas ainda têm 0 linhas em todos os
 * tenants no ambiente-alvo, e (2) obter autorização explícita do operador
 * para a operação destrutiva. Ver finding correspondente em
 * `.claude/ops/state.json` para o registro formal desta decisão.
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
