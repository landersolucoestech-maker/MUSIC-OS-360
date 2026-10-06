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
    await service.configure(TENANT_A, 'TEAM123', 'KEY456', TEST_PRIVATE_KEY);

    const raw = [...integRepo._rows.values()][0];
    expect(raw.credentials_encrypted).not.toContain(TEST_PRIVATE_KEY);
    expect(raw.credentials_encrypted).not.toContain('TEAM123');
  });

  it('getProviderStatus(): exposes only the closed set of non-secret status fields and never the private key', async () => {
    await service.configure(TENANT_A, 'TEAM123', 'KEY456', TEST_PRIVATE_KEY);
    const status = await service.getProviderStatus(TENANT_A);
    expect(Object.keys(status).sort()).toEqual(
      ['connected', 'last_attempt_at', 'last_error', 'last_success_at', 'last_sync_at', 'status', 'verified'],
    );
    // Credentials were saved but no authenticated call proved them: the status says so.
    expect(status).toMatchObject({ connected: true, last_sync_at: null, verified: false, last_success_at: null, last_error: null });
    expect(JSON.stringify(status)).not.toContain('PRIVATE KEY');
    expect(JSON.stringify(status)).not.toContain('KEY456');
  });

  it('with credentials configured: signs a valid ES256 developer token and calls the Apple API with Bearer', async () => {
    await service.configure(TENANT_A, 'TEAM123', 'KEY456', TEST_PRIVATE_KEY);
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
    await service.configure(TENANT_A, 'TEAM123', 'KEY456', TEST_PRIVATE_KEY);
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401 });

    const result = await service.getArtistFromCatalog(TENANT_A, 'artist-id-123');
    expect(result).toEqual({ error: 'PROVIDER_UNAUTHORIZED' });
  });
});
