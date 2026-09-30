import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';

/**
 * 20260930000003_BackfillAndRestrictMarketingContentApprovalToEnglish
 *
 * A marketing content's approval has no column: the web stores it in
 * `marketing_content_posts.metadata.approval` (jsonb), where it held the
 * Portuguese UI vocabulary pendente / aprovado / reprovado /
 * ajustes_solicitados. Technical vocabulary is English (the web renders the
 * PT-BR labels): pending / approved / rejected / revision_requested -- the
 * same words as the asset-approval decisions (marketing-assets.dto.ts).
 *
 * Backfill-and-Restrict in one migration, same shape as
 * 20260929000002 (which handled the content status/target/type columns):
 *
 *   1. Backfill exact legacy values (case/space-insensitive, idempotent -- a
 *      row already holding a canonical value never matches). Only string
 *      approvals are rewritten; every other `metadata` key is preserved
 *      (`jsonb_set` on the single path). `updated_at` is left alone: this is a
 *      vocabulary rewrite, not a user edit, and bumping it would make every
 *      open editor fail its optimistic-concurrency check.
 *   2. Verify: any remaining approval outside the canonical set (unknown
 *      spelling, or a non-string JSON value) aborts the migration with the
 *      offending values listed, before the constraint is added. Nothing is
 *      guessed or coerced. A missing key and a JSON null are valid (the web
 *      reads both as "pending").
 *   3. Restrict: `chk_marketing_content_posts_metadata_approval` via a plain
 *      ADD CONSTRAINT (a NOT VALID + VALIDATE split buys nothing inside one
 *      migration transaction). ADD CONSTRAINT takes ACCESS EXCLUSIVE and scans
 *      the table under it, and that lock is held until commit, so writers wait
 *      for the whole scan; `lock_timeout` bounds only the wait to acquire the
 *      lock, not the scan. There is no table rewrite.
 *
 * Deploy coupling: after this migration a build that still writes a Portuguese
 * approval fails the CHECK. The current API maps a deprecated approval to the
 * canonical value before validation (marketing-vocabulary.ts), and the current
 * web reads both spellings, so only an API build older than this change is
 * affected: stop it (and its workers) before running this migration -- see
 * docs/runbooks/staging-to-production.md, "Marketing vocabulary release".
 *
 * down(): drops the CHECK and maps every canonical value back to its
 * Portuguese spelling. The mapping is one-to-one, so nothing is lost. Before
 * touching anything it refuses to run when a row holds an approval that is
 * neither canonical nor one of the legacy spellings (the CHECK makes that
 * impossible while it exists; this guards the case where it was dropped and
 * free text was written since), because such a row cannot be represented in
 * the previous vocabulary either.
 */
type Pair = readonly [legacy: string, canonical: string];

const APPROVALS: ReadonlyArray<Pair> = [
  ['pendente', 'pending'],
  ['aprovado', 'approved'],
  ['reprovado', 'rejected'],
  ['ajustes_solicitados', 'revision_requested'],
];

const TABLE = 'marketing_content_posts';
const CONSTRAINT = 'chk_marketing_content_posts_metadata_approval';

const MAX_REPORTED_VALUES = 20;
const MAX_REPORTED_VALUE_LENGTH = 40;

/**
 * Renders offending data values for an abort message: at most 20 distinct
 * values, each collapsed to a single line and truncated to 40 characters, so a
 * hostile or huge value cannot flood the migration log.
 */
function describeOffendingValues(rows: ReadonlyArray<{ value: string }>): string {
  const shown = rows.slice(0, MAX_REPORTED_VALUES).map((row) => {
    const oneLine = String(row.value).replace(/\s+/g, ' ');
    return oneLine.length > MAX_REPORTED_VALUE_LENGTH ? `${oneLine.slice(0, MAX_REPORTED_VALUE_LENGTH)}...` : oneLine;
  });
  const more = rows.length > MAX_REPORTED_VALUES ? `, ... (+${rows.length - MAX_REPORTED_VALUES} more)` : '';
  return `${shown.join(', ')}${more}`;
}

const quote = (values: readonly string[]): string => values.map((value) => `'${value}'`).join(', ');
const CANONICAL = APPROVALS.map(([, canonical]) => canonical);
const LEGACY = APPROVALS.map(([legacy]) => legacy);

export class BackfillAndRestrictMarketingContentApprovalToEnglish20260930000003 implements MigrationInterface {
  name = 'BackfillAndRestrictMarketingContentApprovalToEnglish20260930000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    for (const [legacy, canonical] of APPROVALS) {
      const [{ affected }] = await queryRunner.query(
        `WITH updated AS (
           UPDATE "${TABLE}" SET "metadata" = jsonb_set("metadata", '{approval}', to_jsonb($2::text), false)
           WHERE jsonb_typeof("metadata"->'approval') = 'string'
             AND lower(trim("metadata"->>'approval')) = $1
           RETURNING id
         )
         SELECT count(*)::int AS affected FROM updated`,
        [legacy, canonical],
      );
      console.log(
        `[BackfillAndRestrictMarketingContentApprovalToEnglish] ${TABLE}.metadata.approval '${legacy}' -> '${canonical}': ${affected} row(s)`,
      );
    }

    const invalidRows: Array<{ value: string }> = await queryRunner.query(
      `SELECT DISTINCT "metadata"->>'approval' AS value
       FROM "${TABLE}"
       WHERE "metadata"->>'approval' IS NOT NULL
         AND "metadata"->>'approval' NOT IN (${quote(CANONICAL)})
       ORDER BY 1
       LIMIT ${MAX_REPORTED_VALUES + 1}`,
    );
    if (invalidRows.length > 0) {
      throw new Error(
        `${this.name}: cannot add CHECK constraint, "${TABLE}"."metadata"->>'approval' contains ` +
          `unexpected values after backfill: [${describeOffendingValues(invalidRows)}]. ` +
          `Fix or migrate this data before re-running this migration.`,
      );
    }

    await queryRunner.query(`ALTER TABLE "${TABLE}" DROP CONSTRAINT IF EXISTS "${CONSTRAINT}"`);
    await queryRunner.query(
      `ALTER TABLE "${TABLE}" ADD CONSTRAINT "${CONSTRAINT}" ` +
        `CHECK (("metadata"->>'approval') IS NULL OR ("metadata"->>'approval') IN (${quote(CANONICAL)}))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    const unmappable: Array<{ value: string }> = await queryRunner.query(
      `SELECT DISTINCT "metadata"->>'approval' AS value
       FROM "${TABLE}"
       WHERE "metadata"->>'approval' IS NOT NULL
         AND "metadata"->>'approval' NOT IN (${quote([...CANONICAL, ...LEGACY])})
       ORDER BY 1
       LIMIT ${MAX_REPORTED_VALUES + 1}`,
    );
    if (unmappable.length > 0) {
      throw new Error(
        `${this.name}: cannot restore the previous vocabulary, "${TABLE}"."metadata"->>'approval' contains ` +
          `values that are neither canonical nor legacy: [${describeOffendingValues(unmappable)}]. ` +
          `Fix this data before rolling back.`,
      );
    }

    await queryRunner.query(`ALTER TABLE "${TABLE}" DROP CONSTRAINT IF EXISTS "${CONSTRAINT}"`);

    for (const [legacy, canonical] of APPROVALS) {
      await queryRunner.query(
        `UPDATE "${TABLE}" SET "metadata" = jsonb_set("metadata", '{approval}', to_jsonb($1::text), false)
         WHERE jsonb_typeof("metadata"->'approval') = 'string' AND "metadata"->>'approval' = $2`,
        [legacy, canonical],
      );
    }
  }
}
