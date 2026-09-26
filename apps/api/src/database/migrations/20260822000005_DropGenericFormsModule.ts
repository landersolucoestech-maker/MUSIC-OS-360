import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260822000005_DropGenericFormsModule
 *
 * Product decision (2026-08-22): there will be no generic Form Builder in
 * Music OS 360. `forms`/`form_submissions` (created in
 * 20260521000040_ConversationsAndForms, together with MusicChat's
 * conversations tables — preserved intact, not touched here)
 * never had an approved real consumer: zero UI in the frontend, zero
 * service/controller of another module depends on them, and
 * entity-metadata.service.ts already explicitly excluded them from the Reports
 * Center ("they may never appear"). Artist acquisition uses the Artist
 * Public Form (its own specialized flow); support uses Support Ticket;
 * neither ever depended on this generic module.
 *
 * Additive/safe: only DROPs the two forms-module tables (which never
 * had a real write flow in production) and the form_status enum.
 * Does NOT touch conversations/conversation_messages/conversation_notes (MusicChat).
 */
export class DropGenericFormsModule20260822000005 implements MigrationInterface {
  name = 'DropGenericFormsModule20260822000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS form_submissions CASCADE`);
    await queryRunner.query(`DROP TABLE IF EXISTS forms CASCADE`);
    await queryRunner.query(`DROP TYPE IF EXISTS form_status`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE TYPE form_status AS ENUM ('draft', 'active', 'archived')`);

    await queryRunner.query(`
      CREATE TABLE forms (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name        TEXT        NOT NULL,
        description TEXT,
        fields      JSONB       NOT NULL DEFAULT '[]',
        settings    JSONB       NOT NULL DEFAULT '{}',
        status      form_status NOT NULL DEFAULT 'draft',
        submission_count INT    NOT NULL DEFAULT 0,
        created_by  TEXT,
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at  TIMESTAMPTZ
      );
      CREATE INDEX idx_forms_tenant_status ON forms (tenant_id, status) WHERE deleted_at IS NULL;
    `);

    await queryRunner.query(`
      CREATE TABLE form_submissions (
        id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        form_id   UUID        NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
        tenant_id UUID        NOT NULL,
        lead_id   UUID        REFERENCES leads(id) ON DELETE SET NULL,
        data      JSONB       NOT NULL DEFAULT '{}',
        origin    TEXT,
        ip        TEXT,
        metadata  JSONB       NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_form_submissions_form   ON form_submissions (form_id, created_at DESC);
      CREATE INDEX idx_form_submissions_tenant ON form_submissions (tenant_id);
      CREATE INDEX idx_form_submissions_lead   ON form_submissions (lead_id) WHERE lead_id IS NOT NULL;
    `);

    await queryRunner.query(`
      ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
      ALTER TABLE form_submissions ENABLE ROW LEVEL SECURITY;
      CREATE POLICY tenant_isolation ON forms
        USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
      CREATE POLICY tenant_isolation ON form_submissions
        USING (tenant_id = current_setting('app.current_tenant_id', TRUE)::UUID);
    `);
  }
}
