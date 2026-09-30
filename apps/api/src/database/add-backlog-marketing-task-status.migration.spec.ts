import { AddBacklogToMarketingTaskStatusCheck20260929000001 } from './migrations/20260929000001_AddBacklogToMarketingTaskStatusCheck';
import { ALL_MIGRATIONS } from './migrations';
import { MARKETING_TASK_STATUSES } from '../modules/marketing/marketing-vocabulary';

function runner(bypass = true) {
  const sql: string[] = [];
  const query = jest.fn(async (statement: string) => {
    sql.push(statement);
    if (statement.includes('rolbypassrls')) return [{ bypass }];
    if (statement.includes('count(*)')) return [{ affected: 2 }];
    return [];
  });
  return { query, sql };
}

describe('AddBacklogToMarketingTaskStatusCheck20260929000001', () => {
  const migration = new AddBacklogToMarketingTaskStatusCheck20260929000001();

  it('is registered in ALL_MIGRATIONS', () => {
    expect(ALL_MIGRATIONS).toContain(AddBacklogToMarketingTaskStatusCheck20260929000001);
  });

  it('up() widens the CHECK to exactly the API vocabulary (NOT VALID, then VALIDATE)', async () => {
    const { query, sql } = runner();
    await migration.up({ query } as never);
    const add = sql.find((s) => s.includes('ADD CONSTRAINT'))!;
    const listed = [...add.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
    expect(listed).toEqual([...MARKETING_TASK_STATUSES].sort());
    expect(add).toContain('NOT VALID');
    expect(sql.findIndex((s) => s.includes('DROP CONSTRAINT'))).toBeLessThan(sql.findIndex((s) => s.includes('ADD CONSTRAINT')));
    expect(sql.findIndex((s) => s.includes('ADD CONSTRAINT'))).toBeLessThan(sql.findIndex((s) => s.includes('VALIDATE CONSTRAINT')));
    expect(sql.some((s) => /\bUPDATE\b/.test(s))).toBe(false);
  });

  it('down() refuses a role that cannot bypass RLS before touching anything else', async () => {
    const { query } = runner(false);
    await expect(migration.down({ query } as never)).rejects.toThrow(/BYPASSRLS/);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it('down() returns backlog rows to pending, then restores the previous CHECK without backlog', async () => {
    const { query, sql } = runner();
    await migration.down({ query } as never);
    const update = sql.findIndex((s) => s.includes(`"status" = 'pending'`) && s.includes(`WHERE "status" = 'backlog'`));
    const add = sql.findIndex((s) => s.includes('ADD CONSTRAINT'));
    expect(update).toBeGreaterThan(-1);
    expect(update).toBeLessThan(add);
    expect(sql[add]).not.toContain(`'backlog'`);
    expect(sql[add]).toContain(`'pending', 'in_progress', 'review', 'blocked', 'done', 'cancelled'`);
  });
});
