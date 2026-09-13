/**
 * autentique.service.ts
 *
 * Hardened integration with Autentique digital signature platform.
 *
 * Hardening applied (Phase 5):
 *   - Idempotency: webhook external_id deduplication via WebhookService
 *   - Timeout: AbortController (15s) on every outbound API call
 *   - Retry metadata: retry_count + last_failure_at tracked in IntegrationEntity.metadata
 *   - Failure activity logs: failures written to activity_logs with context
 *   - Dead-letter: webhook events persisted via WebhookService even on processing error
 *   - Provider metadata: provider, provider_event_id, provider_status, synced_at stored on contract
 */

import {
  Injectable, Logger, Inject, Optional,
  UnauthorizedException, ServiceUnavailableException, ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ADMIN_DATA_SOURCE, DATA_SOURCE } from '../../../database/database.module';
import { DatabaseContextService } from '../../../database/database-context.service';
import { IntegrationEntity, ContractEntity } from '../../../database/entities';
import { EncryptionService } from '../../../core/security/encryption.service';
import { EventsService, DOMAIN_EVENTS } from '../../../core/events/events.service';
import { ActivityLogsService } from '../../activity-logs/activity-logs.service';
import { WebhookService } from '../webhooks/webhook.service';
import { IntegrationStatus } from '@music-os-360/types';
import { TenantBootstrapResolver } from '../../../database/tenant-bootstrap.resolver';

const AUTENTIQUE_API    = 'https://api.autentique.com.br/v2';
const FETCH_TIMEOUT_MS  = 15_000;

@Injectable()
export class AutentiqueService {
  private readonly logger = new Logger(AutentiqueService.name);
  private readonly integRepo:   Repository<IntegrationEntity> | null = null;
  private readonly contractRepo: Repository<ContractEntity>   | null = null;
  private readonly adminContractRepo: Repository<ContractEntity> | null = null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    private readonly encryption: EncryptionService,
    private readonly config: ConfigService,
    @Optional() private readonly events: EventsService,
    @Optional() private readonly activityLogs: ActivityLogsService,
    @Optional() private readonly webhookSvc: WebhookService,
    @Optional() private readonly dbContext?: DatabaseContextService,
    @Inject(ADMIN_DATA_SOURCE) @Optional() adminDataSource?: DataSource | null,
    @Optional() private readonly tenantResolver?: TenantBootstrapResolver,
  ) {
    if (ds) {
      this.integRepo    = ds.getRepository(IntegrationEntity);
      this.contractRepo = ds.getRepository(ContractEntity);
    }
    if (adminDataSource) {
      this.adminContractRepo = adminDataSource.getRepository(ContractEntity);
    }
  }

  // ── Internal helpers ─────────────────────────────────────────────────────────

  private assertRepos(): void {
    if (!this.integRepo || !this.contractRepo) {
      throw new ServiceUnavailableException('Autentique persistence unavailable');
    }
  }

  /**
   * This webhook is @Public() — it never traverses TenantGuard, the only
   * other place tenants.active gets checked. Without this, a suspended
   * tenant's contracts keep getting flipped to "assinado" by a signed
   * document callback indefinitely. Runs after the tenant is resolved from
   * the contract (server-side, not client-supplied) and before
   * runInTenantContext applies the signature.
   */
  private async assertTenantActive(tenantId: string): Promise<void> {
    if (!this.tenantResolver) {
      throw new ServiceUnavailableException('Tenant bootstrap unavailable for Autentique webhook');
    }
    const tenant = await this.tenantResolver.resolveTenant(tenantId);
    if (!tenant || !tenant.active) {
      throw new ForbiddenException('Tenant not found or inactive');
    }
    // P0-A: deliberately NO billing-status gate here — same Type-B
    // reconciliation reasoning as DocuSign's assertTenantActive. The
    // signature already happened externally; only the lifecycle check above
    // applies. See the P0-A Public Boundary Policy Matrix.
  }

  private async getToken(tenantId: string): Promise<string> {
    this.assertRepos();
    const row = await this.integRepo!
      .createQueryBuilder('i')
      .where('i.tenant_id = :tenantId AND i.provider = :provider', { tenantId, provider: 'autentique' })
      .getOne();
    if (!row?.credentials_encrypted) {
      throw new ServiceUnavailableException('Autentique not configured for this tenant');
    }
    const creds = this.encryption.decrypt(row.credentials_encrypted);
    return (JSON.parse(creds) as { api_token: string }).api_token;
  }

  /** Fetch with AbortController timeout and retry metadata tracking on failure. */
  private async timedFetch(
    tenantId: string, url: string, init: RequestInit,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = (err as Error).name === 'AbortError';
      const message   = isTimeout ? `Autentique API timeout (${FETCH_TIMEOUT_MS}ms)` : String(err);
      await this.recordFailure(tenantId, message);
      throw new ServiceUnavailableException(message);
    }
  }

  /** Increment failure_count + record last_failure_at in integration metadata. */
  private async recordFailure(tenantId: string, reason: string): Promise<void> {
    if (!this.integRepo) return;
    try {
      const row = await this.integRepo
        .createQueryBuilder('i')
        .where('i.tenant_id = :tenantId AND i.provider = :provider', { tenantId, provider: 'autentique' })
        .getOne();
      if (row) {
        const retryCount = ((row.metadata as any)?.retry_count ?? 0) + 1;
        await this.integRepo.update({ id: row.id } as any, {
          failure_count: (row.failure_count ?? 0) + 1,
          status:        IntegrationStatus.ERROR,
          metadata: {
            ...row.metadata,
            retry_count:     retryCount,
            last_failure_at: new Date().toISOString(),
            last_failure_reason: reason.substring(0, 500),
          },
        } as any);
      }
    } catch { /* best-effort — don't throw from error handler */ }
  }

  /** Reset failure counters after a successful operation. */
  private async recordSuccess(tenantId: string): Promise<void> {
    if (!this.integRepo) return;
    try {
      const row = await this.integRepo
        .createQueryBuilder('i')
        .where('i.tenant_id = :tenantId AND i.provider = :provider', { tenantId, provider: 'autentique' })
        .getOne();
      if (row) {
        await this.integRepo.update({ id: row.id } as any, {
          failure_count: 0,
          status:        IntegrationStatus.CONNECTED,
          last_sync_at:  new Date(),
          metadata: {
            ...row.metadata,
            synced_at:   new Date().toISOString(),
            provider:    'autentique',
            retry_count: 0,
          },
        } as any);
      }
    } catch { /* best-effort */ }
  }

  // ── Public API ───────────────────────────────────────────────────────────────

  async sendForSignature(params: {
    tenantId:   string;
    contractId: string;
    name:       string;
    fileBase64: string;
    signers:    Array<{ name: string; email: string }>;
  }): Promise<{ documentId: string }> {
    this.assertRepos();
    const token = await this.getToken(params.tenantId);

    const mutation = `
      mutation CreateDocument($document: DocumentInput!, $signers: [SignerInput!]!) {
        createDocument(document: $document, signers: $signers) { id name }
      }
    `;

    let res: Response;
    try {
      res = await this.timedFetch(params.tenantId, `${AUTENTIQUE_API}/graphql`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body:    JSON.stringify({
          query:     mutation,
          variables: {
            document: { name: params.name, content_base64: params.fileBase64 },
            signers:  params.signers.map((s) => ({ name: s.name, email: s.email, action: 'SIGN' })),
          },
        }),
      });
    } catch (err) {
      // timedFetch already recorded the failure; log to activity
      if (this.activityLogs && params.contractId) {
        await this.activityLogs.create(params.tenantId, 'autentique:service', {
          entity_type:  'contract',
          entity_id:    params.contractId,
          action:       'send_for_signature_failed',
          description:  `Falha ao enviar contrato "${params.name}" para Autentique`,
          metadata:     { error: String(err), provider: 'autentique' },
        }).catch(() => {});
      }
      throw err;
    }

    const data = await res.json() as any;
    if (data.errors) {
      const errMsg = String(data.errors[0]?.message ?? 'Autentique API error');
      await this.recordFailure(params.tenantId, errMsg);
      throw new ServiceUnavailableException(errMsg);
    }

    const docId = data.data.createDocument.id as string;

    if (params.contractId) {
      await this.contractRepo!
        .createQueryBuilder()
        .update(ContractEntity)
        .set({
          status:           'aguardando_assinatura',
          autentique_doc_id: docId,
          signing_platform: 'autentique',
          updated_at:       new Date(),
          metadata: () => `metadata || '${JSON.stringify({
            provider: 'autentique', provider_doc_id: docId,
            synced_at: new Date().toISOString(), provider_status: 'awaiting_signature',
          })}'::jsonb`,
        } as any)
        .where('id = :contractId AND tenant_id = :tenantId', {
          contractId: params.contractId, tenantId: params.tenantId,
        })
        .execute();
    }

    await this.recordSuccess(params.tenantId);

    if (params.contractId && this.events) {
      this.events.emitTyped(DOMAIN_EVENTS.CONTRACT_SENT_FOR_SIGNATURE, {
        tenantId:      params.tenantId,
        userId:        'autentique:service',
        aggregateType: 'contract',
        aggregateId:   params.contractId,
        payload: {
          contractId:      params.contractId,
          tenantId:        params.tenantId,
          title:          params.name,
          artistId:        null,
          autentiqueDocId: docId,
          sentBy:          'autentique:service',
        },
      });
    }

    this.logger.log(`Autentique: document ${docId} sent for signature — contract=${params.contractId}`);
    return { documentId: docId };
  }

  async handleWebhook(payload: any, secret?: string): Promise<{ received: true }> {
    this.assertRepos();

    // 1. Validate shared secret
    const expectedSecret = this.config.get<string>('AUTENTIQUE_WEBHOOK_SECRET');
    if (!expectedSecret) throw new ServiceUnavailableException('AUTENTIQUE_WEBHOOK_SECRET not configured');

    const secretValid = this.webhookSvc
      ? this.webhookSvc.validateSharedSecret(secret ?? '', expectedSecret)
      : secret === expectedSecret;

    if (!secretValid) throw new UnauthorizedException('Invalid Autentique webhook secret');

    // 2. Ingest via WebhookService (idempotency + persistence)
    const eventType   = String(payload?.event ?? 'unknown');
    const externalId  = String(payload?.event_id ?? payload?.document?.id ?? payload?.document_id ?? '');
    const tenantId    = null; // Autentique webhooks don't carry tenant — resolved via document lookup

    const ingestResult = this.webhookSvc
      ? await this.webhookSvc.ingest({ provider: 'autentique', eventType, externalId: externalId || null, tenantId, payload })
      : { isDuplicate: false, eventId: 'no-svc', status: 'pending' as any };

    if (ingestResult.isDuplicate) {
      this.logger.warn(`[autentique/webhook] Duplicate event ignored: externalId=${externalId}`);
      return { received: true };
    }

    // 3. Only process document.signed events
    if (eventType !== 'document.signed') {
      this.webhookSvc?.markProcessed(ingestResult.eventId, 'processed');
      return { received: true };
    }

    const docId = (payload.document_id ?? payload.document?.id) as string | undefined;
    if (!docId) {
      this.webhookSvc?.markProcessed(ingestResult.eventId, 'processed');
      return { received: true };
    }

    try {
      if (!this.adminContractRepo || !this.dbContext) {
        throw new ServiceUnavailableException('Autentique tenant bootstrap unavailable');
      }

      // Read-only bootstrap: resolve tenant without depending on tenant RLS context.
      const contractIdentity = await this.adminContractRepo.findOne({
        where: { autentique_doc_id: docId },
      });

      if (!contractIdentity?.tenant_id) {
        this.logger.warn(`[autentique/webhook] No contract found for docId=${docId}`);
        this.webhookSvc?.markProcessed(ingestResult.eventId, 'processed');
        return { received: true };
      }

      await this.assertTenantActive(contractIdentity.tenant_id);

      await this.dbContext.runInTenantContext(
        { tenantId: contractIdentity.tenant_id, orgId: null, role: null },
        (manager) => this.processSignedContract(
          manager,
          contractIdentity.id,
          contractIdentity.tenant_id,
          docId,
          externalId,
        ),
      );

      this.webhookSvc?.markProcessed(ingestResult.eventId, 'processed');
    } catch (err) {
      const errMsg = String(err);
      this.logger.error(`[autentique/webhook] Processing failed: ${errMsg}`);
      this.webhookSvc?.markProcessed(ingestResult.eventId, 'failed', errMsg);

      if (this.activityLogs) {
        await this.activityLogs.create('system', 'autentique:webhook', {
          entity_type:  'webhook',
          entity_id:    ingestResult.eventId,
          action:       'webhook_processing_failed',
          description:  `Falha ao processar webhook Autentique: ${errMsg.substring(0, 200)}`,
          metadata:     { docId, eventType, error: errMsg.substring(0, 500), provider: 'autentique' },
        }).catch(() => {});
      }

      // Rethrow so Nest returns a 5xx and Autentique retries the webhook
      // delivery instead of treating a swallowed failure as delivered.
      throw err;
    }

    return { received: true };
  }

  private async processSignedContract(
    manager: EntityManager,
    contractId: string,
    tenantId: string,
    docId: string,
    externalId: string,
  ): Promise<void> {
    const repo = manager.getRepository(ContractEntity);
    const contract = await repo.findOne({
      where: { id: contractId, tenant_id: tenantId },
    });
    if (!contract) {
      throw new Error(`Autentique contract not visible in tenant context: ${contractId}`);
    }

    const signedAt = new Date().toISOString();
    const providerEventId = externalId || docId;

    await repo
      .createQueryBuilder()
      .update(ContractEntity)
      .set({
        status:     'assinado',
        updated_at: new Date(),
        metadata: () => `metadata || '${JSON.stringify({
          provider:          'autentique',
          provider_event_id: providerEventId,
          provider_status:   'signed',
          synced_at:         signedAt,
        })}'::jsonb`,
      } as any)
      .where('id = :id AND tenant_id = :tenantId', { id: contract.id, tenantId })
      .execute();

    await this.recordSuccess(tenantId);
    this.logger.log(`[autentique/webhook] Contract ${contract.id} signed via docId=${docId}`);

    if (this.activityLogs) {
      await this.activityLogs.create(tenantId, 'autentique:webhook', {
        entity_type:  'contract',
        entity_id:    contract.id,
        action:       'signed_via_webhook',
        description:  `Contrato assinado via Autentique webhook (docId=${docId})`,
        metadata:     { docId, providerEventId, signedAt, provider: 'autentique' },
      }).catch(() => {});
    }

    if (this.events) {
      this.events.emitTyped(DOMAIN_EVENTS.CONTRACT_SIGNED, {
        tenantId,
        userId:        'autentique:webhook',
        aggregateType: 'contract',
        aggregateId:   contract.id,
        payload: {
          contractId: contract.id,
          tenantId,
          title:     contract.title ?? '',
          artistId:   (contract as any).artist_id ?? null,
          signedBy:   'autentique:webhook',
          signedAt,
        },
      });
    }
  }

  async configure(tenantId: string, apiToken: string): Promise<void> {
    this.assertRepos();
    const credentials_encrypted = this.encryption.encrypt(JSON.stringify({ api_token: apiToken }));
    const existing = await this.integRepo!
      .createQueryBuilder('i')
      .where('i.tenant_id = :tenantId AND i.provider = :provider', { tenantId, provider: 'autentique' })
      .getOne();

    if (existing) {
      await this.integRepo!.update({ id: existing.id } as any, {
        credentials_encrypted,
        status:        IntegrationStatus.CONNECTED,
        failure_count: 0,
        metadata: { ...existing.metadata, provider: 'autentique', configured_at: new Date().toISOString() },
        updated_at:    new Date(),
      } as any);
    } else {
      const entity = this.integRepo!.create({
        tenant_id:             tenantId,
        provider:              'autentique',
        status:                IntegrationStatus.CONNECTED,
        credentials_encrypted,
        metadata: { provider: 'autentique', configured_at: new Date().toISOString() },
      });
      await this.integRepo!.save(entity);
    }
  }
}
