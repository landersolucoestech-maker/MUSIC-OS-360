import { IntegrationStatus } from '@music-os-360/types';
import { IntegrationBaseService } from './integration-base.service';
import { AbramusService } from './abramus/abramus.service';

type Row = { id: string; tenant_id: string; provider: string; status: string; credentials_encrypted: string | null; metadata: Record<string, unknown>; failure_count?: number; last_sync_at?: Date | null };

/** In-memory integrations table behind the same repository calls the service makes. */
function makeStore(initial: Row[] = []) {
  const rows: Row[] = [...initial];
  const qb = (rowsRef: Row[]) => {
    const chain: Record<string, unknown> = {};
    let params: { tenantId?: string; provider?: string } = {};
    chain['where'] = (_sql: string, p: typeof params) => { params = p; return chain; };
    chain['getOne'] = async () => rowsRef.find((r) => r.tenant_id === params.tenantId && r.provider === params.provider) ?? null;
    return chain;
  };
  const repo = {
    createQueryBuilder: jest.fn(() => qb(rows)),
    create: jest.fn((v: Partial<Row>) => ({ id: `i${rows.length + 1}`, ...v }) as Row),
    save: jest.fn(async (v: Row) => { rows.push(v); return v; }),
    update: jest.fn(async (where: { id: string }, patch: Partial<Row>) => {
      const row = rows.find((r) => r.id === where.id);
      if (row) Object.assign(row, patch);
      return { affected: row ? 1 : 0 };
    }),
  };
  return { rows, repo };
}

class TestIntegration extends IntegrationBaseService {}

function build(initial: Row[] = []) {
  const { rows, repo } = makeStore(initial);
  const ds = { getRepository: jest.fn(() => repo) };
  const enc = { encrypt: jest.fn((v: string) => `enc(${v.length})`), decrypt: jest.fn() };
  const svc = new TestIntegration(ds as never, enc as never);
  return { svc, rows };
}

describe('IntegrationBaseService.saveCredentials: a saved credential is not a tested connection', () => {
  it('without a probe it is stored but recorded as not verified, with the attempt time', async () => {
    const { svc, rows } = build();
    await svc.saveCredentials('t1', 'tiktok', { token: 'x' });
    expect(rows[0].status).toBe(IntegrationStatus.CONNECTED);
    expect(rows[0].metadata['verified']).toBe(false);
    expect(typeof rows[0].metadata['last_attempt_at']).toBe('string');
    expect(rows[0].metadata['last_success_at']).toBeUndefined();
    const status = await svc.getStatus('t1', 'tiktok');
    expect(status).toMatchObject({ verified: false, last_success_at: null, last_error: null });
  });

  it('with a probe that succeeds it is connected, verified and has a last success', async () => {
    const { svc, rows } = build();
    const probe = jest.fn().mockResolvedValue(undefined);
    await svc.saveCredentials('t1', 'abramus', { token: 'x' }, probe);
    expect(probe).toHaveBeenCalledTimes(1);
    expect(rows[0].status).toBe(IntegrationStatus.CONNECTED);
    expect(rows[0].metadata['verified']).toBe(true);
    expect(typeof rows[0].metadata['last_success_at']).toBe('string');
    expect(await svc.getStatus('t1', 'abramus')).toMatchObject({ connected: true, verified: true });
  });

  it('with a probe that fails it is not connected, keeps the redacted reason and reports the failure to the caller', async () => {
    const { svc, rows } = build();
    const probe = jest.fn().mockRejectedValue(new Error('auth error 401: {"password":"hunter2","detail":"bad login"} for ana@example.com'));
    await expect(svc.saveCredentials('t1', 'abramus', { token: 'x' }, probe))
      .rejects.toMatchObject({ response: { code: 'INTEGRATION_CONNECTION_TEST_FAILED' } });
    expect(rows[0].status).toBe(IntegrationStatus.ERROR);
    expect(rows[0].metadata['verified']).toBe(false);
    const reason = String(rows[0].metadata['last_failure_reason']);
    expect(reason).not.toContain('hunter2');
    expect(reason).not.toContain('ana@example.com');
    const status = await svc.getStatus('t1', 'abramus');
    expect(status).toMatchObject({ connected: false, status: IntegrationStatus.ERROR, verified: false });
    expect(status.last_error).toBe(reason);
  });

  it('a failed re-configuration keeps the previous working credentials and status, and records only the failure', async () => {
    const { svc, rows } = build([{
      id: 'i1', tenant_id: 't1', provider: 'abramus', status: IntegrationStatus.CONNECTED,
      credentials_encrypted: 'old-credentials', metadata: { verified: true, last_success_at: '2026-10-01T00:00:00.000Z' },
    }]);
    await expect(svc.saveCredentials('t1', 'abramus', { token: 'mistyped' }, jest.fn().mockRejectedValue(new Error('401 unauthorized'))))
      .rejects.toMatchObject({ response: { code: 'INTEGRATION_CONNECTION_TEST_FAILED' } });
    expect(rows[0].credentials_encrypted).toBe('old-credentials');
    expect(rows[0].status).toBe(IntegrationStatus.CONNECTED);
    expect(rows[0].metadata['verified']).toBe(true);
    expect(rows[0].metadata['last_success_at']).toBe('2026-10-01T00:00:00.000Z');
    expect(String(rows[0].metadata['last_failure_reason'])).toContain('401');
  });

  it('when the restore itself fails the caller still gets the validation failure and the state says it is not connected', async () => {
    const { svc, rows } = build([{
      id: 'i1', tenant_id: 't1', provider: 'abramus', status: IntegrationStatus.CONNECTED,
      credentials_encrypted: 'old-credentials', metadata: { verified: true },
    }]);
    jest.spyOn(svc as unknown as { restoreCredentials: () => Promise<void> }, 'restoreCredentials').mockRejectedValue(new Error('db down'));
    await expect(svc.saveCredentials('t1', 'abramus', { token: 'mistyped' }, jest.fn().mockRejectedValue(new Error('401'))))
      .rejects.toMatchObject({ response: { code: 'INTEGRATION_CONNECTION_TEST_FAILED' } });
    expect(rows[0].status).toBe(IntegrationStatus.ERROR);
    expect(rows[0].metadata['verified']).toBe(false);
    expect(rows[0].metadata['restore_failed']).toBe(true);
  });

  it('a store that cannot record the failure does not turn the validation failure into a raw error', async () => {
    const { svc } = build();
    jest.spyOn(svc as unknown as { recordConnectionState: () => Promise<void> }, 'recordConnectionState').mockRejectedValue(new Error('db down'));
    await expect(svc.saveCredentials('t1', 'abramus', { token: 'x' }, jest.fn().mockRejectedValue(new Error('401'))))
      .rejects.toMatchObject({ response: { code: 'INTEGRATION_CONNECTION_TEST_FAILED' } });
  });

  it('a failed first configuration has nothing to restore: it is stored in error', async () => {
    const { svc, rows } = build();
    await expect(svc.saveCredentials('t1', 'abramus', { token: 'x' }, jest.fn().mockRejectedValue(new Error('down')))).rejects.toBeDefined();
    expect(rows[0].status).toBe(IntegrationStatus.ERROR);
    expect(rows[0].credentials_encrypted).not.toBeNull();
  });

  it('a later successful probe clears the previous failure', async () => {
    const { svc, rows } = build();
    await expect(svc.saveCredentials('t1', 'abramus', { token: 'x' }, jest.fn().mockRejectedValue(new Error('down')))).rejects.toBeDefined();
    await svc.saveCredentials('t1', 'abramus', { token: 'y' }, jest.fn().mockResolvedValue(undefined));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe(IntegrationStatus.CONNECTED);
    expect(rows[0].metadata['last_failure_reason']).toBeNull();
    expect(rows[0].metadata['verified']).toBe(true);
  });

  it('getStatus of a tenant with no integration reports disconnected and unverified', async () => {
    const { svc } = build();
    expect(await svc.getStatus('t1', 'abramus')).toMatchObject({ connected: false, status: IntegrationStatus.DISCONNECTED, verified: false });
  });

  it('status is read per tenant', async () => {
    const { svc } = build([{ id: 'i1', tenant_id: 't1', provider: 'abramus', status: 'connected', credentials_encrypted: 'x', metadata: { verified: true } }]);
    expect((await svc.getStatus('t1', 'abramus')).connected).toBe(true);
    expect((await svc.getStatus('t2', 'abramus')).connected).toBe(false);
  });
});

describe('AbramusService.configure: connected only after a real login', () => {
  function buildAbramus(fetchImpl: jest.Mock) {
    const { rows, repo } = makeStore();
    const ds = { getRepository: jest.fn(() => repo) };
    const enc = { encrypt: jest.fn(() => 'enc'), decrypt: jest.fn() };
    const svc = new AbramusService(ds as never, enc as never);
    (svc as unknown as { fetch: jest.Mock }).fetch = fetchImpl;
    const resolveHost = jest.fn().mockResolvedValue(['93.184.216.34']);
    (svc as unknown as { resolveHost: jest.Mock }).resolveHost = resolveHost;
    return { svc, rows, fetchImpl, resolveHost };
  }

  it('logs in with the submitted credentials and then marks the integration connected and verified', async () => {
    const { svc, rows, fetchImpl } = buildAbramus(jest.fn().mockResolvedValue({ ok: true, json: async () => ({ token: 'tok' }) }));
    await svc.configure('t1', 'user', 'secret', 'https://abramus.example.test');
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://abramus.example.test/api/v1/auth/login');
    expect(JSON.parse(init.body as string)).toEqual({ username: 'user', password: 'secret' });
    expect(rows[0].status).toBe(IntegrationStatus.CONNECTED);
    expect(rows[0].metadata['verified']).toBe(true);
  });

  it.each([
    ['a rejected login', { ok: false, status: 401, json: async () => ({}) }],
    ['a login that returns no token', { ok: true, json: async () => ({}) }],
  ])('is not connected after %s', async (_label, response) => {
    const { svc, rows } = buildAbramus(jest.fn().mockResolvedValue(response));
    await expect(svc.configure('t1', 'user', 'wrong', 'https://abramus.example.test'))
      .rejects.toMatchObject({ response: { code: 'INTEGRATION_CONNECTION_TEST_FAILED' } });
    expect(rows[0].status).toBe(IntegrationStatus.ERROR);
    expect(rows[0].metadata['verified']).toBe(false);
  });

  it('an unreachable provider is not connected either', async () => {
    const { svc, rows } = buildAbramus(jest.fn().mockRejectedValue(new Error('getaddrinfo ENOTFOUND abramus.example.test')));
    await expect(svc.configure('t1', 'user', 'secret', 'https://abramus.example.test')).rejects.toBeDefined();
    expect(rows[0].status).toBe(IntegrationStatus.ERROR);
  });

  it('never puts the provider response body, with a secret in it, into the error of a data call', async () => {
    const { svc } = buildAbramus(jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok' }) })
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => '{"api_key":"sk-live-123456789","message":"boom"}' }));
    jest.spyOn(svc, 'loadCredentials').mockResolvedValue({ username: 'u', password: 'p', base_url: 'https://abramus.example.test' } as never);
    const error = await svc.searchWork('t1', 'x').then(() => null, (e: Error) => e);
    expect(error?.message).toMatch(/Abramus API error 500/);
    expect(error?.message).toContain('boom');
    expect(error?.message).not.toContain('sk-live-123456789');
  });

  it.each([
    'http://abramus.example.test',
    'https://127.0.0.1',
    'https://169.254.169.254/latest',
    'https://[::1]',
    'https://10.0.0.5',
    'https://user:pw@abramus.example.test',
    'https://abramus.example.test:8443',
    'https://localhost',
    'https://db.internal',
    'not a url',
  ])('rejects the endpoint %s before storing or calling anything', async (url) => {
    const { svc, rows, fetchImpl } = buildAbramus(jest.fn());
    await expect(svc.configure('t1', 'user', 'secret', url))
      .rejects.toMatchObject({ response: { code: 'INTEGRATION_URL_NOT_ALLOWED' } });
    expect(rows).toHaveLength(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('rejects a public-looking name that resolves to a private address', async () => {
    const { svc, rows, fetchImpl, resolveHost } = buildAbramus(jest.fn());
    resolveHost.mockResolvedValue(['93.184.216.34', '10.1.2.3']);
    await expect(svc.configure('t1', 'user', 'secret', 'https://abramus.example.test'))
      .rejects.toMatchObject({ response: { code: 'INTEGRATION_URL_NOT_ALLOWED' } });
    expect(rows).toHaveLength(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('refuses to call a stored endpoint that is no longer public', async () => {
    const { svc, fetchImpl } = buildAbramus(jest.fn());
    jest.spyOn(svc, 'loadCredentials').mockResolvedValue({ username: 'u', password: 'p', base_url: 'https://169.254.169.254' } as never);
    await expect(svc.searchWork('t1', 'x')).rejects.toMatchObject({ response: { code: 'INTEGRATION_URL_NOT_ALLOWED' } });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('never follows a redirect, so a validated host cannot bounce the call to an unchecked address', async () => {
    const { svc, fetchImpl } = buildAbramus(jest.fn().mockResolvedValue({ ok: false, status: 307, headers: { get: () => 'http://169.254.169.254/' } }));
    await expect(svc.configure('t1', 'user', 'secret', 'https://abramus.example.test')).rejects.toBeDefined();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect((fetchImpl.mock.calls[0] as [string, RequestInit])[1].redirect).toBe('manual');
  });

  it('a data call is also sent without following redirects and fails on a redirect answer', async () => {
    const { svc, fetchImpl } = buildAbramus(jest.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ token: 'tok' }) })
      .mockResolvedValueOnce({ ok: false, status: 302, text: async () => '' }));
    jest.spyOn(svc, 'loadCredentials').mockResolvedValue({ username: 'u', password: 'p', base_url: 'https://abramus.example.test' } as never);
    await expect(svc.searchWork('t1', 'x')).rejects.toThrow(/redirect/);
    expect((fetchImpl.mock.calls[1] as [string, RequestInit])[1].redirect).toBe('manual');
  });

  it('closes DNS rebinding: a name that answers public for the checks and private at connect time is never connected', async () => {
    const { svc, rows, resolveHost } = buildAbramus(jest.fn());
    // buildAbramus replaced the injected fetch; restore the production one to exercise the connect-time lookup
    delete (svc as unknown as { fetch?: unknown }).fetch;
    resolveHost.mockReset();
    resolveHost.mockResolvedValueOnce(['93.184.216.34']).mockResolvedValueOnce(['93.184.216.34']).mockResolvedValue(['169.254.169.254']);
    await expect(svc.configure('t1', 'user', 'secret', 'https://abramus.example.test'))
      .rejects.toMatchObject({ response: { code: 'INTEGRATION_CONNECTION_TEST_FAILED' } });
    expect(resolveHost).toHaveBeenCalledTimes(3);
    expect(rows[0].status).toBe(IntegrationStatus.ERROR);
  });

  it('one tenant-supplied host failing opens only its own breaker, never the breaker of another host', async () => {
    const { svc, resolveHost } = buildAbramus(jest.fn());
    delete (svc as unknown as { fetch?: unknown }).fetch;
    resolveHost.mockResolvedValue(['10.0.0.9']); // every connect is refused by the lookup guard
    const call = (host: string) => (svc as unknown as { fetch: (u: string) => Promise<Response> }).fetch(`https://${host}/api`);
    for (let i = 0; i < 5; i += 1) await expect(call('down.example.test')).rejects.toThrow('public address');
    await expect(call('down.example.test')).rejects.toThrow('temporariamente indisponível');
    await expect(call('other.example.test')).rejects.toThrow('public address'); // reached the guard: its breaker is closed
  });

  it('an unresolvable host is a 400 that stores nothing, not a 500 with the resolver message', async () => {
    const { svc, rows, resolveHost, fetchImpl } = buildAbramus(jest.fn());
    resolveHost.mockRejectedValue(Object.assign(new Error('getaddrinfo ENOTFOUND typo.example.test'), { code: 'ENOTFOUND' }));
    const error = await svc.configure('t1', 'user', 'secret', 'https://typo.example.test').then(() => null, (e: { response: { code: string; message: string } }) => e);
    expect(error?.response.code).toBe('INTEGRATION_URL_NOT_ALLOWED');
    expect(error?.response.message).not.toContain('getaddrinfo');
    expect(rows).toHaveLength(0);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('a public IPv6 literal is accepted without a name lookup', async () => {
    const { svc, fetchImpl, resolveHost } = buildAbramus(jest.fn().mockResolvedValue({ ok: true, json: async () => ({ token: 'tok' }) }));
    await svc.configure('t1', 'user', 'secret', 'https://[2606:4700:4700::1111]/');
    expect((fetchImpl.mock.calls[0] as [string])[0]).toBe('https://[2606:4700:4700::1111]/api/v1/auth/login');
    expect(resolveHost).not.toHaveBeenCalled();
  });

  it('keeps the breaker of a host in use and evicts the least recently used one', () => {
    const { svc } = buildAbramus(jest.fn());
    const breakerFor = (host: string) => (svc as unknown as { breakerFor: (u: string) => unknown }).breakerFor(`https://${host}/x`);
    const first = breakerFor('h0.example.test');
    const second = breakerFor('h1.example.test');
    for (let i = 2; i < 100; i += 1) breakerFor(`h${i}.example.test`);
    expect(breakerFor('h0.example.test')).toBe(first); // touched: now the most recently used, h1 is the oldest
    breakerFor('h100.example.test'); // the map is full: evicts h1
    expect(breakerFor('h0.example.test')).toBe(first);
    expect(breakerFor('h1.example.test')).not.toBe(second); // h1 lost its breaker and got a new one
  });

  it('the name resolver gives up after its timeout instead of holding a thread', async () => {
    jest.useFakeTimers();
    try {
      const { svc } = buildAbramus(jest.fn());
      delete (svc as unknown as { resolveHost?: unknown }).resolveHost;
      const dns = jest.requireActual('node:dns') as typeof import('node:dns');
      jest.spyOn(dns.promises, 'lookup').mockImplementation(() => new Promise(() => undefined) as never);
      const pending = (svc as unknown as { resolveHost: (n: string) => Promise<string[]> }).resolveHost('slow.example.test');
      const assertion = expect(pending).rejects.toThrow('DNS lookup timeout');
      jest.advanceTimersByTime(5001);
      await assertion;
    } finally {
      jest.useRealTimers();
      jest.restoreAllMocks();
    }
  });
});
