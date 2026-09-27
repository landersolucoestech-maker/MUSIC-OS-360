import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * C3 / Phases E3 + E5 — events.data -> events.starts_at (expand-and-contract).
 *
 * E1 (20260716000001) added `starts_at`; E2 made EventsService dual-write it.
 * This migration completes the data side so reads can move to `starts_at` (E4,
 * application code in the same change):
 *
 *   E3  aborting backfill — fails if any row already holds a `starts_at` that
 *       differs from `data` (a divergence must be investigated, never
 *       overwritten), then copies `data` into every NULL `starts_at`;
 *   sync trigger — writers that bypass EventsService (the reports importer,
 *       manual SQL) still keep both columns equal until `data` is dropped:
 *       on INSERT each fills the other when missing; on UPDATE a change to one
 *       is copied to the other;
 *   E5  `starts_at` becomes NOT NULL.
 *
 * E6 (dropping `data`) is destructive and is NOT done here: it needs explicit
 * authorization after a release that only reads `starts_at` is deployed
 * everywhere (canonical naming map blocker).
 *
 * down() removes the NOT NULL, the trigger and its function; backfilled values
 * are left in place (they equal `data`).
 */
export class EventsStartsAtBackfillAndSync20260928000007 implements MigrationInterface {
  name = 'EventsStartsAtBackfillAndSync20260928000007';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const [{ diverging }] = await queryRunner.query(
      `SELECT count(*)::int AS diverging FROM "events" WHERE "starts_at" IS NOT NULL AND "starts_at" <> "data"`,
    );
    if (diverging > 0) {
      throw new Error(
        `EventsStartsAtBackfillAndSync20260928000007: ${diverging} event row(s) have starts_at <> data; ` +
          'investigate the divergence before running the C3/E3 backfill.',
      );
    }
    await queryRunner.query(`UPDATE "events" SET "starts_at" = "data" WHERE "starts_at" IS NULL`);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION public.sync_events_start_columns()
      RETURNS trigger
      LANGUAGE plpgsql
      SET search_path = ''
      AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          NEW.starts_at := COALESCE(NEW.starts_at, NEW.data);
          NEW.data := COALESCE(NEW.data, NEW.starts_at);
        ELSIF NEW.starts_at IS DISTINCT FROM OLD.starts_at AND NEW.data IS NOT DISTINCT FROM OLD.data THEN
          IF NEW.starts_at IS NOT NULL THEN NEW.data := NEW.starts_at; END IF;
        ELSIF NEW.data IS DISTINCT FROM OLD.data AND NEW.starts_at IS NOT DISTINCT FROM OLD.starts_at THEN
          NEW.starts_at := NEW.data;
        END IF;
        RETURN NEW;
      END
      $$;
    `);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_events_sync_start_columns" ON "events"`);
    await queryRunner.query(`
      CREATE TRIGGER "trg_events_sync_start_columns"
      BEFORE INSERT OR UPDATE OF "data", "starts_at" ON "events"
      FOR EACH ROW EXECUTE FUNCTION public.sync_events_start_columns()
    `);

    await queryRunner.query(`ALTER TABLE "events" ALTER COLUMN "starts_at" SET NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "events" ALTER COLUMN "starts_at" DROP NOT NULL`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_events_sync_start_columns" ON "events"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS public.sync_events_start_columns()`);
  }
}
