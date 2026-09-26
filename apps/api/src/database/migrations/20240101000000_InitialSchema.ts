import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20240101000000_InitialSchema
 *
 * Initial schema of MUSIC OS 360.
 * Creates all tables, indexes and constraints.
 * Generated from src/database/entities.ts.
 *
 * Rollback: down() drops all tables in reverse order (FK-safe).
 */
export class InitialSchema20240101000000 implements MigrationInterface {
  name = 'InitialSchema20240101000000';

  async up(queryRunner: QueryRunner): Promise<void> {

    // ── extensions ──────────────────────────────────────────────────────────
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);

    // ── organizations ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "organizations" (
        "id"               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "external_auth_org_id"     VARCHAR(255) UNIQUE,
        "name"             VARCHAR(255) NOT NULL,
        "slug"             VARCHAR(100) NOT NULL UNIQUE,
        "plan"             VARCHAR(50)  NOT NULL DEFAULT 'starter',
        "billing_status"   VARCHAR(50)  NOT NULL DEFAULT 'trial',
        "industry"         VARCHAR(100) NOT NULL DEFAULT 'gravadora',
        "cnpj_encrypted"   TEXT,
        "phone"            VARCHAR(50),
        "address"          JSONB        NOT NULL DEFAULT '{}',
        "config"           JSONB        NOT NULL DEFAULT '{}',
        "metadata"         JSONB        NOT NULL DEFAULT '{}',
        "created_at"       TIMESTAMP    NOT NULL DEFAULT NOW(),
        "updated_at"       TIMESTAMP    NOT NULL DEFAULT NOW(),
        "deleted_at"       TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_organizations_external_auth_org_id" ON "organizations" ("external_auth_org_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_organizations_slug"         ON "organizations" ("slug")`);

    // ── tenants ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tenants" (
        "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "org_id"        UUID         NOT NULL,
        "external_auth_org_id"  VARCHAR(255) UNIQUE,
        "name"          VARCHAR(255) NOT NULL,
        "slug"          VARCHAR(100) NOT NULL UNIQUE,
        "plan"          VARCHAR(50)  NOT NULL DEFAULT 'starter',
        "features"      JSONB        NOT NULL DEFAULT '{}',
        "settings"      JSONB        NOT NULL DEFAULT '{}',
        "active"        BOOLEAN      NOT NULL DEFAULT TRUE,
        "created_at"    TIMESTAMP    NOT NULL DEFAULT NOW(),
        "updated_at"    TIMESTAMP    NOT NULL DEFAULT NOW(),
        "deleted_at"    TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_tenants_org_id"       ON "tenants" ("org_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_tenants_external_auth_org_id" ON "tenants" ("external_auth_org_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_tenants_slug"         ON "tenants" ("slug")`);

    // ── org_members ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "org_members" (
        "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "org_id"          UUID         NOT NULL,
        "tenant_id"       UUID         NOT NULL,
        "auth_user_id"   VARCHAR(255) NOT NULL,
        "email"           VARCHAR(255) NOT NULL,
        "full_name"       VARCHAR(255),
        "role"            VARCHAR(50)  NOT NULL DEFAULT 'viewer',
        "is_active"       BOOLEAN      NOT NULL DEFAULT TRUE,
        "joined_at"       TIMESTAMP,
        "created_at"      TIMESTAMP    NOT NULL DEFAULT NOW(),
        "updated_at"      TIMESTAMP    NOT NULL DEFAULT NOW(),
        UNIQUE ("tenant_id", "auth_user_id")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_org_members_tenant_id"     ON "org_members" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_org_members_auth_user_id" ON "org_members" ("auth_user_id")`);

    // ── billing_subscriptions ────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "billing_subscriptions" (
        "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "org_id"              UUID         NOT NULL,
        "stripe_customer_id"  VARCHAR(255) UNIQUE,
        "stripe_sub_id"       VARCHAR(255) UNIQUE,
        "plan"                VARCHAR(50)  NOT NULL DEFAULT 'starter',
        "status"              VARCHAR(50)  NOT NULL DEFAULT 'trial',
        "trial_ends_at"       TIMESTAMP,
        "current_period_end"  TIMESTAMP,
        "seats"               INTEGER      NOT NULL DEFAULT 3,
        "seats_used"          INTEGER      NOT NULL DEFAULT 1,
        "metadata"            JSONB        NOT NULL DEFAULT '{}',
        "created_at"          TIMESTAMP    NOT NULL DEFAULT NOW(),
        "updated_at"          TIMESTAMP    NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_billing_org_id" ON "billing_subscriptions" ("org_id")`);

    // ── artists ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "artists" (
        "id"                           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"                    UUID         NOT NULL,
        "nome_artistico"               VARCHAR(255) NOT NULL,
        "nome_civil"                   VARCHAR(255),
        "tipo"                         VARCHAR(50)  NOT NULL DEFAULT 'solo',
        "status"                       VARCHAR(50)  NOT NULL DEFAULT 'em_negociacao',
        "status_cadastro"              VARCHAR(50)  NOT NULL DEFAULT 'ativo',
        "genero_musical"               VARCHAR(100),
        "email_encrypted"              TEXT,
        "telefone_encrypted"           TEXT,
        "cpf_cnpj_encrypted"           TEXT,
        "foto_url"                     TEXT,
        "galeria_urls"                 JSONB        NOT NULL DEFAULT '[]',
        "documentos"                   JSONB        NOT NULL DEFAULT '[]',
        "observacoes"                  TEXT,
        "manager_nome"                 VARCHAR(255),
        "manager_contato_encrypted"    TEXT,
        "produtor_executivo"           VARCHAR(255),
        "agencia_booking"              VARCHAR(255),
        "label_parceira"               VARCHAR(255),
        "especialidades"               JSONB        NOT NULL DEFAULT '[]',
        "spotify_url"                 TEXT,
        "youtube_url"                 TEXT,
        "deezer_url"                   TEXT,
        "apple_music_url"              TEXT,
        "soundcloud_url"               TEXT,
        "contrato_id"                  UUID,
        "org_slug"                     VARCHAR(100),
        "metadata"                     JSONB        NOT NULL DEFAULT '{}',
        "created_at"                   TIMESTAMP    NOT NULL DEFAULT NOW(),
        "updated_at"                   TIMESTAMP    NOT NULL DEFAULT NOW(),
        "deleted_at"                   TIMESTAMP,
        "created_by"                   VARCHAR(255),
        "updated_by"                   VARCHAR(255)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_artists_tenant_id"        ON "artists" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_artists_tenant_status"    ON "artists" ("tenant_id", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_artists_tenant_deleted"   ON "artists" ("tenant_id", "deleted_at")`);

    // ── works ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "works" (
        "id"                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"                       UUID         NOT NULL,
        "titulo"                          VARCHAR(500) NOT NULL,
        "compositor"                      VARCHAR(255),
        "compositores"                    TEXT,
        "co_compositores"                 TEXT,
        "detentores"                      TEXT,
        "editora"                         VARCHAR(255),
        "isrc"                            VARCHAR(20),
        "iswc"                            VARCHAR(20),
        "cod_abramus"                     VARCHAR(100),
        "cod_ecad"                        VARCHAR(100),
        "tipo"                            VARCHAR(100) NOT NULL,
        "genero"                          VARCHAR(100),
        "status"                          VARCHAR(50)  NOT NULL DEFAULT 'pendente',
        "duracao"                         VARCHAR(20),
        "origem_externa"                  VARCHAR(100),
        "origem_externa_id"               VARCHAR(255),
        "origem_externa_sincronizado_em"  TIMESTAMP,
        "metadata"                        JSONB        NOT NULL DEFAULT '{}',
        "created_at"                      TIMESTAMP    NOT NULL DEFAULT NOW(),
        "updated_at"                      TIMESTAMP    NOT NULL DEFAULT NOW(),
        "deleted_at"                      TIMESTAMP,
        "created_by"                      VARCHAR(255),
        "updated_by"                      VARCHAR(255)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_works_tenant_id"     ON "works" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_works_tenant_status" ON "works" ("tenant_id", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_works_isrc"          ON "works" ("isrc")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_works_iswc"          ON "works" ("iswc")`);

    // ── phonograms ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "phonograms" (
        "id"                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"                       UUID         NOT NULL,
        "titulo"                          VARCHAR(500) NOT NULL,
        "obra_id"                         UUID,
        "artista_id"                      UUID,
        "isrc"                            VARCHAR(20),
        "duracao"                         VARCHAR(20),
        "tipo"                            VARCHAR(100) NOT NULL,
        "status"                          VARCHAR(50)  NOT NULL DEFAULT 'pendente',
        "compositores"                    TEXT,
        "interpretes"                     TEXT,
        "produtores"                      TEXT,
        "gravadora"                       VARCHAR(255),
        "cod_abramus"                     VARCHAR(100),
        "cod_ecad"                        VARCHAR(100),
        "origem_externa"                  VARCHAR(100),
        "origem_externa_id"               VARCHAR(255),
        "origem_externa_sincronizado_em"  TIMESTAMP,
        "metadata"                        JSONB        NOT NULL DEFAULT '{}',
        "created_at"                      TIMESTAMP    NOT NULL DEFAULT NOW(),
        "updated_at"                      TIMESTAMP    NOT NULL DEFAULT NOW(),
        "deleted_at"                      TIMESTAMP,
        "created_by"                      VARCHAR(255),
        "updated_by"                      VARCHAR(255)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_phonograms_tenant_id"  ON "phonograms" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_phonograms_obra_id"    ON "phonograms" ("obra_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_phonograms_artista_id" ON "phonograms" ("artista_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_phonograms_isrc"       ON "phonograms" ("isrc")`);

    // ── contracts ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contracts" (
        "id"                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"         UUID         NOT NULL,
        "titulo"            VARCHAR(500) NOT NULL,
        "tipo"              VARCHAR(100) NOT NULL,
        "status"            VARCHAR(50)  NOT NULL DEFAULT 'rascunho',
        "artista_id"        UUID,
        "cliente_id"        UUID,
        "lancamento_id"     UUID,
        "data_inicio"       TIMESTAMP,
        "data_fim"          TIMESTAMP,
        "valor"             DECIMAL(15,2),
        "exclusivo"         BOOLEAN      NOT NULL DEFAULT FALSE,
        "observacoes"       TEXT,
        "arquivo_url"       TEXT,
        "autentique_doc_id" VARCHAR(255),
        "signing_platform"  VARCHAR(100),
        "versoes"           JSONB        NOT NULL DEFAULT '[]',
        "metadata"          JSONB        NOT NULL DEFAULT '{}',
        "created_at"        TIMESTAMP    NOT NULL DEFAULT NOW(),
        "updated_at"        TIMESTAMP    NOT NULL DEFAULT NOW(),
        "deleted_at"        TIMESTAMP,
        "created_by"        VARCHAR(255),
        "updated_by"        VARCHAR(255)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_contracts_tenant_id"     ON "contracts" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_contracts_tenant_status" ON "contracts" ("tenant_id", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_contracts_artista_id"    ON "contracts" ("artista_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_contracts_data_fim"      ON "contracts" ("data_fim")`);

    // ── contract_templates ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "contract_templates" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"   UUID         NOT NULL,
        "titulo"      VARCHAR(500) NOT NULL,
        "tipo"        VARCHAR(100) NOT NULL,
        "conteudo"    TEXT         NOT NULL,
        "variaveis"   JSONB        NOT NULL DEFAULT '[]',
        "ativo"       BOOLEAN      NOT NULL DEFAULT TRUE,
        "created_at"  TIMESTAMP    NOT NULL DEFAULT NOW(),
        "updated_at"  TIMESTAMP    NOT NULL DEFAULT NOW(),
        "deleted_at"  TIMESTAMP,
        "created_by"  VARCHAR(255)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_contract_templates_tenant" ON "contract_templates" ("tenant_id")`);

    // ── transactions ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "transactions" (
        "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"       UUID          NOT NULL,
        "tipo"            VARCHAR(50)   NOT NULL,
        "categoria"       VARCHAR(100)  NOT NULL,
        "descricao"       TEXT,
        "valor"           DECIMAL(15,2) NOT NULL,
        "data"            TIMESTAMP     NOT NULL,
        "status"          VARCHAR(50)   NOT NULL DEFAULT 'pendente',
        "artista_id"      UUID,
        "contrato_id"     UUID,
        "projeto_id"      UUID,
        "referencia"      VARCHAR(255),
        "comprovante_url" TEXT,
        "metadata"        JSONB         NOT NULL DEFAULT '{}',
        "created_at"      TIMESTAMP     NOT NULL DEFAULT NOW(),
        "updated_at"      TIMESTAMP     NOT NULL DEFAULT NOW(),
        "deleted_at"      TIMESTAMP,
        "created_by"      VARCHAR(255),
        "updated_by"      VARCHAR(255)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_transactions_tenant_id"   ON "transactions" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_transactions_tenant_data" ON "transactions" ("tenant_id", "data")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_transactions_artista_id"  ON "transactions" ("artista_id")`);

    // ── invoices ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "invoices" (
        "id"                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"               UUID          NOT NULL,
        "numero"                  VARCHAR(100),
        "tipo"                    VARCHAR(100)  NOT NULL,
        "status"                  VARCHAR(50)   NOT NULL DEFAULT 'pendente',
        "prestador_id"            UUID,
        "tomador_nome"            VARCHAR(255),
        "tomador_doc_encrypted"   TEXT,
        "valor"                   DECIMAL(15,2) NOT NULL,
        "descricao"               TEXT,
        "data_emissao"            TIMESTAMP,
        "data_vencimento"         TIMESTAMP,
        "arquivo_url"             TEXT,
        "metadata"                JSONB         NOT NULL DEFAULT '{}',
        "created_at"              TIMESTAMP     NOT NULL DEFAULT NOW(),
        "updated_at"              TIMESTAMP     NOT NULL DEFAULT NOW(),
        "deleted_at"              TIMESTAMP,
        "created_by"              VARCHAR(255)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_invoices_tenant_id"     ON "invoices" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_invoices_tenant_status" ON "invoices" ("tenant_id", "status")`);

    // ── clients ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "clients" (
        "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"          UUID         NOT NULL,
        "nome"               VARCHAR(255) NOT NULL,
        "segmento"           VARCHAR(100),
        "tipo_pessoa"        VARCHAR(50)  NOT NULL DEFAULT 'pessoa_juridica',
        "cpf_cnpj_encrypted" TEXT,
        "responsavel"        VARCHAR(255),
        "email_encrypted"    TEXT,
        "telefone_encrypted" TEXT,
        "endereco"           VARCHAR(500),
        "cidade"             VARCHAR(100),
        "estado"             VARCHAR(2),
        "status"             VARCHAR(50)  NOT NULL DEFAULT 'ativo',
        "observacoes"        TEXT,
        "metadata"           JSONB        NOT NULL DEFAULT '{}',
        "created_at"         TIMESTAMP    NOT NULL DEFAULT NOW(),
        "updated_at"         TIMESTAMP    NOT NULL DEFAULT NOW(),
        "deleted_at"         TIMESTAMP,
        "created_by"         VARCHAR(255),
        "updated_by"         VARCHAR(255)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_clients_tenant_id"     ON "clients" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_clients_tenant_status" ON "clients" ("tenant_id", "status")`);

    // ── leads ─────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "leads" (
        "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"          UUID         NOT NULL,
        "cliente_id"         UUID,
        "nome"               VARCHAR(255) NOT NULL,
        "email_encrypted"    TEXT,
        "telefone_encrypted" TEXT,
        "empresa"            VARCHAR(255),
        "status"             VARCHAR(50)  NOT NULL DEFAULT 'novo',
        "score"              INTEGER      NOT NULL DEFAULT 0,
        "fonte"              VARCHAR(100),
        "metadata"           JSONB        NOT NULL DEFAULT '{}',
        "created_at"         TIMESTAMP    NOT NULL DEFAULT NOW(),
        "updated_at"         TIMESTAMP    NOT NULL DEFAULT NOW(),
        "deleted_at"         TIMESTAMP,
        "created_by"         VARCHAR(255),
        "updated_by"         VARCHAR(255)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_leads_tenant_id"     ON "leads" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_leads_tenant_status" ON "leads" ("tenant_id", "status")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_leads_cliente_id"    ON "leads" ("cliente_id")`);

    // ── lead_interactions ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "lead_interactions" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"   UUID         NOT NULL,
        "lead_id"     UUID         NOT NULL,
        "tipo"        VARCHAR(100) NOT NULL,
        "descricao"   TEXT,
        "data"        TIMESTAMP    NOT NULL DEFAULT NOW(),
        "created_by"  VARCHAR(255),
        "created_at"  TIMESTAMP    NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_lead_interactions_tenant" ON "lead_interactions" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_lead_interactions_lead"   ON "lead_interactions" ("lead_id")`);

    // ── campaigns ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "campaigns" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"   UUID          NOT NULL,
        "nome"        VARCHAR(255)  NOT NULL,
        "tipo"        VARCHAR(100)  NOT NULL,
        "status"      VARCHAR(50)   NOT NULL DEFAULT 'rascunho',
        "objetivo"    TEXT,
        "orcamento"   DECIMAL(15,2),
        "data_inicio" TIMESTAMP,
        "data_fim"    TIMESTAMP,
        "artista_id"  UUID,
        "metadata"    JSONB         NOT NULL DEFAULT '{}',
        "created_at"  TIMESTAMP     NOT NULL DEFAULT NOW(),
        "updated_at"  TIMESTAMP     NOT NULL DEFAULT NOW(),
        "deleted_at"  TIMESTAMP,
        "created_by"  VARCHAR(255),
        "updated_by"  VARCHAR(255)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_campaigns_tenant_id" ON "campaigns" ("tenant_id")`);

    // ── briefings ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "briefings" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"    UUID         NOT NULL,
        "titulo"       VARCHAR(255) NOT NULL,
        "descricao"    TEXT,
        "artista_id"   UUID,
        "campanha_id"  UUID,
        "status"       VARCHAR(50)  NOT NULL DEFAULT 'rascunho',
        "prazo"        TIMESTAMP,
        "metadata"     JSONB        NOT NULL DEFAULT '{}',
        "created_at"   TIMESTAMP    NOT NULL DEFAULT NOW(),
        "updated_at"   TIMESTAMP    NOT NULL DEFAULT NOW(),
        "deleted_at"   TIMESTAMP,
        "created_by"   VARCHAR(255)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_briefings_tenant_id" ON "briefings" ("tenant_id")`);

    // ── events ────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "events" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"   UUID          NOT NULL,
        "titulo"      VARCHAR(255)  NOT NULL,
        "tipo"        VARCHAR(100)  NOT NULL,
        "status"      VARCHAR(50)   NOT NULL DEFAULT 'agendado',
        "data"        TIMESTAMP     NOT NULL,
        "local"       VARCHAR(255),
        "artista_id"  UUID,
        "valor"       DECIMAL(15,2),
        "observacoes" TEXT,
        "metadata"    JSONB         NOT NULL DEFAULT '{}',
        "created_at"  TIMESTAMP     NOT NULL DEFAULT NOW(),
        "updated_at"  TIMESTAMP     NOT NULL DEFAULT NOW(),
        "deleted_at"  TIMESTAMP,
        "created_by"  VARCHAR(255),
        "updated_by"  VARCHAR(255)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_events_tenant_id"   ON "events" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_events_tenant_data" ON "events" ("tenant_id", "data")`);

    // ── projects ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "projects" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"   UUID          NOT NULL,
        "nome"        VARCHAR(255)  NOT NULL,
        "tipo"        VARCHAR(100)  NOT NULL,
        "status"      VARCHAR(50)   NOT NULL DEFAULT 'planejamento',
        "artista_id"  UUID,
        "data_inicio" TIMESTAMP,
        "data_fim"    TIMESTAMP,
        "orcamento"   DECIMAL(15,2),
        "descricao"   TEXT,
        "metadata"    JSONB         NOT NULL DEFAULT '{}',
        "created_at"  TIMESTAMP     NOT NULL DEFAULT NOW(),
        "updated_at"  TIMESTAMP     NOT NULL DEFAULT NOW(),
        "deleted_at"  TIMESTAMP,
        "created_by"  VARCHAR(255),
        "updated_by"  VARCHAR(255)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_projects_tenant_id" ON "projects" ("tenant_id")`);

    // ── releases ──────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "releases" (
        "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"       UUID         NOT NULL,
        "artista_id"      UUID,
        "titulo"          VARCHAR(500) NOT NULL,
        "tipo"            VARCHAR(100) NOT NULL DEFAULT 'single',
        "status"          VARCHAR(50)  NOT NULL DEFAULT 'planejamento',
        "distribuidora"   VARCHAR(255),
        "upc"             VARCHAR(20),
        "data_lancamento" TIMESTAMP,
        "plataformas"     JSONB        NOT NULL DEFAULT '[]',
        "capa_url"        TEXT,
        "metadata"        JSONB        NOT NULL DEFAULT '{}',
        "created_at"      TIMESTAMP    NOT NULL DEFAULT NOW(),
        "updated_at"      TIMESTAMP    NOT NULL DEFAULT NOW(),
        "deleted_at"      TIMESTAMP,
        "created_by"      VARCHAR(255),
        "updated_by"      VARCHAR(255)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_releases_tenant_id"  ON "releases" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_releases_artista_id" ON "releases" ("artista_id")`);

    // ── shares ────────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "shares" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"    UUID         NOT NULL,
        "obra_id"      UUID,
        "fonograma_id" UUID,
        "titular_nome" VARCHAR(255) NOT NULL,
        "titular_doc"  VARCHAR(50),
        "papel"        VARCHAR(100) NOT NULL DEFAULT 'autor',
        "percentual"   DECIMAL(7,4) NOT NULL,
        "status"       VARCHAR(50)  NOT NULL DEFAULT 'ativo',
        "metadata"     JSONB        NOT NULL DEFAULT '{}',
        "created_at"   TIMESTAMP    NOT NULL DEFAULT NOW(),
        "updated_at"   TIMESTAMP    NOT NULL DEFAULT NOW(),
        "deleted_at"   TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_shares_tenant_id" ON "shares" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_shares_obra_id"   ON "shares" ("obra_id")`);

    // ── takedowns ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "takedowns" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"   UUID         NOT NULL,
        "titulo"      VARCHAR(255) NOT NULL,
        "plataforma"  VARCHAR(100) NOT NULL,
        "url"         TEXT,
        "status"      VARCHAR(50)  NOT NULL DEFAULT 'pendente',
        "obra_id"     UUID,
        "artista_id"  UUID,
        "motivo"      TEXT,
        "resposta"    TEXT,
        "metadata"    JSONB        NOT NULL DEFAULT '{}',
        "created_at"  TIMESTAMP    NOT NULL DEFAULT NOW(),
        "updated_at"  TIMESTAMP    NOT NULL DEFAULT NOW(),
        "deleted_at"  TIMESTAMP,
        "created_by"  VARCHAR(255)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_takedowns_tenant_id"     ON "takedowns" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_takedowns_tenant_status" ON "takedowns" ("tenant_id", "status")`);

    // ── support_tickets ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "support_tickets" (
        "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"     UUID         NOT NULL,
        "ticket_number" VARCHAR(50)  NOT NULL UNIQUE,
        "subject"       VARCHAR(500) NOT NULL,
        "description"   TEXT,
        "status"        VARCHAR(50)  NOT NULL DEFAULT 'open',
        "priority"      VARCHAR(50)  NOT NULL DEFAULT 'medium',
        "category"      VARCHAR(100),
        "created_by"    VARCHAR(255) NOT NULL,
        "assigned_to"   VARCHAR(255),
        "sla_deadline"  TIMESTAMP,
        "resolved_at"   TIMESTAMP,
        "tags"          JSONB        NOT NULL DEFAULT '[]',
        "metadata"      JSONB        NOT NULL DEFAULT '{}',
        "created_at"    TIMESTAMP    NOT NULL DEFAULT NOW(),
        "updated_at"    TIMESTAMP    NOT NULL DEFAULT NOW(),
        "deleted_at"    TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_support_tickets_tenant" ON "support_tickets" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_support_tickets_status" ON "support_tickets" ("status")`);

    // ── notifications ─────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notifications" (
        "id"         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"  UUID         NOT NULL,
        "user_id"    VARCHAR(255) NOT NULL,
        "title"      VARCHAR(255) NOT NULL,
        "body"       TEXT,
        "type"       VARCHAR(100) NOT NULL,
        "entity"     VARCHAR(100),
        "entity_id"  VARCHAR(255),
        "read_at"    TIMESTAMP,
        "metadata"   JSONB        NOT NULL DEFAULT '{}',
        "created_at" TIMESTAMP    NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_notifications_tenant_user"        ON "notifications" ("tenant_id", "user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_notifications_tenant_user_readat" ON "notifications" ("tenant_id", "user_id", "read_at")`);

    // ── uploads ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "uploads" (
        "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"     UUID         NOT NULL,
        "user_id"       VARCHAR(255) NOT NULL,
        "file_id"       VARCHAR(255) NOT NULL UNIQUE,
        "original_name" VARCHAR(500) NOT NULL,
        "mime_type"     VARCHAR(255) NOT NULL,
        "size_bytes"    INTEGER      NOT NULL,
        "r2_key"        TEXT         NOT NULL,
        "category"      VARCHAR(50)  NOT NULL,
        "entity"        VARCHAR(100),
        "entity_id"     VARCHAR(255),
        "status"        VARCHAR(50)  NOT NULL DEFAULT 'pending',
        "confirmed_at"  TIMESTAMP,
        "metadata"      JSONB        NOT NULL DEFAULT '{}',
        "created_at"    TIMESTAMP    NOT NULL DEFAULT NOW(),
        "deleted_at"    TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_uploads_tenant_id"   ON "uploads" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_uploads_file_id"     ON "uploads" ("file_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_uploads_entity"      ON "uploads" ("entity", "entity_id")`);

    // ── integrations ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "integrations" (
        "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"             UUID         NOT NULL,
        "provider"              VARCHAR(100) NOT NULL,
        "status"                VARCHAR(50)  NOT NULL DEFAULT 'disconnected',
        "credentials_encrypted" TEXT,
        "settings"              JSONB        NOT NULL DEFAULT '{}',
        "last_sync_at"          TIMESTAMP,
        "failure_count"         INTEGER      NOT NULL DEFAULT 0,
        "metadata"              JSONB        NOT NULL DEFAULT '{}',
        "created_at"            TIMESTAMP    NOT NULL DEFAULT NOW(),
        "updated_at"            TIMESTAMP    NOT NULL DEFAULT NOW(),
        "deleted_at"            TIMESTAMP,
        UNIQUE ("tenant_id", "provider")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_integrations_tenant" ON "integrations" ("tenant_id")`);

    // ── oauth_connections ─────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "oauth_connections" (
        "id"                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"                UUID         NOT NULL,
        "user_id"                  VARCHAR(255) NOT NULL,
        "provider"                 VARCHAR(100) NOT NULL,
        "access_token_encrypted"   TEXT         NOT NULL,
        "refresh_token_encrypted"  TEXT,
        "expires_at"               TIMESTAMP,
        "scopes"                   TEXT,
        "metadata"                 JSONB        NOT NULL DEFAULT '{}',
        "created_at"               TIMESTAMP    NOT NULL DEFAULT NOW(),
        "updated_at"               TIMESTAMP    NOT NULL DEFAULT NOW(),
        UNIQUE ("tenant_id", "user_id", "provider")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_oauth_tenant_id" ON "oauth_connections" ("tenant_id")`);

    // ── webhook_events ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "webhook_events" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"    UUID,
        "provider"     VARCHAR(100) NOT NULL,
        "event_type"   VARCHAR(100) NOT NULL,
        "external_id"  VARCHAR(255) UNIQUE,
        "payload"      JSONB        NOT NULL,
        "status"       VARCHAR(50)  NOT NULL DEFAULT 'pending',
        "processed_at" TIMESTAMP,
        "error"        TEXT,
        "retry_count"  INTEGER      NOT NULL DEFAULT 0,
        "created_at"   TIMESTAMP    NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_webhook_events_provider" ON "webhook_events" ("provider", "event_type")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_webhook_events_status"   ON "webhook_events" ("status")`);

    // ── audit_logs ────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "audit_logs" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"   UUID,
        "user_id"     VARCHAR(255),
        "action"      VARCHAR(100) NOT NULL,
        "entity"      VARCHAR(100) NOT NULL,
        "entity_id"   VARCHAR(255),
        "before"      JSONB,
        "after"       JSONB,
        "ip_address"  VARCHAR(45),
        "user_agent"  TEXT,
        "request_id"  VARCHAR(255),
        "metadata"    JSONB        NOT NULL DEFAULT '{}',
        "created_at"  TIMESTAMP    NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_logs_tenant_id" ON "audit_logs" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_logs_entity"    ON "audit_logs" ("tenant_id", "entity")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_logs_user_id"   ON "audit_logs" ("user_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_audit_logs_created"   ON "audit_logs" ("created_at")`);

    // ── ai_jobs ───────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ai_jobs" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"    UUID          NOT NULL,
        "user_id"      VARCHAR(255)  NOT NULL,
        "provider"     VARCHAR(50)   NOT NULL,
        "model"        VARCHAR(100)  NOT NULL,
        "skill"        VARCHAR(100)  NOT NULL,
        "status"       VARCHAR(50)   NOT NULL DEFAULT 'pending',
        "input_tokens" INTEGER       NOT NULL DEFAULT 0,
        "output_tokens" INTEGER      NOT NULL DEFAULT 0,
        "cost_usd"     DECIMAL(12,8) NOT NULL DEFAULT 0,
        "latency_ms"   INTEGER,
        "completed_at" TIMESTAMP,
        "metadata"     JSONB         NOT NULL DEFAULT '{}',
        "created_at"   TIMESTAMP     NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ai_jobs_tenant_id"  ON "ai_jobs" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ai_jobs_created_at" ON "ai_jobs" ("created_at")`);

    // ── artist_goals ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "artist_goals" (
        "id"          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"   UUID          NOT NULL,
        "artista_id"  UUID          NOT NULL,
        "titulo"      VARCHAR(255)  NOT NULL,
        "tipo"        VARCHAR(100)  NOT NULL,
        "meta_valor"  DECIMAL(15,2),
        "valor_atual" DECIMAL(15,2) NOT NULL DEFAULT 0,
        "status"      VARCHAR(50)   NOT NULL DEFAULT 'em_andamento',
        "periodo"     VARCHAR(50)   NOT NULL DEFAULT 'mensal',
        "data_inicio" TIMESTAMP,
        "data_fim"    TIMESTAMP,
        "metadata"    JSONB         NOT NULL DEFAULT '{}',
        "created_at"  TIMESTAMP     NOT NULL DEFAULT NOW(),
        "updated_at"  TIMESTAMP     NOT NULL DEFAULT NOW(),
        "deleted_at"  TIMESTAMP,
        "created_by"  VARCHAR(255)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_artist_goals_tenant_id"  ON "artist_goals" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_artist_goals_artista_id" ON "artist_goals" ("artista_id")`);

    // ── content_detections ────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "content_detections" (
        "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"          UUID         NOT NULL,
        "obra_id"            UUID,
        "artista_id"         UUID,
        "plataforma"         VARCHAR(100) NOT NULL,
        "titulo_detectado"   VARCHAR(500),
        "url"                TEXT,
        "score"              DECIMAL(5,4),
        "status"             VARCHAR(50)  NOT NULL DEFAULT 'pendente',
        "tipo"               VARCHAR(100) NOT NULL DEFAULT 'uso_nao_autorizado',
        "detectado_em"       TIMESTAMP    NOT NULL DEFAULT NOW(),
        "metadata"           JSONB        NOT NULL DEFAULT '{}',
        "created_at"         TIMESTAMP    NOT NULL DEFAULT NOW(),
        "updated_at"         TIMESTAMP    NOT NULL DEFAULT NOW(),
        "deleted_at"         TIMESTAMP
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_content_detections_tenant" ON "content_detections" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_content_detections_status" ON "content_detections" ("status")`);

    // ── ecad_reports ──────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "ecad_reports" (
        "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"     UUID          NOT NULL,
        "obra_id"       UUID,
        "periodo"       VARCHAR(20)   NOT NULL,
        "tipo"          VARCHAR(100)  NOT NULL,
        "valor_bruto"   DECIMAL(15,2),
        "valor_liquido" DECIMAL(15,2),
        "status"        VARCHAR(50)   NOT NULL DEFAULT 'pendente',
        "arquivo_url"   TEXT,
        "metadata"      JSONB         NOT NULL DEFAULT '{}',
        "created_at"    TIMESTAMP     NOT NULL DEFAULT NOW(),
        "updated_at"    TIMESTAMP     NOT NULL DEFAULT NOW(),
        "deleted_at"    TIMESTAMP,
        "created_by"    VARCHAR(255)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ecad_reports_tenant"  ON "ecad_reports" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_ecad_reports_periodo" ON "ecad_reports" ("periodo")`);

    // ── employees ─────────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "employees" (
        "id"                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"           UUID         NOT NULL,
        "nome"                VARCHAR(255) NOT NULL,
        "cargo"               VARCHAR(255),
        "departamento"        VARCHAR(100),
        "tipo_contrato"       VARCHAR(100) NOT NULL DEFAULT 'clt',
        "status"              VARCHAR(50)  NOT NULL DEFAULT 'ativo',
        "email_encrypted"     TEXT,
        "telefone_encrypted"  TEXT,
        "cpf_encrypted"       TEXT,
        "salario"             DECIMAL(15,2),
        "data_admissao"       TIMESTAMP,
        "data_demissao"       TIMESTAMP,
        "documentos"          JSONB        NOT NULL DEFAULT '[]',
        "metadata"            JSONB        NOT NULL DEFAULT '{}',
        "created_at"          TIMESTAMP    NOT NULL DEFAULT NOW(),
        "updated_at"          TIMESTAMP    NOT NULL DEFAULT NOW(),
        "deleted_at"          TIMESTAMP,
        "created_by"          VARCHAR(255)
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_employees_tenant_id" ON "employees" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_employees_status"    ON "employees" ("status")`);

    // ── payroll_entries ───────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "payroll_entries" (
        "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"      UUID          NOT NULL,
        "employee_id"    UUID          NOT NULL,
        "competencia"    VARCHAR(7)    NOT NULL,
        "salario_bruto"  DECIMAL(15,2) NOT NULL,
        "descontos"      DECIMAL(15,2) NOT NULL DEFAULT 0,
        "salario_liquido" DECIMAL(15,2) NOT NULL,
        "status"         VARCHAR(50)   NOT NULL DEFAULT 'pendente',
        "arquivo_url"    TEXT,
        "pago_em"        TIMESTAMP,
        "metadata"       JSONB         NOT NULL DEFAULT '{}',
        "created_at"     TIMESTAMP     NOT NULL DEFAULT NOW(),
        "updated_at"     TIMESTAMP     NOT NULL DEFAULT NOW(),
        UNIQUE ("employee_id", "competencia")
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payroll_tenant_id"    ON "payroll_entries" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_payroll_employee_id"  ON "payroll_entries" ("employee_id")`);

    // ── leave_requests ────────────────────────────────────────────────────────
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "leave_requests" (
        "id"           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"    UUID         NOT NULL,
        "employee_id"  UUID         NOT NULL,
        "tipo"         VARCHAR(100) NOT NULL,
        "data_inicio"  TIMESTAMP    NOT NULL,
        "data_fim"     TIMESTAMP    NOT NULL,
        "status"       VARCHAR(50)  NOT NULL DEFAULT 'pendente',
        "motivo"       TEXT,
        "aprovado_por" VARCHAR(255),
        "metadata"     JSONB        NOT NULL DEFAULT '{}',
        "created_at"   TIMESTAMP    NOT NULL DEFAULT NOW(),
        "updated_at"   TIMESTAMP    NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_leave_tenant_id"    ON "leave_requests" ("tenant_id")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_leave_employee_id"  ON "leave_requests" ("employee_id")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse order of creation to respect implicit dependencies
    const tables = [
      'leave_requests', 'payroll_entries', 'employees',
      'ecad_reports', 'content_detections', 'artist_goals', 'ai_jobs',
      'audit_logs', 'webhook_events', 'oauth_connections', 'integrations',
      'uploads', 'notifications', 'support_tickets', 'takedowns',
      'shares', 'releases', 'projects', 'events', 'briefings',
      'campaigns', 'lead_interactions', 'leads', 'clients',
      'invoices', 'transactions', 'contract_templates', 'contracts',
      'phonograms', 'works', 'artists',
      'billing_subscriptions', 'org_members', 'tenants', 'organizations',
    ];
    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
    }
  }
}
