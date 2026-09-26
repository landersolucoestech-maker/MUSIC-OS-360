import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 13A / M8 — performance_metric_entries (Phase 12 §2.10; Phase 11 §24).
 *
 * BINDING RULE: a performance metric is NEVER a financial transaction — this
 * table does not reference the financial domain's transactions table and no
 * cross-write path exists (I12). It never generates revenue.
 *
 * - exactly-one target (phonogram | release | artist) with a composite FK;
 * - PROFILE types (followers/subscribers/monthly_listeners) require an artist;
 *   CONSUMPTION types require a phonogram or a release;
 * - quantity = the period's INCREMENT (never cumulative);
 * - anti-duplication: partial UNIQUE NULLS NOT DISTINCT over active entries;
 * - a correction NEVER edits the core nor deletes: a new record + superseded_by_id
 *   on the original (history preserved); physical DELETE blocked by a trigger;
 * - its own RLS in this migration (Phase 12 §14).
 */
export class PerformanceMetricEntries20260718000008 implements MigrationInterface {
  name = 'PerformanceMetricEntries20260718000008';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "performance_metric_entries" (
        "id"                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "tenant_id"          uuid NOT NULL,
        "metric_type"        "performance_metric_type" NOT NULL,
        "platform"           varchar(50) NOT NULL,
        "aggregator"         varchar(100) NULL,
        "phonogram_id"       uuid NULL,
        "release_id"         uuid NULL,
        "artist_id"          uuid NULL,
        "project_id"         uuid NULL,
        "period_start"       date NOT NULL,
        "period_end"         date NOT NULL,
        "quantity"           bigint NOT NULL CHECK ("quantity" >= 0),
        "source"             "metric_source" NOT NULL,
        "external_reference" text NULL,
        "notes"              text NULL,
        "superseded_by_id"   uuid NULL,
        "created_at"         timestamptz NOT NULL DEFAULT now(),
        "updated_at"         timestamptz NOT NULL DEFAULT now(),
        "created_by"         uuid NULL,
        "updated_by"         uuid NULL,
        CONSTRAINT "uq_perf_metric_entries_tenant_id_id" UNIQUE ("tenant_id", "id"),
        CONSTRAINT "ck_metric_period_valid" CHECK ("period_end" >= "period_start"),
        CONSTRAINT "ck_metric_single_target" CHECK (
          num_nonnulls("phonogram_id", "release_id", "artist_id") = 1
        ),
        CONSTRAINT "ck_metric_type_target_compat" CHECK (
          ("metric_type" IN ('followers', 'subscribers', 'monthly_listeners')
             AND "artist_id" IS NOT NULL)
          OR ("metric_type" NOT IN ('followers', 'subscribers', 'monthly_listeners')
             AND ("phonogram_id" IS NOT NULL OR "release_id" IS NOT NULL))
        ),
        CONSTRAINT "ck_metric_no_self_supersede" CHECK ("superseded_by_id" <> "id"),
        CONSTRAINT "fk_metric_phonogram"
          FOREIGN KEY ("tenant_id", "phonogram_id") REFERENCES "phonograms" ("tenant_id", "id"),
        CONSTRAINT "fk_metric_release"
          FOREIGN KEY ("tenant_id", "release_id") REFERENCES "releases" ("tenant_id", "id"),
        CONSTRAINT "fk_metric_artist"
          FOREIGN KEY ("tenant_id", "artist_id") REFERENCES "artists" ("tenant_id", "id"),
        CONSTRAINT "fk_metric_project"
          FOREIGN KEY ("tenant_id", "project_id") REFERENCES "projects" ("tenant_id", "id"),
        CONSTRAINT "fk_metric_superseded_by"
          FOREIGN KEY ("tenant_id", "superseded_by_id")
          REFERENCES "performance_metric_entries" ("tenant_id", "id")
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_metric_active_dedupe"
        ON "performance_metric_entries"
        ("tenant_id", "metric_type", "platform", "phonogram_id", "release_id",
         "artist_id", "period_start", "period_end", "source")
        NULLS NOT DISTINCT
        WHERE "superseded_by_id" IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_metric_tenant_phonogram_period"
        ON "performance_metric_entries" ("tenant_id", "phonogram_id", "period_start")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_metric_tenant_artist_period"
        ON "performance_metric_entries" ("tenant_id", "artist_id", "period_start")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_metric_tenant_platform_type"
        ON "performance_metric_entries" ("tenant_id", "platform", "metric_type")
    `);

    // Immutable core + no physical deletion: corrections only via supersede.
    await queryRunner.query(`
      CREATE FUNCTION "fn_metric_immutability"() RETURNS trigger
      LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'performance_metric_entries: exclusão física proibida — corrija via superseded_by_id';
        END IF;
        IF NEW."metric_type" IS DISTINCT FROM OLD."metric_type"
           OR NEW."platform" IS DISTINCT FROM OLD."platform"
           OR NEW."aggregator" IS DISTINCT FROM OLD."aggregator"
           OR NEW."phonogram_id" IS DISTINCT FROM OLD."phonogram_id"
           OR NEW."release_id" IS DISTINCT FROM OLD."release_id"
           OR NEW."artist_id" IS DISTINCT FROM OLD."artist_id"
           OR NEW."period_start" IS DISTINCT FROM OLD."period_start"
           OR NEW."period_end" IS DISTINCT FROM OLD."period_end"
           OR NEW."quantity" IS DISTINCT FROM OLD."quantity"
           OR NEW."source" IS DISTINCT FROM OLD."source" THEN
          RAISE EXCEPTION 'performance_metric_entries: núcleo da métrica é imutável — crie um registro de correção';
        END IF;
        IF OLD."superseded_by_id" IS NOT NULL
           AND NEW."superseded_by_id" IS DISTINCT FROM OLD."superseded_by_id" THEN
          RAISE EXCEPTION 'performance_metric_entries: correção já registrada não pode ser trocada';
        END IF;
        NEW."updated_at" := now();
        RETURN NEW;
      END $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_metric_immutability"
        BEFORE UPDATE OR DELETE ON "performance_metric_entries"
        FOR EACH ROW EXECUTE FUNCTION "fn_metric_immutability"()
    `);

    // Own RLS (project pattern).
    await queryRunner.query(`ALTER TABLE "performance_metric_entries" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "performance_metric_entries" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`
      CREATE POLICY "performance_metric_entries_isolation" ON "performance_metric_entries"
        USING ("tenant_id" = private_get_tenant_id())
        WITH CHECK ("tenant_id" = private_get_tenant_id())
    `);
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_migrator') THEN
          CREATE POLICY "migrator_admin_all" ON "performance_metric_entries"
            FOR ALL TO "musicos_migrator" USING (true) WITH CHECK (true);
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'musicos_app') THEN
          GRANT SELECT, INSERT, UPDATE ON "performance_metric_entries" TO "musicos_app";
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP POLICY IF EXISTS "migrator_admin_all" ON "performance_metric_entries"`);
    await queryRunner.query(`DROP POLICY "performance_metric_entries_isolation" ON "performance_metric_entries"`);
    await queryRunner.query(`DROP TRIGGER "trg_metric_immutability" ON "performance_metric_entries"`);
    await queryRunner.query(`DROP FUNCTION "fn_metric_immutability"()`);
    await queryRunner.query(`DROP TABLE "performance_metric_entries"`);
  }
}
