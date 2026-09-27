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

/** Real WebhookService (not mocked) — the test must exercise the real HMAC, not a double that always returns true. */
function makeController(overrides: {
  findTenant?: jest.Mock;
  verify?: jest.Mock;
  ingest?: jest.Mock;
  markProcessed?: jest.Mock;
  handleInboundMessage?: jest.Mock;
} = {}) {
  const whatsapp: any = {
    resolveTenantByPhoneNumberId: overrides.findTenant ?? jest.fn().mockResolvedValue({ kind: 'resolved', tenantId: 'tenant-a' }),
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
  // find-b4201eb2: @Public route — every database access must run inside the
  // resolved tenant's context. The stub marks "inside the context" and records
  // the tenant of each opening.
  const contexts: string[] = [];
  let active: string | null = null;
  const dbContext: any = {
    runInTenantContext: jest.fn(async (ctx: { tenantId: string }, work: () => Promise<unknown>) => {
      contexts.push(ctx.tenantId);
      const prev = active;
      active = ctx.tenantId;
      try { return await work(); } finally { active = prev; }
    }),
  };
  const activeTenant = () => active;
  return {
    controller: new WhatsAppWebhookController(whatsapp, webhookSvc, musicChat, config, dbContext),
    whatsapp, webhookSvc, musicChat, ingestSpy, markProcessedSpy, dbContext, contexts, activeTenant,
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

/** Simulates the real request: rawBody is the Buffer captured at bootstrap (rawBody:true), payload is the JSON already parsed by Nest — both come from the same body. */
function rawReq(bodyObj: unknown): any {
  return { rawBody: Buffer.from(JSON.stringify(bodyObj), 'utf8') };
}

describe('WhatsAppWebhookController', () => {
  beforeEach(() => { process.env['META_APP_SECRET'] = TEST_SECRET; });
  afterAll(() => {
    if (ORIGINAL_META_APP_SECRET === undefined) delete process.env['META_APP_SECRET'];
    else process.env['META_APP_SECRET'] = ORIGINAL_META_APP_SECRET;
  });

  // ── GET verification (unchanged by the POST hardening) ───────────────────────

  it('valid webhook verification: responds 200 with the challenge as plain text', () => {
    const { controller, whatsapp } = makeController({ verify: jest.fn(() => 'challenge-123') });
    const res = makeRes();

    controller.verify('subscribe', 'right-token', 'challenge-123', res);

    expect(whatsapp.verifyWebhookChallenge).toHaveBeenCalledWith('subscribe', 'right-token', 'challenge-123');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.send).toHaveBeenCalledWith('challenge-123');
  });

  it('invalid webhook verification: responds 403, never echoes the challenge', () => {
    const { controller } = makeController({
      verify: jest.fn(() => { throw Object.assign(new Error('bad token'), { code: 'WHATSAPP_WEBHOOK_INVALID' }); }),
    });
    const res = makeRes();

    controller.verify('subscribe', 'wrong-token', 'challenge-123', res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).not.toHaveBeenCalledWith('challenge-123');
  });

  // ── POST: mandatory signature (real HMAC algorithm, not mocked) ─────────────

  it('POST without X-Hub-Signature-256: rejected with 403, nothing processed', async () => {
    const { controller, ingestSpy, musicChat } = makeController();
    const body = messagePayloadObj();

    await expect(controller.receive(body, undefined, rawReq(body))).rejects.toBeInstanceOf(ForbiddenException);

    expect(ingestSpy).not.toHaveBeenCalled();
    expect(musicChat.handleInboundMessage).not.toHaveBeenCalled();
  });

  it('POST with a wrong signature: rejected with 403, nothing processed', async () => {
    const { controller, ingestSpy, musicChat } = makeController();
    const body = messagePayloadObj();

    await expect(
      controller.receive(body, 'sha256=0000000000000000000000000000000000000000000000000000000000000000', rawReq(body)),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(ingestSpy).not.toHaveBeenCalled();
    expect(musicChat.handleInboundMessage).not.toHaveBeenCalled();
  });

  it('POST with META_APP_SECRET absent: explicitly rejected (503), never processed silently', async () => {
    delete process.env['META_APP_SECRET'];
    const { controller, ingestSpy, musicChat } = makeController();
    const body = messagePayloadObj();
    const req = rawReq(body);
    const validSig = sign(req.rawBody.toString('utf8')); // even with a correct signature, there is no way to validate without a server secret

    await expect(controller.receive(body, validSig, req)).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(ingestSpy).not.toHaveBeenCalled();
    expect(musicChat.handleInboundMessage).not.toHaveBeenCalled();
  });

  it('POST with a real, correct HMAC signature + message: inbound processed', async () => {
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

  it('duplicate valid POST: idempotency still holds (handleInboundMessage does not run again)', async () => {
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

  it('event without a message (field !== messages, e.g. statuses): safely ignored after a valid signature', async () => {
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

  it('unknown payload (object other than whatsapp_business_account): safely ignored after a valid signature', async () => {
    const { controller, musicChat, ingestSpy } = makeController();
    const body = { object: 'page' };
    const req = rawReq(body);
    const validSig = sign(req.rawBody.toString('utf8'));

    const result = await controller.receive(body, validSig, req);

    expect(result).toEqual({ received: true });
    expect(ingestSpy).not.toHaveBeenCalled();
    expect(musicChat.handleInboundMessage).not.toHaveBeenCalled();
  });

  it('provider not configured (no tenant with that phone_number_id): safely ignored after a valid signature', async () => {
    const { controller, musicChat, ingestSpy } = makeController({ findTenant: jest.fn().mockResolvedValue({ kind: 'unknown' }) });
    const body = messagePayloadObj();
    const req = rawReq(body);
    const validSig = sign(req.rawBody.toString('utf8'));

    await controller.receive(body, validSig, req);

    expect(ingestSpy).not.toHaveBeenCalled();
    expect(musicChat.handleInboundMessage).not.toHaveBeenCalled();
  });

  it('find-2220a85e: a phone_number_id linked to more than one tenant is routed to NONE (fail-closed)', async () => {
    const { controller, musicChat, ingestSpy } = makeController({
      findTenant: jest.fn().mockResolvedValue({ kind: 'conflict', tenantCount: 2 }),
    });
    const body = messagePayloadObj();
    const req = rawReq(body);
    await controller.receive(body, sign(req.rawBody.toString('utf8')), req);
    expect(ingestSpy).not.toHaveBeenCalled();
    expect(musicChat.handleInboundMessage).not.toHaveBeenCalled();
  });

  it('find-2220a85e: the routed message goes exactly to the resolved tenant', async () => {
    const { controller, musicChat, ingestSpy } = makeController({
      findTenant: jest.fn().mockResolvedValue({ kind: 'resolved', tenantId: 'tenant-z' }),
    });
    const body = messagePayloadObj();
    const req = rawReq(body);
    await controller.receive(body, sign(req.rawBody.toString('utf8')), req);
    expect(ingestSpy).toHaveBeenCalledWith(expect.objectContaining({ tenantId: 'tenant-z' }));
    expect(musicChat.handleInboundMessage).toHaveBeenCalledWith('tenant-z', expect.anything());
  });

  it('find-b4201eb2: ingest and MusicChat run INSIDE the resolved tenant context', async () => {
    const seen: Array<{ step: string; tenant: string | null }> = [];
    const ctl = makeController({
      findTenant: jest.fn().mockResolvedValue({ kind: 'resolved', tenantId: 'tenant-q' }),
    });
    ctl.ingestSpy.mockImplementation(async () => { seen.push({ step: 'ingest', tenant: ctl.activeTenant() }); return { isDuplicate: false, eventId: 'evt-1', status: 'pending' }; });
    ctl.musicChat.handleInboundMessage.mockImplementation(async () => { seen.push({ step: 'musicchat', tenant: ctl.activeTenant() }); return { action: 'received' }; });
    ctl.markProcessedSpy.mockImplementation(async () => { seen.push({ step: 'mark', tenant: ctl.activeTenant() }); });
    const body = messagePayloadObj();
    const req = rawReq(body);
    await ctl.controller.receive(body, sign(req.rawBody.toString('utf8')), req);
    expect(seen).toEqual([
      { step: 'ingest', tenant: 'tenant-q' },
      { step: 'musicchat', tenant: 'tenant-q' },
      { step: 'mark', tenant: 'tenant-q' },
    ]);
  });

  it('find-b4201eb2: a MusicChat failure records "failed" in a separate transaction (never in the aborted one)', async () => {
    const ctl = makeController({ handleInboundMessage: jest.fn().mockRejectedValue(new Error('RLS/DB error')) });
    const body = messagePayloadObj();
    const req = rawReq(body);
    await expect(ctl.controller.receive(body, sign(req.rawBody.toString('utf8')), req)).rejects.toThrow();
    // ingest, processing attempt, failure record: 3 distinct contexts
    expect(ctl.dbContext.runInTenantContext).toHaveBeenCalledTimes(3);
    expect(ctl.markProcessedSpy).toHaveBeenLastCalledWith('evt-1', 'failed', 'RLS/DB error');
  });

  // ── Regression: an internal failure must not become silent loss (always 200) ─

  it('handleInboundMessage fails: does NOT silently return 200 — throws to trigger Meta\'s retry', async () => {
    const { controller, markProcessedSpy } = makeController({
      handleInboundMessage: jest.fn().mockRejectedValue(new Error('DB unavailable')),
    });
    const body = messagePayloadObj();
    const req = rawReq(body);
    const validSig = sign(req.rawBody.toString('utf8'));

    await expect(controller.receive(body, validSig, req)).rejects.toBeInstanceOf(BadGatewayException);
    expect(markProcessedSpy).toHaveBeenCalledWith('evt-1', 'failed', 'DB unavailable');
  });

  it('payload with multiple messages, one failing: still throws (no 200 hiding the partial failure)', async () => {
    const handleInboundMessage = jest.fn()
      .mockResolvedValueOnce({ action: 'received' })
      .mockRejectedValueOnce(new Error('failure on the second call'));
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

  it('redelivery of a previously FAILED event (isDuplicate=false, status pending after retry): reprocesses instead of skipping', async () => {
    // Mirrors WebhookService.ingest's real behavior after the fix: a known external_id
    // whose previous status was FAILED comes back as isDuplicate=false (retryable),
    // not isDuplicate=true — only an already PROCESSED event is a true duplicate.
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
