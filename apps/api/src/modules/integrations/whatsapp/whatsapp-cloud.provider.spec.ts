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
    select() { return this; },
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
  // adminDs = mesma store: no runtime é a conexão owner (ADMIN_DATA_SOURCE)
  // sobre a MESMA tabela integrations.
  return new WhatsAppCloudProvider(ds, makeEncryption(), config, ds);
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

  /** find-2220a85e: configure agora prova posse via Graph API antes de gravar. */
  async function configureOk(tenant: string, pid: string, token: string, waba: string) {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: pid }) });
    await provider.configure(tenant, pid, token, waba);
    fetchMock.mockClear();
  }

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
    await configureOk(TENANT_A, '1234567890', 'secret-token-xyz', 'waba-456');
    const raw = [...integRepo._rows.values()][0];
    expect(raw.credentials_encrypted).not.toContain('secret-token-xyz');
    expect(await provider.isConfigured(TENANT_A)).toBe(true);
    expect(await provider.isConfigured(TENANT_B)).toBe(false);
  });

  // ── outbound ─────────────────────────────────────────────────────────────────

  it('envio outbound de texto: sucesso retorna o id da mensagem', async () => {
    await configureOk(TENANT_A, '1234567890', 'token', 'waba-456');
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [{ id: 'wamid.ABC' }] }) });

    const result = await provider.sendTextMessage(TENANT_A, '5511999999999', 'Olá!');

    expect(result).toEqual({ externalMessageId: 'wamid.ABC' });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/1234567890/messages');
    expect((init.headers as Record<string, string>)['Authorization']).toBe('Bearer token');
    const body = JSON.parse(init.body as string);
    expect(body).toEqual({ messaging_product: 'whatsapp', to: '5511999999999', type: 'text', text: { body: 'Olá!' } });
  });

  it('401 da Meta: WHATSAPP_AUTH_ERROR', async () => {
    await configureOk(TENANT_A, '1234567890', 'bad-token', 'waba-456');
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({ error: { code: 190, message: 'Invalid OAuth access token' } }) });

    await expect(provider.sendTextMessage(TENANT_A, '5511999999999', 'oi')).rejects.toMatchObject({
      code: 'WHATSAPP_AUTH_ERROR',
    });
  });

  it('429 da Meta: WHATSAPP_RATE_LIMITED', async () => {
    await configureOk(TENANT_A, '1234567890', 'token', 'waba-456');
    fetchMock.mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({ error: { code: 4, message: 'Too many requests' } }) });

    await expect(provider.sendTextMessage(TENANT_A, '5511999999999', 'oi')).rejects.toMatchObject({
      code: 'WHATSAPP_RATE_LIMITED',
    });
  });

  it('5xx da Meta: WHATSAPP_UPSTREAM_ERROR', async () => {
    await configureOk(TENANT_A, '1234567890', 'token', 'waba-456');
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({ error: { message: 'Service unavailable' } }) });

    await expect(provider.sendTextMessage(TENANT_A, '5511999999999', 'oi')).rejects.toMatchObject({
      code: 'WHATSAPP_UPSTREAM_ERROR',
    });
  });

  it('destinatário inválido (code 131030): WHATSAPP_INVALID_RECIPIENT', async () => {
    await configureOk(TENANT_A, '1234567890', 'token', 'waba-456');
    fetchMock.mockResolvedValueOnce({
      ok: false, status: 400,
      json: async () => ({ error: { code: 131030, message: 'Recipient phone number not in allowed list' } }),
    });

    await expect(provider.sendTextMessage(TENANT_A, '5511999999999', 'oi')).rejects.toMatchObject({
      code: 'WHATSAPP_INVALID_RECIPIENT',
    });
  });

  it('nunca converte falha upstream em sucesso silencioso (sem messages[0].id)', async () => {
    await configureOk(TENANT_A, '1234567890', 'token', 'waba-456');
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

  // ── identidade phone_number_id -> tenant (find-2220a85e) ───────────────────

  it('resolveTenantByPhoneNumberId: resolve o tenant certo entre vários configurados', async () => {
    await configureOk(TENANT_A, '1111111111', 'token-a', 'waba-a');
    await configureOk(TENANT_B, '2222222222', 'token-b', 'waba-b');

    expect(await provider.resolveTenantByPhoneNumberId('2222222222')).toEqual({ kind: 'resolved', tenantId: TENANT_B });
    expect(await provider.resolveTenantByPhoneNumberId('9999999999')).toEqual({ kind: 'unknown' });
  });

  it('configure: recusa o mesmo phone_number_id já vinculado a outro tenant (409)', async () => {
    await configureOk(TENANT_A, '1111111111', 'token-a', 'waba-a');
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: '1111111111' }) });
    await expect(provider.configure(TENANT_B, '1111111111', 'token-b', 'waba-b')).rejects.toMatchObject({ status: 409 });
    expect(await provider.resolveTenantByPhoneNumberId('1111111111')).toEqual({ kind: 'resolved', tenantId: TENANT_A });
  });

  it('configure: o mesmo tenant pode reconfigurar o próprio número', async () => {
    await configureOk(TENANT_A, '1111111111', 'token-a', 'waba-a');
    await expect(configureOk(TENANT_A, '1111111111', 'token-a2', 'waba-a')).resolves.toBeUndefined();
  });

  it('configure: sem prova de posse (Graph API recusa o token) não grava nada (400)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: { code: 100 } }) });
    await expect(provider.configure(TENANT_B, '1111111111', 'token-alheio', 'waba-b')).rejects.toMatchObject({ status: 400 });
    expect(integRepo._rows.size).toBe(0);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain('/1111111111?fields=id');
    expect(init.headers.Authorization).toBe('Bearer token-alheio');
  });

  it('configure: Graph API respondendo outro id não prova posse (400)', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ id: '3333333333' }) });
    await expect(provider.configure(TENANT_B, '1111111111', 't', 'w')).rejects.toMatchObject({ status: 400 });
  });

  it('configure: phoneNumberId não numérico é rejeitado sem chamar a Meta (400)', async () => {
    await expect(provider.configure(TENANT_A, '../../me/accounts', 't', 'w')).rejects.toMatchObject({ status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('resolveTenantByPhoneNumberId: vínculo duplicado legado vira conflito (fail-closed), nunca "primeira linha"', async () => {
    await configureOk(TENANT_A, '1111111111', 'token-a', 'waba-a');
    // simula uma linha legada gravada antes da checagem de unicidade
    integRepo._rows.set(`${TENANT_B}:whatsapp`, {
      id: 'legacy-b', tenant_id: TENANT_B, provider: 'whatsapp',
      credentials_encrypted: makeEncryption().encrypt(JSON.stringify({ phoneNumberId: '1111111111', accessToken: 'x', wabaId: 'y' })),
    });
    expect(await provider.resolveTenantByPhoneNumberId('1111111111')).toEqual({ kind: 'conflict', tenantCount: 2 });
  });

  it('resolução sem ADMIN_DATA_SOURCE falha explicitamente (não cai para a conexão RLS que retorna 0 linhas)', async () => {
    const ds: any = { getRepository: jest.fn(() => integRepo) };
    const noAdmin = new WhatsAppCloudProvider(ds, makeEncryption(), { get: jest.fn() } as never, null);
    await expect(noAdmin.resolveTenantByPhoneNumberId('1111111111')).rejects.toThrow(/ADMIN_DATA_SOURCE/);
  });
});
