import 'reflect-metadata';
import { createHmac } from 'crypto';
import { BadGatewayException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { WhatsAppWebhookController } from './whatsapp-webhook.controller';
import { WebhookService } from '../webhooks/webhook.service';

const TEST_SECRET = 'test-meta-app-secret';
const ORIGINAL_META_APP_SECRET = process.env['META_APP_SECRET'];

function sign(rawBody: string, secret = TEST_SECRET): string {
  return `sha256=${createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;
}

function makeRes() {
  return { status: jest.fn().mockReturnThis(), send: jest.fn().mockReturnThis() } as any;
}

/** WebhookService real (não mockado) — o teste precisa exercitar o HMAC de verdade, não uma dublê que sempre retorna true. */
function makeController(overrides: {
  findTenant?: jest.Mock;
  verify?: jest.Mock;
  ingest?: jest.Mock;
  markProcessed?: jest.Mock;
  handleInboundMessage?: jest.Mock;
} = {}) {
  const whatsapp: any = {
    findTenantByPhoneNumberId: overrides.findTenant ?? jest.fn().mockResolvedValue('tenant-a'),
    verifyWebhookChallenge: overrides.verify ?? jest.fn(() => 'challenge-echo'),
  };
  const webhookSvc = new WebhookService(null);
  const ingestSpy = overrides.ingest ?? jest.fn().mockResolvedValue({ isDuplicate: false, eventId: 'evt-1', status: 'pending' });
  const markProcessedSpy = overrides.markProcessed ?? jest.fn().mockResolvedValue(undefined);
  (webhookSvc as any).ingest = ingestSpy;
  (webhookSvc as any).markProcessed = markProcessedSpy;
  const musicChat: any = {
    handleInboundMessage: overrides.handleInboundMessage ?? jest.fn().mockResolvedValue({ action: 'received' }),
  };
  const config: any = { get: jest.fn((key: string) => process.env[key]) };
  return {
    controller: new WhatsAppWebhookController(whatsapp, webhookSvc, musicChat, config),
    whatsapp, webhookSvc, musicChat, ingestSpy, markProcessedSpy,
  };
}

const messagePayloadObj = (overrides: Partial<any> = {}) => ({
  object: 'whatsapp_business_account',
  entry: [{
    id: 'waba-1',
    changes: [{
      field: 'messages',
      value: {
        metadata: { phone_number_id: 'phone-123' },
        contacts: [{ profile: { name: 'Maria' }, wa_id: '5511999999999' }],
        messages: [{ id: 'wamid.ABC', from: '5511999999999', timestamp: '1700000000', type: 'text', text: { body: 'Olá' } }],
        ...overrides,
      },
    }],
  }],
});

/** Simula o request real: rawBody é o Buffer capturado pelo bootstrap (rawBody:true), payload é o JSON já parseado pelo Nest — os dois vêm do mesmo corpo. */
function rawReq(bodyObj: unknown): any {
  return { rawBody: Buffer.from(JSON.stringify(bodyObj), 'utf8') };
}

describe('WhatsAppWebhookController', () => {
  beforeEach(() => { process.env['META_APP_SECRET'] = TEST_SECRET; });
  afterAll(() => {
    if (ORIGINAL_META_APP_SECRET === undefined) delete process.env['META_APP_SECRET'];
    else process.env['META_APP_SECRET'] = ORIGINAL_META_APP_SECRET;
  });

  // ── GET verification (inalterado pelo hardening do POST) ─────────────────────

  it('webhook verification válida: responde 200 com o challenge em texto puro', () => {
    const { controller, whatsapp } = makeController({ verify: jest.fn(() => 'challenge-123') });
    const res = makeRes();

    controller.verify('subscribe', 'right-token', 'challenge-123', res);

    expect(whatsapp.verifyWebhookChallenge).toHaveBeenCalledWith('subscribe', 'right-token', 'challenge-123');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('challenge-123');
  });

  it('webhook verification inválida: responde 403, nunca ecoa o challenge', () => {
    const { controller } = makeController({
      verify: jest.fn(() => { throw Object.assign(new Error('bad token'), { code: 'WHATSAPP_WEBHOOK_INVALID' }); }),
    });
    const res = makeRes();

    controller.verify('subscribe', 'wrong-token', 'challenge-123', res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).not.toHaveBeenCalledWith('challenge-123');
  });

  // ── POST: assinatura obrigatória (algoritmo HMAC real, não mockado) ──────────

  it('POST sem X-Hub-Signature-256: rejeitado com 403, nada é processado', async () => {
    const { controller, ingestSpy, musicChat } = makeController();
    const body = messagePayloadObj();

    await expect(controller.receive(body, undefined, rawReq(body))).rejects.toBeInstanceOf(ForbiddenException);

    expect(ingestSpy).not.toHaveBeenCalled();
    expect(musicChat.handleInboundMessage).not.toHaveBeenCalled();
  });

  it('POST com assinatura incorreta: rejeitado com 403, nada é processado', async () => {
    const { controller, ingestSpy, musicChat } = makeController();
    const body = messagePayloadObj();

    await expect(
      controller.receive(body, 'sha256=0000000000000000000000000000000000000000000000000000000000000000', rawReq(body)),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(ingestSpy).not.toHaveBeenCalled();
    expect(musicChat.handleInboundMessage).not.toHaveBeenCalled();
  });

  it('POST com META_APP_SECRET ausente: rejeitado explicitamente (503), nunca processa silenciosamente', async () => {
    delete process.env['META_APP_SECRET'];
    const { controller, ingestSpy, musicChat } = makeController();
    const body = messagePayloadObj();
    const req = rawReq(body);
    const validSig = sign(req.rawBody.toString('utf8')); // mesmo com assinatura correta, sem secret no servidor não há como validar

    await expect(controller.receive(body, validSig, req)).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(ingestSpy).not.toHaveBeenCalled();
    expect(musicChat.handleInboundMessage).not.toHaveBeenCalled();
  });

  it('POST com assinatura HMAC real e correta + mensagem: inbound processado', async () => {
    const { controller, musicChat, ingestSpy, markProcessedSpy } = makeController();
    const body = messagePayloadObj();
    const req = rawReq(body);
    const validSig = sign(req.rawBody.toString('utf8'));

    const result = await controller.receive(body, validSig, req);

    expect(result).toEqual({ received: true });
    expect(ingestSpy).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'whatsapp', eventType: 'message', externalId: 'wamid.ABC', tenantId: 'tenant-a',
    }));
    expect(musicChat.handleInboundMessage).toHaveBeenCalledWith('tenant-a', expect.objectContaining({
      externalContactId: '5511999999999', customerName: 'Maria', channel: 'whatsapp', body: 'Olá', phone: '5511999999999',
    }));
    expect(markProcessedSpy).toHaveBeenCalledWith('evt-1', 'processed');
  });

  it('POST válido duplicado: idempotência continua funcionando (handleInboundMessage não roda de novo)', async () => {
    const { controller, musicChat, markProcessedSpy } = makeController({
      ingest: jest.fn().mockResolvedValue({ isDuplicate: true, eventId: 'evt-1', status: 'processed' }),
    });
    const body = messagePayloadObj();
    const req = rawReq(body);
    const validSig = sign(req.rawBody.toString('utf8'));

    await controller.receive(body, validSig, req);

    expect(musicChat.handleInboundMessage).not.toHaveBeenCalled();
    expect(markProcessedSpy).not.toHaveBeenCalled();
  });

  it('evento sem mensagem (field !== messages, ex.: statuses): ignora com segurança após assinatura válida', async () => {
    const { controller, musicChat, ingestSpy } = makeController();
    const body = {
      object: 'whatsapp_business_account',
      entry: [{ id: 'waba-1', changes: [{ field: 'statuses', value: { statuses: [{ id: 'wamid.X', status: 'delivered' }] } }] }],
    };
    const req = rawReq(body);
    const validSig = sign(req.rawBody.toString('utf8'));

    await controller.receive(body, validSig, req);

    expect(ingestSpy).not.toHaveBeenCalled();
    expect(musicChat.handleInboundMessage).not.toHaveBeenCalled();
  });

  it('payload desconhecido (object diferente de whatsapp_business_account): ignora com segurança após assinatura válida', async () => {
    const { controller, musicChat, ingestSpy } = makeController();
    const body = { object: 'page' };
    const req = rawReq(body);
    const validSig = sign(req.rawBody.toString('utf8'));

    const result = await controller.receive(body, validSig, req);

    expect(result).toEqual({ received: true });
    expect(ingestSpy).not.toHaveBeenCalled();
    expect(musicChat.handleInboundMessage).not.toHaveBeenCalled();
  });

  it('provider não configurado (nenhum tenant com esse phone_number_id): ignora com segurança após assinatura válida', async () => {
    const { controller, musicChat, ingestSpy } = makeController({ findTenant: jest.fn().mockResolvedValue(null) });
    const body = messagePayloadObj();
    const req = rawReq(body);
    const validSig = sign(req.rawBody.toString('utf8'));

    await controller.receive(body, validSig, req);

    expect(ingestSpy).not.toHaveBeenCalled();
    expect(musicChat.handleInboundMessage).not.toHaveBeenCalled();
  });

  // ── Regressão: falha interna não pode virar perda silenciosa (200 sempre) ────

  it('handleInboundMessage falha: NÃO retorna 200 silenciosamente — lança erro para acionar o retry da Meta', async () => {
    const { controller, markProcessedSpy } = makeController({
      handleInboundMessage: jest.fn().mockRejectedValue(new Error('DB indisponível')),
    });
    const body = messagePayloadObj();
    const req = rawReq(body);
    const validSig = sign(req.rawBody.toString('utf8'));

    await expect(controller.receive(body, validSig, req)).rejects.toBeInstanceOf(BadGatewayException);
    expect(markProcessedSpy).toHaveBeenCalledWith('evt-1', 'failed', 'DB indisponível');
  });

  it('payload com múltiplas mensagens, uma falha: ainda lança erro (não retorna 200 escondendo a falha parcial)', async () => {
    const handleInboundMessage = jest.fn()
      .mockResolvedValueOnce({ action: 'received' })
      .mockRejectedValueOnce(new Error('falha na segunda'));
    const ingestSpy = jest.fn()
      .mockResolvedValueOnce({ isDuplicate: false, eventId: 'evt-1', status: 'pending' })
      .mockResolvedValueOnce({ isDuplicate: false, eventId: 'evt-2', status: 'pending' });
    const { controller } = makeController({ handleInboundMessage, ingest: ingestSpy });
    const body = messagePayloadObj({
      messages: [
        { id: 'wamid.ONE', from: '5511999999999', timestamp: '1700000000', type: 'text', text: { body: 'Um' } },
        { id: 'wamid.TWO', from: '5511999999999', timestamp: '1700000001', type: 'text', text: { body: 'Dois' } },
      ],
    });
    const req = rawReq(body);
    const validSig = sign(req.rawBody.toString('utf8'));

    await expect(controller.receive(body, validSig, req)).rejects.toBeInstanceOf(BadGatewayException);
    expect(handleInboundMessage).toHaveBeenCalledTimes(2);
  });

  it('reenvio de evento previamente FAILED (isDuplicate=false, status pending após retry): reprocessa em vez de pular', async () => {
    // Reflete o comportamento real de WebhookService.ingest após o fix: um external_id
    // conhecido cujo status anterior era FAILED volta como isDuplicate=false (retryable),
    // não isDuplicate=true — só um evento já PROCESSED é um duplicado de verdade.
    const { controller, musicChat, markProcessedSpy } = makeController({
      ingest: jest.fn().mockResolvedValue({ isDuplicate: false, eventId: 'evt-1', status: 'pending' }),
    });
    const body = messagePayloadObj();
    const req = rawReq(body);
    const validSig = sign(req.rawBody.toString('utf8'));

    await controller.receive(body, validSig, req);

    expect(musicChat.handleInboundMessage).toHaveBeenCalledTimes(1);
    expect(markProcessedSpy).toHaveBeenCalledWith('evt-1', 'processed');
  });
});
