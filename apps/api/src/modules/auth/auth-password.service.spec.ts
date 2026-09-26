import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { AuthPasswordService } from './auth-password.service';
import type { JwtAuth } from '../../core/guards/auth.guard';
import type { ChangeRequiredPasswordDto } from './dto/change-required-password.dto';

const updateUserByIdMock = jest.fn();
const signOutAdminMock = jest.fn();
const signInWithPasswordMock = jest.fn();
const signOutAnonMock = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn((_url: string, key: string) => {
    if (key === 'anon-key') {
      return {
        auth: {
          signInWithPassword: signInWithPasswordMock,
          signOut: signOutAnonMock,
        },
      };
    }
    return {
      auth: {
        admin: {
          updateUserById: updateUserByIdMock,
          signOut: signOutAdminMock,
        },
      },
    };
  }),
}));

function buildAuth(appMetadata: Record<string, unknown>, email = 'owner@lander.example'): JwtAuth {
  return {
    userId: 'user-1',
    sessionId: 'sess-1',
    orgId: 'org-1',
    orgRole: 'owner',
    claims: { app_metadata: appMetadata, email },
  };
}

const STRONG_PASSWORD = 'Correto-Cavalo9Bateria!';

function dto(newPassword: string, confirmPassword = newPassword): ChangeRequiredPasswordDto {
  return { newPassword, confirmPassword };
}

describe('AuthPasswordService.changeRequiredPassword', () => {
  const fullConfig = {
    get: (key: string) =>
      ({
        SUPABASE_URL: 'https://test.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        SUPABASE_ANON_KEY: 'anon-key',
      })[key],
  } as any;

  beforeEach(() => {
    updateUserByIdMock.mockReset();
    signOutAdminMock.mockReset().mockResolvedValue({ data: null, error: null });
    signInWithPasswordMock.mockReset().mockResolvedValue({ data: { session: null }, error: { message: 'invalid credentials' } });
    signOutAnonMock.mockReset().mockResolvedValue({ error: null });
  });

  it('rejects when newPassword and confirmPassword diverge, without calling Supabase', async () => {
    const audit = { log: jest.fn() };
    const svc = new AuthPasswordService(fullConfig, null, audit as any);

    await expect(
      svc.changeRequiredPassword(buildAuth({ must_change_password: true }), 'tenant-1', dto(STRONG_PASSWORD, 'outra-coisa'), null),
    ).rejects.toThrow(BadRequestException);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('rejects a weak password before calling Supabase, listing the pending requirements', async () => {
    const audit = { log: jest.fn() };
    const svc = new AuthPasswordService(fullConfig, null, audit as any);

    await expect(
      svc.changeRequiredPassword(buildAuth({ must_change_password: true }), 'tenant-1', dto('fraca123'), null),
    ).rejects.toThrow(BadRequestException);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('rejects reuse of the current provisional password when technically verifiable (successful test sign-in)', async () => {
    signInWithPasswordMock.mockResolvedValue({ data: { session: { access_token: 'x' } }, error: null });
    const audit = { log: jest.fn() };
    const svc = new AuthPasswordService(fullConfig, null, audit as any);

    await expect(
      svc.changeRequiredPassword(buildAuth({ must_change_password: true }), 'tenant-1', dto(STRONG_PASSWORD), null),
    ).rejects.toThrow(BadRequestException);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
    expect(signOutAnonMock).toHaveBeenCalled(); // does not leave the test session alive
  });

  it('does not block the change when the reuse check is not verifiable (no SUPABASE_ANON_KEY)', async () => {
    const configSemAnon = {
      get: (key: string) => ({ SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-role-key' })[key],
    } as any;
    updateUserByIdMock.mockResolvedValue({ data: {}, error: null });
    const audit = { log: jest.fn() };
    const svc = new AuthPasswordService(configSemAnon, null, audit as any);

    await expect(
      svc.changeRequiredPassword(buildAuth({ must_change_password: true }), 'tenant-1', dto(STRONG_PASSWORD), null),
    ).resolves.toEqual({ passwordChanged: true, mustRefreshSession: true });
    expect(signInWithPasswordMock).not.toHaveBeenCalled();
  });

  it('changes the password and clears must_change_password IN THE SAME Admin API call, preserving the rest of app_metadata', async () => {
    updateUserByIdMock.mockResolvedValue({ data: {}, error: null });
    const audit = { log: jest.fn() };
    const svc = new AuthPasswordService(fullConfig, null, audit as any);

    const result = await svc.changeRequiredPassword(
      buildAuth({ org_id: 'org-1', role: 'owner', must_change_password: true }),
      'tenant-1',
      dto(STRONG_PASSWORD),
      null,
    );

    expect(result).toEqual({ passwordChanged: true, mustRefreshSession: true });
    expect(updateUserByIdMock).toHaveBeenCalledWith('user-1', {
      password: STRONG_PASSWORD,
      app_metadata: { org_id: 'org-1', role: 'owner', must_change_password: false },
    });
  });

  it('audits user.password_changed only after confirmed success', async () => {
    updateUserByIdMock.mockResolvedValue({ data: {}, error: null });
    const audit = { log: jest.fn() };
    const svc = new AuthPasswordService(fullConfig, null, audit as any);

    await svc.changeRequiredPassword(buildAuth({ must_change_password: true }), 'tenant-1', dto(STRONG_PASSWORD), null);

    expect(audit.log).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      orgId: 'org-1',
      userId: 'user-1',
      actorRole: 'owner',
      action: 'user.password_changed',
      entity: 'user',
      entityId: 'user-1',
    }));
  });

  it('if Supabase rejects the change, must_change_password remains true (nothing changes) and it never audits', async () => {
    updateUserByIdMock.mockResolvedValue({ data: null, error: { message: 'boom' } });
    const audit = { log: jest.fn() };
    const svc = new AuthPasswordService(fullConfig, null, audit as any);

    await expect(
      svc.changeRequiredPassword(buildAuth({ must_change_password: true }), 'tenant-1', dto(STRONG_PASSWORD), null),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(audit.log).not.toHaveBeenCalled();
  });

  it('throws ServiceUnavailableException without SUPABASE_URL/SERVICE_ROLE_KEY, never attempts to call the API', async () => {
    const emptyConfig = { get: () => undefined } as any;
    const audit = { log: jest.fn() };
    const svc = new AuthPasswordService(emptyConfig, null, audit as any);

    await expect(
      svc.changeRequiredPassword(buildAuth({ must_change_password: true }), 'tenant-1', dto(STRONG_PASSWORD), null),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(updateUserByIdMock).not.toHaveBeenCalled();
  });

  it('revokes other sessions via admin.signOut(accessToken, "others") when an access token is provided', async () => {
    updateUserByIdMock.mockResolvedValue({ data: {}, error: null });
    const audit = { log: jest.fn() };
    const svc = new AuthPasswordService(fullConfig, null, audit as any);

    await svc.changeRequiredPassword(buildAuth({ must_change_password: true }), 'tenant-1', dto(STRONG_PASSWORD), 'current-access-token');

    expect(signOutAdminMock).toHaveBeenCalledWith('current-access-token', 'others');
  });

  it('failing to revoke other sessions does not undo the already-confirmed success of the password change', async () => {
    updateUserByIdMock.mockResolvedValue({ data: {}, error: null });
    signOutAdminMock.mockRejectedValue(new Error('revoke failed'));
    const audit = { log: jest.fn() };
    const svc = new AuthPasswordService(fullConfig, null, audit as any);

    await expect(
      svc.changeRequiredPassword(buildAuth({ must_change_password: true }), 'tenant-1', dto(STRONG_PASSWORD), 'token'),
    ).resolves.toEqual({ passwordChanged: true, mustRefreshSession: true });
    expect(audit.log).toHaveBeenCalled();
  });

  it('never includes the password in plain text in the audit call', async () => {
    updateUserByIdMock.mockResolvedValue({ data: {}, error: null });
    const audit = { log: jest.fn() };
    const svc = new AuthPasswordService(fullConfig, null, audit as any);

    await svc.changeRequiredPassword(buildAuth({ must_change_password: true }), 'tenant-1', dto(STRONG_PASSWORD), null);

    const call = audit.log.mock.calls[0][0];
    expect(JSON.stringify(call)).not.toContain(STRONG_PASSWORD);
  });
});
