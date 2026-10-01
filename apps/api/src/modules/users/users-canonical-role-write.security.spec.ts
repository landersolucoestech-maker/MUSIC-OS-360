import { BadRequestException } from '@nestjs/common';

const mockInvite = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockGenerateLink = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { admin: { inviteUserByEmail: mockInvite, updateUserById: mockUpdate, deleteUser: mockDelete, generateLink: mockGenerateLink } },
  }),
}));

import { MembershipRoleResolverService } from './membership-role-resolver.service';
import { UsersService } from './users.service';

/**
 * RBAC S4a: writers canonicalize legacy role slugs (juridico -> legal, ..., artista -> artist) for
 * org_members.role, the domain event and the Supabase invite/app_metadata role claim, while role_id still
 * follows canonical_role_id (legacy row). Canonical writes happen ONLY when the roles table proves the
 * canonical slug resolves to the same role row. Authorization (assertCanAssignRole) is identical for both forms.
 */
const T = 'tenant-a';
const OTHER_T = 'tenant-b';

interface Row {
  id: string; tenant_id: string | null; slug: string; hierarchy_level: number; is_assignable: boolean;
  canonical_role_id: string | null; archived_at: Date | null; deleted_at: Date | null;
}
const g = (id: string, slug: string, level: number, extra: Partial<Row> = {}): Row => ({
  id, tenant_id: null, slug, hierarchy_level: level, is_assignable: true, canonical_role_id: null,
  archived_at: null, deleted_at: null, ...extra,
});
const PAIRS: ReadonlyArray<readonly [legacy: string, canonical: string, level: number]> = [
  ['juridico', 'legal', 55], ['comercial', 'sales', 45], ['produtor', 'producer', 40],
  ['colaborador', 'collaborator', 20], ['rh_manager', 'hr_manager', 55],
];

function catalog(extra: Row[] = [], opts: { withAliases?: boolean } = {}): Row[] {
  const rows: Row[] = [
    g('r-owner', 'owner', 90), g('r-admin', 'admin', 80), g('r-manager', 'manager', 70), g('r-editor', 'editor', 60),
    g('r-viewer', 'viewer', 10), g('r-super', 'super_admin', 100, { is_assignable: false }),
    g('r-artist', 'artist', 30), g('r-artista', 'artista', 30, { canonical_role_id: 'r-artist' }),
  ];
  for (const [legacy, canonical, level] of PAIRS) {
    rows.push(g(`r-${legacy}`, legacy, level));
    if (opts.withAliases !== false) rows.push(g(`r-${canonical}`, canonical, level, { is_assignable: false, canonical_role_id: `r-${legacy}` }));
  }
  return [...rows, ...extra];
}

function harness(roles: Row[], member: Record<string, unknown> | null = { id: 'm1', tenant_id: T, role: 'editor', auth_user_id: 'auth-1', updated_at: new Date() }) {
  const live = (r: Row) => !r.deleted_at;
  const dsQuery = jest.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('SELECT "id", "tenant_id", "canonical_role_id"')) {
      const [slug, tenant] = params as [string, string];
      const rows = roles.filter((r) => r.slug === slug && (r.tenant_id === tenant || r.tenant_id === null))
        .sort((a, b) => Number(b.tenant_id === tenant) - Number(a.tenant_id === tenant));
      return rows.slice(0, 1);
    }
    if (sql.includes('"tenant_id" IS NOT NULL AND "tenant_id" <> $2')) return [];
    if (sql.includes('SELECT "id", "archived_at", "deleted_at" FROM "roles" WHERE "id" = $1')) {
      return roles.filter((r) => r.id === (params[0] as string));
    }
    throw new Error(`unexpected ds query ${sql.slice(0, 60)}`);
  });
  const resolver = new MembershipRoleResolverService({ query: dsQuery } as never);

  const managerQuery = jest.fn(async (sql: string, params: unknown[] = []) => {
    if (sql.includes('SELECT "slug", "hierarchy_level", "is_assignable"')) {
      const [slugs, tenant] = params as [string[], string];
      return roles.filter((r) => live(r) && !r.archived_at && slugs.includes(r.slug) && (r.tenant_id === tenant || r.tenant_id === null))
        .sort((a, b) => Number(b.tenant_id === null) - Number(a.tenant_id === null))
        .map((r) => ({ slug: r.slug, hierarchy_level: r.hierarchy_level, is_assignable: r.is_assignable, tenant_id: r.tenant_id }));
    }
    if (sql.includes('SELECT "slug" FROM "roles"')) {
      const [id, tenant] = params as [string, string];
      return roles.filter((r) => r.id === id && (r.tenant_id === tenant || r.tenant_id === null) && r.is_assignable && !r.archived_at && !r.deleted_at).map((r) => ({ slug: r.slug }));
    }
    if (sql.includes('FROM "tenant_invitations" invitation')) return invitationRows;
    if (sql.includes('FROM "tenants"')) return [{ org_id: 'org-a', slug: 'tenant-a' }];
    if (sql.includes('FROM "org_members"') || sql.includes('FROM "tenant_invitations"')) return [];
    if (sql.includes('UPDATE "tenant_invitations"')) return [];
    if (sql.includes('INSERT INTO "tenant_invitations"')) return [{ id: 'inv-1', role_id: params[3] }];
    throw new Error(`unexpected manager query ${sql.slice(0, 70)}`);
  });
  let invitationRows: Array<Record<string, unknown>> = [];
  const qb: any = {
    select: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(), andWhere: jest.fn().mockReturnThis(),
    getOne: jest.fn(), getCount: jest.fn().mockResolvedValue(2), orderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(), take: jest.fn().mockReturnThis(), getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
  };
  qb.getOne.mockImplementation(async () => member);
  const saved: Array<Record<string, unknown>> = [];
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    manager: { query: managerQuery },
    create: jest.fn((v: unknown) => v),
    save: jest.fn(async (v: Record<string, unknown>) => { saved.push(v); return { id: 'new-m', ...v }; }),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  const events = { emitTyped: jest.fn() };
  const config = { get: () => undefined, getOrThrow: () => 'x' };
  const mail = { send: jest.fn(), inviteHtml: jest.fn().mockReturnValue('<html/>') };
  const svc = new UsersService(
    { getRepository: () => repo } as never, events as never, resolver, { delete: jest.fn() } as never,
    config as never, mail as never, { enforce: jest.fn() } as never,
  );
  return {
    svc, repo, qb, saved, events, managerQuery,
    setInvitations: (rows: Array<Record<string, unknown>>) => { invitationRows = rows; },
    setMember: (m: Record<string, unknown> | null) => qb.getOne.mockImplementation(async () => m),
  };
}

const createDto = (role: string) => ({ userId: 'u-new', email: 'n@example.com', role } as never);

function firstCreateLookups(h: ReturnType<typeof harness>) {
  // findByUserId -> no existing member, then anyMember (org lookup)
  h.qb.getOne.mockReset();
  h.qb.getOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ org_id: 'org-a' });
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env['RBAC_CANONICAL_ROLE_WRITE'];
  mockInvite.mockResolvedValue({ data: { user: { id: 'auth-new' } }, error: null });
  mockUpdate.mockResolvedValue({ error: null });
  mockGenerateLink.mockResolvedValue({ data: { properties: { action_link: 'https://x/y' } }, error: null });
});
afterEach(() => { delete process.env['RBAC_CANONICAL_ROLE_WRITE']; });

describe('create(): canonical slug is persisted, role_id stays the legacy row', () => {
  it.each(PAIRS)('%s -> persists %s with role_id of the legacy row; %s input is persisted as-is', async (legacy, canonical) => {
    for (const input of [legacy, canonical]) {
      const h = harness(catalog());
      firstCreateLookups(h);
      await h.svc.create(T, createDto(input), 'inviter', 'owner');
      expect(h.saved[0]).toMatchObject({ role: canonical, role_id: `r-${legacy}`, tenant_id: T });
      expect(h.events.emitTyped).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ payload: expect.objectContaining({ role: canonical }) }));
    }
  });

  it('artista -> artist (role_id is the canonical artist row); unmapped roles are untouched', async () => {
    const h = harness(catalog());
    firstCreateLookups(h);
    await h.svc.create(T, createDto('artista'), 'i', 'owner');
    expect(h.saved[0]).toMatchObject({ role: 'artist', role_id: 'r-artist' });
    const h2 = harness(catalog());
    firstCreateLookups(h2);
    await h2.svc.create(T, createDto('editor'), 'i', 'owner');
    expect(h2.saved[0]).toMatchObject({ role: 'editor', role_id: 'r-editor' });
  });

  it('keeps the legacy slug when the canonical alias row does not exist yet (code deployed before the migration)', async () => {
    const h = harness(catalog([], { withAliases: false }));
    firstCreateLookups(h);
    await h.svc.create(T, createDto('juridico'), 'i', 'owner');
    expect(h.saved[0]).toMatchObject({ role: 'juridico', role_id: 'r-juridico' });
  });

  it('keeps the legacy slug when the alias row is archived or points to another role (proof fails)', async () => {
    for (const tweak of [
      (rows: Row[]) => rows.map((r) => (r.slug === 'legal' ? { ...r, archived_at: new Date() } : r)),
      (rows: Row[]) => rows.map((r) => (r.slug === 'legal' ? { ...r, canonical_role_id: 'r-comercial' } : r)),
    ]) {
      const h = harness(tweak(catalog()));
      firstCreateLookups(h);
      await h.svc.create(T, createDto('juridico'), 'i', 'owner');
      expect(h.saved[0]).toMatchObject({ role: 'juridico', role_id: 'r-juridico' });
    }
  });

  it('a tenant custom role squatting on the canonical slug never lends its identity: legacy slug kept, English input rejected', async () => {
    const squat = g('r-tenant-legal', 'legal', 10, { tenant_id: T });
    const h = harness(catalog([squat]));
    firstCreateLookups(h);
    await h.svc.create(T, createDto('juridico'), 'i', 'owner');
    expect(h.saved[0]).toMatchObject({ role: 'juridico', role_id: 'r-juridico' });

    const h2 = harness(catalog([squat]));
    firstCreateLookups(h2);
    await expect(h2.svc.create(T, createDto('legal'), 'i', 'owner')).rejects.toBeInstanceOf(BadRequestException);
    expect(h2.saved).toHaveLength(0);
  });

  it('a squatting role in ANOTHER tenant is invisible here and changes nothing', async () => {
    const h = harness(catalog([g('r-other-legal', 'legal', 10, { tenant_id: OTHER_T })]));
    firstCreateLookups(h);
    await h.svc.create(T, createDto('juridico'), 'i', 'owner');
    expect(h.saved[0]).toMatchObject({ role: 'legal', role_id: 'r-juridico' });
  });

  it('kill switch RBAC_CANONICAL_ROLE_WRITE=false writes the legacy form for every input (rollback, both stay accepted)', async () => {
    process.env['RBAC_CANONICAL_ROLE_WRITE'] = 'false';
    for (const [legacy, canonical] of PAIRS) {
      for (const input of [legacy, canonical]) {
        const h = harness(catalog());
        firstCreateLookups(h);
        await h.svc.create(T, createDto(input), 'i', 'owner');
        expect(h.saved[0]).toMatchObject({ role: legacy, role_id: `r-${legacy}` });
      }
    }
  });

  it('resolver failure while proving the canonical slug degrades to the legacy slug, never to a guess', async () => {
    const h = harness(catalog());
    firstCreateLookups(h);
    const original = MembershipRoleResolverService.prototype.classify;
    const classify = jest.spyOn(MembershipRoleResolverService.prototype, 'classify');
    // 1st call = resolveOrThrow of the sent slug (real); 2nd call = canonical proof -> DB failure
    classify.mockImplementationOnce(function (this: MembershipRoleResolverService, ...args: Parameters<typeof original>) {
      return original.apply(this, args);
    });
    classify.mockRejectedValueOnce(new Error('db down'));
    await h.svc.create(T, createDto('juridico'), 'i', 'owner');
    expect(h.saved[0]).toMatchObject({ role: 'juridico', role_id: 'r-juridico' });
    classify.mockRestore();
  });
});

describe('create()/assignRole(): authorization is identical for the legacy and the canonical slug', () => {
  const ACTORS = ['owner', 'tenant_owner', 'super_admin', 'admin', 'manager', 'editor', 'viewer', 'legal', 'juridico', 'sales', 'comercial', 'collaborator', 'colaborador', 'artist', 'artista'];

  async function outcome(actor: string, target: string): Promise<'ok' | 'rejected'> {
    const rows = catalog([g('r-tenant-x', 'tenant_x', 1, { tenant_id: T })]);
    if (!rows.some((r) => r.slug === actor)) rows.push(g(`r-${actor}`, actor, 90));
    const h = harness(rows);
    firstCreateLookups(h);
    try {
      await h.svc.create(T, createDto(target), 'i', actor);
      return 'ok';
    } catch (err) {
      if (err instanceof BadRequestException) return 'rejected';
      throw err;
    }
  }

  it.each(PAIRS)('create(target=%s) and create(target=%s) are allowed/denied the same for every actor', async (legacy, canonical) => {
    for (const actor of ACTORS) {
      expect({ actor, res: await outcome(actor, canonical) }).toEqual({ actor, res: await outcome(actor, legacy) });
    }
  });

  it.each(PAIRS)('ceiling: manager may assign %s/%s; an equal-level holder or a viewer may not', async (legacy, canonical) => {
    expect(await outcome('manager', legacy)).toBe('ok');
    expect(await outcome('manager', canonical)).toBe('ok');
    // target level >= actor level is rejected unless the actor is owner-class (same for both forms)
    for (const actor of [legacy, canonical]) {
      for (const target of [legacy, canonical]) expect(await outcome(actor, target)).toBe('rejected');
    }
    expect(await outcome('viewer', legacy)).toBe('rejected');
    expect(await outcome('viewer', canonical)).toBe('rejected');
  });

  it('super_admin, owner and admin-only escalations stay closed for canonical slugs: nobody can assign super_admin', async () => {
    for (const actor of ['owner', 'tenant_owner', 'super_admin', 'admin']) {
      expect(await outcome(actor, 'super_admin')).toBe('rejected');
    }
  });

  it('canonical slug is assignable exactly while the legacy twin is (twin assignable=false closes both)', async () => {
    const rows = catalog().map((r) => (r.slug === 'juridico' ? { ...r, is_assignable: false } : r));
    for (const target of ['juridico', 'legal']) {
      const h = harness(rows);
      firstCreateLookups(h);
      await expect(h.svc.create(T, createDto(target), 'i', 'owner')).rejects.toBeInstanceOf(BadRequestException);
    }
  });

  it('after a future in-place rename (no legacy twin row, English row assignable) the English slug is assignable by its own row', async () => {
    const rows = catalog().filter((r) => r.slug !== 'juridico').map((r) => (r.slug === 'legal' ? { ...r, is_assignable: true, canonical_role_id: null } : r));
    const h = harness(rows);
    firstCreateLookups(h);
    await expect(h.svc.create(T, createDto('legal'), 'i', 'owner')).resolves.toBeDefined();
  });

  it('without the twin row the alias keeps its own non-assignable row (code-before-migration window stays closed)', async () => {
    const rows = catalog().filter((r) => r.slug !== 'juridico');
    const h = harness(rows);
    firstCreateLookups(h);
    await expect(h.svc.create(T, createDto('legal'), 'i', 'owner')).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['ghost', 'LEGAL', 'Legal', 'legal ', 'constructor', '__proto__', 'toString', 'hasOwnProperty', 'admin_master', 'ar_gestao', 'financeiro_contabil', 'leitor', ''])(
    'unknown role %j is rejected for every actor, including owner and super_admin, and nothing is written',
    async (role) => {
      for (const actor of ['owner', 'super_admin', 'admin', 'manager']) {
        const h = harness(catalog());
        firstCreateLookups(h);
        await expect(h.svc.create(T, createDto(role), 'i', actor)).rejects.toBeInstanceOf(BadRequestException);
        expect(h.saved).toHaveLength(0);
      }
    },
  );

  it('an actor holding a canonical slug gets the same ceiling as with the legacy slug', async () => {
    for (const target of ['viewer', 'collaborator', 'colaborador', 'artist', 'legal', 'editor']) {
      expect(await outcome('legal', target)).toBe(await outcome('juridico', target));
      expect(await outcome('sales', target)).toBe(await outcome('comercial', target));
    }
  });
});

describe('assignRole(): persists the canonical slug with the legacy role_id, CAS and owner protection intact', () => {
  it.each(PAIRS)('assignRole(%s) writes role=%s, role_id=legacy row', async (legacy, canonical) => {
    const h = harness(catalog());
    await h.svc.assignRole(T, 'm1', legacy, 'owner');
    expect(h.repo.update).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ role: canonical, role_id: `r-${legacy}` }));
  });

  it('refuses to demote the last owner regardless of the slug form being assigned', async () => {
    for (const role of ['legal', 'juridico']) {
      const h = harness(catalog(), { id: 'm1', tenant_id: T, role: 'owner', auth_user_id: 'auth-1', updated_at: new Date() });
      h.qb.getCount.mockResolvedValue(0);
      await expect(h.svc.assignRole(T, 'm1', role, 'owner')).rejects.toBeInstanceOf(BadRequestException);
      expect(h.repo.update).not.toHaveBeenCalled();
    }
  });

  it('a viewer cannot assign a canonical role above their ceiling and owner is never reachable through an alias', async () => {
    const h = harness(catalog());
    await expect(h.svc.assignRole(T, 'm1', 'legal', 'viewer')).rejects.toBeInstanceOf(BadRequestException);
    await expect(h.svc.assignRole(T, 'm1', 'owner', 'manager')).rejects.toBeInstanceOf(BadRequestException);
    expect(h.repo.update).not.toHaveBeenCalled();
  });
});

describe('invite()/resendInvitation(): the Supabase role claim carries the canonical slug', () => {
  it('invite by the assignable legacy row id sends canonical role in invite metadata and app_metadata; membership is canonical too', async () => {
    const h = harness(catalog());
    // invite: findByUserId -> none; anyMember -> org
    h.qb.getOne.mockReset();
    h.qb.getOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ org_id: 'org-a' });
    await h.svc.invite(T, 'new@example.com', 'r-juridico', 'inviter', 'owner');
    expect(mockInvite).toHaveBeenCalledWith('new@example.com', expect.objectContaining({ data: expect.objectContaining({ role: 'legal' }) }));
    expect(mockUpdate).toHaveBeenCalledWith('auth-new', { app_metadata: { org_id: T, role: 'legal' } });
    expect(h.saved[0]).toMatchObject({ role: 'legal', role_id: 'r-juridico' });
  });

  it('invite cannot use the inert canonical alias row id (not assignable), nor escalate via another tenant role', async () => {
    const h = harness(catalog([g('r-other', 'legal', 10, { tenant_id: OTHER_T })]));
    await expect(h.svc.invite(T, 'x@example.com', 'r-legal', 'inviter', 'owner')).rejects.toThrow();
    await expect(h.svc.invite(T, 'x@example.com', 'r-other', 'inviter', 'owner')).rejects.toThrow();
    expect(mockInvite).not.toHaveBeenCalled();
  });

  it('invite with the kill switch keeps the legacy claim', async () => {
    process.env['RBAC_CANONICAL_ROLE_WRITE'] = 'false';
    const h = harness(catalog());
    h.qb.getOne.mockReset();
    h.qb.getOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ org_id: 'org-a' });
    await h.svc.invite(T, 'new@example.com', 'r-juridico', 'inviter', 'owner');
    expect(mockUpdate).toHaveBeenCalledWith('auth-new', { app_metadata: { org_id: T, role: 'juridico' } });
    expect(h.saved[0]).toMatchObject({ role: 'juridico' });
  });

  it('resendInvitation regenerates the link with the canonical role', async () => {
    const h = harness(catalog());
    h.setInvitations([{ id: 'inv-1', email: 'a@example.com', role_slug: 'juridico', tenant_name: 'T' }]);
    await h.svc.resendInvitation(T, 'inv-1', 'inviter', 'owner');
    expect(mockGenerateLink).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ data: { tenant_id: T, role: 'legal' } }) }));
  });
});

describe('list(): a role filter matches members persisted under either form', () => {
  it.each([['juridico', ['legal', 'juridico']], ['legal', ['legal', 'juridico']], ['artista', ['artist', 'artista']], ['admin', ['admin']], ['ghost', ['ghost']]] as const)(
    'filter %s -> %j',
    async (role, expected) => {
      const h = harness(catalog());
      await h.svc.list(T, { role } as never);
      expect(h.qb.andWhere).toHaveBeenCalledWith('m.role IN (:...roles)', { roles: expected });
    },
  );
});
