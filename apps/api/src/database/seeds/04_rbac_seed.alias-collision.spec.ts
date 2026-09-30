import { seedRbac } from './04_rbac_seed';
import { ENGLISH_ROLE_ALIASES } from '../../core/rbac/role-hierarchy';

describe('seedRbac English alias vs live tenant custom role', () => {
  function makeDs(collidingSlugs: string[]) {
    const roleInserts: string[] = [];
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes(`"tenant_id" IS NOT NULL AND "deleted_at" IS NULL LIMIT 1`)) {
        return collidingSlugs.includes(params![0] as string) ? [{ '?column?': 1 }] : [];
      }
      if (sql.startsWith('INSERT INTO "roles"')) roleInserts.push(params![0] as string);
      if (sql.includes('count(*)::int AS')) return [{ permissions: 0, roles: 0, rolepermissions: 0 }];
      return [];
    });
    return { ds: { query } as never, roleInserts };
  }

  it('skips (with a warning, no data) the alias whose slug a live tenant custom role uses, inserts the others', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { ds, roleInserts } = makeDs(['sales']);
    await seedRbac(ds);
    expect(roleInserts).not.toContain('sales');
    for (const alias of Object.keys(ENGLISH_ROLE_ALIASES).filter((a) => a !== 'sales')) expect(roleInserts).toContain(alias);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"sales"'));
    warn.mockRestore();
  });

  it('inserts every alias when there is no collision', async () => {
    const { ds, roleInserts } = makeDs([]);
    await seedRbac(ds);
    for (const alias of Object.keys(ENGLISH_ROLE_ALIASES)) expect(roleInserts).toContain(alias);
  });
});
