import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Audiovisual Tasks — table of tasks attached to audiovisual projects.
 *
 * Reuses the campaign_tasks/crm_tasks pattern: simple status, due_date,
 * priority, assigned_to (nullable user UUID). Auto-created by the Projects
 * service on status transitions (briefing → pre_production creates "Cast",
 * "Locação", "Roteiro" etc.) or manually through the UI.
 */
export class AudiovisualTasks20260527000004 implements MigrationInterface {
  name = 'AudiovisualTasks20260527000004';

  async up(qr: QueryRunner): Promise<void> {
    await qr.query(`
      CREATE TABLE IF NOT EXISTS audiovisual_tasks (
        id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                UUID NOT NULL,
        audiovisual_project_id   UUID NOT NULL,
        title                    VARCHAR(500) NOT NULL,
        description              TEXT,
        status                   VARCHAR(30) NOT NULL DEFAULT 'pending',
        priority                 VARCHAR(20) NOT NULL DEFAULT 'medium',
        assigned_to              UUID,
        due_date                 TIMESTAMPTZ,
        completed_at             TIMESTAMPTZ,
        auto_generated           BOOLEAN NOT NULL DEFAULT false,
        auto_stage               VARCHAR(40),
        metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by               VARCHAR(255),
        updated_by               VARCHAR(255),
        created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at               TIMESTAMPTZ,
        CONSTRAINT chk_av_tasks_status CHECK (
          status IN ('pending','in_progress','blocked','done','cancelled')
        ),
        CONSTRAINT chk_av_tasks_priority CHECK (
          priority IN ('low','medium','high','urgent')
        )
      );
      CREATE INDEX IF NOT EXISTS idx_av_tasks_tenant   ON audiovisual_tasks (tenant_id);
      CREATE INDEX IF NOT EXISTS idx_av_tasks_project  ON audiovisual_tasks (tenant_id, audiovisual_project_id, status);
      CREATE INDEX IF NOT EXISTS idx_av_tasks_assigned ON audiovisual_tasks (tenant_id, assigned_to);
      CREATE INDEX IF NOT EXISTS idx_av_tasks_due      ON audiovisual_tasks (tenant_id, due_date);
      CREATE INDEX IF NOT EXISTS idx_av_tasks_deleted  ON audiovisual_tasks (tenant_id, deleted_at);
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS audiovisual_tasks;`);
  }
}
