import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';

/**
 * 20261005200001_BackfillInvoicesFileUrlFromUrlPdf (EXPAND step; NO DROP)
 *
 * invoices.file_url is the canonical document URL; invoices.url_pdf is the pre-rename form column
 * that InvoicesService now mirrors from file_url on every write. Rows written before the dual write
 * only have url_pdf. This additive, idempotent backfill fills file_url from url_pdf WHERE file_url IS
 * NULL, so readers no longer depend on the `file_url ?? url_pdf` fallback and url_pdf can later be
 * retired (removal condition: docs/naming ledger row for invoices.url_pdf).
 *
 * Never overwrites a non-NULL file_url, never drops/alters a column or constraint, never touches
 * updated_at. Rollback: the ids of the filled rows are recorded in a side table (RLS ENABLED +
 * FORCED, no policy, app roles revoked: only the BYPASSRLS migration role can touch it) in the SAME
 * statement as the UPDATE; down() nulls file_url for exactly those ids while it still equals url_pdf,
 * then drops the side table. Same pattern as 20260930000022.
 */
const BACKFILL_TABLE = 'invoices_file_url_backfill_20261005';

async function hasTable(queryRunner: QueryRunner, table: string): Promise<boolean> {
  const rows: Array<{ t: string | null }> = await queryRunner.query(`SELECT to_regclass($1) AS t`, [`public."${table}"`]);
  return rows[0]?.t != null;
}

export class BackfillInvoicesFileUrlFromUrlPdf20261005200001 implements MigrationInterface {
  name = 'BackfillInvoicesFileUrlFromUrlPdf20261005200001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${BACKFILL_TABLE}" (
        "id" uuid PRIMARY KEY,
        "tenant_id" uuid NOT NULL,
        "backfilled_at" timestamptz NOT NULL DEFAULT now()
      )`);
    await queryRunner.query(`ALTER TABLE "${BACKFILL_TABLE}" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "${BACKFILL_TABLE}" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`REVOKE ALL ON TABLE "${BACKFILL_TABLE}" FROM PUBLIC`);
    await queryRunner.query(`
      DO $$
      DECLARE r text;
      BEGIN
        FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'musicos_app'] LOOP
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', '${BACKFILL_TABLE}', r);
          END IF;
        END LOOP;
      END $$;`);

    const rows: Array<{ n: number }> = await queryRunner.query(`
      WITH moved AS (
        UPDATE "invoices" SET "file_url" = "url_pdf"
        WHERE "file_url" IS NULL AND "url_pdf" IS NOT NULL
        RETURNING "id", "tenant_id"
      ), recorded AS (
        INSERT INTO "${BACKFILL_TABLE}" ("id", "tenant_id")
        SELECT "id", "tenant_id" FROM moved ON CONFLICT ("id") DO NOTHING
        RETURNING 1
      )
      SELECT count(*)::int AS n FROM moved`);
    const divergent: Array<{ n: number }> = await queryRunner.query(
      `SELECT count(*)::int AS n FROM "invoices" WHERE "file_url" IS NOT NULL AND "url_pdf" IS NOT NULL AND "file_url" <> "url_pdf"`);
    console.log(
      `[BackfillInvoicesFileUrlFromUrlPdf] invoices.file_url filled: ${rows[0]?.n ?? 0} row(s) (still divergent from url_pdf, untouched: ${divergent[0]?.n ?? 0})`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    if (await hasTable(queryRunner, BACKFILL_TABLE)) {
      await queryRunner.query(`
      UPDATE "invoices" i SET "file_url" = NULL
      FROM "${BACKFILL_TABLE}" b
      WHERE b."id" = i."id" AND i."file_url" IS NOT DISTINCT FROM i."url_pdf"`);
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "${BACKFILL_TABLE}"`);
  }
}
