import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { AdminUsersService } from './admin-users.service';

jest.mock('@supabase/supabase-js', () => {
  const listUsers = jest.fn();
  const ctor = jest.fn(() => ({ auth: { admin: { listUsers } } }));
  return { createClient: ctor, __listUsers: listUsers };
});

const listUsersMock = () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@supabase/supabase-js').__listUsers as jest.Mock;
};

/**
 * Decision Gate item 6 (GAP-07): Admin Users needs real MFA/last-login without
 * N+1 per user — listUsers() paginated once, with a short cache, assembled into a Map.
 */
function makeService() {
  const ds = { query: jest.fn().mockResolvedValue([]) };
  const config = { getOrThrow: jest.fn((k: string) => `fake-${k}`) };
  const svc = new AdminUsersService(ds as never, config as unknown as ConfigService);
  return { svc, ds };
}

describe('AdminUsersService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('joins org_members + tenants + roles and enriches with MFA/last_login by auth_user_id', async () => {
    const { svc, ds } = makeService();
    ds.query.mockResolvedValueOnce([
      {
        id: 'm1', auth_user_id: 'auth-1', name: 'Ana', email: 'ana@x.com',
        role_slug: 'admin', role_name: 'Administrador', tenant_id: 't1', tenant_name: 'Tenant 1',
        status: 'active', joined_at: '2026-01-01T00:00:00Z',
      },
    ]);
    listUsersMock().mockResolvedValueOnce({
      data: { users: [{ id: 'auth-1', last_sign_in_at: '2026-08-01T00:00:00Z', factors: [{ status: 'verified' }] }] },
      error: null,
    });

    const result = await svc.list({});

    expect(result).toEqual([
      expect.objectContaining({
        id: 'm1', last_login: '2026-08-01T00:00:00Z', mfa_enabled: true, sessions_count: null,
      }),
    ]);
  });

  it('never fabricates sessions_count — always null even when auth resolves', async () => {
    const { svc, ds } = makeService();
    ds.query.mockResolvedValueOnce([
      { id: 'm1', auth_user_id: 'auth-1', name: 'Ana', email: 'ana@x.com', role_slug: 'admin', role_name: 'Administrador', tenant_id: 't1', tenant_name: 'T1', status: 'active', joined_at: null },
    ]);
    listUsersMock().mockResolvedValueOnce({ data: { users: [{ id: 'auth-1', last_sign_in_at: null, factors: [] }] }, error: null });

    const [row] = await svc.list({});
    expect(row!.sessions_count).toBeNull();
  });

  it('marks MFA/last_login as unavailable (null) when the member does not appear in auth', async () => {
    const { svc, ds } = makeService();
    ds.query.mockResolvedValueOnce([
      { id: 'm1', auth_user_id: 'auth-orphan', name: 'Ana', email: 'ana@x.com', role_slug: 'admin', role_name: 'Administrador', tenant_id: 't1', tenant_name: 'T1', status: 'active', joined_at: null },
    ]);
    listUsersMock().mockResolvedValueOnce({ data: { users: [] }, error: null });

    const [row] = await svc.list({});
    expect(row!.last_login).toBeNull();
    expect(row!.mfa_enabled).toBeNull();
  });

  it('does not fabricate data when listUsers fails — proceeds with auth unavailable for everyone', async () => {
    const { svc, ds } = makeService();
    ds.query.mockResolvedValueOnce([
      { id: 'm1', auth_user_id: 'auth-1', name: 'Ana', email: 'ana@x.com', role_slug: 'admin', role_name: 'Administrador', tenant_id: 't1', tenant_name: 'T1', status: 'active', joined_at: null },
    ]);
    listUsersMock().mockRejectedValueOnce(new Error('network down'));

    const [row] = await svc.list({});
    expect(row!.last_login).toBeNull();
    expect(row!.mfa_enabled).toBeNull();
  });

  it('reuses the auth cache within the TTL window — does not call listUsers again', async () => {
    const { svc, ds } = makeService();
    ds.query.mockResolvedValue([]);
    listUsersMock().mockResolvedValue({ data: { users: [] }, error: null });

    await svc.list({});
    await svc.list({});

    expect(listUsersMock()).toHaveBeenCalledTimes(1);
  });

  it('applies the email/name/tenant search filter as a parameter (no unsafe concatenation)', async () => {
    const { svc, ds } = makeService();
    listUsersMock().mockResolvedValueOnce({ data: { users: [] }, error: null });

    await svc.list({ search: 'Ana' });

    expect(ds.query).toHaveBeenCalledWith(
      expect.stringContaining('lower(m.email) LIKE $1'),
      ['%ana%'],
    );
  });

  it('filters by status active/blocked via m.is_active', async () => {
    const { svc, ds } = makeService();
    listUsersMock().mockResolvedValueOnce({ data: { users: [] }, error: null });

    await svc.list({ status: 'blocked' });

    expect(ds.query).toHaveBeenCalledWith(
      expect.stringContaining('m.is_active = $1'),
      [false],
    );
  });
});
