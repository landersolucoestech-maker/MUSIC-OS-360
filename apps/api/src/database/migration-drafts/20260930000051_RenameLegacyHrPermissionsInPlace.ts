import { MigrationInterface, QueryRunner } from 'typeorm';
import { assertMigrationRoleBypassesRls } from '../migration-guards';

/**
 * 20260930000051_RenameLegacyHrPermissionsInPlace (R4 / R3-08, RBAC S4b companion): GATED DRAFT.
 *
 * NOT registered in ALL_MIGRATIONS (migrations/index.ts); nothing imports it except its own spec. Registering it
 * means moving it to migrations/ in the S4b release step, after every gate of
 * docs/engineering/rbac-retirement-plan.md section 3b is evidenced. As a second lock, up() and down() throw unless
 * RBAC_S4B_CONFIRM=<CONFIRM_TOKEN> is exported (the token differs from the role-slug draft, so one confirmation
 * never unlocks both).
 *
 * Effect: the permission catalog rows `rh:<action>` become `hr:<action>` IN PLACE (same id, so role_permissions,
 * permission_dependencies, permission_conflicts and role versions stay valid; nothing is deleted). Until this runs,
 * the code reads both spellings (API expandHrPermissionAliases, web permission-map), so the release order is:
 * dual-read build on every runtime, then this migration, then (S5) removal of the `rh` spelling from code.
 *
 * Pre-flight (fail-closed, before any write): no `hr` permission row may exist (a pre-existing hr:* row would collide
 * on uq_permissions_key and would mean someone already wrote the canonical key by hand). Residue audit inside the
 * transaction: zero `rh` rows left. Messages are bounded, counts only.
 *
 * Not touched: Redis permission cache (flush `rbac:*` after commit; entries expire by TTL), JWT claims (permissions
 * are never in the JWT), the seed (ROLE_PERMISSIONS keeps `rh:*` until the code companion flips it in the same release).
 *
 * down(): refuses while any `rh` row exists (would collide); otherwise renames back.
 */
export const CONFIRM_ENV = 'RBAC_S4B_CONFIRM';
export const CONFIRM_TOKEN = 'rename-legacy-hr-permissions-gates-satisfied';
export const MAX_MESSAGE = 600;

function bounded(text: string): string {
  return text.length <= MAX_MESSAGE ? text : `${text.slice(0, MAX_MESSAGE)}...(+${text.length - MAX_MESSAGE} chars)`;
}

export class RenameLegacyHrPermissionsInPlace20260930000051 implements MigrationInterface {
  name = 'RenameLegacyHrPermissionsInPlace20260930000051';

  private assertConfirmed(): void {
    if (process.env[CONFIRM_ENV] !== CONFIRM_TOKEN) {
      throw new Error(`${this.name}: gated draft. Set ${CONFIRM_ENV} only after the gates of docs/engineering/rbac-retirement-plan.md are evidenced.`);
    }
  }

  public async up(queryRunner: QueryRunner): Promise<void> {
    this.assertConfirmed();
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);

    const existing: Array<{ n: number }> = await queryRunner.query(
      `SELECT count(*)::int AS n FROM "permissions" WHERE "resource" = 'hr'`,
    );
    if ((existing[0]?.n ?? 0) > 0) {
      throw new Error(bounded(`${this.name}: refusing, ${existing[0].n} permission row(s) already use resource 'hr'. Nothing was changed.`));
    }

    await queryRunner.query(
      `UPDATE "permissions" SET "resource" = 'hr', "key" = 'hr:' || "action", "updated_at" = now() WHERE "resource" = 'rh'`,
    );

    const residue: Array<{ n: number }> = await queryRunner.query(
      `SELECT count(*)::int AS n FROM "permissions" WHERE "resource" = 'rh' OR "key" LIKE 'rh:%'`,
    );
    if ((residue[0]?.n ?? 0) > 0) {
      throw new Error(bounded(`${this.name}: ${residue[0].n} rh permission row(s) left after rename; rolling back.`));
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    this.assertConfirmed();
    await assertMigrationRoleBypassesRls(queryRunner, this.name);
    await queryRunner.query(`SET LOCAL lock_timeout = '15s'`);
    const clash: Array<{ n: number }> = await queryRunner.query(
      `SELECT count(*)::int AS n FROM "permissions" WHERE "resource" = 'rh'`,
    );
    if ((clash[0]?.n ?? 0) > 0) {
      throw new Error(bounded(`${this.name}: refusing to revert, ${clash[0].n} rh permission row(s) exist. Nothing was changed.`));
    }
    await queryRunner.query(
      `UPDATE "permissions" SET "resource" = 'rh', "key" = 'rh:' || "action", "updated_at" = now() WHERE "resource" = 'hr'`,
    );
  }
}
