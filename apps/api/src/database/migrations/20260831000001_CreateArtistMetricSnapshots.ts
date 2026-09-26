import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260831000001_CreateArtistMetricSnapshots
 *
 * Phase 2 — Time-Series Foundation. `artist_platform_profiles` (unique index
 * (tenant_id, artist_id, platform)) is pure current state: every sync does an
 * UPSERT and overwrites followers/subscribers/monthly_listeners/raw_payload —
 * behavior confirmed by reading ArtistPlatformProfilesService.upsertSuccess
 * before this migration. No table in the schema has an
 * append-only metric store per (artist, platform, metric,
 * time) — a prior search of domain_event_log/audit_logs/activity_logs
 * confirmed none is suitable (generic event_type/aggregate_id, no
 * typed metric/value/observed_at column, no index for an
 * artist+metric+time range query).
 *
 * `artist_metric_snapshots` is append-only by design: no
 * UPDATE/DELETE is granted to musicos_app (grants below), and the uniqueness
 * (tenant_id, artist_id, platform, metric, observed_at) is the idempotency
 * key — the same observed_at never duplicates logically (safe retry
 * via ON CONFLICT DO NOTHING in the code, not in this migration).
 */
export class CreateArtistMetricSnapshots20260831000001 implements MigrationInterface {
  name = 'CreateArtistMetricSnapshots20260831000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE artist_metric_snapshots (
        id                         uuid NOT NULL DEFAULT gen_random_uuid(),
        tenant_id                  uuid NOT NULL,
        artist_id                  uuid NOT NULL,
        platform                   varchar(50) NOT NULL,
        metric                     varchar(100) NOT NULL,
        value                      numeric NOT NULL,
        unit                       varchar(20) NOT NULL DEFAULT 'count',
        source_provider            varchar(50) NOT NULL DEFAULT 'soundcharts',
        registered_identifier      text,
        provider_entity_id         text,
        primary_identity_status    varchar(50),
        cross_platform_status      varchar(50),
        observed_at                timestamptz NOT NULL,
        fetched_at                 timestamptz,
        recorded_at                timestamptz NOT NULL DEFAULT now(),
        normalizer_version         smallint NOT NULL DEFAULT 1,
        raw_payload                jsonb NOT NULL DEFAULT '{}',
        created_at                 timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT artist_metric_snapshots_pkey PRIMARY KEY (id),
        CONSTRAINT artist_metric_snapshots_artist_fkey FOREIGN KEY (artist_id) REFERENCES artists(id) ON DELETE CASCADE,
        CONSTRAINT artist_metric_snapshots_unique_point
          UNIQUE (tenant_id, artist_id, platform, metric, observed_at)
      )
    `);

    // The leading index (tenant_id, artist_id, platform, metric, observed_at) already
    // comes from the UNIQUE constraint above and covers the typical "artist +
    // metric + time range" query (Phase 2, item 43) without an additional index.
    await queryRunner.query(`CREATE INDEX idx_artist_metric_snapshots_tenant ON artist_metric_snapshots (tenant_id)`);
    await queryRunner.query(`CREATE INDEX idx_artist_metric_snapshots_observed_at ON artist_metric_snapshots (observed_at)`);

    await queryRunner.query(`ALTER TABLE artist_metric_snapshots ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE artist_metric_snapshots FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY super_admin_full_access ON artist_metric_snapshots
        AS PERMISSIVE FOR ALL TO authenticated
        USING (app_is_super_admin()) WITH CHECK (app_is_super_admin())
    `);
    await queryRunner.query(`
      CREATE POLICY tenant_isolation ON artist_metric_snapshots
        AS PERMISSIVE FOR ALL TO authenticated
        USING (tenant_id = private_get_tenant_id()) WITH CHECK (tenant_id = private_get_tenant_id())
    `);

    await queryRunner.query(`ALTER TABLE artist_metric_snapshots OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON artist_metric_snapshots TO musicos_migrator`);
    // Only SELECT + INSERT for the app — append-only by design (item 15:
    // "IMMUTABLE / APPEND-ORIENTED"), no UPDATE/DELETE even by mistake.
    await queryRunner.query(`GRANT SELECT, INSERT ON artist_metric_snapshots TO musicos_app`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS artist_metric_snapshots`);
  }
}
