import {
  BadGatewayException, Body, Controller, ForbiddenException, Get, HttpCode, HttpStatus, Headers,
  Logger, Post, Query, Req, Res, ServiceUnavailableException,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiExcludeController } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { DatabaseContextService } from '../../../database/database-context.service';
import { Public } from '../../../core/decorators/public.decorator';
import { WhatsAppCloudProvider } from './whatsapp-cloud.provider';
import { WebhookService } from '../webhooks/webhook.service';
import { MusicChatAutomationService } from '../../conversations/musicchat-automation.service';
import type { MusicChatInboundMessageDto } from '../../conversations/dto/musicchat-automation.dto';

interface WhatsAppInboundMessage {
  id: string;
  from: string;
  timestamp?: string;
  type: string;
  text?: { body: string };
}

interface WhatsAppChangeValue {
  metadata?: { phone_number_id?: string };
  contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
  messages?: WhatsAppInboundMessage[];
}

/**
 * Meta webhook for the WhatsApp Cloud API. It ends in MusicChat's existing
 * conversations domain (MusicChatAutomationService.handleInboundMessage) —
 * it is not a second conversations system.
 */
@ApiExcludeController()
@Controller('integrations/whatsapp')
export class WhatsAppWebhookController {
  private readonly logger = new Logger(WhatsAppWebhookController.name);

  constructor(
    private readonly whatsapp: WhatsAppCloudProvider,
    private readonly webhookSvc: WebhookService,
    private readonly musicChat: MusicChatAutomationService,
    private readonly config: ConfigService,
    // find-b4201eb2: a @Public route gets no tenant context from
    // RequestTenantContextInterceptor; without it, ingest (webhook_events) and
    // MusicChat (conversations) are denied by RLS in production.
    private readonly dbContext: DatabaseContextService,
  ) {}

  @Public()
  @Get('webhook')
  verify(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
    @Res() res: Response,
  ): void {
    try {
      const echoed = this.whatsapp.verifyWebhookChallenge(mode, token, challenge);
      res.status(HttpStatus.OK).send(echoed);
    } catch (err) {
      this.logger.warn(`[whatsapp/webhook] Verification rejected: ${err instanceof Error ? err.message : String(err)}`);
      res.status(HttpStatus.FORBIDDEN).send('Forbidden');
    }
  }

  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async receive(
    @Body() payload: any,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    this.verifySignature(req, signature);

    if (payload?.object !== 'whatsapp_business_account') {
      // Event for a non-WhatsApp object (e.g. another Meta product on the same
      // app) — safely ignored, not an error.
      return { received: true };
    }

    let anyFailed = false;
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== 'messages') continue; // ex.: statuses (delivery receipts) — fora do escopo desta foundation
        if (await this.processMessagesChange(change.value as WhatsAppChangeValue)) {
          anyFailed = true;
        }
      }
    }

    // Meta only redelivers the webhook on a non-2xx response. A 200 ACK despite an
    // internal failure means silent, permanent message loss — instead we return an
    // error to trigger Meta's native retry. A message already processed
    // successfully in the same payload is not reprocessed on redelivery
    // (idempotency via WebhookService.ingest — only failures go back to PENDING).
    if (anyFailed) {
      throw new BadGatewayException('Falha ao processar uma ou mais mensagens — solicitando reenvio');
    }

    return { received: true };
  }

  /**
   * POST security barrier — runs BEFORE any parse/ingest/processing. The HMAC
   * is computed over the raw body (req.rawBody, captured globally via
   * `rawBody: true` at bootstrap — see create-app.ts; already used by the
   * Stripe webhook in billing.controller.ts, nothing changed here), never over
   * `JSON.stringify(payload)` (reserializing does not reproduce, byte for byte,
   * the body Meta signed).
   *
   * An absent META_APP_SECRET is an explicit configuration failure (503), not a
   * silent "skip verification". A missing or invalid signature is always
   * 403 — never "process anyway".
   */
  private verifySignature(req: RawBodyRequest<Request>, signature: string | undefined): void {
    const appSecret = this.config.get<string>('META_APP_SECRET') ?? '';
    if (!appSecret) {
      this.logger.error('[whatsapp/webhook] META_APP_SECRET not configured — webhook rejected');
      throw new ServiceUnavailableException('WhatsApp webhook not configured');
    }

    if (!signature) {
      this.logger.warn('[whatsapp/webhook] Request without X-Hub-Signature-256 — rejected');
      throw new ForbiddenException('X-Hub-Signature-256 missing');
    }

    const rawBody = req.rawBody ? req.rawBody.toString('utf8') : '';
    const valid = this.webhookSvc.validateHmacSignature({
      rawBody, secret: appSecret, received: signature, algorithm: 'sha256', prefix: 'sha256=',
    });
    if (!valid) {
      this.logger.warn('[whatsapp/webhook] Invalid X-Hub-Signature-256 signature — rejected');
      throw new ForbiddenException('Assinatura X-Hub-Signature-256 inválida');
    }
  }

  /** Returns true if any message in the payload failed to process (triggers Meta's retry). */
  private async processMessagesChange(value: WhatsAppChangeValue): Promise<boolean> {
    const phoneNumberId = value.metadata?.phone_number_id;
    const messages = value.messages ?? [];
    if (!phoneNumberId || messages.length === 0) return false;

    const resolution = await this.whatsapp.resolveTenantByPhoneNumberId(phoneNumberId);
    if (resolution.kind === 'unknown') {
      this.logger.warn(`[whatsapp/webhook] No tenant configured for phone_number_id=${phoneNumberId} — event ignored`);
      return false;
    }
    if (resolution.kind === 'conflict') {
      // find-2220a85e: identity ambiguity is never resolved by "first row".
      // Routes to no tenant (fail-closed).
      this.logger.error(
        `[whatsapp/webhook] Identity CONFLICT: phone_number_id=${phoneNumberId} linked to ${resolution.tenantCount} tenants — event NOT routed`,
      );
      return false;
    }
    const tenantId = resolution.tenantId;
    const ctx = { tenantId, orgId: null, role: null };

    let anyFailed = false;
    for (const message of messages) {
      if (message.type !== 'text' || !message.text?.body) continue; // foundation: text only for now

      // find-b4201eb2: each message runs in its OWN tenant context (isolated
      // transaction). A @Public route has no interceptor context, and a database
      // error in one message aborts only that message's transaction — the failure
      // record is written in another context, never in the aborted transaction.
      const ingestResult = await this.dbContext.runInTenantContext(ctx, () => this.webhookSvc.ingest({
        provider: 'whatsapp',
        eventType: 'message',
        externalId: message.id,
        tenantId,
        payload: message as unknown as Record<string, unknown>,
      }));
      if (ingestResult.isDuplicate) {
        this.logger.log(`[whatsapp/webhook] Duplicate event ignored (already processed): externalId=${message.id}`);
        continue;
      }

      const contact = value.contacts?.find((c) => c.wa_id === message.from);
      const dto: MusicChatInboundMessageDto = {
        externalContactId: message.from,
        customerName: contact?.profile?.name ?? message.from,
        channel: 'whatsapp',
        body: message.text.body,
        phone: message.from,
        metadata: { externalMessageId: message.id, provider: 'whatsapp', timestamp: message.timestamp ?? null },
      };

      try {
        await this.dbContext.runInTenantContext(ctx, async () => {
          await this.musicChat.handleInboundMessage(tenantId, dto);
          await this.webhookSvc.markProcessed(ingestResult.eventId, 'processed');
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(`[whatsapp/webhook] Failed to process message ${message.id}: ${msg}`);
        await this.dbContext.runInTenantContext(ctx, () => this.webhookSvc.markProcessed(ingestResult.eventId, 'failed', msg));
        anyFailed = true;
      }
    }
    return anyFailed;
  }
}
