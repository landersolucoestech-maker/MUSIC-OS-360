import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260705000003_RemoveDeadStructuresD1D8
 *
 * Forward-only destructive migration covering findings D1–D8 of the full
 * database audit (2026-07-05, `docs/AUDITORIA_DB_2026-07-05.md`). Every
 * structure removed here was confirmed to have 0 live code references
 * (outside orphan migrations/entities) before this migration was written.
 *
 * DO NOT RUN against production without an explicit Go (see the release runbook).
 *
 * D1: legacy 0-row CRM cluster (crm_companies, crm_contacts, crm_tags,
 *     crm_contact_tags, crm_timeline_events) — replaced by contacts/leads.
 * D2: crm_tasks (4 rows) — migrated to operational_tasks (same shape,
 *     already the real table behind CrmTaskEntity) before the DROP.
 * D3: 13 conversation_* configuration tables (CustomerCareConversationExtensions),
 *     0 rows, 0 live references. conversations/conversation_messages/
 *     conversation_notes are NOT affected (those stay).
 * D4: organization_members — created outside the migration flow, no entity,
 *     no RLS/policies, 0 rows, duplicates org_members (the latter is the official one).
 * D5: financial_category_templates — 0 rows, 0 references.
 * D7: legacy flat columns of financial_category_rules (transaction_type,
 *     counterparty_type, category, subcategory, links, sort_order) — model
 *     replaced by conditions/actions (jsonb); the current entity no longer maps them.
 * D8: financial_centers (22 seeded rows, never read/written by the code)
 *     + the financial_category_centers.center_id column/FK.
 *
 * Audit correction note: item D6 (columns artists.spotify_url/
 * youtube_url/instagram_url/tiktok_url) is NOT included here — while
 * verifying this migration, spotify_url and youtube_url were still being
 * actively written/read by CreateArtistDto/ArtistsService/
 * ArtistaEvolucaoSection, and instagram_url/tiktok_url never existed as
 * `artists` columns (the report was out of date on that point).
 */
export class RemoveDeadStructuresD1D8_20260705000003 implements MigrationInterface {
  name = 'RemoveDeadStructuresD1D8_20260705000003';

  public async up(qr: QueryRunner): Promise<void> {
    // ── D2: migrate crm_tasks → operational_tasks before the DROP (same shape) ──
    await qr.query(`
      INSERT INTO operational_tasks (
        id, tenant_id, title, description, status, priority, type,
        contact_id, company_id, assigned_to, due_date, completed_at,
        created_by, created_at, updated_at
      )
      SELECT
        id, tenant_id, title, description, status, priority, type,
        contact_id, company_id, assigned_to, due_date, completed_at,
        created_by, created_at, updated_at
      FROM crm_tasks
      ON CONFLICT (id) DO NOTHING
    `);

    // ── D1 + D2: drop the legacy CRM cluster (order respects FKs) ──────────────
    for (const table of [
      'crm_timeline_events',
      'crm_tasks',
      'crm_contact_tags',
      'crm_tags',
      'crm_contacts',
      'crm_companies',
    ]) {
      await qr.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }

    // ── D3: 13 conversation_* configuration tables, 0 live usage ──────────────
    for (const table of [
      'conversation_channel_accounts',
      'conversation_sectors',
      'conversation_queues',
      'conversation_service_statuses',
      'conversation_tags',
      'conversation_transfers',
      'conversation_closures',
      'conversation_audit_events',
      'conversation_quick_replies',
      'conversation_auto_messages',
      'conversation_sla_policies',
      'conversation_business_hours',
      'conversation_protocol_settings',
    ]) {
      await qr.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }

    // ── D4: organization_members (duplicate of org_members, outside migrations) ─
    await qr.query(`DROP TABLE IF EXISTS organization_members CASCADE`);

    // ── D5: financial_category_templates, 0 live usage ──────────────────────────
    await qr.query(`DROP TABLE IF EXISTS financial_category_templates CASCADE`);

    // ── D7: legacy flat columns of financial_category_rules ──────────────────
    await qr.query(`
      DROP INDEX IF EXISTS idx_financial_category_rules_dynamic_lookup;
      ALTER TABLE financial_category_rules
        DROP COLUMN IF EXISTS transaction_type,
        DROP COLUMN IF EXISTS counterparty_type,
        DROP COLUMN IF EXISTS category,
        DROP COLUMN IF EXISTS subcategory,
        DROP COLUMN IF EXISTS links,
        DROP COLUMN IF EXISTS sort_order
    `);

    // ── D8: financial_centers + column/FK financial_category_centers.center_id ─
    await qr.query(`
      ALTER TABLE financial_category_centers
        DROP COLUMN IF EXISTS center_id CASCADE
    `);
    await qr.query(`DROP TABLE IF EXISTS financial_centers CASCADE`);
  }

  public async down(qr: QueryRunner): Promise<void> {
    // Schema reversal (best-effort). Data of the tables dropped in D1/D3/D4/D5
    // and the seeded financial_centers rows (D8) are NOT restored — only the
    // crm_tasks→operational_tasks migration (D2) is reversible with real data.

    await qr.query(`
      CREATE TABLE IF NOT EXISTS financial_centers (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID NOT NULL,
        type            VARCHAR(30) NOT NULL,
        name            VARCHAR(255) NOT NULL,
        slug            VARCHAR(255) NOT NULL,
        code            VARCHAR(80) NOT NULL,
        description     TEXT,
        color           VARCHAR(40),
        icon            VARCHAR(80),
        active          BOOLEAN NOT NULL DEFAULT true,
        system_center   BOOLEAN NOT NULL DEFAULT false,
        metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by      VARCHAR(255),
        updated_by      VARCHAR(255),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at      TIMESTAMPTZ,
        CONSTRAINT chk_financial_centers_type CHECK (type IN ('COST_CENTER','REVENUE_CENTER'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_centers_code_active ON financial_centers (tenant_id, code) WHERE deleted_at IS NULL;
      CREATE INDEX IF NOT EXISTS idx_financial_centers_type ON financial_centers (tenant_id, type, active, deleted_at);
    `);

    await qr.query(`
      ALTER TABLE financial_category_centers
        ADD COLUMN IF NOT EXISTS center_id UUID REFERENCES financial_centers(id) ON DELETE CASCADE
    `);
    await qr.query(`
      CREATE INDEX IF NOT EXISTS idx_financial_category_centers_center ON financial_category_centers (tenant_id, center_id)
    `);

    await qr.query(`
      ALTER TABLE financial_category_rules
        ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(40),
        ADD COLUMN IF NOT EXISTS counterparty_type VARCHAR(80),
        ADD COLUMN IF NOT EXISTS category VARCHAR(255),
        ADD COLUMN IF NOT EXISTS subcategory VARCHAR(255),
        ADD COLUMN IF NOT EXISTS links JSONB,
        ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
      CREATE INDEX IF NOT EXISTS idx_financial_category_rules_dynamic_lookup
        ON financial_category_rules (tenant_id, transaction_type, counterparty_type, category, subcategory, active, sort_order);
    `);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS financial_category_templates (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID NOT NULL,
        name            VARCHAR(255) NOT NULL,
        description     TEXT,
        template_kind   VARCHAR(80) NOT NULL DEFAULT 'operational',
        payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
        system_template BOOLEAN NOT NULL DEFAULT false,
        active          BOOLEAN NOT NULL DEFAULT true,
        created_by      VARCHAR(255),
        updated_by      VARCHAR(255),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at      TIMESTAMPTZ
      );
    `);

    await qr.query(`
      CREATE TABLE IF NOT EXISTS organization_members (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       UUID NOT NULL,
        user_id         UUID,
        role            VARCHAR(100),
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    for (const table of [
      'conversation_channel_accounts',
      'conversation_sectors',
      'conversation_queues',
      'conversation_service_statuses',
      'conversation_tags',
      'conversation_transfers',
      'conversation_closures',
      'conversation_audit_events',
      'conversation_quick_replies',
      'conversation_auto_messages',
      'conversation_sla_policies',
      'conversation_business_hours',
      'conversation_protocol_settings',
    ]) {
      await qr.query(`CREATE TABLE IF NOT EXISTS ${table} (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL)`);
    }

    await qr.query(`
      CREATE TABLE IF NOT EXISTS crm_companies (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL);
      CREATE TABLE IF NOT EXISTS crm_contacts (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL, company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL);
      CREATE TABLE IF NOT EXISTS crm_tags (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL);
      CREATE TABLE IF NOT EXISTS crm_contact_tags (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL, contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE, tag_id UUID NOT NULL REFERENCES crm_tags(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS crm_timeline_events (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL, contact_id UUID NOT NULL REFERENCES crm_contacts(id) ON DELETE CASCADE);
      CREATE TABLE IF NOT EXISTS crm_tasks (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id UUID NOT NULL, contact_id UUID REFERENCES crm_contacts(id) ON DELETE SET NULL, company_id UUID REFERENCES crm_companies(id) ON DELETE SET NULL);
    `);
  }
}
