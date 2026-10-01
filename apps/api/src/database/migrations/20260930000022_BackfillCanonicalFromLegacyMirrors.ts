import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';

/**
 * 20260930000022_BackfillCanonicalFromLegacyMirrors (LC1, EXPAND step; NO DROP)
 *
 * Prerequisite of the gated legacy-column drops (docs/engineering/legacy-column-drop-plan.md). Two
 * additive, idempotent backfills that make the canonical column carry every value the legacy mirror
 * holds, so the readers can move to the canonical column and the mirror can later be retired:
 *
 *   1. invoices.service_amount  <- invoices.legacy_amount   WHERE service_amount IS NULL
 *      (Stripe subscription invoices were written with legacy_amount only; the API now dual-writes
 *       both, see billing.service.ts upsertStripeInvoice). Never overwrites a non-NULL service_amount.
 *   2. takedowns.infringing_url <- takedowns.url            WHERE infringing_url IS NULL AND url IS NOT NULL
 *      (pre-CZ-034 rows only had `url`; the web reads `url` only as a fallback).
 *
 * Nothing is dropped, no column or constraint changes, no value is overwritten. Rollback design: the
 * ids of the rows this migration filled are recorded in two side tables (RLS ENABLED + FORCED, NO
 * policy, every app role revoked: only the BYPASSRLS migration role can touch them, same pattern as
 * contract_service_types_taxonomy_backup_20260930), in the SAME statement as the UPDATE (CTE), so the
 * record cannot diverge from the writes. down() sets the canonical column back to NULL for exactly
 * those ids while it still equals the mirror (a row edited afterwards to a different value is left
 * alone), then drops the side tables. `updated_at` is not touched (mirror normalisation, not an edit).
 *
 * Rows are filled across all tenants: the RLS-bypass guard makes sure no tenant is silently skipped.
 */
const INVOICES_BACKFILL = 'invoices_service_amount_backfill_20260930';
const TAKEDOWNS_BACKFILL = 'takedowns_infringing_url_backfill_20260930';

async function createTrackingTable(queryRunner: QueryRunner, table: string): Promise<void> {
  await queryRunner.query(`
    CREATE TABLE IF NOT EXISTS "${table}" (
      "id" uuid PRIMARY KEY,
      "tenant_id" uuid NOT NULL,
      "backfilled_at" timestamptz NOT NULL DEFAULT now()
    )`);
  await queryRunner.query(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
  await queryRunner.query(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
  await queryRunner.query(`REVOKE ALL ON TABLE "${table}" FROM PUBLIC`);
  await queryRunner.query(`
    DO $$
    DECLARE r text;
    BEGIN
      FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'musicos_app'] LOOP
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
          EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', '${table}', r);
        END IF;
      END LOOP;
    END $$;`);
}

/** Whether a column exists on a public table. takedowns.url was removed by 20260719000016; skip the mirror when it is absent. */
async function hasColumn(queryRunner: QueryRunner, table: string, column: string): Promise<boolean> {
  const rows: Array<{ ok: number }> = await queryRunner.query(
    `SELECT 1 AS ok FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2 LIMIT 1`,
    [table, column],
  );
  return rows.length > 0;
}

async function count(queryRunner: QueryRunner, sql: string): Promise<number> {
  const rows: Array<{ n: number }> = await queryRunner.query(sql);
  return rows[0]?.n ?? 0;
}

export class BackfillCanonicalFromLegacyMirrors20260930000022 implements MigrationInterface {
  name = 'BackfillCanonicalFromLegacyMirrors20260930000022';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await createTrackingTable(queryRunner, INVOICES_BACKFILL);
    await createTrackingTable(queryRunner, TAKEDOWNS_BACKFILL);

    const invoices = await count(queryRunner, `
      WITH moved AS (
        UPDATE "invoices" SET "service_amount" = "legacy_amount"
        WHERE "service_amount" IS NULL AND "legacy_amount" IS NOT NULL
        RETURNING "id", "tenant_id"
      ), recorded AS (
        INSERT INTO "${INVOICES_BACKFILL}" ("id", "tenant_id")
        SELECT "id", "tenant_id" FROM moved ON CONFLICT ("id") DO NOTHING
        RETURNING 1
      )
      SELECT count(*)::int AS n FROM moved`);

    const takedownsMirror = await hasColumn(queryRunner, 'takedowns', 'url');
    const takedowns = !takedownsMirror ? 0 : await count(queryRunner, `
      WITH moved AS (
        UPDATE "takedowns" SET "infringing_url" = "url"
        WHERE "infringing_url" IS NULL AND "url" IS NOT NULL
        RETURNING "id", "tenant_id"
      ), recorded AS (
        INSERT INTO "${TAKEDOWNS_BACKFILL}" ("id", "tenant_id")
        SELECT "id", "tenant_id" FROM moved ON CONFLICT ("id") DO NOTHING
        RETURNING 1
      )
      SELECT count(*)::int AS n FROM moved`);

    // Report only (never abort, never rewrite): both columns set but different. Counts, no values.
    const invoiceDivergent = await count(queryRunner,
      `SELECT count(*)::int AS n FROM "invoices" WHERE "service_amount" IS NOT NULL AND "legacy_amount" IS NOT NULL AND "service_amount" <> "legacy_amount"`);
    const takedownDivergent = !takedownsMirror ? 0 : await count(queryRunner,
      `SELECT count(*)::int AS n FROM "takedowns" WHERE "infringing_url" IS NOT NULL AND "url" IS NOT NULL AND "infringing_url" <> "url"`);
    console.log(
      `[BackfillCanonicalFromLegacyMirrors] invoices.service_amount filled: ${invoices} row(s) (still divergent from legacy_amount, untouched: ${invoiceDivergent}); ` +
        `takedowns.infringing_url filled: ${takedowns} row(s) (still divergent from url, untouched: ${takedownDivergent})` +
        (takedownsMirror ? '' : ' [takedowns.url column absent: mirror skipped]'),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    await queryRunner.query(`
      UPDATE "invoices" i SET "service_amount" = NULL
      FROM "${INVOICES_BACKFILL}" b
      WHERE b."id" = i."id" AND i."service_amount" IS NOT DISTINCT FROM i."legacy_amount"`);
    if (await hasColumn(queryRunner, 'takedowns', 'url')) {
      await queryRunner.query(`
      UPDATE "takedowns" t SET "infringing_url" = NULL
      FROM "${TAKEDOWNS_BACKFILL}" b
      WHERE b."id" = t."id" AND t."infringing_url" IS NOT DISTINCT FROM t."url"`);
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "${INVOICES_BACKFILL}"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "${TAKEDOWNS_BACKFILL}"`);
  }
}
