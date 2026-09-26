import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 20260831000003_CreateMarketReferenceMetrics
 *
 * Phase 3.1 — fixes the conceptual defect of the Market Benchmark ("cohort =
 * artists of the same tenant" is not a market — a tenant is a security/ownership
 * boundary, not a market population). The real cohort now comes
 * from EXTERNAL artists discovered via Soundcharts `/related` (real candidate
 * discovery, confirmed live) and their own Soundcharts metrics
 * (`/audience/{platform}`, `/streaming/spotify/listening`, fetched
 * directly by the candidate's Soundcharts UUID — without needing the registered
 * link, because the candidate is not a tenant artist).
 *
 * `market_reference_metrics` is a TECHNICAL CACHE deliberately WITHOUT
 * tenant_id and WITHOUT RLS — it contains no tenant-owned data,
 * only public metrics of external artists (third parties, not customers of the
 * product) used as a market reference. Shared across all
 * tenants by design (items 9/10 of Phase 3.1: "do not duplicate thousands of
 * artists per tenant without need" — the same external artist related
 * to two artists of different tenants reuses the same cache row).
 * Unlike artist_metric_snapshots (append-only, an audit of the tenant's OWN
 * data): this table is a cache with a TTL, allows UPDATE
 * (upsert per refresh), because it is not auditable business history — it is a
 * side cache of an idempotent, public API call.
 */
export class CreateMarketReferenceMetrics20260831000003 implements MigrationInterface {
  name = 'CreateMarketReferenceMetrics20260831000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE market_reference_metrics (
        id                     uuid NOT NULL DEFAULT gen_random_uuid(),
        candidate_uuid         text NOT NULL,
        candidate_name         text,
        candidate_country_code varchar(2),
        metric                 varchar(100) NOT NULL,
        value                  numeric,
        unit                   varchar(20) NOT NULL DEFAULT 'count',
        observed_at            timestamptz,
        fetched_at             timestamptz NOT NULL,
        source_provider        varchar(50) NOT NULL DEFAULT 'soundcharts',
        created_at             timestamptz NOT NULL DEFAULT now(),
        updated_at             timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT market_reference_metrics_pkey PRIMARY KEY (id),
        CONSTRAINT market_reference_metrics_unique_point UNIQUE (candidate_uuid, metric)
      )
    `);
    await queryRunner.query(`CREATE INDEX idx_market_reference_metrics_candidate ON market_reference_metrics (candidate_uuid)`);
    await queryRunner.query(`CREATE INDEX idx_market_reference_metrics_fetched_at ON market_reference_metrics (fetched_at)`);

    // No RLS: no tenant column, no tenant-owned data — see the
    // file comment. Never exposed directly by any tenant-scoped
    // endpoint; consumed only internally by
    // MarketBenchmarkService.
    await queryRunner.query(`ALTER TABLE market_reference_metrics OWNER TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON market_reference_metrics TO musicos_migrator`);
    await queryRunner.query(`GRANT SELECT, INSERT, UPDATE ON market_reference_metrics TO musicos_app`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS market_reference_metrics`);
  }
}
