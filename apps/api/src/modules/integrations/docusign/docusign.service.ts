/**
 * docusign.service.ts
 *
 * DocuSign eSignature REST API v2.1 signing adapter.
 *
 * Completes an integration that already existed halfway: the real OAuth
 * authorization_code flow (token exchange + persistence in
 * OAuthConnectionEntity) already lived in integrations.controller.ts:283-323 —
 * what was missing was the signing adapter itself. This service mirrors
 * AutentiqueService (same persistence, same webhook pipeline, same
 * event/audit model); it is NOT a second signing system.
 *
 * Contract verified against DocuSign's official sources (not inferred):
 *   - envelope:   POST {base_uri}/restapi/v2.1/accounts/{accountId}/envelopes
 *                 body { emailSubject, documents[{documentBase64,name,fileExtension,documentId}],
 *                        recipients.signers[{email,name,recipientId,routingOrder}], status:'sent' }
 *                 (docusign/code-examples-node — lib/eSignature/examples/signingViaEmail.js)
 *   - userinfo:   GET {authBaseUrl}/oauth/userinfo → accounts[{account_id,base_uri,is_default}]
 *                 (docusign/code-examples-node — lib/DSAuthCodeGrant.js)
 *   - webhook:    HMAC-SHA256 of the RAW body, base64 digest, header
 *                 X-DocuSign-Signature-1
 *                 (docusign/connect-node-listener-aws — index.js)
 *
 * Persistence without a migration: reuses the generic columns that already
 * exist on ContractEntity (`signing_platform` varchar + `metadata` jsonb). No new
 * vendor-specific column (unlike `autentique_doc_id`, which is legacy).
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
import { EventsService, DOMAIN_EVENTS } from '../../../core/events/events.service';
import { ActivityLogsService } from '../../activity-logs/activity-logs.service';
import { providerCallFailed } from '../provider-failure';
import { redactForStorage } from '../../../core/filters/redact-diagnostic';
import { WebhookService } from '../webhooks/webhook.service';
import { IntegrationBaseService } from '../integration-base.service';
import { TenantBootstrapResolver } from '../../../database/tenant-bootstrap.resolver';
import { applyProviderSignature } from '../../contracts/contract-provider-signature';

const PROVIDER          = 'docusign';
const FETCH_TIMEOUT_MS  = 15_000;

/** Connect event that represents a truly completed signature. */
const EVENT_COMPLETED = 'envelope-completed';

interface DocuSignAccount {
  accountId: string;
  baseUri:   string;
}

@Injectable()
export class DocuSignService {
  private readonly logger = new Logger(DocuSignService.name);
  private readonly integRepo:         Repository<IntegrationEntity> | null = null;
  private readonly contractRepo:      Repository<ContractEntity>    | null = null;
  private readonly adminContractRepo: Repository<ContractEntity>    | null = null;

  constructor(
    @Inject(DATA_SOURCE) @Optional() ds: DataSource | null,
    private readonly config: ConfigService,
    private readonly integrationBase: IntegrationBaseService,
    @Optional() private readonly events?: EventsService,
    @Optional() private readonly activityLogs?: ActivityLogsService,
    @Optional() private readonly webhookSvc?: WebhookService,
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

  // ── Internal helpers ───────────────────────────────────────────────────────

  private assertRepos(): void {
    if (!this.integRepo || !this.contractRepo) {
      throw new ServiceUnavailableException('Serviço temporariamente indisponível. Tente novamente em instantes.');
    }
  }

  /**
   * This webhook is @Public() — it never traverses TenantGuard, the only
   * other place tenants.active gets checked. Without this, a suspended
   * tenant's contracts keep getting flipped to "assinado" by a signed
   * envelope callback indefinitely. Runs after the tenant is resolved from
   * the contract (server-side, not client-supplied) and before
   * runInTenantContext applies the signature.
   */
  private async assertTenantActive(tenantId: string): Promise<void> {
    if (!this.tenantResolver) {
      throw new ServiceUnavailableException('Tenant bootstrap unavailable for DocuSign webhook');
    }
    const tenant = await this.tenantResolver.resolveTenant(tenantId);
    if (!tenant || !tenant.active) {
      throw new ForbiddenException('Tenant not found or inactive');
    }
    // P0-A: deliberately NO billing-status gate here. This is a Type-B
    // inbound external callback reconciling a signature that already
    // happened outside the app (the signer completed the envelope in
    // DocuSign before this webhook fired) — it does not consume any
    // billable product capability. Blocking it on `suspended`/`read_only`
    // would leave the contract permanently desynced from external reality
    // (stuck at AGUARDANDO_ASSINATURA after it was genuinely signed) with no
    // path to reconcile once the tenant regularizes billing, since
    // DocuSign's own retry window is finite. Only the lifecycle check above
    // (tenant exists/not deactivated) applies here — see the P0-A Public
    // Boundary Policy Matrix.
  }

  /** Fetch with AbortController — same timeout policy as AutentiqueService. */
  private async timedFetch(tenantId: string, url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { ...init, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (err) {
      clearTimeout(timer);
      const isTimeout = (err as Error).name === 'AbortError';
      const message   = isTimeout ? `DocuSign API timeout (${FETCH_TIMEOUT_MS}ms)` : String(err);
      await this.recordFailure(tenantId, message);
      throw providerCallFailed(this.logger, 'DocuSign', message);
    }
  }

  private async upsertIntegrationMetadata(
    tenantId: string,
    patch: Record<string, unknown>,
  ): Promise<void> {
    try {
      const row = await this.integRepo!
        .createQueryBuilder('i')
        .where('i.tenant_id = :tenantId AND i.provider = :provider', { tenantId, provider: PROVIDER })
        .getOne();
      if (row) {
        await this.integRepo!.update({ id: row.id } as any, {
          metadata:   { ...row.metadata, provider: PROVIDER, ...patch },
          updated_at: new Date(),
        } as any);
      }
    } catch { /* best-effort — never break the main flow because of telemetry */ }
  }

  private async recordFailure(tenantId: string, reason: string): Promise<void> {
    await this.upsertIntegrationMetadata(tenantId, {
      last_failure_at: new Date().toISOString(),
      last_failure_reason: redactForStorage(reason).substring(0, 500),
    });
  }

  private async recordSuccess(tenantId: string): Promise<void> {
    await this.upsertIntegrationMetadata(tenantId, {
      last_success_at: new Date().toISOString(),
      last_failure_reason: null,
    });
  }

  /**
   * Resolves accountId + base_uri of the user's default account.
   *
   * The existing OAuth callback stores only the token — not the account/base_uri,
   * which DocuSign exposes only via /oauth/userinfo. We resolve them here and
   * cache them in the OAuthConnection's own metadata so the call is not repeated
   * on every send.
   */
  private async resolveAccount(tenantId: string, userId: string, accessToken: string): Promise<DocuSignAccount> {
    const conn = await this.integrationBase.getOAuthConnection(tenantId, userId, PROVIDER);
    const cachedAccountId = conn?.metadata?.['docusign_account_id'] as string | undefined;
    const cachedBaseUri   = conn?.metadata?.['docusign_base_uri']   as string | undefined;
    if (cachedAccountId && cachedBaseUri) {
      return { accountId: cachedAccountId, baseUri: cachedBaseUri };
    }

    const authBaseUrl = this.config.get<string>('DOCUSIGN_AUTH_BASE_URL')
      ?? 'https://account-d.docusign.com';

    const res = await this.timedFetch(tenantId, `${authBaseUrl}/oauth/userinfo`, {
      method:  'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 401) {
      await this.integrationBase.markOAuthNeedsReauth(tenantId, userId, PROVIDER);
      throw new UnauthorizedException('Token DocuSign expirado ou revogado — reconecte a integração');
    }
    if (!res.ok) {
      const msg = `DocuSign userinfo falhou (HTTP ${res.status})`;
      await this.recordFailure(tenantId, msg);
      throw new ServiceUnavailableException(msg);
    }

    const json = await res.json() as { accounts?: Array<Record<string, unknown>> };
    const accounts = Array.isArray(json.accounts) ? json.accounts : [];
    const account  = accounts.find((a) => a['is_default'] === true) ?? accounts[0];
    const accountId = account?.['account_id'] as string | undefined;
    const baseUri   = account?.['base_uri']   as string | undefined;

    if (!accountId || !baseUri) {
      const msg = 'DocuSign userinfo não retornou uma conta utilizável';
      await this.recordFailure(tenantId, msg);
      throw new ServiceUnavailableException(msg);
    }

    await this.integrationBase.saveOAuthMetadata(tenantId, userId, PROVIDER, {
      docusign_account_id: accountId,
      docusign_base_uri:   baseUri,
    });

    return { accountId, baseUri };
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Creates and sends a DocuSign envelope. Mirrors AutentiqueService.sendForSignature:
   * the same input signature (+ userId, because the DocuSign token is per user)
   * and the same { documentId } return, so the frontend can handle both
   * providers through the same contract.
   */
  async sendForSignature(params: {
    tenantId:   string;
    userId:     string;
    contractId: string;
    name:       string;
    fileBase64: string;
    signers:    Array<{ name: string; email: string }>;
  }): Promise<{ documentId: string }> {
    this.assertRepos();

    if (params.signers.length === 0) {
      throw new ServiceUnavailableException('DocuSign exige ao menos um signatário');
    }

    const conn = await this.integrationBase.getOAuthConnection(params.tenantId, params.userId, PROVIDER);
    if (!conn?.accessToken) {
      throw new ServiceUnavailableException('DocuSign não conectado para este usuário — autorize a integração primeiro');
    }

    const { accountId, baseUri } = await this.resolveAccount(params.tenantId, params.userId, conn.accessToken);

    const envelope = {
      emailSubject: params.name,
      status:       'sent',
      documents: [{
        documentBase64: params.fileBase64,
        name:           params.name,
        fileExtension:  'pdf',
        documentId:     '1',
      }],
      recipients: {
        signers: params.signers.map((s, index) => ({
          email:        s.email,
          name:         s.name,
          recipientId:  String(index + 1),
          routingOrder: String(index + 1),
        })),
      },
    };

    let res: Response;
    try {
      res = await this.timedFetch(
        params.tenantId,
        `${baseUri}/restapi/v2.1/accounts/${accountId}/envelopes`,
        {
          method:  'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization:  `Bearer ${conn.accessToken}`,
          },
          body: JSON.stringify(envelope),
        },
      );
    } catch (err) {
      if (this.activityLogs && params.contractId) {
        await this.activityLogs.create(params.tenantId, 'docusign:service', {
          entity_type: 'contract',
          entity_id:   params.contractId,
          action:      'send_for_signature_failed',
          description: `Falha ao enviar contrato "${params.name}" para DocuSign`,
          metadata:    { error: redactForStorage(err), provider: PROVIDER },
        }).catch(() => {});
      }
      throw err;
    }

    if (res.status === 401) {
      await this.integrationBase.markOAuthNeedsReauth(params.tenantId, params.userId, PROVIDER);
      throw new UnauthorizedException('Token DocuSign expirado ou revogado — reconecte a integração');
    }

    const data = await res.json() as Record<string, unknown>;
    if (!res.ok) {
      const errMsg = String(data['message'] ?? data['errorCode'] ?? `DocuSign API error (HTTP ${res.status})`);
      await this.recordFailure(params.tenantId, errMsg);
      throw providerCallFailed(this.logger, 'DocuSign', errMsg);
    }

    const envelopeId = data['envelopeId'] as string | undefined;
    if (!envelopeId) {
      const msg = 'DocuSign não retornou envelopeId';
      await this.recordFailure(params.tenantId, msg);
      throw new ServiceUnavailableException(msg);
    }

    if (params.contractId) {
      await this.contractRepo!
        .createQueryBuilder()
        .update(ContractEntity)
        .set({
          status:           'awaiting_signature',
          signing_platform: PROVIDER,
          updated_at:       new Date(),
          metadata: () => `metadata || :dsMeta::jsonb`,
        } as any)
        .setParameters({
          dsMeta: JSON.stringify({
            provider:        PROVIDER,
            provider_doc_id: envelopeId,
            provider_status: 'awaiting_signature',
            synced_at:       new Date().toISOString(),
          }),
        })
        .where('id = :contractId AND tenant_id = :tenantId', {
          contractId: params.contractId, tenantId: params.tenantId,
        })
        .execute();
    }

    await this.recordSuccess(params.tenantId);

    if (params.contractId && this.events) {
      this.events.emitTyped(DOMAIN_EVENTS.CONTRACT_SENT_FOR_SIGNATURE, {
        tenantId:      params.tenantId,
        userId:        params.userId,
        aggregateType: 'contract',
        aggregateId:   params.contractId,
        payload: {
          contractId:      params.contractId,
          tenantId:        params.tenantId,
          title:          params.name,
          artistId:        null,
          autentiqueDocId: envelopeId,
          sentBy:          params.userId,
        },
      });
    }

    this.logger.log(`DocuSign: envelope ${envelopeId} sent — contract=${params.contractId}`);
    return { documentId: envelopeId };
  }

  /**
   * DocuSign Connect webhook (JSON/Aggregate). Fail-closed: without a configured
   * DOCUSIGN_WEBHOOK_SECRET or with an invalid HMAC, nothing is processed.
   */
  async handleWebhook(
    payload: any,
    rawBody: string,
    signature?: string,
  ): Promise<{ received: true }> {
    this.assertRepos();

    const expectedSecret = this.config.get<string>('DOCUSIGN_WEBHOOK_SECRET');
    if (!expectedSecret) throw new ServiceUnavailableException('DOCUSIGN_WEBHOOK_SECRET not configured');
    if (!signature)      throw new UnauthorizedException('Missing X-DocuSign-Signature-1 header');

    // DocuSign Connect: HMAC-SHA256 over the RAW body, base64 digest.
    const valid = this.webhookSvc?.validateHmacSignature({
      rawBody,
      secret:   expectedSecret,
      received: signature,
      encoding: 'base64',
    }) ?? false;
    if (!valid) throw new UnauthorizedException('Invalid DocuSign webhook signature');

    const eventType  = String(payload?.event ?? 'unknown');
    const envelopeId = (payload?.data?.envelopeId ?? payload?.envelopeId) as string | undefined;
    // find-06f8d204: dedup key = one event of one envelope. The bare envelopeId (previous
    // key) made envelope-completed a "duplicate" of any earlier event of the
    // same envelope (envelope-sent, recipient-*), so the signature was lost.
    const externalId = envelopeId
      ? `${envelopeId}:${eventType}`
      : String(payload?.generatedDateTime ?? '');

    const ingestResult = this.webhookSvc
      ? await this.webhookSvc.ingest({
          provider: PROVIDER, eventType, externalId: externalId || null, tenantId: null, payload,
        })
      : { isDuplicate: false, eventId: 'no-svc', status: 'pending' as any };

    if (ingestResult.isDuplicate) {
      this.logger.warn(`[docusign/webhook] Duplicate event ignored: externalId=${externalId}`);
      return { received: true };
    }

    if (eventType !== EVENT_COMPLETED || !envelopeId) {
      await this.webhookSvc?.markProcessed(ingestResult.eventId, 'processed');
      return { received: true };
    }

    try {
      if (!this.adminContractRepo || !this.dbContext) {
        throw new ServiceUnavailableException('DocuSign tenant bootstrap unavailable');
      }

      // Read-only bootstrap: resolves the tenant without depending on the RLS
      // context. No vendor-specific column — matches the generic provider_doc_id in
      // metadata. Up to two results: an envelope linked to more than one contract is
      // ambiguous and fails closed (never "the first row wins").
      const matches = await this.adminContractRepo
        .createQueryBuilder('c')
        .where(`c.signing_platform = :provider AND c.metadata->>'provider_doc_id' = :envelopeId`, {
          provider: PROVIDER, envelopeId,
        })
        .take(2)
        .getMany();

      if (matches.length === 0 || !matches[0].tenant_id) {
        this.logger.warn(`[docusign/webhook] No contract found for envelopeId=${envelopeId}`);
        await this.webhookSvc?.markProcessed(ingestResult.eventId, 'processed');
        return { received: true };
      }
      if (matches.length > 1) {
        const msg = `ambiguous docusign envelopeId=${envelopeId}: more than one contract`;
        this.logger.error(`[docusign/webhook] ${msg} — not applied`);
        await this.webhookSvc?.markProcessed(ingestResult.eventId, 'failed', msg);
        return { received: true };
      }
      const contractIdentity = matches[0];

      await this.assertTenantActive(contractIdentity.tenant_id);

      await this.dbContext.runInTenantContext(
        { tenantId: contractIdentity.tenant_id, orgId: null, role: null },
        (manager) => this.processSignedContract(
          manager, contractIdentity.id, contractIdentity.tenant_id, envelopeId, externalId,
        ),
      );

      await this.webhookSvc?.markProcessed(ingestResult.eventId, 'processed');
    } catch (err) {
      const errMsg = String(err);
      this.logger.error(`[docusign/webhook] Processing failed: ${errMsg}`);
      // Durable failure trace: the webhook_events row (tenantless, system path).
      await this.webhookSvc?.markProcessed(ingestResult.eventId, 'failed', errMsg);

      // Rethrow so Nest returns a 5xx and DocuSign retries the webhook
      // delivery instead of treating a swallowed failure as delivered.
      throw err;
    }

    return { received: true };
  }

  private async processSignedContract(
    manager: EntityManager,
    contractId: string,
    tenantId: string,
    envelopeId: string,
    externalId: string,
  ): Promise<void> {
    const contract = await manager.getRepository(ContractEntity).findOne({ where: { id: contractId, tenant_id: tenantId } });
    if (!contract) {
      throw new Error(`DocuSign contract not visible in tenant context: ${contractId}`);
    }

    const signedAt = new Date().toISOString();
    const providerEventId = externalId || envelopeId;

    const outcome = await applyProviderSignature(manager, {
      contractId: contract.id, tenantId, provider: PROVIDER, providerEventId, signedAt,
    });
    await this.recordSuccess(tenantId);
    if (outcome !== 'signed') {
      this.logger.warn(
        `[docusign/webhook] Contract ${contract.id} is '${contract.status}', not awaiting signature — status unchanged (envelopeId=${envelopeId})`,
      );
      return;
    }
    this.logger.log(`[docusign/webhook] Contract ${contract.id} signed via envelopeId=${envelopeId}`);

    if (this.activityLogs) {
      await this.activityLogs.create(tenantId, 'docusign:webhook', {
        entity_type: 'contract',
        entity_id:   contract.id,
        action:      'signed_via_webhook',
        description: `Contrato assinado via DocuSign webhook (envelopeId=${envelopeId})`,
        metadata:    { envelopeId, providerEventId, signedAt, provider: PROVIDER },
      });
    }

    if (this.events) {
      this.events.emitTyped(DOMAIN_EVENTS.CONTRACT_SIGNED, {
        tenantId,
        userId:        'docusign:webhook',
        aggregateType: 'contract',
        aggregateId:   contract.id,
        payload: {
          contractId: contract.id,
          tenantId,
          title:     contract.title ?? '',
          artistId:   (contract as any).artist_id ?? null,
          signedBy:   'docusign:webhook',
          signedAt,
        },
      });
    }
  }
}
