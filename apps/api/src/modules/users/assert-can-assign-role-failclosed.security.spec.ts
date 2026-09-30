import { BadRequestException } from '@nestjs/common';
import { ROLE_HIERARCHY } from '../../core/rbac/role-hierarchy';
import { UsersService } from './users.service';

type Row = { slug: string; hierarchy_level: number; is_assignable: boolean | null };

function makeService(roleRows: Row[]) {
  const repository = { manager: { query: jest.fn().mockResolvedValue(roleRows) } };
  const dataSource = { getRepository: jest.fn().mockReturnValue(repository) };
  return new UsersService(
    dataSource as never,
    { emitTyped: jest.fn() } as never,
    {} as never,
    { delete: jest.fn() } as never,
    {} as never,
    {} as never,
    {} as never,
  );
}

const call = (svc: UsersService, actor: string, target: string) =>
  svc['assertCanAssignRole']('tenant-a', actor, target);

describe('UsersService.assertCanAssignRole — fail-closed on unknown roles', () => {
  it.each(['owner', 'tenant_owner', 'super_admin', 'admin', 'manager', 'viewer'])(
    'rejects an unknown target role for actor %s (no DB row, not in hierarchy)',
    async (actor) => {
      const svc = makeService([{ slug: actor, hierarchy_level: ROLE_HIERARCHY[actor], is_assignable: true }]);
      const err = await call(svc, actor, 'ghost_role').catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({ code: 'ROLE_UNKNOWN' });
    },
  );

  it('rejects an unknown target even when the DB returns no rows at all', async () => {
    await expect(call(makeService([]), 'admin', 'ghost_role')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a non-finite DB level for an unknown code slug', async () => {
    const svc = makeService([
      { slug: 'admin', hierarchy_level: 80, is_assignable: true },
      { slug: 'ghost_role', hierarchy_level: Number.NaN, is_assignable: true },
    ]);
    await expect(call(svc, 'admin', 'ghost_role')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('a DB-defined custom role (not in ROLE_HIERARCHY) is assignable below the actor level', async () => {
    const svc = makeService([
      { slug: 'admin', hierarchy_level: 80, is_assignable: true },
      { slug: 'custom_x', hierarchy_level: 25, is_assignable: true },
    ]);
    await expect(call(svc, 'admin', 'custom_x')).resolves.toBeUndefined();
  });

  it('a DB-defined custom role at or above the actor level is rejected', async () => {
    const svc = makeService([
      { slug: 'manager', hierarchy_level: 70, is_assignable: true },
      { slug: 'custom_y', hierarchy_level: 70, is_assignable: true },
    ]);
    await expect(call(svc, 'manager', 'custom_y')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('pins existing behavior: a known DB role with hierarchy_level 0 is assignable by a higher actor (lowest-level role)', async () => {
    const svc = makeService([
      { slug: 'admin', hierarchy_level: 80, is_assignable: true },
      { slug: 'viewer', hierarchy_level: 0, is_assignable: true },
    ]);
    await expect(call(svc, 'admin', 'viewer')).resolves.toBeUndefined();
  });

  it('pins existing behavior: a level-0 actor cannot assign a level-0 role (>= ceiling)', async () => {
    const svc = makeService([{ slug: 'viewer', hierarchy_level: 0, is_assignable: true }]);
    await expect(call(svc, 'viewer', 'viewer')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('is_assignable=false still wins for a known role', async () => {
    const svc = makeService([
      { slug: 'owner', hierarchy_level: 90, is_assignable: true },
      { slug: 'admin', hierarchy_level: 80, is_assignable: false },
    ]);
    await expect(call(svc, 'owner', 'admin')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('UsersService.assertCanAssignRole — known-role table (identical to base semantics)', () => {
  const slugs = Object.keys(ROLE_HIERARCHY);
  const bypass = new Set(['owner', 'tenant_owner', 'super_admin']);
  // No DB rows: levels come from ROLE_HIERARCHY, is_assignable is unset (covered elsewhere).
  const cases: Array<[string, string, boolean]> = [];
  for (const actor of slugs) {
    for (const target of slugs) {
      const ok =
        bypass.has(actor) || ROLE_HIERARCHY[target] < ROLE_HIERARCHY[actor];
      cases.push([actor, target, ok]);
    }
  }

  it('covers all 20 slugs', () => {
    expect(slugs).toHaveLength(20);
    expect(cases).toHaveLength(400);
  });

  it.each(cases)('actor=%s target=%s allowed=%s (code-map levels, no DB rows)', async (actor, target, ok) => {
    const svc = makeService([]);
    const res = call(svc, actor, target);
    if (ok) await expect(res).resolves.toBeUndefined();
    else await expect(res).rejects.toBeInstanceOf(BadRequestException);
  });
});
