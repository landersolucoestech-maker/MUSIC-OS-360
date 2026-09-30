import { AddEnglishRoleSlugAliases20260930000001 } from './migrations/20260930000001_AddEnglishRoleSlugAliases';
import { ALL_MIGRATIONS } from './migrations';
import { ENGLISH_ROLE_ALIASES } from '../core/rbac/role-hierarchy';

interface Script {
  bypass?: boolean;
  missingCanonical?: string[];
  conflicts?: Array<{ slug: string; source: string; n: number }>;
  verified?: number;
  candidates?: Array<{ id: string; slug: string }>;
  references?: Array<{ slug: string; source: string; n: number }>;
}

function runner(script: Script = {}) {
  const sql: string[] = [];
  const query = jest.fn(async (statement: string) => {
    sql.push(statement);
    if (statement.includes('rolbypassrls')) return [{ bypass: script.bypass ?? true }];
    if (statement.includes('SELECT v.canonical')) return (script.missingCanonical ?? []).map((canonical) => ({ canonical }));
    if (statement.includes(`'tenant_custom_role'`)) return script.conflicts ?? [];
    if (statement.trimStart().startsWith('SELECT count(*)::int AS n')) {
      return [{ n: script.verified ?? 5 }];
    }
    if (statement.includes(`'org_members.role_id'`)) return script.references ?? [];
    if (statement.includes('SELECT r."id", r."slug"')) return script.candidates ?? [];
    return [];
  });
  return { query, sql };
}

const writes = (sql: string[]) => sql.filter((s) => /\b(INSERT|UPDATE|DELETE)\b/.test(s));

describe('AddEnglishRoleSlugAliases20260930000001', () => {
  const migration = new AddEnglishRoleSlugAliases20260930000001();

  it('is registered in ALL_MIGRATIONS (last)', () => {
    expect(ALL_MIGRATIONS).toContain(AddEnglishRoleSlugAliases20260930000001);
  });

  it('up() and down() refuse a role that cannot bypass RLS before touching anything', async () => {
    for (const method of ['up', 'down'] as const) {
      const { query } = runner({ bypass: false });
      await expect(migration[method]({ query } as never)).rejects.toThrow(/BYPASSRLS/);
      expect(query).toHaveBeenCalledTimes(1);
    }
  });

  it('up() sets lock_timeout, then inserts only global, non-assignable aliases guarded by NOT EXISTS', async () => {
    const { query, sql } = runner();
    await migration.up({ query } as never);
    expect(sql.some((s) => s.includes(`SET LOCAL lock_timeout = '15s'`))).toBe(true);
    const inserts = sql.filter((s) => s.includes('INSERT INTO "roles"'));
    expect(inserts).toHaveLength(1);
    const insert = inserts[0];
    expect(insert).toContain('INSERT INTO "roles"');
    expect(insert).toContain('NOT EXISTS');
    expect(insert).toContain('NULL::uuid, c."id", v.alias, c."name", c."hierarchy_level", TRUE, FALSE');
    for (const [alias, canonical] of Object.entries(ENGLISH_ROLE_ALIASES)) {
      expect(insert).toContain(`('${alias}', '${canonical}')`);
    }
    // No renames, no backfill, no permission copy: aliases inherit through canonical_role_id.
    expect(sql.some((s) => /UPDATE "org_members"|INSERT INTO "role_permissions"|DELETE/.test(s))).toBe(false);
  });

  it('up() repairs drifted exact alias rows with a guarded, global-only UPDATE to inert (after the guard, before verification)', async () => {
    const { query, sql } = runner();
    await migration.up({ query } as never);
    const updates = sql.filter((s) => s.includes('UPDATE "roles"'));
    expect(updates).toHaveLength(1);
    const update = updates[0];
    expect(update).toContain('SET "is_assignable" = FALSE, "archived_at" = NULL');
    expect(update).toContain('r."tenant_id" IS NULL');
    expect(update).toContain('c."id" = r."canonical_role_id"');
    expect(update).toContain('IS DISTINCT FROM FALSE');
    for (const [alias, canonical] of Object.entries(ENGLISH_ROLE_ALIASES)) {
      expect(update).toContain(`('${alias}', '${canonical}')`);
    }
    const at = sql.findIndex((s) => s.includes('UPDATE "roles"'));
    expect(at).toBeGreaterThan(sql.findIndex((s) => s.includes('INSERT INTO "roles"')));
    expect(at).toBeLessThan(sql.findIndex((s) => s.trimStart().startsWith('SELECT count(*)::int AS n')));
  });

  it('up() read-after-write requires the aliases to be inert (not assignable, not archived)', async () => {
    const { query, sql } = runner();
    await migration.up({ query } as never);
    const verify = sql.find((s) => s.trimStart().startsWith('SELECT count(*)::int AS n'))!;
    expect(verify).toContain('"is_assignable" = FALSE AND r."archived_at" IS NULL');
  });

  it('up() runs the widening guard and canonical check BEFORE the insert', async () => {
    const { query, sql } = runner();
    await migration.up({ query } as never);
    const insertAt = sql.findIndex((s) => s.includes('INSERT INTO "roles"'));
    expect(sql.findIndex((s) => s.includes('SELECT v.canonical'))).toBeLessThan(insertAt);
    expect(sql.findIndex((s) => s.includes(`'tenant_custom_role'`))).toBeLessThan(insertAt);
  });

  it.each([
    ['a member already holds an English slug', { conflicts: [{ slug: 'sales', source: 'org_members.role', n: 2 }] }],
    ['a tenant custom role uses an English slug', { conflicts: [{ slug: 'legal', source: 'tenant_custom_role', n: 1 }] }],
    ['a global row with an English slug is not the exact alias', { conflicts: [{ slug: 'producer', source: 'global_row_not_expected_alias', n: 1 }] }],
  ])('up() refuses (writes nothing) when %s', async (_label, script) => {
    const { query, sql } = runner(script);
    await expect(migration.up({ query } as never)).rejects.toThrow(/would change existing authorization/);
    expect(writes(sql)).toHaveLength(0);
  });

  it('up() refuses when a canonical Portuguese role is missing or archived', async () => {
    const { query, sql } = runner({ missingCanonical: ['juridico'] });
    await expect(migration.up({ query } as never)).rejects.toThrow(/missing or archived: juridico/);
    expect(writes(sql)).toHaveLength(0);
  });

  it('up() fails if the read-after-write verification does not find all five aliases', async () => {
    const { query } = runner({ verified: 4 });
    await expect(migration.up({ query } as never)).rejects.toThrow(/expected 5 verified alias rows, found 4/);
  });

  it('down() with no alias rows is a no-op', async () => {
    const { query, sql } = runner({ candidates: [] });
    await migration.down({ query } as never);
    expect(writes(sql)).toHaveLength(0);
  });

  it('down() refuses, deleting nothing, when an alias row is still referenced', async () => {
    const { query, sql } = runner({
      candidates: [{ id: 'r1', slug: 'legal' }],
      references: [{ slug: 'legal', source: 'org_members.role_id', n: 3 }],
    });
    await expect(migration.down({ query } as never)).rejects.toThrow(/refusing down\(\).*legal:org_members\.role_id=3/);
    expect(writes(sql)).toHaveLength(0);
  });

  it('down() deletes only global alias rows that still point at their canonical role and are unreferenced', async () => {
    const { query, sql } = runner({ candidates: [{ id: 'r1', slug: 'legal' }, { id: 'r2', slug: 'sales' }] });
    await migration.down({ query } as never);
    const del = writes(sql);
    expect(del).toHaveLength(1);
    expect(del[0]).toContain('DELETE FROM "roles"');
    expect(del[0]).toContain(`"canonical_role_id" IS NOT NULL`);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining('DELETE FROM "roles"'), [['r1', 'r2'], ['legal', 'sales']]);
    const candidateSql = sql.find((s) => s.includes('SELECT r."id", r."slug"'))!;
    expect(candidateSql).toContain('r."tenant_id" IS NULL');
    expect(candidateSql).toContain('r."canonical_role_id" IS NOT NULL');
  });

  it('down() checks every reference source (members role_id/role, invitations, permissions, inheritance, canonical pointers)', async () => {
    const { query, sql } = runner({ candidates: [{ id: 'r1', slug: 'legal' }] });
    await migration.down({ query } as never);
    const refs = sql.find((s) => s.includes(`'org_members.role_id'`))!;
    for (const source of ['org_members.role_id', 'org_members.role', 'tenant_invitations.role_id', 'role_permissions', 'role_inheritance', 'roles.canonical_role_id']) {
      expect(refs).toContain(`'${source}'`);
    }
    expect(query).toHaveBeenCalled();
  });
});
