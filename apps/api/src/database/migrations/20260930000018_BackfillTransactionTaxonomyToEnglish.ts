import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls, formatAuditValues } from '../migration-guards';
import {
  CANONICAL_TRANSACTION_CATEGORY_SLUGS,
  LEGACY_TRANSACTION_CATEGORY_SLUGS,
  UNCHANGED_TRANSACTION_CATEGORY_SLUGS,
  UNMAPPED_TRANSACTION_CATEGORY_SLUGS,
} from '../../modules/transactions/transaction-category-slugs';

/**
 * 20260930000018_BackfillTransactionTaxonomyToEnglish (TX1 / S9)
 *
 * `transactions.category` and `transactions.subcategory` (free varchar, NO CHECK)
 * hold the platform taxonomy as kebab-case Portuguese slugs written by the old web
 * option lists (`receitas-musicais`, `cache-show`, ...), by the reports import and
 * by the OFX placeholder `outros`. Canonical machine values are lower snake_case
 * English ids (modules/transactions/transaction-category-slugs.ts); the PT-BR text
 * is a display label in the web label registry only. Closes
 * BLK-TRANSACTION-CATEGORY-TAXONOMY for the platform-owned slugs.
 *
 * Expand-contract, Backfill step (same shape as 20260930000010/12/17). The EXPAND
 * step ships in the API with this migration: writes and the reports import are
 * canonical, request values are canonicalized, list/export filters match BOTH
 * spellings (IN-expansion), the web reads both. DEPLOY THE API FIRST: an old API
 * build keeps writing legacy slugs after this migration (they are re-mapped by a
 * re-run and are read as legacy meanwhile).
 *
 *   1. Record (table `transaction_taxonomy_backfill_20260930`: id, column, legacy
 *      value, canonical value; RLS enabled + FORCED with no policy, privileges
 *      revoked from PUBLIC/anon/authenticated/musicos_app, kept by down()).
 *   2. Rewrite with an EXACT, case-sensitive match against the legacy map only
 *      (bound parameters, one statement per column). No trimming, no case
 *      folding, no guessing: free text (e.g. the display names "Receitas
 *      Musicais" written by the category-rule store / keyword rules) and any
 *      value that is not literally a legacy slug are left untouched.
 *      Idempotent: a canonical row never matches again. `updated_at` is NOT
 *      touched (a vocabulary rewrite is not a user edit; bumping it would make
 *      every open editor fail its optimistic-concurrency check). Soft-deleted
 *      rows are rewritten too.
 *   3. Report (never abort): slug-shaped values outside the known sets
 *      (canonical, unchanged English, deliberately unmapped) -- at most 20 values,
 *      each truncated to 40 chars -- plus counts only for everything else.
 *
 * NOT done, on purpose: NO CHECK on transactions.category / subcategory (S11 stays
 * blocked). Every writer must be validated first -- the reports import accepts free
 * text, the keyword rules write financial_categories.name, the form writes the
 * display text of the browser-local rule store -- and the residue preflight in
 * findings/transactions-tx1.md must be 0 in every environment. A NOT VALID CHECK
 * would still fail every UPDATE of a residue row. The `external_rights_receipts`
 * phrase is owned by 20260930000017; already-English values are not touched.
 * `receitas-internas` and `repasse-contrato` stay unmapped (meaning not clear).
 * financial_categories.slug / finance_category_keyword_rules persist no
 * transaction slug (rules reference category_id), so nothing is rewritten there.
 *
 * lock_timeout 15s bounds the wait for the side-table DDL and the row locks; no
 * table rewrite.
 *
 * down(): restores the recorded legacy value ONLY for rows still holding exactly
 * the canonical value this migration wrote (a row edited since is never reverted;
 * a row that was canonical before up() was never recorded). Many-to-one aliases
 * (e.g. both external-rights streaming spellings) are therefore restored exactly.
 * Idempotent; the side table is kept.
 */
const LOG_TABLE = 'transaction_taxonomy_backfill_20260930';
const COLUMNS = ['category', 'subcategory'] as const;

const LEGACY = Object.keys(LEGACY_TRANSACTION_CATEGORY_SLUGS);
const CANONICAL_OF_LEGACY = LEGACY.map((legacy) => LEGACY_TRANSACTION_CATEGORY_SLUGS[legacy]);

const KNOWN = [
  ...CANONICAL_TRANSACTION_CATEGORY_SLUGS,
  ...UNCHANGED_TRANSACTION_CATEGORY_SLUGS,
  ...UNMAPPED_TRANSACTION_CATEGORY_SLUGS,
];

export class BackfillTransactionTaxonomyToEnglish20260930000018 implements MigrationInterface {
  name = 'BackfillTransactionTaxonomyToEnglish20260930000018';

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
        `[BackfillTransactionTaxonomyToEnglish] transactions.${column} renamed: ${total} row(s) in ${changed.length} slug(s)` +
          (changed.length ? ` [${formatAuditValues(changed.map((row) => `${row.value}=${row.affected}`))}]` : ''),
      );

      const residue: Array<{ value: string }> = await queryRunner.query(
        `SELECT DISTINCT "${column}" AS value
         FROM "transactions"
         WHERE "${column}" ~ '^[a-z0-9_-]+$' AND "${column}" <> ALL($1::text[])
         ORDER BY 1
         LIMIT 21`,
        [KNOWN],
      );
      const [{ freeText }]: Array<{ freeText: number }> = await queryRunner.query(
        `SELECT count(*)::int AS "freeText" FROM "transactions" WHERE "${column}" !~ '^[a-z0-9_-]+$'`,
      );
      console.log(
        `[BackfillTransactionTaxonomyToEnglish] transactions.${column} slug-shaped values outside the known sets (left untouched): ` +
          (residue.length ? `[${formatAuditValues(residue.map((row) => row.value))}]` : 'none') +
          `; free-text rows (left untouched): ${freeText}`,
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
      console.log(`[BackfillTransactionTaxonomyToEnglish] down: transactions.${column} restored to the recorded legacy slug: ${affected} row(s)`);
    }
  }
}
