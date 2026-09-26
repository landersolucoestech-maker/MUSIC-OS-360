import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Physical rebuild of `audiovisual_projects` in the canonical order of the
 * real form (AudiovisualProjectFormModal) — 2026-07-19 audit.
 * Same pattern as the previous ones (artists/works/phonograms/releases/projects).
 *
 * Real visual order (3-column grid, row by row): Track (phonogram_id/
 * music_title, with `title` as a derived duplicate sent along) → Artist
 * (artist_name) → Production Type (type) → Format (format) → Director →
 * Videomaker → Editor → Shooting Date (shooting_date) → Shooting
 * Location (location) → Capture/Editing/Approval Status → Pre-Release →
 * Release → Budget (budget_estimated) → Actual Cost (budget_actual) →
 * Initial Script (concept) → Notes. `status`/`final_status` are
 * set by the form's own submit (they have no visible field, but are
 * written on every create/edit); `completed_at`/`publish_date` are set
 * by the status transition logic in the service (never by the form).
 *
 * `artist_id`/`release_id`/`campaign_id`/`event_id`/`financial_project_id`
 * are technical relations: accepted by the DTO and used in filters/joins, but without a
 * dedicated selector in the active production form. `financial_project_id`
 * is always born NULL by design (migration FinancialOperationalBridges
 * 20260718000009 — the link is a future explicit user decision).
 *
 * `slug`/`description`/`objective`/`priority`/`stage`/`production_company`/
 * `producer`/`start_date`/`recording_date`/`delivery_date` are accepted by the
 * DTO but have no matching field in the active form (an earlier era of the
 * domain) — `priority` has a default applied by the service, `description` is
 * read in the search filter, `recording_date` is read as a display fallback
 * of `shooting_date`, `delivery_date` is read in the metrics dashboard.
 * Kept as legacy/reserved (same criterion as `projects.orcamento`).
 *
 * `organization_id`/`archived_at` are removed: proven orphans — absent
 * from CreateAudiovisualProjectDto/UpdateAudiovisualProjectDto, without any
 * reader/writer in any controller/service/UI of the domain (full grep
 * in apps/api/src and apps/web/src/modules/audiovisual) — same pattern as
 * `artists.org_slug`/`projects.data_inicio`.
 */
export class RebuildAudiovisualProjectsInCanonicalFormOrder20260719000006 implements MigrationInterface {
  name = 'RebuildAudiovisualProjectsInCanonicalFormOrder20260719000006';

  private readonly newColumns = `
    id                    uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id             uuid NOT NULL,
    phonogram_id          uuid,
    music_title           varchar(500),
    title                 varchar(500) NOT NULL,
    artist_name           varchar(255),
    type                  varchar(40) NOT NULL DEFAULT 'music_video',
    format                varchar(20),
    director              varchar(255),
    videomaker            varchar(255),
    editor                varchar(255),
    shooting_date         date,
    location              varchar(255),
    capture_status        varchar(30),
    editing_status        varchar(30),
    approval_status       varchar(30),
    pre_release_date      date,
    release_date          date,
    budget_estimated      decimal(15,2),
    budget_actual         decimal(15,2),
    concept               text,
    observations          text,
    status                varchar(30) NOT NULL DEFAULT 'draft',
    final_status          varchar(30),
    completed_at          timestamptz,
    publish_date          date,
    artist_id             uuid,
    release_id            uuid,
    campaign_id           uuid,
    event_id              uuid,
    financial_project_id  uuid,
    slug                  varchar(255),
    description           text,
    objective             text,
    priority              varchar(20) NOT NULL DEFAULT 'normal',
    stage                 varchar(40),
    production_company    varchar(255),
    producer              varchar(255),
    start_date            date,
    recording_date        date,
    delivery_date         date,
    metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    created_by            varchar(255),
    updated_by            varchar(255),
    deleted_at            timestamptz
  `;

  private readonly copyColumns = [
    'id', 'tenant_id', 'phonogram_id', 'music_title', 'title', 'artist_name', 'type', 'format',
    'director', 'videomaker', 'editor', 'shooting_date', 'location', 'capture_status',
    'editing_status', 'approval_status', 'pre_release_date', 'release_date', 'budget_estimated',
    'budget_actual', 'concept', 'observations', 'status', 'final_status', 'completed_at',
    'publish_date', 'artist_id', 'release_id', 'campaign_id', 'event_id', 'financial_project_id',
    'slug', 'description', 'objective', 'priority', 'stage', 'production_company', 'producer',
    'start_date', 'recording_date', 'delivery_date', 'metadata', 'created_at', 'updated_at',
    'created_by', 'updated_by', 'deleted_at',
  ].join(', ');

  private readonly statusCheck =
    `CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'briefing'::character varying, ` +
    `'pre_production'::character varying, 'production'::character varying, 'post_production'::character varying, ` +
    `'approval'::character varying, 'delivered'::character varying, 'published'::character varying, ` +
    `'cancelled'::character varying])::text[])))`;

  private readonly typeCheck =
    `CHECK (((type)::text = ANY ((ARRAY['music_video'::character varying, 'visualizer'::character varying, ` +
    `'lyric_video'::character varying, 'teaser'::character varying, 'reels'::character varying, ` +
    `'backstage'::character varying, 'documentary'::character varying, 'live_session'::character varying, ` +
    `'aftermovie'::character varying, 'promo'::character varying, 'commercial'::character varying, ` +
    `'social_content'::character varying, 'other'::character varying])::text[])))`;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 0. Fail-fast validation: organization_id/archived_at must be genuinely empty.
    const [{ non_null }] = await queryRunner.query(
      `SELECT count(organization_id)::int + count(archived_at)::int AS non_null FROM audiovisual_projects`,
    );
    if (Number(non_null) > 0) {
      throw new Error(
        `RebuildAudiovisualProjectsInCanonicalFormOrder: audiovisual_projects.organization_id/archived_at ` +
        `have ${non_null} non-null value(s) — columns presumed orphaned, but real data exists. Migration aborted.`,
      );
    }
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM audiovisual_projects`);

    await queryRunner.query(`CREATE TABLE audiovisual_projects_new (${this.newColumns})`);
    await queryRunner.query(`INSERT INTO audiovisual_projects_new (${this.copyColumns}) SELECT ${this.copyColumns} FROM audiovisual_projects`);

    const [{ c: newCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM audiovisual_projects_new`);
    if (Number(newCount) !== Number(total)) {
      throw new Error(`RebuildAudiovisualProjectsInCanonicalFormOrder: count mismatch (original=${total}, new=${newCount}) — aborted.`);
    }

    await queryRunner.query(`ALTER TABLE audiovisual_projects_new ADD CONSTRAINT audiovisual_projects_new_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects_new ADD CONSTRAINT chk_av_projects_status_new ${this.statusCheck}`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects_new ADD CONSTRAINT chk_av_projects_type_new ${this.typeCheck}`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects_new ADD CONSTRAINT fk_audiovisual_projects_financial_project_new FOREIGN KEY (tenant_id, financial_project_id) REFERENCES projects(tenant_id, id)`);

    await queryRunner.query(`CREATE INDEX idx_av_projects_tenant_new ON audiovisual_projects_new (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_av_projects_tenant_status_new ON audiovisual_projects_new (tenant_id, status)`);
    await queryRunner.query(`CREATE INDEX idx_av_projects_tenant_type_new ON audiovisual_projects_new (tenant_id, type)`);
    await queryRunner.query(`CREATE INDEX idx_av_projects_tenant_artist_new ON audiovisual_projects_new (tenant_id, artist_id)`);
    await queryRunner.query(`CREATE INDEX idx_av_projects_tenant_release_new ON audiovisual_projects_new (tenant_id, release_id)`);
    await queryRunner.query(`CREATE INDEX idx_av_projects_tenant_campaign_new ON audiovisual_projects_new (tenant_id, campaign_id)`);
    await queryRunner.query(`CREATE INDEX idx_av_projects_tenant_event_new ON audiovisual_projects_new (tenant_id, event_id)`);
    await queryRunner.query(`CREATE INDEX idx_av_projects_tenant_deleted_new ON audiovisual_projects_new (tenant_id, deleted_at)`);
    await queryRunner.query(`CREATE INDEX idx_av_projects_publish_date_new ON audiovisual_projects_new (tenant_id, publish_date)`);
    await queryRunner.query(`CREATE INDEX idx_audiovisual_projects_financial_project_new ON audiovisual_projects_new (tenant_id, financial_project_id)`);

    await queryRunner.query(`ALTER TABLE audiovisual_projects RENAME TO audiovisual_projects_old`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects_old RENAME CONSTRAINT audiovisual_projects_pkey TO audiovisual_projects_old_pkey`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects_old RENAME CONSTRAINT chk_av_projects_status TO chk_av_projects_status_old`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects_old RENAME CONSTRAINT chk_av_projects_type TO chk_av_projects_type_old`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects_old RENAME CONSTRAINT fk_audiovisual_projects_financial_project TO fk_audiovisual_projects_financial_project_old`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant RENAME TO idx_av_projects_tenant_old`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_status RENAME TO idx_av_projects_tenant_status_old`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_type RENAME TO idx_av_projects_tenant_type_old`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_artist RENAME TO idx_av_projects_tenant_artist_old`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_release RENAME TO idx_av_projects_tenant_release_old`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_campaign RENAME TO idx_av_projects_tenant_campaign_old`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_event RENAME TO idx_av_projects_tenant_event_old`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_deleted RENAME TO idx_av_projects_tenant_deleted_old`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_publish_date RENAME TO idx_av_projects_publish_date_old`);
    await queryRunner.query(`ALTER INDEX idx_audiovisual_projects_financial_project RENAME TO idx_audiovisual_projects_financial_project_old`);

    await queryRunner.query(`ALTER TABLE audiovisual_projects_new RENAME TO audiovisual_projects`);
    await queryRunner.query(`ALTER INDEX audiovisual_projects_new_pkey RENAME TO audiovisual_projects_pkey`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects RENAME CONSTRAINT chk_av_projects_status_new TO chk_av_projects_status`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects RENAME CONSTRAINT chk_av_projects_type_new TO chk_av_projects_type`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects RENAME CONSTRAINT fk_audiovisual_projects_financial_project_new TO fk_audiovisual_projects_financial_project`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_new RENAME TO idx_av_projects_tenant`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_status_new RENAME TO idx_av_projects_tenant_status`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_type_new RENAME TO idx_av_projects_tenant_type`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_artist_new RENAME TO idx_av_projects_tenant_artist`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_release_new RENAME TO idx_av_projects_tenant_release`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_campaign_new RENAME TO idx_av_projects_tenant_campaign`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_event_new RENAME TO idx_av_projects_tenant_event`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_deleted_new RENAME TO idx_av_projects_tenant_deleted`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_publish_date_new RENAME TO idx_av_projects_publish_date`);
    await queryRunner.query(`ALTER INDEX idx_audiovisual_projects_financial_project_new RENAME TO idx_audiovisual_projects_financial_project`);

    await queryRunner.query(`ALTER TABLE audiovisual_projects ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON audiovisual_projects
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE audiovisual_projects OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON audiovisual_projects TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE audiovisual_projects_old`);
    await queryRunner.query(`ANALYZE audiovisual_projects`);
  }

  private readonly originalColumns = `
    id                    uuid NOT NULL DEFAULT gen_random_uuid(),
    tenant_id             uuid NOT NULL,
    organization_id       uuid,
    artist_id             uuid,
    release_id            uuid,
    phonogram_id          uuid,
    campaign_id           uuid,
    event_id              uuid,
    title                 varchar(500) NOT NULL,
    slug                  varchar(255),
    type                  varchar(40) NOT NULL DEFAULT 'music_video',
    description           text,
    objective             text,
    status                varchar(30) NOT NULL DEFAULT 'draft',
    priority              varchar(20) NOT NULL DEFAULT 'normal',
    stage                 varchar(40),
    budget_estimated      decimal(15,2),
    budget_actual         decimal(15,2),
    production_company    varchar(255),
    director              varchar(255),
    producer              varchar(255),
    start_date            date,
    recording_date        date,
    delivery_date         date,
    publish_date          date,
    completed_at          timestamptz,
    archived_at           timestamptz,
    metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_by            varchar(255),
    updated_by            varchar(255),
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    deleted_at            timestamptz,
    financial_project_id  uuid,
    music_title           varchar(500),
    artist_name           varchar(255),
    format                varchar(20),
    videomaker            varchar(255),
    editor                varchar(255),
    shooting_date         date,
    location              varchar(255),
    capture_status        varchar(30),
    editing_status        varchar(30),
    approval_status       varchar(30),
    pre_release_date      date,
    release_date          date,
    concept               text,
    observations          text,
    final_status          varchar(30)
  `;

  private readonly restoreCopyColumns = [
    'id', 'tenant_id', 'artist_id', 'release_id', 'phonogram_id', 'campaign_id', 'event_id',
    'title', 'slug', 'type', 'description', 'objective', 'status', 'priority', 'stage',
    'budget_estimated', 'budget_actual', 'production_company', 'director', 'producer',
    'start_date', 'recording_date', 'delivery_date', 'publish_date', 'completed_at', 'metadata',
    'created_by', 'updated_by', 'created_at', 'updated_at', 'deleted_at', 'financial_project_id',
    'music_title', 'artist_name', 'format', 'videomaker', 'editor', 'shooting_date', 'location',
    'capture_status', 'editing_status', 'approval_status', 'pre_release_date', 'release_date',
    'concept', 'observations', 'final_status',
  ].join(', ');

  public async down(queryRunner: QueryRunner): Promise<void> {
    const [{ total }] = await queryRunner.query(`SELECT count(*)::int AS total FROM audiovisual_projects`);

    await queryRunner.query(`CREATE TABLE audiovisual_projects_restore (${this.originalColumns})`);
    // organization_id/archived_at no longer exist (removed in up(), proven
    // orphans) — always NULL on reversal, same pattern as
    // org_slug in RebuildArtistsInCanonicalFormOrder20260719000001.
    await queryRunner.query(`INSERT INTO audiovisual_projects_restore (${this.restoreCopyColumns}) SELECT ${this.restoreCopyColumns} FROM audiovisual_projects`);

    const [{ c: restoredCount }] = await queryRunner.query(`SELECT count(*)::int AS c FROM audiovisual_projects_restore`);
    if (Number(restoredCount) !== Number(total)) {
      throw new Error(`RebuildAudiovisualProjectsInCanonicalFormOrder.down: count mismatch (original=${total}, restored=${restoredCount}) — aborted.`);
    }

    await queryRunner.query(`ALTER TABLE audiovisual_projects_restore ADD CONSTRAINT audiovisual_projects_restore_pkey PRIMARY KEY (id)`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects_restore ADD CONSTRAINT chk_av_projects_status_restore ${this.statusCheck}`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects_restore ADD CONSTRAINT chk_av_projects_type_restore ${this.typeCheck}`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects_restore ADD CONSTRAINT fk_audiovisual_projects_financial_project_restore FOREIGN KEY (tenant_id, financial_project_id) REFERENCES projects(tenant_id, id)`);

    await queryRunner.query(`CREATE INDEX idx_av_projects_tenant_restore ON audiovisual_projects_restore (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_av_projects_tenant_status_restore ON audiovisual_projects_restore (tenant_id, status)`);
    await queryRunner.query(`CREATE INDEX idx_av_projects_tenant_type_restore ON audiovisual_projects_restore (tenant_id, type)`);
    await queryRunner.query(`CREATE INDEX idx_av_projects_tenant_artist_restore ON audiovisual_projects_restore (tenant_id, artist_id)`);
    await queryRunner.query(`CREATE INDEX idx_av_projects_tenant_release_restore ON audiovisual_projects_restore (tenant_id, release_id)`);
    await queryRunner.query(`CREATE INDEX idx_av_projects_tenant_campaign_restore ON audiovisual_projects_restore (tenant_id, campaign_id)`);
    await queryRunner.query(`CREATE INDEX idx_av_projects_tenant_event_restore ON audiovisual_projects_restore (tenant_id, event_id)`);
    await queryRunner.query(`CREATE INDEX idx_av_projects_tenant_deleted_restore ON audiovisual_projects_restore (tenant_id, deleted_at)`);
    await queryRunner.query(`CREATE INDEX idx_av_projects_publish_date_restore ON audiovisual_projects_restore (tenant_id, publish_date)`);
    await queryRunner.query(`CREATE INDEX idx_audiovisual_projects_financial_project_restore ON audiovisual_projects_restore (tenant_id, financial_project_id)`);

    await queryRunner.query(`ALTER TABLE audiovisual_projects RENAME TO audiovisual_projects_canonical`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects_canonical RENAME CONSTRAINT audiovisual_projects_pkey TO audiovisual_projects_canonical_pkey`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects_canonical RENAME CONSTRAINT chk_av_projects_status TO chk_av_projects_status_canonical`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects_canonical RENAME CONSTRAINT chk_av_projects_type TO chk_av_projects_type_canonical`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects_canonical RENAME CONSTRAINT fk_audiovisual_projects_financial_project TO fk_audiovisual_projects_financial_project_canonical`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant RENAME TO idx_av_projects_tenant_canonical`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_status RENAME TO idx_av_projects_tenant_status_canonical`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_type RENAME TO idx_av_projects_tenant_type_canonical`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_artist RENAME TO idx_av_projects_tenant_artist_canonical`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_release RENAME TO idx_av_projects_tenant_release_canonical`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_campaign RENAME TO idx_av_projects_tenant_campaign_canonical`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_event RENAME TO idx_av_projects_tenant_event_canonical`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_deleted RENAME TO idx_av_projects_tenant_deleted_canonical`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_publish_date RENAME TO idx_av_projects_publish_date_canonical`);
    await queryRunner.query(`ALTER INDEX idx_audiovisual_projects_financial_project RENAME TO idx_audiovisual_projects_financial_project_canonical`);

    await queryRunner.query(`ALTER TABLE audiovisual_projects_restore RENAME TO audiovisual_projects`);
    await queryRunner.query(`ALTER INDEX audiovisual_projects_restore_pkey RENAME TO audiovisual_projects_pkey`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects RENAME CONSTRAINT chk_av_projects_status_restore TO chk_av_projects_status`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects RENAME CONSTRAINT chk_av_projects_type_restore TO chk_av_projects_type`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects RENAME CONSTRAINT fk_audiovisual_projects_financial_project_restore TO fk_audiovisual_projects_financial_project`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_restore RENAME TO idx_av_projects_tenant`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_status_restore RENAME TO idx_av_projects_tenant_status`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_type_restore RENAME TO idx_av_projects_tenant_type`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_artist_restore RENAME TO idx_av_projects_tenant_artist`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_release_restore RENAME TO idx_av_projects_tenant_release`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_campaign_restore RENAME TO idx_av_projects_tenant_campaign`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_event_restore RENAME TO idx_av_projects_tenant_event`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_tenant_deleted_restore RENAME TO idx_av_projects_tenant_deleted`);
    await queryRunner.query(`ALTER INDEX idx_av_projects_publish_date_restore RENAME TO idx_av_projects_publish_date`);
    await queryRunner.query(`ALTER INDEX idx_audiovisual_projects_financial_project_restore RENAME TO idx_audiovisual_projects_financial_project`);

    await queryRunner.query(`ALTER TABLE audiovisual_projects ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE audiovisual_projects FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON audiovisual_projects
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE audiovisual_projects OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON audiovisual_projects TO musicos_migrator`);

    await queryRunner.query(`DROP TABLE audiovisual_projects_canonical`);
    await queryRunner.query(`ANALYZE audiovisual_projects`);
  }
}
