import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { WhatsAppCloudProvider } from './whatsapp-cloud.provider';
import { WhatsAppError } from './whatsapp.errors';
import { EncryptionService } from '../../../core/security/encryption.service';

const TEST_KEY = '0000000000000000000000000000000000000000000000000000000000000000';
const TENANT_A = 'tenant-a';
const TENANT_B = 'tenant-b';

function makeEncryption(): EncryptionService {
  const config = { get: jest.fn().mockReturnValue(TEST_KEY) } as unknown as ConfigService;
  return new EncryptionService(config);
}

/** In-memory stand-in for the `integrations` table (saveCredentials/loadCredentials/findAllCredentials). */
function makeIntegrationsStore() {
  const rows = new Map<string, any>();
  const key = (t: string, p: string) => `${t}:${p}`;

  const qb: any = {
    _mode: 'one' as 'one' | 'many',
    _providerFilter: null as string | null,
    _tenantFilter: null as string | null,
    where(sql: string, params: any) {
      if (params?.tenantId) this._tenantFilter = params.tenantId;
      if (params?.provider) this._providerFilter = params.provider;
      return this;
    },
    getOne: jest.fn(async function (this: any) {
      for (const row of rows.values()) {
        if (row.tenant_id === this._tenantFilter && row.provider === this._providerFilter) return row;
      }
      return null;
    }),
    getMany: jest.fn(async function (this: any) {
      return [...rows.values()].filter((row) => row.provider === this._providerFilter);
    }),
  };

  return {
    createQueryBuilder: jest.fn(() => ({ ...qb, _tenantFilter: null, _providerFilter: null })),
    create: jest.fn((v: any) => ({ id: `${v.tenant_id}-${v.provider}`, ...v })),
    save: jest.fn(async (v: any) => { rows.set(key(v.tenant_id, v.provider), v); return v; }),
    update: jest.fn(async (crit: any, patch: any) => {
      for (const row of rows.values()) if (row.id === crit.id) Object.assign(row, patch);
    }),
    _rows: rows,
  };
}

function makeProvider(integRepo: ReturnType<typeof makeIntegrationsStore>) {
  const ds: any = { getRepository: jest.fn(() => integRepo) };
  const config = { get: jest.fn((key: string) => process.env[key]) } as unknown as ConfigService;
  return new WhatsAppCloudProvider(ds, makeEncryption(), config);
}

describe('WhatsAppCloudProvider', () => {
  let integRepo: ReturnType<typeof makeIntegrationsStore>;
  let provider: WhatsAppCloudProvider;
  let fetchMock: jest.Mock;
  const ORIGINAL_ENV = process.env['WHATSAPP_WEBHOOK_VERIFY_TOKEN'];

  beforeEach(() => {
    integRepo = makeIntegrationsStore();
    provider  = makeProvider(integRepo);
    fetchMock = jest.fn();
    (global as any).fetch = fetchMock;
  });

  afterEach(() => {
    if (ORIGINAL_ENV === undefined) delete process.env['WHATSAPP_WEBHOOK_VERIFY_TOKEN'];
    else process.env['WHATSAPP_WEBHOOK_VERIFY_TOKEN'] = ORIGINAL_ENV;
  });

  // ── configuração ────────────────────────────────────────────────────────────

  it('provider não configurado: rejeita o envio sem chamar a Meta', async () => {
    await expect(provider.sendTextMessage(TENANT_A, '5511999999999', 'oi')).rejects.toMatchObject({
      code: 'WHATSAPP_NOT_CONFIGURED',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('configure(): persiste credenciais cifradas — nunca o accessToken em texto plano', async () => {
    await provider.configure(TENANT_A, 'phone-123', 'secret-token-xyz', 'waba-456');
    const raw = [...integRepo._rows.values()][0];
    expect(raw.credentials_encrypted).not.toContain('secret-token-xyz');
    expect(await provider.isConfigured(TENANT_A)).toBe(true);
    expect(await provider.isConfigured(TENANT_B)).toBe(false);
  });

  // ── outbound ─────────────────────────────────────────────────────────────────

  it('envio outbound de texto: sucesso retorna o id da mensagem', async () => {
    await provider.configure(TENANT_A, 'phone-123', 'token', 'waba-456');
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [{ id: 'wamid.ABC' }] }) });

    const result = await provider.sendTextMessage(TENANT_A, '5511999999999', 'Olá!');

    expect(result).toEqual({ externalMessageId: 'wamid.ABC' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/phone-123/messages');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer token');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ messaging_product: 'whatsapp', to: '5511999999999', type: 'text', text: { body: 'Olá!' } });
  });

  it('401 da Meta: WHATSAPP_AUTH_ERROR', async () => {
    await provider.configure(TENANT_A, 'phone-123', 'bad-token', 'waba-456');
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: { code: 190, message: 'Invalid OAuth access token' } }) });

    await expect(provider.sendTextMessage(TENANT_A, '5511999999999', 'oi')).rejects.toMatchObject({
      code: 'WHATSAPP_AUTH_ERROR',
    });
  });

  it('429 da Meta: WHATSAPP_RATE_LIMITED', async () => {
    await provider.configure(TENANT_A, 'phone-123', 'token', 'waba-456');
    fetchMock.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ error: { code: 4, message: 'Too many requests' } }) });

    await expect(provider.sendTextMessage(TENANT_A, '5511999999999', 'oi')).rejects.toMatchObject({
      code: 'WHATSAPP_RATE_LIMITED',
    });
  });

  it('5xx da Meta: WHATSAPP_UPSTREAM_ERROR', async () => {
    await provider.configure(TENANT_A, 'phone-123', 'token', 'waba-456');
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: { message: 'Service unavailable' } }) });

    await expect(provider.sendTextMessage(TENANT_A, '5511999999999', 'oi')).rejects.toMatchObject({
      code: 'WHATSAPP_UPSTREAM_ERROR',
    });
  });

  it('destinatário inválido (code 131030): WHATSAPP_INVALID_RECIPIENT', async () => {
    await provider.configure(TENANT_A, 'phone-123', 'token', 'waba-456');
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 400,
      json: async () => ({ error: { code: 131030, message: 'Recipient phone number not in allowed list' } }),
    });

    await expect(provider.sendTextMessage(TENANT_A, '5511999999999', 'oi')).rejects.toMatchObject({
      code: 'WHATSAPP_INVALID_RECIPIENT',
    });
  });

  it('nunca converte falha upstream em sucesso silencioso (sem messages[0].id)', async () => {
    await provider.configure(TENANT_A, 'phone-123', 'token', 'waba-456');
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    await expect(provider.sendTextMessage(TENANT_A, '5511999999999', 'oi')).rejects.toMatchObject({
      code: 'WHATSAPP_UPSTREAM_ERROR',
    });
  });

  // ── webhook verification (GET) ────────────────────────────────────────────────

  it('webhook verification válida: retorna o challenge quando o verify_token bate', () => {
    process.env['WHATSAPP_WEBHOOK_VERIFY_TOKEN'] = 'my-verify-token';
    const challenge = provider.verifyWebhookChallenge('subscribe', 'my-verify-token', 'challenge-123');
    expect(challenge).toBe('challenge-123');
  });

  it('webhook verification inválida: verify_token errado é rejeitado', () => {
    process.env['WHATSAPP_WEBHOOK_VERIFY_TOKEN'] = 'my-verify-token';
    expect(() => provider.verifyWebhookChallenge('subscribe', 'wrong-token', 'challenge-123')).toThrow(WhatsAppError);
    try {
      provider.verifyWebhookChallenge('subscribe', 'wrong-token', 'challenge-123');
    } catch (err) {
      expect((err as WhatsAppError).code).toBe('WHATSAPP_WEBHOOK_INVALID');
    }
  });

  it('webhook verification: sem WHATSAPP_WEBHOOK_VERIFY_TOKEN no ambiente, rejeita como não configurado', () => {
    delete process.env['WHATSAPP_WEBHOOK_VERIFY_TOKEN'];
    expect(() => provider.verifyWebhookChallenge('subscribe', 'anything', 'challenge-123')).toThrow(
      expect.objectContaining({ code: 'WHATSAPP_NOT_CONFIGURED' }),
    );
  });

  // ── tenant lookup ────────────────────────────────────────────────────────────

  it('findTenantByPhoneNumberId: resolve o tenant certo entre vários configurados', async () => {
    await provider.configure(TENANT_A, 'phone-A', 'token-a', 'waba-a');
    await provider.configure(TENANT_B, 'phone-B', 'token-b', 'waba-b');

    expect(await provider.findTenantByPhoneNumberId('phone-B')).toBe(TENANT_B);
    expect(await provider.findTenantByPhoneNumberId('phone-unknown')).toBeNull();
  });
});
