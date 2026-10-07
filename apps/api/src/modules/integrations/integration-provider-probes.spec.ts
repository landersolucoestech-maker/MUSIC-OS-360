/**
 * An integration is connected only after a real authenticated call of its provider succeeded. A provider whose first
 * real call needs a later step (an OAuth consent, the first document sent) is saved as "connecting" and not verified.
 */
import 'reflect-metadata';
import { IntegrationStatus } from '@music-os-360/types';
import { SoundCloudService } from './soundcloud/soundcloud.service';
import { TikTokService } from './tiktok/tiktok.service';
import { GoogleAdsService } from './google-ads/google-ads.service';
import { AutentiqueService } from './autentique/autentique.service';

type Row = Record<string, any>;

function makeStore() {
  const rows: Row[] = [];
  let params: { tenantId?: string; provider?: string } = {};
  const qb: Record<string, unknown> = {
    where: (_sql: string, p: typeof params) => { params = p; return qb; },
    getOne: async () => rows.find((r) => r.tenant_id === params.tenantId && r.provider === params.provider) ?? null,
  };
  const repo = {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((v: Row) => ({ id: `i${rows.length + 1}`, ...v })),
    save: jest.fn(async (v: Row) => { rows.push(v); return v; }),
    update: jest.fn(async (where: { id: string }, patch: Row) => { Object.assign(rows.find((r) => r.id === where.id) ?? {}, patch); return { affected: 1 }; }),
  };
  return { rows, repo, ds: { getRepository: jest.fn(() => repo) } };
}

const enc = { encrypt: jest.fn((v: string) => `enc:${v.length}`), decrypt: jest.fn() };
const config = { get: jest.fn(() => undefined) };

describe('SoundCloud: connected only after SoundCloud resolves a public profile with the client id', () => {
  const build = (fetchImpl: jest.Mock) => {
    const store = makeStore();
    const svc = new SoundCloudService(store.ds as never, enc as never, config as never);
    (svc as unknown as { fetch: jest.Mock }).fetch = fetchImpl;
    return { svc, store };
  };

  it('a successful call connects and verifies the integration, and sends the client id', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });
    const { svc, store } = build(fetchImpl);
    await svc.configure('t1', 'client-1', 'secret-1');
    expect(String(fetchImpl.mock.calls[0][0])).toContain('/resolve?');
    expect(String(fetchImpl.mock.calls[0][0])).toContain('client_id=client-1');
    expect(store.rows[0]).toMatchObject({ status: IntegrationStatus.CONNECTED, metadata: { verified: true } });
  });

  it('a rejected client id fails the configuration and leaves the integration in error, never connected', async () => {
    const { svc, store } = build(jest.fn().mockResolvedValue({ ok: false, status: 401 }));
    await expect(svc.configure('t1', 'bad', 'secret')).rejects.toMatchObject({ response: { code: 'INTEGRATION_CONNECTION_TEST_FAILED' } });
    expect(store.rows[0]).toMatchObject({ status: IntegrationStatus.ERROR, metadata: { verified: false } });
  });
});

describe('TikTok Ads: connected only after the Ads API accepts the access token for the advertiser', () => {
  const build = (fetchImpl: jest.Mock) => {
    const store = makeStore();
    const svc = new TikTokService(store.ds as never, enc as never, config as never);
    (svc as unknown as { fetch: jest.Mock }).fetch = fetchImpl;
    return { svc, store };
  };

  it('code 0 connects and verifies, and the token goes in the Access-Token header', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ code: 0, data: { list: [] } }) });
    const { svc, store } = build(fetchImpl);
    await svc.configureAds('t1', 'app', 'secret', 'adv-1', 'tok-1');
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ headers: { 'Access-Token': 'tok-1' } });
    expect(String(fetchImpl.mock.calls[0][0])).toContain('advertiser_id=adv-1');
    expect(store.rows[0]).toMatchObject({ status: IntegrationStatus.CONNECTED, metadata: { verified: true } });
  });

  it.each([
    ['an HTTP error', { ok: false, status: 401, json: async () => ({}) }],
    ['an API error code with HTTP 200', { ok: true, json: async () => ({ code: 40105, message: 'Access token is invalid' }) }],
  ])('%s fails the configuration and is never connected', async (_label, response) => {
    const { svc, store } = build(jest.fn().mockResolvedValue(response));
    await expect(svc.configureAds('t1', 'app', 'secret', 'adv-1', 'bad')).rejects.toMatchObject({ response: { code: 'INTEGRATION_CONNECTION_TEST_FAILED' } });
    expect(store.rows[0].status).toBe(IntegrationStatus.ERROR);
    expect(store.rows[0].metadata.verified).toBe(false);
  });
});

describe('Google Ads: saved credentials wait for the OAuth consent', () => {
  const plainEnc = { encrypt: (v: string) => v, decrypt: (v: string) => v };
  it('configure() leaves it connecting and not verified; the OAuth callback with stored tokens connects it', async () => {
    const store = makeStore();
    const svc = new GoogleAdsService(store.ds as never, plainEnc as never, config as never);
    await svc.configure('t1', 'dev-token', '123-456-7890');
    expect(store.rows[0]).toMatchObject({ status: IntegrationStatus.CONNECTING, metadata: { verified: false } });
    expect(await svc.getProviderStatus('t1')).toMatchObject({ connected: false, status: 'connecting', verified: false });

    jest.spyOn(svc, 'verifySignedState' as never).mockReturnValue({ tenantId: 't1', userId: 'u1', provider: 'google_ads' } as never);
    jest.spyOn(svc, 'saveOAuthTokens').mockResolvedValue(undefined);
    (svc as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({ json: async () => ({ access_token: 'a', refresh_token: 'r', expires_in: 3600 }) });
    await svc.handleOAuthCallback('code', 'state');
    expect(store.rows[0]).toMatchObject({ status: IntegrationStatus.CONNECTED, metadata: { verified: true } });
  });

  it('a failed token exchange does not connect it', async () => {
    const store = makeStore();
    const svc = new GoogleAdsService(store.ds as never, plainEnc as never, config as never);
    await svc.configure('t1', 'dev-token', '123-456-7890');
    jest.spyOn(svc, 'verifySignedState' as never).mockReturnValue({ tenantId: 't1', userId: 'u1', provider: 'google_ads' } as never);
    (svc as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({ json: async () => ({ error: 'invalid_grant' }) });
    await expect(svc.handleOAuthCallback('code', 'state')).rejects.toThrow();
    expect(store.rows[0].status).toBe(IntegrationStatus.CONNECTING);
  });

  it('an OAuth callback for an integration whose credentials were removed does not mark it connected', async () => {
    const store = makeStore();
    const svc = new GoogleAdsService(store.ds as never, plainEnc as never, config as never);
    await svc.configure('t1', 'dev-token', '123-456-7890');
    await svc.disconnect('t1', 'google_ads');
    store.rows[0].credentials_encrypted = null;
    jest.spyOn(svc, 'verifySignedState' as never).mockReturnValue({ tenantId: 't1', userId: 'u1', provider: 'google_ads' } as never);
    jest.spyOn(svc, 'saveOAuthTokens').mockResolvedValue(undefined);
    (svc as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockResolvedValue({ json: async () => ({ access_token: 'a' }) });
    await svc.handleOAuthCallback('code', 'state');
    expect(store.rows[0].status).not.toBe(IntegrationStatus.CONNECTED);
  });
});

describe('Autentique: saved token waits for the first document sent', () => {
  it('configure() leaves it connecting and not verified', async () => {
    const store = makeStore();
    const svc = new AutentiqueService(store.ds as never, { encrypt: jest.fn(() => 'enc'), decrypt: jest.fn() } as never, config as never, undefined as never, undefined as never, undefined as never);
    await svc.configure('t1', 'api-token');
    expect(store.rows[0]).toMatchObject({ status: IntegrationStatus.CONNECTING, metadata: { verified: false } });
    await svc.configure('t1', 'api-token-2');
    expect(store.rows).toHaveLength(1);
    expect(store.rows[0]).toMatchObject({ status: IntegrationStatus.CONNECTING, metadata: { verified: false } });
  });
});

describe('a probe error never carries the submitted credential', () => {
  it('a token named in full by an HTTP client error is redacted from the response and the stored reason', async () => {
    const store = makeStore();
    const svc = new TikTokService(store.ds as never, enc as never, config as never);
    const token = 'tok-with-newline-ÿ-secret';
    (svc as unknown as { fetch: jest.Mock }).fetch = jest.fn().mockRejectedValue(new TypeError(`Headers.append: "${token}" is an invalid header value`));
    let thrown: unknown;
    await svc.configureAds('t1', 'app', 'secret', 'adv-1', token).catch((e) => { thrown = e; });
    expect(JSON.stringify(thrown)).not.toContain(token);
    expect(JSON.stringify(store.rows[0].metadata)).not.toContain(token);
    expect(store.rows[0].metadata.last_failure_reason).toContain('[REDACTED]');
  });

  it('withoutCredentialValues removes every submitted value of four characters or more', () => {
    const { withoutCredentialValues } = jest.requireActual('./integration-base.service');
    expect(withoutCredentialValues('bad abcd1234 and wxyz', { a: 'abcd1234', b: 'wxyz', c: 'ab' })).toBe('bad [REDACTED] and [REDACTED]');
  });
});

describe('Autentique waiting for the first document stays usable in the signing dialog', () => {
  async function statusFor(state: 'connecting' | 'connected' | 'error' | 'disconnected') {
    const { IntegrationsController } = jest.requireActual('./integrations.controller');
    const result = (s: string) => ({ connected: s === 'connected', status: s, verified: s === 'connected' });
    const integrationBase = { getStatus: jest.fn(async (_t: string, provider: string) => result(provider === 'autentique' ? state : 'disconnected')) };
    const self = new Proxy({}, { get: (_t, key) => (key === 'integrationBase' ? integrationBase : { isConfigured: () => false }) });
    return IntegrationsController.prototype.getStatus.call(self, { tenantId: 't1' });
  }

  it.each([
    ['connecting', true, false],
    ['connected', true, true],
    ['error', false, false],
    ['disconnected', false, false],
  ] as const)('%s: configured=%s, connected=%s', async (state, configured, connected) => {
    const status = await statusFor(state);
    expect(status.autentique).toMatchObject({ configured, connected, verified: connected });
  });
});

describe('Autentique: a pasted token never reaches the stored failure reason or the status', () => {
  it('a send failure whose error names the token in full is stored redacted', async () => {
    const token = 'sEcr\nTOKEN-valueXYZ';
    const store = makeStore();
    const crypto = { encrypt: (v: string) => v, decrypt: (v: string) => v };
    const svc = new AutentiqueService(store.ds as never, crypto as never, config as never, undefined as never, undefined as never, undefined as never);
    await svc.configure('t1', token);
    await (svc as unknown as { recordFailure(t: string, r: string): Promise<void> }).recordFailure('t1', `Headers.append: "Bearer ${token}" is an invalid header value`);
    const stored = JSON.stringify(store.rows[0].metadata);
    expect(stored).not.toContain('TOKEN-valueXYZ');
    expect(stored).toContain('[REDACTED]');
  });
});

describe('withoutCredentialValues: forms of a value', () => {
  const { withoutCredentialValues } = jest.requireActual('./integration-base.service');
  it('removes the URL-encoded and JSON-escaped forms and a value that contains another whole', () => {
    expect(withoutCredentialValues('GET /x?client_id=a%20b%26c%3Dd', { client_id: 'a b&c=d' })).not.toContain('a%20b');
    expect(withoutCredentialValues('{"k":"line1\\nline2-secret"}', { key: 'line1\nline2-secret' })).not.toContain('line2-secret');
    expect(withoutCredentialValues('abcdXYZ123', { short: 'abcd', long: 'abcdXYZ123' })).toBe('[REDACTED]');
  });
});
