import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical rebuild of `campaign_tasks` — 2026-07-19 audit.
 *
 * `CreateCampaignTaskDto`/`CampaignOperationsService.createTask()` match
 * the physical columns entirely (title, description, priority,
 * assigned_to, due_date; status/completed_at by business logic on the
 * transition to 'done'). The only point fixed: `created_by` was BEFORE
 * created_at/updated_at — moved to the end of the audit block (there is
 * no updated_by/deleted_at in this table — tasks are hard-deleted via
 * `.delete()`, a pre-existing gap, not invented here). Zero columns removed.
 *
 * NOTE (recorded pending item, not fixed here): the parent table `campaigns`
 * has a DTO (`CreateCampaignDto`: title/type/artistId/budget/startsAt/
 * endsAt) whose field names do NOT match the entity's physical columns
 * (nome/tipo/artista_id/orcamento/data_inicio/data_fim), and there is no real
 * frontend caller for the `/campaigns` REST resource (the frontend's "Campanhas" page
 * operates on `marketing_projects`/`marketing_tasks`, a different
 * resource). `campaign_tasks`/`campaign_assets` (this file and the
 * next) have correct DTOs and are exercised only via
 * `CampaignOperationsService`, which depends on an existing parent campaign.
 */
export class RebuildCampaignTasksInCanonicalFormOrder20260719000022 implements MigrationInterface {
  name = 'RebuildCampaignTasksInCanonicalFormOrder20260719000022';

  private readonly newColumns = `
    id            uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL,
    campaign_id   uuid NOT NULL,
    title         varchar(500) NOT NULL,
    description   text,
    status        varchar(50) NOT NULL DEFAULT 'pending',
    priority      varchar(50) NOT NULL DEFAULT 'medium',
    assigned_to   varchar(255),
    due_date      timestamptz,
    completed_at  timestamptz,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    created_by    varchar(255)
  `;

  private readonly copyColumns = [
    'id', 'tenant_id', 'campaign_id', 'title', 'description', 'status', 'priority',
    'assigned_to', 'due_date', 'completed_at', 'created_at', 'updated_at', 'created_by',
  ].join(', ');

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM campaign_tasks`);

    await queryRunner.query(`CREATE TABLE campaign_tasks_new (${this.newColumns})`);
    await queryRunner.query(`INSERT INTO campaign_tasks_new (${this.copyColumns}) SELECT ${this.copyColumns} FROM campaign_tasks`);

    const [{ c: newCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM campaign_tasks_new`);
    if (Number(newCount) !== Number(total)) {
      throw new Error(`RebuildCampaignTasksInCanonicalFormOrder: contagem divergente (original=${total}, nova=${newCount}) — abortada.`);
    }

    await queryRunner.query(`ALTER TABLE campaign_tasks_new ADD CONSTRAINT campaign_tasks_new_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE campaign_tasks_new ADD CONSTRAINT campaign_tasks_new_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE campaign_tasks_new ADD CONSTRAINT fk_campaign_tasks_campaign_tenant_new FOREIGN KEY (campaign_id, tenant_id) REFERENCES campaigns(id, tenant_id) ON DELETE CASCADE`);
    await queryRunner.query(`CREATE INDEX idx_campaign_tasks_assignee_new ON campaign_tasks_new (assigned_to)`);
    await queryRunner.query(`CREATE INDEX idx_campaign_tasks_campaign_new ON campaign_tasks_new (tenant_id, campaign_id)`);
    await queryRunner.query(`CREATE INDEX idx_campaign_tasks_due_new ON campaign_tasks_new (tenant_id, due_date)`);

    await queryRunner.query(`ALTER TABLE campaign_tasks RENAME TO campaign_tasks_old`);
    await queryRunner.query(`ALTER TABLE campaign_tasks_old RENAME CONSTRAINT campaign_tasks_pkey TO campaign_tasks_old_pkey`);
    await queryRunner.query(`ALTER TABLE campaign_tasks_old RENAME CONSTRAINT campaign_tasks_campaign_id_fkey TO campaign_tasks_old_campaign_id_fkey`);
    await queryRunner.query(`ALTER TABLE campaign_tasks_old RENAME CONSTRAINT fk_campaign_tasks_campaign_tenant TO fk_campaign_tasks_campaign_tenant_old`);
    await queryRunner.query(`ALTER INDEX idx_campaign_tasks_assignee RENAME TO idx_campaign_tasks_assignee_old`);
    await queryRunner.query(`ALTER INDEX idx_campaign_tasks_campaign RENAME TO idx_campaign_tasks_campaign_old`);
    await queryRunner.query(`ALTER INDEX idx_campaign_tasks_due RENAME TO idx_campaign_tasks_due_old`);

    await queryRunner.query(`ALTER TABLE campaign_tasks_new RENAME TO campaign_tasks`);
    await queryRunner.query(`ALTER INDEX campaign_tasks_new_pkey RENAME TO campaign_tasks_pkey`);
    await queryRunner.query(`ALTER TABLE campaign_tasks RENAME CONSTRAINT campaign_tasks_new_campaign_id_fkey TO campaign_tasks_campaign_id_fkey`);
    await queryRunner.query(`ALTER TABLE campaign_tasks RENAME CONSTRAINT fk_campaign_tasks_campaign_tenant_new TO fk_campaign_tasks_campaign_tenant`);
    await queryRunner.query(`ALTER INDEX idx_campaign_tasks_assignee_new RENAME TO idx_campaign_tasks_assignee`);
    await queryRunner.query(`ALTER INDEX idx_campaign_tasks_campaign_new RENAME TO idx_campaign_tasks_campaign`);
    await queryRunner.query(`ALTER INDEX idx_campaign_tasks_due_new RENAME TO idx_campaign_tasks_due`);

    await queryRunner.query(`ALTER TABLE campaign_tasks ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE campaign_tasks FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY campaign_tasks_tenant_select ON campaign_tasks
        AS PERMISSIVE FOR SELECT TO authenticated, musicos_app
        USING (tenant_id = (SELECT app_current_tenant_id()))
    `);
    await queryRunner.query(`
      CREATE POLICY campaign_tasks_tenant_insert ON campaign_tasks
        AS PERMISSIVE FOR INSERT TO authenticated, musicos_app
        WITH CHECK (tenant_id = (SELECT app_current_tenant_id()))
    `);
    await queryRunner.query(`
      CREATE POLICY campaign_tasks_tenant_update ON campaign_tasks
        AS PERMISSIVE FOR UPDATE TO authenticated, musicos_app
        USING (tenant_id = (SELECT app_current_tenant_id()))
        WITH CHECK (tenant_id = (SELECT app_current_tenant_id()))
    `);
    await queryRunner.query(`
      CREATE POLICY campaign_tasks_tenant_delete ON campaign_tasks
        AS PERMISSIVE FOR DELETE TO authenticated, musicos_app
        USING (tenant_id = (SELECT app_current_tenant_id()))
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON campaign_tasks
        AS PERMISSIVE FOR ALL TO public
        USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid)
    `);

    await queryRunner.query(`ALTER TABLE campaign_tasks OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON campaign_tasks TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE campaign_tasks_old`);
    await queryRunner.query(`ANALYZE campaign_tasks`);
  }

  private readonly originalColumns = `
    id            uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id     uuid NOT NULL,
    campaign_id   uuid NOT NULL,
    title         varchar(500) NOT NULL,
    description   text,
    status        varchar(50) NOT NULL DEFAULT 'pending',
    priority      varchar(50) NOT NULL DEFAULT 'medium',
    assigned_to   varchar(255),
    due_date      timestamptz,
    completed_at  timestamptz,
    created_by    varchar(255),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
  `;

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM campaign_tasks`);

    await queryRunner.query(`CREATE TABLE campaign_tasks_restore (${this.originalColumns})`);
    await queryRunner.query(`INSERT INTO campaign_tasks_restore (${this.copyColumns}) SELECT ${this.copyColumns} FROM campaign_tasks`);

    const [{ c: restoredCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM campaign_tasks_restore`);
    if (Number(restoredCount) !== Number(total)) {
      throw new Error(`RebuildCampaignTasksInCanonicalFormOrder.down: contagem divergente (original=${total}, restaurada=${restoredCount}) — abortado.`);
    }

    await queryRunner.query(`ALTER TABLE campaign_tasks_restore ADD CONSTRAINT campaign_tasks_restore_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE campaign_tasks_restore ADD CONSTRAINT campaign_tasks_restore_campaign_id_fkey FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE`);
    await queryRunner.query(`ALTER TABLE campaign_tasks_restore ADD CONSTRAINT fk_campaign_tasks_campaign_tenant_restore FOREIGN KEY (campaign_id, tenant_id) REFERENCES campaigns(id, tenant_id) ON DELETE CASCADE`);
    await queryRunner.query(`CREATE INDEX idx_campaign_tasks_assignee_restore ON campaign_tasks_restore (assigned_to)`);
    await queryRunner.query(`CREATE INDEX idx_campaign_tasks_campaign_restore ON campaign_tasks_restore (tenant_id, campaign_id)`);
    await queryRunner.query(`CREATE INDEX idx_campaign_tasks_due_restore ON campaign_tasks_restore (tenant_id, due_date)`);

    await queryRunner.query(`ALTER TABLE campaign_tasks RENAME TO campaign_tasks_canonical`);
    await queryRunner.query(`ALTER TABLE campaign_tasks_canonical RENAME CONSTRAINT campaign_tasks_pkey TO campaign_tasks_canonical_pkey`);
    await queryRunner.query(`ALTER TABLE campaign_tasks_canonical RENAME CONSTRAINT campaign_tasks_campaign_id_fkey TO campaign_tasks_canonical_campaign_id_fkey`);
    await queryRunner.query(`ALTER TABLE campaign_tasks_canonical RENAME CONSTRAINT fk_campaign_tasks_campaign_tenant TO fk_campaign_tasks_campaign_tenant_canonical`);
    await queryRunner.query(`ALTER INDEX idx_campaign_tasks_assignee RENAME TO idx_campaign_tasks_assignee_canonical`);
    await queryRunner.query(`ALTER INDEX idx_campaign_tasks_campaign RENAME TO idx_campaign_tasks_campaign_canonical`);
    await queryRunner.query(`ALTER INDEX idx_campaign_tasks_due RENAME TO idx_campaign_tasks_due_canonical`);

    await queryRunner.query(`ALTER TABLE campaign_tasks_restore RENAME TO campaign_tasks`);
    await queryRunner.query(`ALTER INDEX campaign_tasks_restore_pkey RENAME TO campaign_tasks_pkey`);
    await queryRunner.query(`ALTER TABLE campaign_tasks RENAME CONSTRAINT campaign_tasks_restore_campaign_id_fkey TO campaign_tasks_campaign_id_fkey`);
    await queryRunner.query(`ALTER TABLE campaign_tasks RENAME CONSTRAINT fk_campaign_tasks_campaign_tenant_restore TO fk_campaign_tasks_campaign_tenant`);
    await queryRunner.query(`ALTER INDEX idx_campaign_tasks_assignee_restore RENAME TO idx_campaign_tasks_assignee`);
    await queryRunner.query(`ALTER INDEX idx_campaign_tasks_campaign_restore RENAME TO idx_campaign_tasks_campaign`);
    await queryRunner.query(`ALTER INDEX idx_campaign_tasks_due_restore RENAME TO idx_campaign_tasks_due`);

    await queryRunner.query(`ALTER TABLE campaign_tasks ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE campaign_tasks FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY campaign_tasks_tenant_select ON campaign_tasks
        AS PERMISSIVE FOR SELECT TO authenticated, musicos_app
        USING (tenant_id = (SELECT app_current_tenant_id()))
    `);
    await queryRunner.query(`
      CREATE POLICY campaign_tasks_tenant_insert ON campaign_tasks
        AS PERMISSIVE FOR INSERT TO authenticated, musicos_app
        WITH CHECK (tenant_id = (SELECT app_current_tenant_id()))
    `);
    await queryRunner.query(`
      CREATE POLICY campaign_tasks_tenant_update ON campaign_tasks
        AS PERMISSIVE FOR UPDATE TO authenticated, musicos_app
        USING (tenant_id = (SELECT app_current_tenant_id()))
        WITH CHECK (tenant_id = (SELECT app_current_tenant_id()))
    `);
    await queryRunner.query(`
      CREATE POLICY campaign_tasks_tenant_delete ON campaign_tasks
        AS PERMISSIVE FOR DELETE TO authenticated, musicos_app
        USING (tenant_id = (SELECT app_current_tenant_id()))
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON campaign_tasks
        AS PERMISSIVE FOR ALL TO public
        USING (tenant_id = (current_setting('app.current_tenant_id', true))::uuid)
    `);

    await queryRunner.query(`ALTER TABLE campaign_tasks OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON campaign_tasks TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE campaign_tasks_canonical`);
    await queryRunner.query(`ANALYZE campaign_tasks`);
  }
}
