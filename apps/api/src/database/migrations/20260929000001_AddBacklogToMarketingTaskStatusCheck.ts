import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';

/**
 * `marketing_tasks.status` is restricted by `chk_marketing_tasks_status` to
 * pending / in_progress / review / blocked / done / cancelled. The task board
 * (apps/web marketing module) has a first-class `backlog` column next to
 * "to do" (`pending`) -- distinct in the option list, the tone map, the board
 * columns and the KPI copy ("backlog e a fazer") -- so `backlog` is a
 * persisted state, not an alias: mapping it to `pending` would move a
 * backlog card to the "to do" column after a reload.
 *
 * Widening only: every existing value stays valid, so there is nothing to
 * backfill and the change is compatible with the old and the new build. The new
 * constraint is added NOT VALID and then validated. Inside this single
 * migration transaction the ACCESS EXCLUSIVE lock taken by DROP/ADD CONSTRAINT
 * is held until commit (measured on PostgreSQL 16), so writers wait for the
 * table scan; `lock_timeout` bounds the wait and there is no table rewrite.
 *
 * down(): a `backlog` row cannot satisfy the previous CHECK, so it is
 * returned to `pending` (the state it was closest to: not started) before the
 * narrow constraint is restored. That conversion is lossy by nature (backlog
 * vs to-do distinction is lost); it is the documented rollback contract.
 */
export class AddBacklogToMarketingTaskStatusCheck20260929000001 implements MigrationInterface {
  name = 'AddBacklogToMarketingTaskStatusCheck20260929000001';

  private static readonly CANONICAL = ['backlog', 'pending', 'in_progress', 'review', 'blocked', 'done', 'cancelled'];
  private static readonly PREVIOUS = ['pending', 'in_progress', 'review', 'blocked', 'done', 'cancelled'];

  private static list(values: readonly string[]): string {
    return values.map((value) => `'${value}'`).join(', ');
  }

  private async replaceConstraint(queryRunner: QueryRunner, values: readonly string[]): Promise<void> {
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    await queryRunner.query(`ALTER TABLE "marketing_tasks" DROP CONSTRAINT IF EXISTS "chk_marketing_tasks_status"`);
    await queryRunner.query(
      `ALTER TABLE "marketing_tasks" ADD CONSTRAINT "chk_marketing_tasks_status" ` +
        `CHECK ("status" IN (${AddBacklogToMarketingTaskStatusCheck20260929000001.list(values)})) NOT VALID`,
    );
    await queryRunner.query(`ALTER TABLE "marketing_tasks" VALIDATE CONSTRAINT "chk_marketing_tasks_status"`);
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    await this.replaceConstraint(queryRunner, AddBacklogToMarketingTaskStatusCheck20260929000001.CANONICAL);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    const [{ affected }] = await queryRunner.query(
      `WITH updated AS (
         UPDATE "marketing_tasks" SET "status" = 'pending', "updated_at" = now()
         WHERE "status" = 'backlog'
         RETURNING id
       )
       SELECT count(*)::int AS affected FROM updated`,
    );
    console.log(`[AddBacklogToMarketingTaskStatusCheck] marketing_tasks.status 'backlog' -> 'pending': ${affected} row(s)`);
    await this.replaceConstraint(queryRunner, AddBacklogToMarketingTaskStatusCheck20260929000001.PREVIOUS);
  }
}
