import { BadRequestException } from '@nestjs/common';
import { UsersService } from './users.service';

/**
 * assertCanAssignRole guards the English-alias twin lookup with isEnglishRoleAlias (OWN-property check).
 * An inherited key (constructor, toString, __proto__) must never become a "twin slug" pushed into the
 * SQL ANY($1) array, and a role without a known level stays unassignable (fail closed).
 */
describe('UsersService.assertCanAssignRole English alias guard', () => {
  type Row = { slug: string; hierarchy_level: number; is_assignable: boolean | null; tenant_id?: string | null };
  function build(rows: Row[]) {
    const query = jest.fn().mockResolvedValue(rows);
    const repository = { manager: { query } };
    const dataSource = { getRepository: jest.fn().mockReturnValue(repository) };
    const svc = new UsersService(
      dataSource as never, { emitTyped: jest.fn() } as never, {} as never, { delete: jest.fn() } as never, {} as never, {} as never, {} as never,
    );
    return { svc, query };
  }
  const call = (svc: UsersService, actor: string, target: string) => svc['assertCanAssignRole']('tenant-a', actor, target);

  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'target %s fails closed (ROLE_UNKNOWN) and the roles query only receives string slugs',
    async (target) => {
      const { svc, query } = build([{ slug: 'manager', hierarchy_level: 70, is_assignable: true }]);
      const err = await call(svc, 'manager', target).catch((e) => e);
      expect(err).toBeInstanceOf(BadRequestException);
      expect((err as BadRequestException).getResponse()).toMatchObject({ error: 'ROLE_UNKNOWN' });
      const slugs = query.mock.calls[0][1][0] as unknown[];
      expect(slugs).toEqual(['manager', target]);
      expect(slugs.every((s) => typeof s === 'string')).toBe(true);
    },
  );

  it('an English alias target adds exactly its legacy global twin to the lookup and inherits the twin policy', async () => {
    const { svc, query } = build([
      { slug: 'manager', hierarchy_level: 70, is_assignable: true, tenant_id: null },
      { slug: 'juridico', hierarchy_level: 55, is_assignable: true, tenant_id: null },
    ]);
    await expect(call(svc, 'manager', 'legal')).resolves.toBeUndefined();
    expect(query.mock.calls[0][1][0]).toEqual(['manager', 'legal', 'juridico']);
  });

  it('an English alias whose twin is non-assignable is rejected', async () => {
    const { svc } = build([
      { slug: 'manager', hierarchy_level: 70, is_assignable: true, tenant_id: null },
      { slug: 'juridico', hierarchy_level: 55, is_assignable: false, tenant_id: null },
    ]);
    await expect(call(svc, 'manager', 'legal')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('a non-alias slug adds no twin to the lookup', async () => {
    const { svc, query } = build([
      { slug: 'manager', hierarchy_level: 70, is_assignable: true },
      { slug: 'editor', hierarchy_level: 60, is_assignable: true },
    ]);
    await call(svc, 'manager', 'editor');
    expect(query.mock.calls[0][1][0]).toEqual(['manager', 'editor']);
  });
});
