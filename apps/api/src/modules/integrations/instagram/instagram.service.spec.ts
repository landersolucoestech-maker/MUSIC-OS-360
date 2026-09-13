import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { InstagramService } from './instagram.service';
import { EncryptionService } from '../../../core/security/encryption.service';

const TEST_KEY = '0000000000000000000000000000000000000000000000000000000000000000';

function makeEncryption(): EncryptionService {
  const config = { get: jest.fn().mockReturnValue(TEST_KEY) } as unknown as ConfigService;
  return new EncryptionService(config);
}

const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';
const USER_A   = 'user-a';

/** In-memory stand-in for the `oauth_connections` table, keyed like the real unique index. */
function makeOAuthStore() {
  const rows = new Map<string, any>();
  const key = (t: string, u: string, p: string) => `${t}:${u}:${p}`;

  const qb: any = {
    _where: null as null | ((row: any) => boolean),
    where(_sql: string, params: any) {
      this._where = (row: any) =>
        row.tenant_id === params.tenantId && row.user_id === params.userId && row.provider === params.provider;
      return this;
    },
    select() { return this; },
    getOne: jest.fn(async function (this: any) {
      for (const row of rows.values()) if (this._where?.(row)) return row;
      return null;
    }),
  };

  return {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((v: any) => ({ id: `${v.tenant_id}-${v.user_id}-${v.provider}`, metadata: {}, ...v })),
    save: jest.fn(async (v: any) => { rows.set(key(v.tenant_id, v.user_id, v.provider), v); return v; }),
    update: jest.fn(async (crit: any, patch: any) => {
      for (const row of rows.values()) {
        if (row.id === crit.id) Object.assign(row, patch);
      }
    }),
    _rows: rows,
    _seed(row: any) { rows.set(key(row.tenant_id, row.user_id, row.provider), { metadata: {}, ...row }); },
  };
}

function makeService(oauthRepo: ReturnType<typeof makeOAuthStore>) {
  const ds: any = { getRepository: jest.fn(() => oauthRepo) };
  const config = {
    get: jest.fn((key: string) => ({
      META_APP_ID: 'app-id', META_APP_SECRET: 'app-secret', META_REDIRECT_URI: 'https://staging.example.com/oauth/callback',
    } as Record<string, string>)[key]),
  } as unknown as ConfigService;
  return new InstagramService(ds, makeEncryption(), config);
}

describe('InstagramService', () => {
  let oauthRepo: ReturnType<typeof makeOAuthStore>;
  let service: InstagramService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    oauthRepo = makeOAuthStore();
    service   = makeService(oauthRepo);
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  // ── state / callback ────────────────────────────────────────────────────────

  it('rejects a callback with an invalid signed state', async () => {
    await expect(service.handleCallback('code', 'not-a-real-state')).rejects.toThrow();
  });

  it('exchanges code for a long-lived token and persists it encrypted, tenant-scoped', async () => {
    const state = service.getAuthUrl(TENANT_A, USER_A).match(/state=([^&]+)/)![1];
    fetchMock
      .mockResolvedValueOnce({ json: async () => ({ access_token: 'short-token' }) })
      .mockResolvedValueOnce({ json: async () => ({ access_token: 'long-token', expires_in: 5_184_000 }) });

    await service.handleCallback('auth-code', decodeURIComponent(state));

    const conn = await service.getOAuthConnection(TENANT_A, USER_A, 'instagram');
    expect(conn?.accessToken).toBe('long-token');
    // Never stored in plaintext.
    const rawRow = [...oauthRepo._rows.values()][0];
    expect(rawRow.access_token_encrypted).not.toContain('long-token');
  });

  // ── refresh ──────────────────────────────────────────────────────────────────

  it('refreshes a still-valid long-lived token via fb_exchange_token', async () => {
    oauthRepo._seed({
      tenant_id: TENANT_A, user_id: USER_A, provider: 'instagram', id: 'row-1',
      access_token_encrypted: makeEncryption().encrypt('old-token'),
      expires_at: new Date(Date.now() + 1_000), scopes: 'instagram_basic',
    });
    fetchMock.mockResolvedValueOnce({ json: async () => ({ access_token: 'new-token', expires_in: 5_184_000 }) });

    const ok = await service.refreshLongLivedToken(TENANT_A, USER_A, 'instagram');

    expect(ok).toBe(true);
    const conn = await service.getOAuthConnection(TENANT_A, USER_A, 'instagram');
    expect(conn?.accessToken).toBe('new-token');
  });

  it('marks the connection needs_reauth when the refresh exchange fails', async () => {
    oauthRepo._seed({
      tenant_id: TENANT_A, user_id: USER_A, provider: 'instagram', id: 'row-1',
      access_token_encrypted: makeEncryption().encrypt('old-token'),
      expires_at: new Date(Date.now() + 1_000), scopes: 'instagram_basic',
    });
    fetchMock.mockResolvedValueOnce({ json: async () => ({ error: { message: 'token expired' } }) });

    const ok = await service.refreshLongLivedToken(TENANT_A, USER_A, 'instagram');

    expect(ok).toBe(false);
    const status = await service.getProviderStatus(TENANT_A, USER_A, 'instagram');
    expect(status).toEqual({ connected: true, needs_reauth: true });
  });

  it('never leaks a refresh failure for one tenant into another tenant\'s status', async () => {
    oauthRepo._seed({
      tenant_id: TENANT_A, user_id: USER_A, provider: 'instagram', id: 'row-a',
      access_token_encrypted: makeEncryption().encrypt('token-a'), expires_at: new Date(Date.now() + 1_000),
    });
    oauthRepo._seed({
      tenant_id: TENANT_B, user_id: USER_A, provider: 'instagram', id: 'row-b',
      access_token_encrypted: makeEncryption().encrypt('token-b'), expires_at: new Date(Date.now() + 1_000),
    });
    fetchMock.mockResolvedValueOnce({ json: async () => ({ error: { message: 'expired' } }) });

    await service.refreshLongLivedToken(TENANT_A, USER_A, 'instagram');

    expect(await service.getProviderStatus(TENANT_A, USER_A, 'instagram')).toEqual({ connected: true, needs_reauth: true });
    expect(await service.getProviderStatus(TENANT_B, USER_A, 'instagram')).toEqual({ connected: true, needs_reauth: false });
  });

  // ── disconnect / revocation ──────────────────────────────────────────────────

  it('disconnects locally even when the Meta revoke call fails (best-effort revoke)', async () => {
    oauthRepo._seed({
      tenant_id: TENANT_A, user_id: USER_A, provider: 'instagram', id: 'row-1',
      access_token_encrypted: makeEncryption().encrypt('token'), expires_at: null,
    });
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    (oauthRepo as any).createQueryBuilder = jest.fn(() => {
      const qb: any = {
        where: jest.fn().mockReturnThis(),
        delete: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        execute: jest.fn(async () => { oauthRepo._rows.clear(); }),
        select: jest.fn().mockReturnThis(),
        getOne: jest.fn(async () => [...oauthRepo._rows.values()][0] ?? null),
      };
      return qb;
    });

    await service.disconnectProvider(TENANT_A, USER_A, 'instagram');

    // find-fec66ce8/find-dd523831: this.fetch() now routes through
    // resilientFetch, which adds an AbortSignal for the 10s timeout guard.
    // objectContaining alone would still pass against a pre-fix raw fetch()
    // call (it ignores the extra field either way) — assert the signal
    // explicitly so this test actually fails if this.fetch() regresses to a
    // raw fetch() call.
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/me/permissions'),
      expect.objectContaining({ method: 'DELETE' }),
    );
    const [, deleteInit] = fetchMock.mock.calls.find(([url]) => String(url).includes('/me/permissions'))!;
    expect(deleteInit.signal).toBeInstanceOf(AbortSignal);
    expect(oauthRepo._rows.size).toBe(0);
  });
});
