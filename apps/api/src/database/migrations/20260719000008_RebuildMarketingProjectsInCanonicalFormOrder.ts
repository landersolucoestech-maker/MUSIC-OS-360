import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical rebuild of `marketing_projects` — 2026-07-19 audit.
 *
 * IMPORTANT DIFFERENCE from the previous tables: there is no real
 * visual form to create/edit a `MarketingProject` — `projectFields`/
 * `useCreateProject`/`useUpdateProject` (apps/web/src/modules/marketing/forms/
 * marketing-forms.ts, hooks/useMarketingProjects.ts) are exported but never
 * imported by any page; the only read is a read-only list
 * used by Tarefas.tsx to populate the task's project selector. In the
 * absence of a real render tree, the canonical order follows the order
 * declared in `CreateMarketingProjectDto` (apps/api/.../marketing-projects.dto.ts),
 * which is the only contract actually exercised (via `POST/PATCH /marketing/projects`,
 * called by `projectsApi.create/update` in marketing.service.ts) — and which already
 * matches the current physical order, except for three points fixed here:
 *
 * 1. `organization_id` does not exist in the DTO and has no reader/writer in the
 *    module — a proven orphan, removed (same criterion as artists.org_slug).
 * 2. `financial_project_id` (optional financial bridge, migration
 *    FinancialOperationalBridges 20260718000009 — always born NULL by
 *    design) was after `deleted_at`; moved next to the other technical
 *    relations (source_project_id..campaign_id).
 * 3. The audit block was `created_by, updated_by, created_at, updated_at,
 *    deleted_at`; fixed to `created_at, updated_at, created_by,
 *    updated_by, deleted_at` (the canonical pattern of the previous rebuilds).
 */
export class RebuildMarketingProjectsInCanonicalFormOrder20260719000008 implements MigrationInterface {
  name = 'RebuildMarketingProjectsInCanonicalFormOrder20260719000008';

  private readonly newColumns = `
    id                    uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id             uuid NOT NULL,
    type                  varchar(40) NOT NULL,
    title                 varchar(500) NOT NULL,
    description           text,
    status                varchar(30) NOT NULL DEFAULT 'draft',
    priority              varchar(20) NOT NULL DEFAULT 'normal',
    source_project_id     uuid,
    artist_id             uuid,
    company_id            uuid,
    label_id              uuid,
    publisher_id          uuid,
    studio_id             uuid,
    event_id              uuid,
    campaign_id           uuid,
    financial_project_id  uuid,
    starts_at             date,
    ends_at               date,
    goals                 jsonb NOT NULL DEFAULT '{}'::jsonb,
    metrics               jsonb NOT NULL DEFAULT '{}'::jsonb,
    context               jsonb NOT NULL DEFAULT '{}'::jsonb,
    metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    created_by            varchar(255),
    updated_by            varchar(255),
    deleted_at            timestamptz
  `;

  private readonly copyColumns = [
    'id', 'tenant_id', 'type', 'title', 'description', 'status', 'priority',
    'source_project_id', 'artist_id', 'company_id', 'label_id', 'publisher_id', 'studio_id',
    'event_id', 'campaign_id', 'financial_project_id', 'starts_at', 'ends_at', 'goals',
    'metrics', 'context', 'metadata', 'created_at', 'updated_at', 'created_by', 'updated_by',
    'deleted_at',
  ].join(', ');

  private readonly typeCheck =
    `CHECK (((type)::text = ANY ((ARRAY['MUSIC_PROJECT'::character varying, 'ARTIST'::character varying, ` +
    `'COMPANY'::character varying, 'LABEL'::character varying, 'PUBLISHER'::character varying, ` +
    `'STUDIO'::character varying, 'EVENT'::character varying, 'CONTENT'::character varying, ` +
    `'CAMPAIGN'::character varying, 'BRANDING'::character varying, 'CORPORATE'::character varying, ` +
    `'PRODUCT'::character varying, 'CUSTOM'::character varying])::text[])))`;

  private readonly statusCheck =
    `CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'planning'::character varying, ` +
    `'active'::character varying, 'paused'::character varying, 'completed'::character varying, ` +
    `'cancelled'::character varying, 'archived'::character varying])::text[])))`;

  private readonly priorityCheck =
    `CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'normal'::character varying, ` +
    `'high'::character varying, 'urgent'::character varying])::text[])))`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ non_null }] = await queryRunner.query(`SELECT count(organization_id)::int AS non_null FROM marketing_projects`);
    if (Number(non_null) > 0) {
      throw new Error(
        `RebuildMarketingProjectsInCanonicalFormOrder: marketing_projects.organization_id has ${non_null} ` +
        `non-null value(s) — column presumed orphaned, but real data exists. Migration aborted.`,
      );
    }
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM marketing_projects`);

    await queryRunner.query(`CREATE TABLE marketing_projects_new (${this.newColumns})`);
    await queryRunner.query(`INSERT INTO marketing_projects_new (${this.copyColumns}) SELECT ${this.copyColumns} FROM marketing_projects`);

    const [{ c: newCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM marketing_projects_new`);
    if (Number(newCount) !== Number(total)) {
      throw new Error(`RebuildMarketingProjectsInCanonicalFormOrder: count mismatch (original=${total}, new=${newCount}) — aborted.`);
    }

    await queryRunner.query(`ALTER TABLE marketing_projects_new ADD CONSTRAINT marketing_projects_new_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE marketing_projects_new ADD CONSTRAINT chk_marketing_projects_type_new ${this.typeCheck}`);
    await queryRunner.query(`ALTER TABLE marketing_projects_new ADD CONSTRAINT chk_marketing_projects_status_new ${this.statusCheck}`);
    await queryRunner.query(`ALTER TABLE marketing_projects_new ADD CONSTRAINT chk_marketing_projects_priority_new ${this.priorityCheck}`);
    await queryRunner.query(`ALTER TABLE marketing_projects_new ADD CONSTRAINT fk_marketing_projects_financial_project_new FOREIGN KEY (tenant_id, financial_project_id) REFERENCES projects(tenant_id, id)`);

    await queryRunner.query(`CREATE INDEX idx_marketing_projects_tenant_new ON marketing_projects_new (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_marketing_projects_tenant_type_new ON marketing_projects_new (tenant_id, type)`);
    await queryRunner.query(`CREATE INDEX idx_marketing_projects_tenant_status_new ON marketing_projects_new (tenant_id, status)`);
    await queryRunner.query(`CREATE INDEX idx_marketing_projects_artist_new ON marketing_projects_new (tenant_id, artist_id)`);
    await queryRunner.query(`CREATE INDEX idx_marketing_projects_campaign_new ON marketing_projects_new (tenant_id, campaign_id)`);
    await queryRunner.query(`CREATE INDEX idx_marketing_projects_deleted_new ON marketing_projects_new (tenant_id, deleted_at)`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_marketing_projects_source_project_new ON marketing_projects_new (tenant_id, source_project_id) WHERE (source_project_id IS NOT NULL AND deleted_at IS NULL)`);
    await queryRunner.query(`CREATE INDEX idx_marketing_projects_financial_project_new ON marketing_projects_new (tenant_id, financial_project_id)`);

    await queryRunner.query(`ALTER TABLE marketing_projects RENAME TO marketing_projects_old`);
    await queryRunner.query(`ALTER TABLE marketing_projects_old RENAME CONSTRAINT marketing_projects_pkey TO marketing_projects_old_pkey`);
    await queryRunner.query(`ALTER TABLE marketing_projects_old RENAME CONSTRAINT chk_marketing_projects_type TO chk_marketing_projects_type_old`);
    await queryRunner.query(`ALTER TABLE marketing_projects_old RENAME CONSTRAINT chk_marketing_projects_status TO chk_marketing_projects_status_old`);
    await queryRunner.query(`ALTER TABLE marketing_projects_old RENAME CONSTRAINT chk_marketing_projects_priority TO chk_marketing_projects_priority_old`);
    await queryRunner.query(`ALTER TABLE marketing_projects_old RENAME CONSTRAINT fk_marketing_projects_financial_project TO fk_marketing_projects_financial_project_old`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_tenant RENAME TO idx_marketing_projects_tenant_old`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_tenant_type RENAME TO idx_marketing_projects_tenant_type_old`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_tenant_status RENAME TO idx_marketing_projects_tenant_status_old`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_artist RENAME TO idx_marketing_projects_artist_old`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_campaign RENAME TO idx_marketing_projects_campaign_old`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_deleted RENAME TO idx_marketing_projects_deleted_old`);
    await queryRunner.query(`ALTER INDEX uq_marketing_projects_source_project RENAME TO uq_marketing_projects_source_project_old`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_financial_project RENAME TO idx_marketing_projects_financial_project_old`);

    await queryRunner.query(`ALTER TABLE marketing_projects_new RENAME TO marketing_projects`);
    await queryRunner.query(`ALTER INDEX marketing_projects_new_pkey RENAME TO marketing_projects_pkey`);
    await queryRunner.query(`ALTER TABLE marketing_projects RENAME CONSTRAINT chk_marketing_projects_type_new TO chk_marketing_projects_type`);
    await queryRunner.query(`ALTER TABLE marketing_projects RENAME CONSTRAINT chk_marketing_projects_status_new TO chk_marketing_projects_status`);
    await queryRunner.query(`ALTER TABLE marketing_projects RENAME CONSTRAINT chk_marketing_projects_priority_new TO chk_marketing_projects_priority`);
    await queryRunner.query(`ALTER TABLE marketing_projects RENAME CONSTRAINT fk_marketing_projects_financial_project_new TO fk_marketing_projects_financial_project`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_tenant_new RENAME TO idx_marketing_projects_tenant`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_tenant_type_new RENAME TO idx_marketing_projects_tenant_type`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_tenant_status_new RENAME TO idx_marketing_projects_tenant_status`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_artist_new RENAME TO idx_marketing_projects_artist`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_campaign_new RENAME TO idx_marketing_projects_campaign`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_deleted_new RENAME TO idx_marketing_projects_deleted`);
    await queryRunner.query(`ALTER INDEX uq_marketing_projects_source_project_new RENAME TO uq_marketing_projects_source_project`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_financial_project_new RENAME TO idx_marketing_projects_financial_project`);

    await queryRunner.query(`ALTER TABLE marketing_projects ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE marketing_projects FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON marketing_projects
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE marketing_projects OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON marketing_projects TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE marketing_projects_old`);
    await queryRunner.query(`ANALYZE marketing_projects`);
  }

  private readonly originalColumns = `
    id                    uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id             uuid NOT NULL,
    organization_id       uuid,
    type                  varchar(40) NOT NULL,
    title                 varchar(500) NOT NULL,
    description           text,
    status                varchar(30) NOT NULL DEFAULT 'draft',
    priority              varchar(20) NOT NULL DEFAULT 'normal',
    source_project_id     uuid,
    artist_id             uuid,
    company_id            uuid,
    label_id              uuid,
    publisher_id          uuid,
    studio_id             uuid,
    event_id              uuid,
    campaign_id           uuid,
    starts_at             date,
    ends_at               date,
    goals                 jsonb NOT NULL DEFAULT '{}'::jsonb,
    metrics               jsonb NOT NULL DEFAULT '{}'::jsonb,
    context               jsonb NOT NULL DEFAULT '{}'::jsonb,
    metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by            varchar(255),
    updated_by            varchar(255),
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    deleted_at            timestamptz,
    financial_project_id  uuid
  `;

  private readonly restoreCopyColumns = [
    'id', 'tenant_id', 'type', 'title', 'description', 'status', 'priority',
    'source_project_id', 'artist_id', 'company_id', 'label_id', 'publisher_id', 'studio_id',
    'event_id', 'campaign_id', 'starts_at', 'ends_at', 'goals', 'metrics', 'context', 'metadata',
    'created_by', 'updated_by', 'created_at', 'updated_at', 'deleted_at', 'financial_project_id',
  ].join(', ');

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM marketing_projects`);

    await queryRunner.query(`CREATE TABLE marketing_projects_restore (${this.originalColumns})`);
    // organization_id no longer exists (removed in up(), proven
    // orphan) — always NULL on reversal, same pattern as org_slug in
    // RebuildArtistsInCanonicalFormOrder20260719000001.
    await queryRunner.query(`INSERT INTO marketing_projects_restore (${this.restoreCopyColumns}) SELECT ${this.restoreCopyColumns} FROM marketing_projects`);

    const [{ c: restoredCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM marketing_projects_restore`);
    if (Number(restoredCount) !== Number(total)) {
      throw new Error(`RebuildMarketingProjectsInCanonicalFormOrder.down: count mismatch (original=${total}, restored=${restoredCount}) — aborted.`);
    }

    await queryRunner.query(`ALTER TABLE marketing_projects_restore ADD CONSTRAINT marketing_projects_restore_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE marketing_projects_restore ADD CONSTRAINT chk_marketing_projects_type_restore ${this.typeCheck}`);
    await queryRunner.query(`ALTER TABLE marketing_projects_restore ADD CONSTRAINT chk_marketing_projects_status_restore ${this.statusCheck}`);
    await queryRunner.query(`ALTER TABLE marketing_projects_restore ADD CONSTRAINT chk_marketing_projects_priority_restore ${this.priorityCheck}`);
    await queryRunner.query(`ALTER TABLE marketing_projects_restore ADD CONSTRAINT fk_marketing_projects_financial_project_restore FOREIGN KEY (tenant_id, financial_project_id) REFERENCES projects(tenant_id, id)`);

    await queryRunner.query(`CREATE INDEX idx_marketing_projects_tenant_restore ON marketing_projects_restore (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_marketing_projects_tenant_type_restore ON marketing_projects_restore (tenant_id, type)`);
    await queryRunner.query(`CREATE INDEX idx_marketing_projects_tenant_status_restore ON marketing_projects_restore (tenant_id, status)`);
    await queryRunner.query(`CREATE INDEX idx_marketing_projects_artist_restore ON marketing_projects_restore (tenant_id, artist_id)`);
    await queryRunner.query(`CREATE INDEX idx_marketing_projects_campaign_restore ON marketing_projects_restore (tenant_id, campaign_id)`);
    await queryRunner.query(`CREATE INDEX idx_marketing_projects_deleted_restore ON marketing_projects_restore (tenant_id, deleted_at)`);
    await queryRunner.query(`CREATE UNIQUE INDEX uq_marketing_projects_source_project_restore ON marketing_projects_restore (tenant_id, source_project_id) WHERE (source_project_id IS NOT NULL AND deleted_at IS NULL)`);
    await queryRunner.query(`CREATE INDEX idx_marketing_projects_financial_project_restore ON marketing_projects_restore (tenant_id, financial_project_id)`);

    await queryRunner.query(`ALTER TABLE marketing_projects RENAME TO marketing_projects_canonical`);
    await queryRunner.query(`ALTER TABLE marketing_projects_canonical RENAME CONSTRAINT marketing_projects_pkey TO marketing_projects_canonical_pkey`);
    await queryRunner.query(`ALTER TABLE marketing_projects_canonical RENAME CONSTRAINT chk_marketing_projects_type TO chk_marketing_projects_type_canonical`);
    await queryRunner.query(`ALTER TABLE marketing_projects_canonical RENAME CONSTRAINT chk_marketing_projects_status TO chk_marketing_projects_status_canonical`);
    await queryRunner.query(`ALTER TABLE marketing_projects_canonical RENAME CONSTRAINT chk_marketing_projects_priority TO chk_marketing_projects_priority_canonical`);
    await queryRunner.query(`ALTER TABLE marketing_projects_canonical RENAME CONSTRAINT fk_marketing_projects_financial_project TO fk_marketing_projects_financial_project_canonical`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_tenant RENAME TO idx_marketing_projects_tenant_canonical`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_tenant_type RENAME TO idx_marketing_projects_tenant_type_canonical`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_tenant_status RENAME TO idx_marketing_projects_tenant_status_canonical`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_artist RENAME TO idx_marketing_projects_artist_canonical`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_campaign RENAME TO idx_marketing_projects_campaign_canonical`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_deleted RENAME TO idx_marketing_projects_deleted_canonical`);
    await queryRunner.query(`ALTER INDEX uq_marketing_projects_source_project RENAME TO uq_marketing_projects_source_project_canonical`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_financial_project RENAME TO idx_marketing_projects_financial_project_canonical`);

    await queryRunner.query(`ALTER TABLE marketing_projects_restore RENAME TO marketing_projects`);
    await queryRunner.query(`ALTER INDEX marketing_projects_restore_pkey RENAME TO marketing_projects_pkey`);
    await queryRunner.query(`ALTER TABLE marketing_projects RENAME CONSTRAINT chk_marketing_projects_type_restore TO chk_marketing_projects_type`);
    await queryRunner.query(`ALTER TABLE marketing_projects RENAME CONSTRAINT chk_marketing_projects_status_restore TO chk_marketing_projects_status`);
    await queryRunner.query(`ALTER TABLE marketing_projects RENAME CONSTRAINT chk_marketing_projects_priority_restore TO chk_marketing_projects_priority`);
    await queryRunner.query(`ALTER TABLE marketing_projects RENAME CONSTRAINT fk_marketing_projects_financial_project_restore TO fk_marketing_projects_financial_project`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_tenant_restore RENAME TO idx_marketing_projects_tenant`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_tenant_type_restore RENAME TO idx_marketing_projects_tenant_type`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_tenant_status_restore RENAME TO idx_marketing_projects_tenant_status`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_artist_restore RENAME TO idx_marketing_projects_artist`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_campaign_restore RENAME TO idx_marketing_projects_campaign`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_deleted_restore RENAME TO idx_marketing_projects_deleted`);
    await queryRunner.query(`ALTER INDEX uq_marketing_projects_source_project_restore RENAME TO uq_marketing_projects_source_project`);
    await queryRunner.query(`ALTER INDEX idx_marketing_projects_financial_project_restore RENAME TO idx_marketing_projects_financial_project`);

    await queryRunner.query(`ALTER TABLE marketing_projects ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE marketing_projects FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON marketing_projects
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE marketing_projects OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON marketing_projects TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE marketing_projects_canonical`);
    await queryRunner.query(`ANALYZE marketing_projects`);
  }
}
