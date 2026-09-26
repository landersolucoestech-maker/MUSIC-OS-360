import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Audiovisual — Phase 1 schema.
 *
 * 7 operational tables for the video production cycle:
 *  - audiovisual_projects       (central entity — clip/teaser/visualizer/...)
 *  - audiovisual_briefings      (1:1 with project — concept, references, mood)
 *  - audiovisual_shots          (shotlist — N per project)
 *  - audiovisual_production_days(shoot control — N per project)
 *  - audiovisual_team_members   (team involved)
 *  - audiovisual_deliverables   (final deliverables — youtube_master, reels, etc.)
 *  - audiovisual_approvals      (approvals per project or per deliverable)
 *
 * Reuse of existing entities via nullable UUID without a hard FK constraint
 * (repo pattern): artist_id, release_id, phonogram_id, campaign_id, event_id.
 *
 * Multi-tenant: every table has tenant_id NOT NULL. Soft delete via deleted_at.
 */
export class AudiovisualPhase120260527000003 implements MigrationInterface {
  name = 'AudiovisualPhase120260527000003';

  async up(qr: QueryRunner): Promise<void> {
    // ── audiovisual_projects ─────────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS audiovisual_projects (
        id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id           UUID NOT NULL,
        organization_id     UUID,
        artist_id           UUID,
        release_id          UUID,
        phonogram_id        UUID,
        campaign_id         UUID,
        event_id            UUID,
        title               VARCHAR(500) NOT NULL,
        slug                VARCHAR(255),
        type                VARCHAR(40)  NOT NULL DEFAULT 'music_video',
        description         TEXT,
        objective           TEXT,
        status              VARCHAR(30)  NOT NULL DEFAULT 'draft',
        priority            VARCHAR(20)  NOT NULL DEFAULT 'normal',
        stage               VARCHAR(40),
        budget_estimated    DECIMAL(15,2),
        budget_actual       DECIMAL(15,2),
        production_company  VARCHAR(255),
        director            VARCHAR(255),
        producer            VARCHAR(255),
        start_date          DATE,
        recording_date      DATE,
        delivery_date       DATE,
        publish_date        DATE,
        completed_at        TIMESTAMPTZ,
        archived_at         TIMESTAMPTZ,
        metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by          VARCHAR(255),
        updated_by          VARCHAR(255),
        created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at          TIMESTAMPTZ,
        CONSTRAINT chk_av_projects_type CHECK (
          type IN (
            'music_video','visualizer','lyric_video','teaser','reels','backstage',
            'documentary','live_session','aftermovie','promo','commercial',
            'social_content','other'
          )
        ),
        CONSTRAINT chk_av_projects_status CHECK (
          status IN (
            'draft','briefing','pre_production','production','post_production',
            'approval','delivered','published','cancelled'
          )
        )
      );
      CREATE INDEX IF NOT EXISTS idx_av_projects_tenant         ON audiovisual_projects (tenant_id);
      CREATE INDEX IF NOT EXISTS idx_av_projects_tenant_status  ON audiovisual_projects (tenant_id, status);
      CREATE INDEX IF NOT EXISTS idx_av_projects_tenant_type    ON audiovisual_projects (tenant_id, type);
      CREATE INDEX IF NOT EXISTS idx_av_projects_tenant_artist  ON audiovisual_projects (tenant_id, artist_id);
      CREATE INDEX IF NOT EXISTS idx_av_projects_tenant_release ON audiovisual_projects (tenant_id, release_id);
      CREATE INDEX IF NOT EXISTS idx_av_projects_tenant_campaign ON audiovisual_projects (tenant_id, campaign_id);
      CREATE INDEX IF NOT EXISTS idx_av_projects_tenant_event   ON audiovisual_projects (tenant_id, event_id);
      CREATE INDEX IF NOT EXISTS idx_av_projects_tenant_deleted ON audiovisual_projects (tenant_id, deleted_at);
      CREATE INDEX IF NOT EXISTS idx_av_projects_publish_date   ON audiovisual_projects (tenant_id, publish_date);
    `);

    // ── audiovisual_briefings (1:1 com project) ──────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS audiovisual_briefings (
        id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                UUID NOT NULL,
        audiovisual_project_id   UUID NOT NULL UNIQUE,
        concept                  TEXT,
        visual_style             TEXT,
        references_list          JSONB NOT NULL DEFAULT '[]'::jsonb,
        target_audience          TEXT,
        platforms                JSONB NOT NULL DEFAULT '[]'::jsonb,
        format_requirements      TEXT,
        aspect_ratios            JSONB NOT NULL DEFAULT '[]'::jsonb,
        color_palette            JSONB NOT NULL DEFAULT '[]'::jsonb,
        moodboard_links          JSONB NOT NULL DEFAULT '[]'::jsonb,
        inspiration_notes        TEXT,
        campaign_alignment       TEXT,
        artist_notes             TEXT,
        manager_notes            TEXT,
        technical_notes          TEXT,
        metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_by               VARCHAR(255),
        updated_by               VARCHAR(255),
        created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_av_briefings_tenant  ON audiovisual_briefings (tenant_id);
      CREATE INDEX IF NOT EXISTS idx_av_briefings_project ON audiovisual_briefings (tenant_id, audiovisual_project_id);
    `);

    // ── audiovisual_shots ────────────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS audiovisual_shots (
        id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                UUID NOT NULL,
        audiovisual_project_id   UUID NOT NULL,
        ordering                 INTEGER NOT NULL DEFAULT 0,
        scene_title              VARCHAR(255),
        description              TEXT,
        location                 VARCHAR(255),
        actors                   JSONB NOT NULL DEFAULT '[]'::jsonb,
        props                    JSONB NOT NULL DEFAULT '[]'::jsonb,
        wardrobe                 JSONB NOT NULL DEFAULT '[]'::jsonb,
        equipment                JSONB NOT NULL DEFAULT '[]'::jsonb,
        estimated_duration_sec   INTEGER,
        notes                    TEXT,
        shooting_status          VARCHAR(20) NOT NULL DEFAULT 'pending',
        metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at               TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_av_shots_tenant  ON audiovisual_shots (tenant_id);
      CREATE INDEX IF NOT EXISTS idx_av_shots_project ON audiovisual_shots (tenant_id, audiovisual_project_id, ordering);
    `);

    // ── audiovisual_production_days ──────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS audiovisual_production_days (
        id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                UUID NOT NULL,
        audiovisual_project_id   UUID NOT NULL,
        shooting_date            DATE NOT NULL,
        call_time                TIME,
        end_time                 TIME,
        location                 VARCHAR(255),
        weather_notes            TEXT,
        team_notes               TEXT,
        production_notes         TEXT,
        status                   VARCHAR(20) NOT NULL DEFAULT 'scheduled',
        metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_av_pdays_tenant   ON audiovisual_production_days (tenant_id);
      CREATE INDEX IF NOT EXISTS idx_av_pdays_project  ON audiovisual_production_days (tenant_id, audiovisual_project_id, shooting_date);
    `);

    // ── audiovisual_team_members ─────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS audiovisual_team_members (
        id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                UUID NOT NULL,
        audiovisual_project_id   UUID NOT NULL,
        user_id                  UUID,
        external_name            VARCHAR(255),
        role                     VARCHAR(40) NOT NULL DEFAULT 'other',
        contact                  VARCHAR(255),
        payment_amount           DECIMAL(15,2),
        payment_status           VARCHAR(20) NOT NULL DEFAULT 'pending',
        notes                    TEXT,
        metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at               TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_av_team_tenant  ON audiovisual_team_members (tenant_id);
      CREATE INDEX IF NOT EXISTS idx_av_team_project ON audiovisual_team_members (tenant_id, audiovisual_project_id);
      CREATE INDEX IF NOT EXISTS idx_av_team_user    ON audiovisual_team_members (tenant_id, user_id);
    `);

    // ── audiovisual_deliverables ─────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS audiovisual_deliverables (
        id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                UUID NOT NULL,
        audiovisual_project_id   UUID NOT NULL,
        title                    VARCHAR(500) NOT NULL,
        type                     VARCHAR(40) NOT NULL DEFAULT 'youtube_master',
        platform                 VARCHAR(50),
        format                   VARCHAR(50),
        resolution               VARCHAR(20),
        duration_sec             INTEGER,
        version                  INTEGER NOT NULL DEFAULT 1,
        status                   VARCHAR(20) NOT NULL DEFAULT 'draft',
        approved                 BOOLEAN NOT NULL DEFAULT false,
        published                BOOLEAN NOT NULL DEFAULT false,
        file_url                 TEXT,
        thumbnail_url            TEXT,
        published_at             TIMESTAMPTZ,
        delivery_notes           TEXT,
        metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
        created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at               TIMESTAMPTZ,
        CONSTRAINT chk_av_deliverables_type CHECK (
          type IN (
            'youtube_master','vertical_reels','tiktok_cut','teaser','thumbnail',
            'subtitles','backstage_cut','trailer','stories','ads','short_clip','other'
          )
        )
      );
      CREATE INDEX IF NOT EXISTS idx_av_deliverables_tenant   ON audiovisual_deliverables (tenant_id);
      CREATE INDEX IF NOT EXISTS idx_av_deliverables_project  ON audiovisual_deliverables (tenant_id, audiovisual_project_id);
      CREATE INDEX IF NOT EXISTS idx_av_deliverables_status   ON audiovisual_deliverables (tenant_id, status);
      CREATE INDEX IF NOT EXISTS idx_av_deliverables_deleted  ON audiovisual_deliverables (tenant_id, deleted_at);
    `);

    // ── audiovisual_approvals ────────────────────────────────────────────────
    await qr.query(`
      CREATE TABLE IF NOT EXISTS audiovisual_approvals (
        id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id                UUID NOT NULL,
        audiovisual_project_id   UUID NOT NULL,
        deliverable_id           UUID,
        requested_by             VARCHAR(255),
        approved_by              VARCHAR(255),
        rejected_by              VARCHAR(255),
        status                   VARCHAR(30) NOT NULL DEFAULT 'pending',
        comments                 TEXT,
        revision_round           INTEGER NOT NULL DEFAULT 1,
        requested_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        approved_at              TIMESTAMPTZ,
        rejected_at              TIMESTAMPTZ,
        metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
        CONSTRAINT chk_av_approvals_status CHECK (
          status IN ('pending','approved','rejected','revision_requested')
        )
      );
      CREATE INDEX IF NOT EXISTS idx_av_approvals_tenant      ON audiovisual_approvals (tenant_id);
      CREATE INDEX IF NOT EXISTS idx_av_approvals_project     ON audiovisual_approvals (tenant_id, audiovisual_project_id, requested_at DESC);
      CREATE INDEX IF NOT EXISTS idx_av_approvals_deliverable ON audiovisual_approvals (tenant_id, deliverable_id);
      CREATE INDEX IF NOT EXISTS idx_av_approvals_status      ON audiovisual_approvals (tenant_id, status);
    `);
  }

  async down(qr: QueryRunner): Promise<void> {
    await qr.query(`DROP TABLE IF EXISTS audiovisual_approvals;`);
    await qr.query(`DROP TABLE IF EXISTS audiovisual_deliverables;`);
    await qr.query(`DROP TABLE IF EXISTS audiovisual_team_members;`);
    await qr.query(`DROP TABLE IF EXISTS audiovisual_production_days;`);
    await qr.query(`DROP TABLE IF EXISTS audiovisual_shots;`);
    await qr.query(`DROP TABLE IF EXISTS audiovisual_briefings;`);
    await qr.query(`DROP TABLE IF EXISTS audiovisual_projects;`);
  }
}
