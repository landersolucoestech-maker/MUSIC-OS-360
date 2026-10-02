import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls, formatAuditValues } from '../migration-guards';

/**
 * 20260930000037_BackfillInternalRevenueAndContractPassThroughSlugs (TX1 follow-up, closes BLK-TRANSACTION-CATEGORY-TAXONOMY)
 *
 * 20260930000018 left two platform slugs as stored because their accounting meaning was not documented:
 * `receitas-internas` and `repasse-contrato`. They are persisted machine values with a fixed display label
 * ("Receitas Internas", "Repasse de Contrato") and nothing branches on their accounting meaning, so they are now
 * mapped like every other slug (modules/transactions/transaction-category-slugs.ts and its web mirror):
 *
 *   receitas-internas -> internal_revenue
 *   repasse-contrato  -> contract_pass_through
 *
 * Same shape as 20260930000018: (1) record id / column / legacy / canonical in the locked-down side table
 * `transaction_internal_revenue_backfill_20260930` (RLS enabled + FORCED, no policy, privileges revoked from
 * PUBLIC/anon/authenticated/musicos_app, kept by down()); (2) rewrite `transactions.category` and
 * `transactions.subcategory` with an EXACT, case-sensitive match (bound parameters, one statement per column; no trim,
 * no case folding; free text such as "Receitas Internas" is never rewritten); `updated_at` is NOT touched and
 * soft-deleted rows are rewritten too; idempotent (a canonical row never matches again). Counts-only logs.
 * Expand/contract: the API and web readers already accept both spellings (IN-expansion on filters); deploy the API
 * first. Removal condition of the legacy spelling: the census in
 * docs/runbooks/staging-to-production.md#residue-census-20260930000037 returns 0 for one release window.
 *
 * The values are a frozen literal (not derived from the live map), so later edits of the map never change this file.
 * No CHECK is added (S11 stays blocked). lock_timeout 15s; no table rewrite.
 *
 * down(): restores the recorded legacy value ONLY for rows still holding exactly the canonical value this migration
 * wrote (a row edited since is never reverted). Idempotent; the side table is kept.
 */
const LOG_TABLE = 'transaction_internal_revenue_backfill_20260930';
const COLUMNS = ['category', 'subcategory'] as const;

/** Frozen legacy -> canonical (the spec asserts it equals the application map entries). */
const LEGACY_TO_CANONICAL: Readonly<Record<string, string>> = {
  'receitas-internas': 'internal_revenue',
  'repasse-contrato': 'contract_pass_through',
};

/** Exported for the unit spec only. */
export const TRANSACTION_INTERNAL_REVENUE_BACKFILL = { LEGACY_TO_CANONICAL, LOG_TABLE } as const;

const LEGACY = Object.keys(LEGACY_TO_CANONICAL);
const CANONICAL_OF_LEGACY = LEGACY.map((legacy) => LEGACY_TO_CANONICAL[legacy]);

export class BackfillInternalRevenueAndContractPassThroughSlugs20260930000037 implements MigrationInterface {
  name = 'BackfillInternalRevenueAndContractPassThroughSlugs20260930000037';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "${LOG_TABLE}" (
        "id" uuid NOT NULL,
        "column_name" varchar(16) NOT NULL,
        "tenant_id" uuid NOT NULL,
        "legacy_value" varchar(100) NOT NULL,
        "canonical_value" varchar(100) NOT NULL,
        "backed_up_at" timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY ("id", "column_name")
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

    for (const column of COLUMNS) {
      await queryRunner.query(
        `INSERT INTO "${LOG_TABLE}" ("id", "column_name", "tenant_id", "legacy_value", "canonical_value")
         SELECT t."id", '${column}', t."tenant_id", t."${column}", m.canonical
         FROM "transactions" t
         JOIN unnest($1::text[], $2::text[]) AS m(legacy, canonical) ON t."${column}" = m.legacy
         ON CONFLICT ("id", "column_name") DO NOTHING`,
        [LEGACY, CANONICAL_OF_LEGACY],
      );
      const changed: Array<{ value: string; affected: number }> = await queryRunner.query(
        `WITH updated AS (
           UPDATE "transactions" AS t SET "${column}" = m.canonical
           FROM unnest($1::text[], $2::text[]) AS m(legacy, canonical)
           WHERE t."${column}" = m.legacy
           RETURNING m.legacy AS matched
         )
         SELECT matched AS value, count(*)::int AS affected FROM updated GROUP BY matched ORDER BY matched`,
        [LEGACY, CANONICAL_OF_LEGACY],
      );
      const total = changed.reduce((sum, row) => sum + row.affected, 0);
      console.log(
        `[BackfillInternalRevenueAndContractPassThroughSlugs] transactions.${column} renamed: ${total} row(s) in ${changed.length} slug(s)` +
          (changed.length ? ` [${formatAuditValues(changed.map((row) => `${row.value}=${row.affected}`))}]` : ''),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    for (const column of [...COLUMNS].reverse()) {
      const [{ affected }]: Array<{ affected: number }> = await queryRunner.query(
        `WITH updated AS (
           UPDATE "transactions" AS t SET "${column}" = l."legacy_value"
           FROM "${LOG_TABLE}" l
           WHERE l."column_name" = '${column}' AND l."id" = t."id" AND t."${column}" = l."canonical_value"
           RETURNING t."id"
         )
         SELECT count(*)::int AS affected FROM updated`,
      );
      console.log(`[BackfillInternalRevenueAndContractPassThroughSlugs] down: transactions.${column} restored to the recorded legacy slug: ${affected} row(s)`);
    }
  }
}
