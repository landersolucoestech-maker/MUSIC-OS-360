import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';

/**
 * 20260930000014_BackfillReleaseStatusDefaultToDraft (PV1 / S3)
 *
 * `releases.status` (varchar(50) NOT NULL, no CHECK) still carries the DEFAULT
 * 'planejamento' set when the table was rebuilt (20260719000004) although the
 * entity default is `ReleaseStatus.DRAFT` and ReleaseService always writes it
 * (`releases.service.ts`). 'planejamento' is not a `ReleaseStatus`, and it is
 * NOT in the legacy map of 20260928000019 (that map has `planejado` ->
 * scheduled, a different word), so a row inserted without an explicit status
 * (raw SQL, seeds) is never normalized. It is the initial state of a release
 * (the column default), i.e. `draft`; the web already displays an unknown status
 * as "incomplete", the display group of `draft`.
 *
 * Steps:
 *   1. DEFAULT 'planejamento' -> 'draft'. Metadata-only for existing rows.
 *   2. Backfill ONLY rows whose status is exactly 'planejamento' (no case
 *      folding, nothing else is touched) -> 'draft', keeping the original
 *      spelling in metadata.legacy_status exactly like 20260928000019. Only
 *      rows whose metadata is NULL or a jsonb object are rewritten (a
 *      non-object metadata cannot carry the marker); any remaining
 *      'planejamento' row is reported in the log, never coerced. `updated_at`
 *      is left alone (vocabulary rewrite, not a user edit).
 *
 * NOT decided here (owner decision BLK-RELEASES-STATUS-CHECK): rejeitado,
 * takedown, take_down and remocao have no ReleaseStatus equivalent; they are
 * left untouched and no chk_releases_status is added.
 *
 * Deploy note: a build that still relies on the DB default would now get
 * 'draft', which is what every current code path already writes.
 *
 * down(): DEFAULT back to 'planejamento'; restores 'planejamento' only for rows
 * that still hold 'draft' AND carry metadata.legacy_status = 'planejamento'
 * (a status changed after up() is never reverted; the marker is then dropped
 * only for rows that were restored).
 */
const LEGACY = 'planejamento';
const CANONICAL = 'draft';

export class BackfillReleaseStatusDefaultToDraft20260930000014 implements MigrationInterface {
  name = 'BackfillReleaseStatusDefaultToDraft20260930000014';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    await queryRunner.query(`ALTER TABLE "releases" ALTER COLUMN "status" SET DEFAULT '${CANONICAL}'`);

    const [{ affected }] = await queryRunner.query(
      `WITH updated AS (
         UPDATE "releases"
         SET "metadata" = COALESCE("metadata", '{}'::jsonb) || jsonb_build_object('legacy_status', "status"), "status" = $2
         WHERE "status" = $1 AND ("metadata" IS NULL OR jsonb_typeof("metadata") = 'object')
         RETURNING id
       )
       SELECT count(*)::int AS affected FROM updated`,
      [LEGACY, CANONICAL],
    );
    console.log(`[BackfillReleaseStatusDefaultToDraft] releases.status '${LEGACY}' -> '${CANONICAL}': ${affected} row(s)`);

    const [{ remaining }] = await queryRunner.query(
      `SELECT count(*)::int AS remaining FROM "releases" WHERE "status" = $1`,
      [LEGACY],
    );
    console.log(`[BackfillReleaseStatusDefaultToDraft] releases.status '${LEGACY}' rows left untouched (non-object metadata): ${remaining}`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    await queryRunner.query(`ALTER TABLE "releases" ALTER COLUMN "status" SET DEFAULT '${LEGACY}'`);
    await queryRunner.query(
      `UPDATE "releases"
       SET "status" = $1, "metadata" = "metadata" - 'legacy_status'
       WHERE "status" = $2 AND jsonb_typeof("metadata") = 'object' AND "metadata"->>'legacy_status' = $1`,
      [LEGACY, CANONICAL],
    );
  }
}
