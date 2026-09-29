import type { QueryRunner } from 'typeorm';

/**
 * Data migrations on tenant tables are plain UPDATEs, and those tables use
 * FORCE ROW LEVEL SECURITY (it applies to the owner too). Run by a role that is
 * neither superuser nor BYPASSRLS, every UPDATE matches zero rows and the
 * migration would be recorded as applied having changed nothing. Fail instead
 * (docs/engineering/database.md, first pre-flight query).
 */
export async function assertMigrationRoleBypassesRls(queryRunner: QueryRunner, migration: string): Promise<void> {
  const rows: Array<{ bypass: boolean }> = await queryRunner.query(
    `SELECT (rolsuper OR rolbypassrls) AS bypass FROM pg_roles WHERE rolname = current_user`,
  );
  if (rows[0]?.bypass !== true) {
    throw new Error(
      `${migration}: the migration role must be superuser or BYPASSRLS — with FORCE ROW LEVEL SECURITY ` +
      'its UPDATEs would match zero rows. See docs/engineering/database.md (pre-flight queries).',
    );
  }
}
