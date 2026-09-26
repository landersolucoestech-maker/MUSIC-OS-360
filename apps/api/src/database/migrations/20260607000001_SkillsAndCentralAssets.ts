import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Slice 1 — Backend foundation for Skills + Central Asset Model (additive).
 *
 * Creates the skill execution persistence (skill_runs / skill_run_logs) and the
 * central asset model (assets / asset_versions / project_assets /
 * task_assets / asset_usage_logs), COEXISTING with the already existing specific
 * tables (uploads, marketing_assets, audiovisual_assets, campaign_assets).
 *
 * Logical links via indexed uuid (project pattern — no rigid FK).
 */
export class SkillsAndCentralAssets20260607000001 implements MigrationInterface {
  name = 'SkillsAndCentralAssets20260607000001';

  async up(qr: QueryRunner): Promise<void> {
    // ── skill_runs ────────────────────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS skill_runs (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id       uuid NOT NULL,
        user_id         varchar(255),
        skill_name      varchar(100) NOT NULL,
        entity_type     varchar(100),
        entity_id       varchar(255),
        correlation_id  varchar(255),
        status          varchar(20) NOT NULL DEFAULT 'pending',
        input_payload   jsonb NOT NULL DEFAULT '{}'::jsonb,
        output_payload  jsonb,
        error_message   text,
        started_at      timestamp,
        finished_at     timestamp,
        created_at      timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_skill_runs_tenant ON skill_runs (tenant_id);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_skill_runs_tenant_name ON skill_runs (tenant_id, skill_name);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_skill_runs_tenant_status ON skill_runs (tenant_id, status);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_skill_runs_correlation ON skill_runs (correlation_id);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_skill_runs_entity ON skill_runs (entity_type, entity_id);`);

    // ── skill_run_logs ────────────────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS skill_run_logs (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        skill_run_id  uuid NOT NULL,
        level         varchar(10) NOT NULL DEFAULT 'info',
        message       text NOT NULL,
        payload       jsonb,
        created_at    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_skill_run_logs_run ON skill_run_logs (skill_run_id);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_skill_run_logs_run_level ON skill_run_logs (skill_run_id, level);`);

    // ── assets (central) ──────────────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS assets (
        id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           uuid NOT NULL,
        name                varchar(500) NOT NULL,
        asset_type          varchar(50) NOT NULL DEFAULT 'unknown',
        mime_type           varchar(150),
        status              varchar(20) NOT NULL DEFAULT 'active',
        source              varchar(50) NOT NULL,
        source_id           varchar(255),
        current_version_id  uuid,
        metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_by          varchar(255),
        created_at          timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at          timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at          timestamp
      );
    `);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_assets_tenant ON assets (tenant_id);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_assets_tenant_type ON assets (tenant_id, asset_type);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_assets_tenant_status ON assets (tenant_id, status);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_assets_tenant_source ON assets (tenant_id, source, source_id);`);

    // ── asset_versions ────────────────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS asset_versions (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id     uuid NOT NULL,
        asset_id      uuid NOT NULL,
        version       integer NOT NULL DEFAULT 1,
        file_url      text NOT NULL,
        thumbnail_url text,
        mime_type     varchar(150),
        size_bytes    bigint,
        change_notes  text,
        created_by    varchar(255),
        created_at    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_asset_versions_tenant ON asset_versions (tenant_id);`);
    await qr.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_asset_versions_asset_version ON asset_versions (tenant_id, asset_id, version);`);

    // ── project_assets ────────────────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS project_assets (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id     uuid NOT NULL,
        project_id    uuid NOT NULL,
        asset_id      uuid NOT NULL,
        role          varchar(50) NOT NULL DEFAULT 'reference',
        source_event  varchar(100),
        linked_by     varchar(255),
        created_at    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_project_assets_tenant ON project_assets (tenant_id);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_project_assets_project ON project_assets (tenant_id, project_id);`);
    await qr.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_project_assets_project_asset ON project_assets (tenant_id, project_id, asset_id);`);

    // ── task_assets ───────────────────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS task_assets (
        id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id     uuid NOT NULL,
        task_id       uuid NOT NULL,
        asset_id      uuid NOT NULL,
        role          varchar(50) NOT NULL DEFAULT 'reference',
        source_event  varchar(100),
        linked_by     varchar(255),
        created_at    timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_task_assets_tenant ON task_assets (tenant_id);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_task_assets_task ON task_assets (tenant_id, task_id);`);
    await qr.query(`CREATE UNIQUE INDEX IF NOT EXISTS uq_task_assets_task_asset ON task_assets (tenant_id, task_id, asset_id);`);

    // ── asset_usage_logs ──────────────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS asset_usage_logs (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id    uuid NOT NULL,
        asset_id     uuid NOT NULL,
        action       varchar(60) NOT NULL,
        target_type  varchar(100),
        target_id    varchar(255),
        actor_id     varchar(255),
        metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
        created_at   timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_asset_usage_logs_tenant ON asset_usage_logs (tenant_id);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_asset_usage_logs_asset ON asset_usage_logs (tenant_id, asset_id);`);
    await qr.query(`CREATE INDEX IF NOT EXISTS idx_asset_usage_logs_action ON asset_usage_logs (tenant_id, action);`);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS asset_usage_logs;`);
    await qr.query(`DROP TABLE IF EXISTS task_assets;`);
    await qr.query(`DROP TABLE IF EXISTS project_assets;`);
    await qr.query(`DROP TABLE IF EXISTS asset_versions;`);
    await qr.query(`DROP TABLE IF EXISTS assets;`);
    await qr.query(`DROP TABLE IF EXISTS skill_run_logs;`);
    await qr.query(`DROP TABLE IF EXISTS skill_runs;`);
  }
}
