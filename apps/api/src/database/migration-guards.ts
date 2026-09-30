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

export const AUDIT_VALUES_MAX_LISTED = 20;
export const AUDIT_VALUE_MAX_CHARS = 40;

/**
 * Bounded rendering of offending data values for a migration abort message: at
 * most 20 values, each truncated to 40 characters, control characters shown
 * escaped (the values are tenant data and can be arbitrarily long/odd). Query
 * with `LIMIT 21` so "and more" can be detected without reading every value.
 */
export function formatAuditValues(values: ReadonlyArray<unknown>): string {
  const render = (value: unknown): string => {
    const text = value === null || value === undefined ? 'NULL' : String(value);
    const escaped = Array.from(text, (c) => {
      const code = c.charCodeAt(0);
      return code < 0x20 || (code >= 0x7f && code <= 0x9f) ? `\\u${code.toString(16).padStart(4, '0')}` : c;
    }).join('');
    return escaped.length > AUDIT_VALUE_MAX_CHARS ? `${escaped.slice(0, AUDIT_VALUE_MAX_CHARS)}…` : escaped;
  };
  const listed = values.slice(0, AUDIT_VALUES_MAX_LISTED).map(render).join(', ');
  return values.length > AUDIT_VALUES_MAX_LISTED ? `${listed}, … (more not shown)` : listed;
}
