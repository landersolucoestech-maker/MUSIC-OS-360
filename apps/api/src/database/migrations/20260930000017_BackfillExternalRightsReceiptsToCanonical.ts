import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';

/**
 * 20260930000017_BackfillExternalRightsReceiptsToCanonical (CT1)
 *
 * Owner decision recorded in findings/persisted-vocabulary-audit.md: the persisted
 * phrase 'recebimentos externos de direitos' is the canonical technical id
 * `external_rights_receipts` (precedent: financial_rules.type `external_rights_fee`);
 * the PT-BR label "Recebimentos externos de direitos" lives in the web UI only.
 * It was persisted in two columns, both free-text varchar WITHOUT a CHECK:
 *   - contract_service_types.financial_model (the service-type form value);
 *   - transactions.category (the artist-revenue category option).
 * (The third spelling, the web-only contract form `payment_type`, is never persisted.)
 *
 * Expand/contract. Expand = the code that ships with this migration writes the
 * canonical id and keeps READING / FILTERING the legacy phrase (API list filter on
 * transactions.category and contracts DTO input mapping; web normalizers). This is
 * the backfill step; the contract step (dropping the legacy readers) is gated on
 * the census queries in findings/contracts-ct1.md returning 0.
 *
 * Steps (EXACT match, case-sensitive, nothing else is touched; idempotent: a
 * canonical row never matches again; `updated_at` is left alone because this is a
 * vocabulary rewrite, not a user edit):
 *   1. Record the ids about to be rewritten in the side table
 *      `external_rights_receipts_backfill_20260930` (table_name, id, tenant_id;
 *      ON CONFLICT DO NOTHING, so a down()/up() replay keeps one entry per row).
 *      RLS enabled and FORCED with no policy, privileges revoked from PUBLIC/anon/
 *      authenticated/musicos_app: only the migration (BYPASSRLS) role reads it.
 *      NOT dropped by down(): forensic data, drop it in a later migration.
 *   2. UPDATE the two columns phrase -> canonical (soft-deleted rows included).
 *   NO CHECK constraint is added: the reports import writes these varchar columns
 *   with free text, and the contract_service_types column has never been restricted.
 *   Logs are bounded: one line per column with a row count, never a value list.
 *
 * lock_timeout 15s bounds the wait for the row locks / the side-table DDL. The UPDATEs
 * only touch the (few) rows holding the exact phrase; no table rewrite, no ACCESS
 * EXCLUSIVE lock beyond the side table.
 *
 * down(): restores the phrase ONLY for rows recorded in the side table that still
 * hold the canonical id (a row the user edited to something else after up() is never
 * reverted; a row that held the canonical id before up() was never recorded, so it
 * is never turned into the legacy phrase). Idempotent.
 *
 * Preflight (read-only) SQL: see findings/contracts-ct1.md.
 */
const LEGACY = 'recebimentos externos de direitos';
const CANONICAL = 'external_rights_receipts';
const LOG_TABLE = 'external_rights_receipts_backfill_20260930';

interface Target {
  table: 'contract_service_types' | 'transactions';
  column: 'financial_model' | 'category';
}

const TARGETS: ReadonlyArray<Target> = [
  { table: 'contract_service_types', column: 'financial_model' },
  { table: 'transactions', column: 'category' },
];

async function rewrite(queryRunner: QueryRunner, migration: string, t: Target, from: string, to: string): Promise<void> {
  const [{ affected }] = await queryRunner.query(
    `WITH updated AS (
       UPDATE "${t.table}" SET "${t.column}" = $2 WHERE "${t.column}" = $1 RETURNING id
     )
     SELECT count(*)::int AS affected FROM updated`,
    [from, to],
  );
  console.log(`[${migration}] ${t.table}.${t.column}: ${affected} row(s) rewritten`);
}

export class BackfillExternalRightsReceiptsToCanonical20260930000017 implements MigrationInterface {
  name = 'BackfillExternalRightsReceiptsToCanonical20260930000017';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${LOG_TABLE}" (
        "table_name" varchar(64) NOT NULL,
        "id" uuid NOT NULL,
        "tenant_id" uuid NOT NULL,
        "backed_up_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("table_name", "id")
      )`);
    await queryRunner.query(`ALTER TABLE "${LOG_TABLE}" ENABLE ROW LEVEL SECURITY`);
    await queryRunner.query(`ALTER TABLE "${LOG_TABLE}" FORCE ROW LEVEL SECURITY`);
    await queryRunner.query(`REVOKE ALL ON TABLE "${LOG_TABLE}" FROM PUBLIC`);
    await queryRunner.query(`
      DO $$
      DECLARE r text;
      BEGIN
        FOREACH r IN ARRAY ARRAY['anon', 'authenticated', 'musicos_app'] LOOP
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN
            EXECUTE format('REVOKE ALL ON TABLE public.%I FROM %I', '${LOG_TABLE}', r);
          END IF;
        END LOOP;
      END $$;`);

    for (const t of TARGETS) {
      await queryRunner.query(
        `INSERT INTO "${LOG_TABLE}" ("table_name", "id", "tenant_id")
         SELECT '${t.table}', "id", "tenant_id" FROM "${t.table}" WHERE "${t.column}" = $1
         ON CONFLICT ("table_name", "id") DO NOTHING`,
        [LEGACY],
      );
      await rewrite(queryRunner, this.name, t, LEGACY, CANONICAL);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    for (const t of [...TARGETS].reverse()) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE "${t.table}" x SET "${t.column}" = $2
           FROM "${LOG_TABLE}" l
           WHERE l."table_name" = '${t.table}' AND l."id" = x."id" AND x."${t.column}" = $1
           RETURNING x.id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [CANONICAL, LEGACY],
      );
      console.log(`[${this.name}] ${t.table}.${t.column}: ${affected} row(s) restored`);
    }
  }
}
