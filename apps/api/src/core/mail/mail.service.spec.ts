import { Test }        from '@nestjs/testing';
import { MailService, escapeHtml } from './mail.service';
import { ConfigService } from '@nestjs/config';

const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('MailService', () => {
  let service: MailService;

  const makeModule = async (hasKey = true, nodeEnv = 'production', allowlist?: string) => {
    const m = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: ConfigService,
          useValue: {
            get: (k: string) => {
              if (k === 'RESEND_API_KEY')    return hasKey ? 're_test' : undefined;
              if (k === 'RESEND_FROM_EMAIL') return 'noreply@test.com';
              if (k === 'NODE_ENV')          return nodeEnv;
              if (k === 'STAGING_MAIL_ALLOWLIST_DOMAINS') return allowlist;
            },
          },
        },
      ],
    }).compile();
    return m.get<MailService>(MailService);
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    service = await makeModule(true);
  });

  it('chama Resend API com Authorization header correto', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ id: 'email_1' }),
    });
    const r = await service.send({ to: 'x@x.com', subject: 'T', html: '<p>H</p>' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer re_test' }),
      }),
    );
    expect(r.id).toBe('email_1');
  });

  /**
   * find-a4445173: EmailProcessor runs under BullMQ's default retry policy
   * with no idempotency protection against Resend -- a retried job could
   * double-send. Resend deduplicates by its own Idempotency-Key header.
   */
  it('forwards idempotencyKey as the Idempotency-Key header when provided (find-a4445173)', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'email_2' }) });
    await service.send({ to: 'x@x.com', subject: 'T', html: '<p>H</p>', idempotencyKey: 'job-42' });
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails',
      expect.objectContaining({
        headers: expect.objectContaining({ 'Idempotency-Key': 'job-42' }),
      }),
    );
  });

  it('omits the Idempotency-Key header when none is provided', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'email_3' }) });
    await service.send({ to: 'x@x.com', subject: 'T', html: '<p>H</p>' });
    const [, init] = mockFetch.mock.calls[0];
    expect(init.headers).not.toHaveProperty('Idempotency-Key');
  });

  it('retorna skipped:true quando sem API key', async () => {
    const svc = await makeModule(false);
    const r = await svc.send({ to: 'x@x.com', subject: 'T', html: '<p>H</p>' });
    expect(r).toEqual({ skipped: true });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  describe('STAGING-01 — allowlist e prefixo em NODE_ENV=staging', () => {
    it('prefixa o assunto com [STAGING] e envia normalmente para um domínio permitido', async () => {
      const svc = await makeModule(true, 'staging', 'example.com');
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'email_1' }) });

      await svc.send({ to: 'qa@example.com', subject: 'Bem-vindo', html: '<p>H</p>' });

      const body = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      expect(body.subject).toBe('[STAGING] Bem-vindo');
      expect(body.to).toEqual(['qa@example.com']);
    });

    it('bloqueia destinatários fora do allowlist e não chama a API do Resend se nenhum sobrar', async () => {
      const svc = await makeModule(true, 'staging', 'example.com');
      const r = await svc.send({ to: 'usuario.real@gmail.com', subject: 'T', html: '<p>H</p>' });
      expect(r).toEqual({ skipped: true });
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('envia só para os destinatários permitidos quando a lista é mista', async () => {
      const svc = await makeModule(true, 'staging', 'example.com');
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'email_1' }) });

      await svc.send({ to: ['qa@example.com', 'usuario.real@gmail.com'], subject: 'T', html: '<p>H</p>' });

      const body = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      expect(body.to).toEqual(['qa@example.com']);
    });

    it('não filtra nem prefixa em produção (comportamento inalterado)', async () => {
      const svc = await makeModule(true, 'production');
      mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ id: 'email_1' }) });

      await svc.send({ to: 'cliente.real@gmail.com', subject: 'Bem-vindo', html: '<p>H</p>' });

      const body = JSON.parse((mockFetch.mock.calls[0][1] as any).body);
      expect(body.subject).toBe('Bem-vindo');
      expect(body.to).toEqual(['cliente.real@gmail.com']);
    });
  });

  it('welcomeHtml contém o nome do usuário', () => {
    const html = service.welcomeHtml('João');
    expect(html).toContain('João');
    expect(html).toMatch(/<html/i);
  });

  it('contractExpiringHtml contém título e dias', () => {
    const html = service.contractExpiringHtml('Contrato XYZ', 7);
    expect(html).toContain('Contrato XYZ');
    expect(html).toContain('7');
  });

  describe('escapeHtml (MAIL-01)', () => {
    it('escapa os 5 caracteres HTML-significativos', () => {
      expect(escapeHtml(`<img src=x onerror="alert('xss')">&`)).toBe(
        '&lt;img src=x onerror=&quot;alert(&#39;xss&#39;)&quot;&gt;&amp;',
      );
    });

    it('welcomeHtml neutraliza markup injetado no nome do usuário', () => {
      const html = service.welcomeHtml('<img src=x onerror=alert(1)>');
      expect(html).not.toContain('<img src=x onerror=alert(1)>');
      expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    });

    it('contractExpiringHtml neutraliza markup injetado no título do contrato', () => {
      const html = service.contractExpiringHtml('<script>alert(1)</script>', 7);
      expect(html).not.toContain('<script>alert(1)</script>');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
  });
});
