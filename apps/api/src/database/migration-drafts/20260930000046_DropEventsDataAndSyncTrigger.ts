import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';
import { assertConfirmed, bounded, lockTables } from './legacy-column-drop.base';

/**
 * DRAFT, GATED, NOT REGISTERED (LC1). events.data + trigger trg_events_sync_start_columns (BLK-C3-E6).
 * Plan: docs/engineering/legacy-column-drop-plan.md. Requires LEGACY_DROP_CONFIRM at execution time.
 *
 * Why no archive table: events.data is enforced equal to events.starts_at (NOT NULL) by the trigger of
 * 20260928000007, so the precondition `data IS DISTINCT FROM starts_at` = 0 proves the column carries no
 * information; rollback rebuilds it from starts_at.
 *
 * up(): gate, RLS guard, lock_timeout, LOCK TABLE events (SHARE ROW EXCLUSIVE); presence; precondition (diverging rows = 0, NULL starts_at = 0);
 * DROP TRIGGER; DROP FUNCTION; DROP COLUMN data (its index idx_events_tenant_data goes with it; the
 * replacement idx_events_tenant_starts_at exists since 20260716000001 and is asserted present BEFORE the drop).
 * Order matters: the trigger must go first, otherwise it would reference a dropped column.
 * down(): ADD COLUMN data timestamp, UPDATE events SET data = starts_at, SET NOT NULL, recreate function,
 * trigger and idx_events_tenant_data (same definitions as 20260928000007 / InitialSchema).
 */
const FUNCTION_SQL = `
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
  $$;`;

export class DropEventsDataAndSyncTrigger20260930000046 implements MigrationInterface {
  name = 'DropEventsDataAndSyncTrigger20260930000046';

  public async up(queryRunner: QueryRunner): Promise<void> {
    assertConfirmed(this.name);
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    // Writers wait (bounded by lock_timeout) so the precondition holds until the DROP, same as every other draft.
    await lockTables(queryRunner, ['events']);

    const present: Array<{ n: number }> = await queryRunner.query(
      `SELECT count(*)::int AS n FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'events' AND column_name = 'data'`,
    );
    if ((present[0]?.n ?? 0) === 0) return; // already dropped

    const idx: Array<{ ok: boolean }> = await queryRunner.query(`SELECT to_regclass('public.idx_events_tenant_starts_at') IS NOT NULL AS ok`);
    if (!idx[0]?.ok) throw new Error(`${this.name}: replacement index idx_events_tenant_starts_at is missing; refusing to drop events.data.`);

    const bad: Array<{ diverging: number; null_start: number }> = await queryRunner.query(
      `SELECT count(*) FILTER (WHERE "data" IS DISTINCT FROM "starts_at")::int AS diverging,
              count(*) FILTER (WHERE "starts_at" IS NULL)::int AS null_start
       FROM "events"`,
    );
    if ((bad[0]?.diverging ?? 0) > 0 || (bad[0]?.null_start ?? 0) > 0) {
      throw new Error(bounded(`${this.name}: precondition failed: events rows with data <> starts_at: ${bad[0].diverging}; with starts_at NULL: ${bad[0].null_start}. Reconcile before dropping.`));
    }

    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_events_sync_start_columns" ON "events"`);
    await queryRunner.query(`DROP FUNCTION IF EXISTS public.sync_events_start_columns()`);
    await queryRunner.query(`ALTER TABLE "events" DROP COLUMN IF EXISTS "data"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    assertConfirmed(this.name);
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await lockTables(queryRunner, ['events']);
    await queryRunner.query(`ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "data" timestamp`);
    await queryRunner.query(`UPDATE "events" SET "data" = "starts_at" WHERE "data" IS NULL`);
    await queryRunner.query(`ALTER TABLE "events" ALTER COLUMN "data" SET NOT NULL`);
    await queryRunner.query(FUNCTION_SQL);
    await queryRunner.query(`DROP TRIGGER IF EXISTS "trg_events_sync_start_columns" ON "events"`);
    await queryRunner.query(`
      CREATE TRIGGER "trg_events_sync_start_columns"
      BEFORE INSERT OR UPDATE OF "data", "starts_at" ON "events"
      FOR EACH ROW EXECUTE FUNCTION public.sync_events_start_columns()`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "idx_events_tenant_data" ON "events" ("tenant_id", "data")`);
  }
}
