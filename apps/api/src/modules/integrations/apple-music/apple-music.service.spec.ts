import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { AppleMusicService } from './apple-music.service';
import { EncryptionService } from '../../../core/security/encryption.service';

const TEST_KEY = '0000000000000000000000000000000000000000000000000000000000000000';

// Synthetic EC (P-256) key generated locally only for this test — never a
// real Apple credential. `buildDeveloperToken` requires exactly this curve (ES256).
const TEST_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgL31gt/CymDrlnoX5
Ir7QchC0+4J/AJJPUD5tFVY/aa+hRANCAAQ4RWLRxdQnRpeF55Gd7CZuvo+inhai
aU1DLtKfNI1lucSwrqKtGOpCvcrxAoA+SVxhH99FWLf8fHGxWfd8QSCR
-----END PRIVATE KEY-----`;

function makeEncryption(): EncryptionService {
  const config = { get: jest.fn().mockReturnValue(TEST_KEY) } as unknown as ConfigService;
  return new EncryptionService(config);
}

const TENANT_A = 'tenant-a';

/** In-memory stand-in for the `integrations` table (saveCredentials/loadCredentials). */
function makeIntegrationsStore() {
  const rows = new Map<string, any>();
  const key = (t: string, p: string) => `${t}:${p}`;

  const qb: any = {
    _where: null as null | ((row: any) => boolean),
    where(_sql: string, params: any) {
      this._where = (row: any) => row.tenant_id === params.tenantId && row.provider === params.provider;
      return this;
    },
    getOne: jest.fn(async function (this: any) {
      for (const row of rows.values()) if (this._where?.(row)) return row;
      return null;
    }),
  };

  return {
    createQueryBuilder: jest.fn(() => qb),
    create: jest.fn((v: any) => ({ id: `${v.tenant_id}-${v.provider}`, ...v })),
    save: jest.fn(async (v: any) => { rows.set(key(v.tenant_id, v.provider), v); return v; }),
    update: jest.fn(async (crit: any, patch: any) => {
      for (const row of rows.values()) if (row.id === crit.id) Object.assign(row, patch);
    }),
    _rows: rows,
  };
}

function makeService(integRepo: ReturnType<typeof makeIntegrationsStore>) {
  const ds: any = { getRepository: jest.fn(() => integRepo) };
  return new AppleMusicService(ds, makeEncryption());
}

function decodeJwtSegment(segment: string): any {
  return JSON.parse(Buffer.from(segment, 'base64url').toString('utf8'));
}

describe('AppleMusicService', () => {
  let integRepo: ReturnType<typeof makeIntegrationsStore>;
  let service: AppleMusicService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    integRepo = makeIntegrationsStore();
    service   = makeService(integRepo);
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  it('without credentials configured: returns an explicit error, never calls the Apple API', async () => {
    const result = await service.getArtistFromCatalog(TENANT_A, 'some-id');
    expect(result).toEqual({ error: 'PROVIDER_NOT_CONFIGURED' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('configure(): persists team_id/key_id/private_key encrypted — never in plain text', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await service.configure(TENANT_A, 'TEAM123', 'KEY456', TEST_PRIVATE_KEY);

    const raw = [...integRepo._rows.values()][0];
    expect(raw.credentials_encrypted).not.toContain(TEST_PRIVATE_KEY);
    expect(raw.credentials_encrypted).not.toContain('TEAM123');
  });

  it('getProviderStatus(): exposes only the closed set of non-secret status fields and never the private key', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await service.configure(TENANT_A, 'TEAM123', 'KEY456', TEST_PRIVATE_KEY);
    const status = await service.getProviderStatus(TENANT_A);
    expect(Object.keys(status).sort()).toEqual(
      ['connected', 'last_attempt_at', 'last_error', 'last_success_at', 'last_sync_at', 'status', 'verified'],
    );
    // Apple accepted the developer token in the test call made by configure(): the status says so.
    expect(status).toMatchObject({ connected: true, last_sync_at: null, verified: true, last_error: null });
    expect(typeof status.last_success_at).toBe('string');
    expect(JSON.stringify(status)).not.toContain('PRIVATE KEY');
    expect(JSON.stringify(status)).not.toContain('KEY456');
  });

  it('with credentials configured: signs a valid ES256 developer token and calls the Apple API with Bearer', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await service.configure(TENANT_A, 'TEAM123', 'KEY456', TEST_PRIVATE_KEY);
    fetchMock.mockClear();
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ attributes: { name: 'Artist X', genreNames: ['Pop'], url: 'https://x' } }] }),
    });

    const result = await service.getArtistFromCatalog(TENANT_A, 'artist-id-123', 'br');

    expect(result).toMatchObject({ name: 'Artist X' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/catalog/br/artists/artist-id-123');

    const auth = (init.headers as Record<string, string>)['Authorization'];
    expect(auth).toMatch(/^Bearer /);
    const token = auth.replace('Bearer ', '');
    const [headerB64, payloadB64, sig] = token.split('.');
    expect(decodeJwtSegment(headerB64)).toEqual({ alg: 'ES256', kid: 'KEY456' });
    const payload = decodeJwtSegment(payloadB64);
    expect(payload.iss).toBe('TEAM123');
    expect(payload.exp - payload.iat).toBe(15_777_000);
    expect(sig.length).toBeGreaterThan(0);
  });

  it('propagates the Apple API HTTP error status without masking it as success', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    await service.configure(TENANT_A, 'TEAM123', 'KEY456', TEST_PRIVATE_KEY);
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });

    const result = await service.getArtistFromCatalog(TENANT_A, 'artist-id-123');
    expect(result).toEqual({ error: 'PROVIDER_UNAUTHORIZED' });
  });

  describe('configure(): connected only after Apple accepts the developer token', () => {
    it('sends the signed token to a real catalog call and records the integration as connected and verified', async () => {
      fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
      await service.configure(TENANT_A, 'TEAM123', 'KEY456', TEST_PRIVATE_KEY);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toContain('api.music.apple.com/v1/catalog/br/search');
      expect((init.headers as Record<string, string>)['Authorization']).toMatch(/^Bearer [\w-]+\.[\w-]+\.[\w-]+$/);
      expect(await service.getProviderStatus(TENANT_A)).toMatchObject({ connected: true, verified: true });
    });

    it('a rejected token fails the configuration and the integration is not connected', async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });
      await expect(service.configure(TENANT_A, 'TEAM123', 'KEY456', TEST_PRIVATE_KEY))
        .rejects.toMatchObject({ response: { code: 'INTEGRATION_CONNECTION_TEST_FAILED' } });
      expect(await service.getProviderStatus(TENANT_A)).toMatchObject({ connected: false, status: 'error', verified: false });
    });

    it('an unusable private key fails before any call leaves the process', async () => {
      await expect(service.configure(TENANT_A, 'TEAM123', 'KEY456', 'not-a-key')).rejects.toMatchObject({ response: { code: 'INTEGRATION_CONNECTION_TEST_FAILED' } });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
