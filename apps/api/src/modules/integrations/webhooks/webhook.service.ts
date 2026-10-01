/**
 * webhooks/webhook.service.ts
 *
 * Reusable webhook infrastructure:
 *   - Idempotency via WebhookEventEntity.external_id (unique constraint)
 *   - Persistence before processing (audit trail even on failure)
 *   - Mark processed/failed after handling
 *   - Signature validation abstraction (provider-agnostic)
 *   - Replay protection via status check
 *
 * Architecture: every inbound webhook passes through this service
 * before touching domain state.
 */

import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';
import { DataSource, Repository } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import { WebhookEventEntity } from '../../../database/entities';
import { WebhookEventStatus } from '@music-os-360/types';
import { redactDiagnosticText } from '../../../core/filters/redact-diagnostic';

export interface WebhookIngestResult {
  isDuplicate: boolean;
  eventId:     string;
  status:      WebhookEventStatus;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly repo: Repository<WebhookEventEntity> | null = null;

  constructor(@Inject(DATA_SOURCE) @Optional() ds: DataSource | null) {
    if (ds) this.repo = ds.getRepository(WebhookEventEntity);
  }

  /**
   * Ingest a webhook event.
   * Returns { isDuplicate: true } if external_id was already seen.
   * Persists before any domain processing — even on duplicate, returns the original event id.
   */
  async ingest(params: {
    provider:    string;
    eventType:   string;
    externalId:  string | null;
    tenantId:    string | null;
    payload:     Record<string, unknown>;
  }): Promise<WebhookIngestResult> {
    if (!this.repo) {
      this.logger.warn('[webhook] DB not available — skipping idempotency check');
      return { isDuplicate: false, eventId: 'no-db', status: WebhookEventStatus.PENDING };
    }

    // Idempotency: if external_id is known AND already successfully processed, it's a true
    // duplicate. A PENDING/FAILED row for the same external_id is not a duplicate — it's the
    // same event legitimately being retried (matches this class's own "replay protection via
    // status check" doc comment above, which the previous existence-only check didn't actually
    // implement). Reuse the same row's id/retry_count rather than creating a second row.
    if (params.externalId) {
      try {
        const existing = await this.repo.findOne({ where: { external_id: params.externalId } });
        if (existing) {
          if (existing.status === WebhookEventStatus.PROCESSED) {
            this.logger.warn(
              `[webhook] Duplicate event ignored: provider=${params.provider} externalId=${params.externalId} status=${existing.status}`,
            );
            return { isDuplicate: true, eventId: existing.id, status: existing.status as WebhookEventStatus };
          }
          this.logger.log(
            `[webhook] Retrying previously ${existing.status} event: provider=${params.provider} externalId=${params.externalId}`,
          );
          await this.repo.update(
            { id: existing.id } as any,
            { status: WebhookEventStatus.PENDING, retry_count: (existing.retry_count ?? 0) + 1 } as any,
          );
          return { isDuplicate: false, eventId: existing.id, status: WebhookEventStatus.PENDING };
        }
      } catch (err) {
        this.logger.error(`[webhook] Idempotency check failed: ${String(err)}`);
      }
    }

    // Persist the event (status = PENDING)
    try {
      const entity = this.repo.create({
        provider:    params.provider,
        event_type:  params.eventType,
        external_id: params.externalId ?? undefined,
        tenant_id:   params.tenantId,
        payload:     params.payload,
        status:      WebhookEventStatus.PENDING,
        retry_count: 0,
      });
      const saved = await this.repo.save(entity);
      this.logger.log(`[webhook] Persisted: id=${saved.id} provider=${params.provider} type=${params.eventType}`);
      return { isDuplicate: false, eventId: saved.id, status: WebhookEventStatus.PENDING };
    } catch (err) {
      this.logger.error(`[webhook] Failed to persist event: ${String(err)}`);
      return { isDuplicate: false, eventId: 'persist-error', status: WebhookEventStatus.PENDING };
    }
  }

  /**
   * Mark a webhook event as processed or failed.
   * Increments retry_count on failure for observability.
   */
  async markProcessed(eventId: string, outcome: 'processed' | 'failed', error?: string): Promise<void> {
    if (!this.repo || eventId === 'no-db' || eventId === 'persist-error') return;
    try {
      if (outcome === 'processed') {
        await this.repo.update({ id: eventId } as any, {
          status:       WebhookEventStatus.PROCESSED,
          processed_at: new Date(),
          error:        null,
        } as any);
      } else {
        // Increment retry_count via raw query to avoid race conditions
        await this.repo
          .createQueryBuilder()
          .update(WebhookEventEntity)
          .set({
            status:      WebhookEventStatus.FAILED,
            error:       redactDiagnosticText(error ?? 'unknown error').substring(0, 2000),
            retry_count: () => 'retry_count + 1',
          } as any)
          .where('id = :id', { id: eventId })
          .execute();
        this.logger.warn(`[webhook] Marked FAILED: id=${eventId} error=${redactDiagnosticText(error).substring(0, 100)}`);
      }
    } catch (err) {
      this.logger.error(`[webhook] markProcessed failed: ${String(err)}`);
    }
  }

  /**
   * HMAC-SHA256 signature validation — provider-agnostic.
   * Both sides must produce the same digest from the raw body + secret.
   *
   * `encoding` covers the real difference between providers: most send the digest
   * in hex (default), but DocuSign Connect sends it in base64 in the
   * X-DocuSign-Signature-1 header (see docusign/connect-node-listener-aws). The comparison
   * remains timing-safe over the decoded bytes in both cases.
   */
  validateHmacSignature(params: {
    rawBody:   string;
    secret:    string;
    received:  string;
    algorithm?: 'sha256' | 'sha1';
    prefix?:   string;
    encoding?: 'hex' | 'base64';
  }): boolean {
    const algo     = params.algorithm ?? 'sha256';
    const encoding = params.encoding ?? 'hex';
    const expected = createHmac(algo, params.secret).update(params.rawBody, 'utf8').digest(encoding);
    const received = params.prefix ? params.received.replace(params.prefix, '') : params.received;
    try {
      const left  = Buffer.from(expected, encoding);
      const right = Buffer.from(received, encoding);
      if (left.length !== right.length) return false;
      return timingSafeEqual(left, right);
    } catch {
      return false;
    }
  }

  /**
   * Simple constant-time equality for shared-secret comparison (e.g. Autentique).
   */
  validateSharedSecret(received: string, expected: string): boolean {
    if (!received || !expected) return false;
    try {
      const l = Buffer.from(received);
      const r = Buffer.from(expected);
      return l.length === r.length && timingSafeEqual(l, r);
    } catch {
      return false;
    }
  }
}
