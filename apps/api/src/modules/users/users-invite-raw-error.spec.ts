import { ConflictException, Logger } from '@nestjs/common';

const RAW = 'ECONNREFUSED 10.0.0.5:5432 password authentication failed';
const mockInvite = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockGenerateLink = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      admin: {
        inviteUserByEmail: mockInvite,
        updateUserById: mockUpdate,
        deleteUser: mockDelete,
        generateLink: mockGenerateLink,
      },
    },
  }),
}));

import { UsersService } from './users.service';

/** Supabase auth error text is a technical diagnostic: logged, never returned to the browser. */
describe('UsersService invitations - provider error text never reaches the response', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();
    mockDelete.mockResolvedValue({});
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });
  afterEach(() => jest.restoreAllMocks());

  function build(query: jest.Mock) {
    const dataSource = { getRepository: () => ({ manager: { query } }) };
    const config = { get: () => undefined, getOrThrow: () => 'x' };
    return new UsersService(
      dataSource as never,
      { emitTyped: jest.fn() } as never,
      {} as never,
      {} as never,
      config as never,
      { send: jest.fn(), inviteHtml: jest.fn() } as never,
      { enforce: jest.fn() } as never,
    );
  }

  function inviteQueries() {
    return jest.fn()
      .mockResolvedValueOnce([{ slug: 'editor' }])
      .mockResolvedValueOnce([{ slug: 'owner', hierarchy_level: 100 }])
      .mockResolvedValueOnce([{ org_id: 'o', slug: 's' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
  }

  async function bodyOf(p: Promise<unknown>) {
    const thrown = await p.catch((e: unknown) => e);
    expect(thrown).toBeInstanceOf(ConflictException);
    const body = (thrown as ConflictException).getResponse() as { message: string; error: string };
    expect(JSON.stringify(body)).not.toContain('ECONNREFUSED');
    expect(JSON.stringify(body)).not.toContain('password authentication');
    return body;
  }

  it('invite: inviteUserByEmail failure', async () => {
    mockInvite.mockResolvedValue({ data: { user: null }, error: { message: RAW } });
    const body = await bodyOf(build(inviteQueries()).invite('t', 'a@b.co', 'r', 'i', 'owner'));
    expect(body).toEqual({ message: 'Não foi possível criar o convite. Tente novamente.', error: 'INVITE_CREATE_FAILED' });
    expect(warn.mock.calls.some(([m]) => String(m).includes(RAW))).toBe(true);
  });

  it('invite: app_metadata update failure', async () => {
    mockInvite.mockResolvedValue({ data: { user: { id: 'u' } }, error: null });
    mockUpdate.mockResolvedValue({ error: { message: RAW } });
    const body = await bodyOf(build(inviteQueries()).invite('t', 'a@b.co', 'r', 'i', 'owner'));
    expect(body.error).toBe('INVITE_METADATA_FAILED');
    expect(body.message).toBe('Não foi possível criar o convite. Tente novamente.');
    expect(warn.mock.calls.some(([m]) => String(m).includes(RAW))).toBe(true);
  });

  it('resendInvitation: generateLink failure', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ id: 'i', email: 'a@b.co', role_slug: 'editor', tenant_name: 'T' }])
      .mockResolvedValueOnce([{ slug: 'owner', hierarchy_level: 100 }])
      .mockResolvedValue([]);
    mockGenerateLink.mockResolvedValue({ data: {}, error: { message: RAW } });
    const body = await bodyOf(build(query).resendInvitation('t', 'i', 'inviter', 'owner'));
    expect(body).toEqual({ message: 'Não foi possível reenviar o convite. Tente novamente.', error: 'INVITE_RESEND_FAILED' });
    expect(warn.mock.calls.some(([m]) => String(m).includes(RAW))).toBe(true);
  });
});
