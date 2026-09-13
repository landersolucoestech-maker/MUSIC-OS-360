/**
 * docusign.service.ts
 *
 * Adapter de assinatura DocuSign eSignature REST API v2.1.
 *
 * Completa a integração que já existia pela metade: o fluxo OAuth
 * authorization_code real (troca de token + persistência em
 * OAuthConnectionEntity) já vivia em integrations.controller.ts:283-323 — o que
 * faltava era o adapter de assinatura em si. Este serviço é o espelho do
 * AutentiqueService (mesma persistência, mesmo webhook pipeline, mesmo modelo de
 * eventos/auditoria); NÃO é um segundo sistema de assinatura.
 *
 * Contrato verificado contra as fontes oficiais do DocuSign (não deduzido):
 *   - envelope:   POST {base_uri}/restapi/v2.1/accounts/{accountId}/envelopes
 *                 body { emailSubject, documents[{documentBase64,name,fileExtension,documentId}],
 *                        recipients.signers[{email,name,recipientId,routingOrder}], status:'sent' }
 *                 (docusign/code-examples-node — lib/eSignature/examples/signingViaEmail.js)
 *   - userinfo:   GET {authBaseUrl}/oauth/userinfo → accounts[{account_id,base_uri,is_default}]
 *                 (docusign/code-examples-node — lib/DSAuthCodeGrant.js)
 *   - webhook:    HMAC-SHA256 do RAW body, digest em base64, header
 *                 X-DocuSign-Signature-1
 *                 (docusign/connect-node-listener-aws — index.js)
 *
 * Persistência sem migration: reaproveita as colunas genéricas já existentes em
 * ContractEntity (`signing_platform` varchar + `metadata` jsonb). Nenhuma coluna
 * vendor-specific nova (ao contrário de `autentique_doc_id`, que é legado).
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
import { WebhookService } from '../webhooks/webhook.service';
import { IntegrationBaseService } from '../integration-base.service';
import { TenantBootstrapResolver } from '../../../database/tenant-bootstrap.resolver';

const PROVIDER          = 'docusign';
const FETCH_TIMEOUT_MS  = 15_000;

/** Evento do Connect que representa assinatura concluída de fato. */
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
      throw new ServiceUnavailableException('DocuSign persistence unavailable');
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

  /** Fetch com AbortController — mesma política de timeout do AutentiqueService. */
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
      throw new ServiceUnavailableException(message);
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
    } catch { /* best-effort — nunca derrubar o fluxo principal por telemetria */ }
  }

  private async recordFailure(tenantId: string, reason: string): Promise<void> {
    await this.upsertIntegrationMetadata(tenantId, {
      last_failure_at: new Date().toISOString(),
      last_failure_reason: reason.substring(0, 500),
    });
  }

  private async recordSuccess(tenantId: string): Promise<void> {
    await this.upsertIntegrationMetadata(tenantId, {
      last_success_at: new Date().toISOString(),
      last_failure_reason: null,
    });
  }

  /**
   * Resolve accountId + base_uri da conta default do utilizador.
   *
   * O callback OAuth existente guarda apenas o token — não o account/base_uri,
   * que o DocuSign só expõe via /oauth/userinfo. Resolvemos aqui e cacheamos no
   * metadata da própria OAuthConnection para não repetir a chamada a cada envio.
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
   * Cria e envia um envelope DocuSign. Espelha AutentiqueService.sendForSignature:
   * mesma assinatura de entrada (+ userId, porque o token DocuSign é por
   * utilizador) e mesmo retorno { documentId }, para o frontend poder tratar os
   * dois provedores pelo mesmo contrato.
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
      throw new ServiceUnavailableException('DocuSign não conectado para este utilizador — autorize a integração primeiro');
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
          metadata:    { error: String(err), provider: PROVIDER },
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
      throw new ServiceUnavailableException(errMsg);
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
          status:           'aguardando_assinatura',
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
   * Webhook DocuSign Connect (JSON/Aggregate). Fail-closed: sem
   * DOCUSIGN_WEBHOOK_SECRET configurado ou com HMAC inválido, nada é processado.
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

    // DocuSign Connect: HMAC-SHA256 sobre o RAW body, digest em base64.
    const valid = this.webhookSvc?.validateHmacSignature({
      rawBody,
      secret:   expectedSecret,
      received: signature,
      encoding: 'base64',
    }) ?? false;
    if (!valid) throw new UnauthorizedException('Invalid DocuSign webhook signature');

    const eventType  = String(payload?.event ?? 'unknown');
    const envelopeId = (payload?.data?.envelopeId ?? payload?.envelopeId) as string | undefined;
    const externalId = String(payload?.data?.envelopeId ?? payload?.generatedDateTime ?? '');

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
      this.webhookSvc?.markProcessed(ingestResult.eventId, 'processed');
      return { received: true };
    }

    try {
      if (!this.adminContractRepo || !this.dbContext) {
        throw new ServiceUnavailableException('DocuSign tenant bootstrap unavailable');
      }

      // Bootstrap read-only: resolve o tenant sem depender do contexto RLS.
      // Sem coluna vendor-specific — casa pelo provider_doc_id genérico no metadata.
      const contractIdentity = await this.adminContractRepo
        .createQueryBuilder('c')
        .where(`c.signing_platform = :provider AND c.metadata->>'provider_doc_id' = :envelopeId`, {
          provider: PROVIDER, envelopeId,
        })
        .getOne();

      if (!contractIdentity?.tenant_id) {
        this.logger.warn(`[docusign/webhook] No contract found for envelopeId=${envelopeId}`);
        this.webhookSvc?.markProcessed(ingestResult.eventId, 'processed');
        return { received: true };
      }

      await this.assertTenantActive(contractIdentity.tenant_id);

      await this.dbContext.runInTenantContext(
        { tenantId: contractIdentity.tenant_id, orgId: null, role: null },
        (manager) => this.processSignedContract(
          manager, contractIdentity.id, contractIdentity.tenant_id, envelopeId, externalId,
        ),
      );

      this.webhookSvc?.markProcessed(ingestResult.eventId, 'processed');
    } catch (err) {
      const errMsg = String(err);
      this.logger.error(`[docusign/webhook] Processing failed: ${errMsg}`);
      this.webhookSvc?.markProcessed(ingestResult.eventId, 'failed', errMsg);

      if (this.activityLogs) {
        await this.activityLogs.create('system', 'docusign:webhook', {
          entity_type: 'webhook',
          entity_id:   ingestResult.eventId,
          action:      'webhook_processing_failed',
          description: `Falha ao processar webhook DocuSign: ${errMsg.substring(0, 200)}`,
          metadata:    { envelopeId, eventType, error: errMsg.substring(0, 500), provider: PROVIDER },
        }).catch(() => {});
      }

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
    const repo = manager.getRepository(ContractEntity);
    const contract = await repo.findOne({ where: { id: contractId, tenant_id: tenantId } });
    if (!contract) {
      throw new Error(`DocuSign contract not visible in tenant context: ${contractId}`);
    }

    const signedAt = new Date().toISOString();
    const providerEventId = externalId || envelopeId;

    await repo
      .createQueryBuilder()
      .update(ContractEntity)
      .set({
        status:     'assinado',
        updated_at: new Date(),
        metadata: () => `metadata || :dsMeta::jsonb`,
      } as any)
      .setParameters({
        dsMeta: JSON.stringify({
          provider:          PROVIDER,
          provider_event_id: providerEventId,
          provider_status:   'signed',
          synced_at:         signedAt,
        }),
      })
      .where('id = :id AND tenant_id = :tenantId', { id: contract.id, tenantId })
      .execute();

    await this.recordSuccess(tenantId);
    this.logger.log(`[docusign/webhook] Contract ${contract.id} signed via envelopeId=${envelopeId}`);

    if (this.activityLogs) {
      await this.activityLogs.create(tenantId, 'docusign:webhook', {
        entity_type: 'contract',
        entity_id:   contract.id,
        action:      'signed_via_webhook',
        description: `Contrato assinado via DocuSign webhook (envelopeId=${envelopeId})`,
        metadata:    { envelopeId, providerEventId, signedAt, provider: PROVIDER },
      }).catch(() => {});
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
