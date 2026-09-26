import {
  Injectable, Inject, Optional, Logger,
  BadRequestException, ConflictException, BadGatewayException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import { ADMIN_DATA_SOURCE } from '../../../database/database.tokens';
import { IntegrationEntity } from '../../../database/entities';
import { EncryptionService } from '../../../core/security/encryption.service';
import { IntegrationBaseService } from '../integration-base.service';
import { WhatsAppError } from './whatsapp.errors';

// Same Graph API version already used by the project's active Meta integration
// (InstagramService — see apps/api/src/modules/integrations/instagram/instagram.service.ts).
const GRAPH_API = 'https://graph.facebook.com/v19.0';
const PROVIDER = 'whatsapp';

export interface WhatsAppCredentials {
  phoneNumberId: string;
  accessToken: string;
  wabaId: string;
}

/** Result of the phone_number_id -> tenant identity resolution (find-2220a85e). */
export type WhatsAppTenantResolution =
  | { kind: 'resolved'; tenantId: string }
  | { kind: 'unknown' }
  | { kind: 'conflict'; tenantCount: number };

/** Cloud API phone number IDs are numeric (Graph object id). */
const PHONE_NUMBER_ID_PATTERN = /^\d{5,30}$/;

export interface WhatsAppSendResult {
  externalMessageId: string;
}

/**
 * Isolated responsibility: send/validate/normalize calls to the WhatsApp
 * Cloud API (Meta). It knows nothing about the MusicChat conversations domain —
 * that belongs to the caller (see WhatsAppWebhookController).
 */
@Injectable()
export class WhatsAppCloudProvider extends IntegrationBaseService {
  private readonly identityLogger = new Logger('WhatsAppIdentity');

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    enc: EncryptionService,
    private readonly config: ConfigService,
    // find-2220a85e: identity resolution on the public webhook (no tenant
    // context). With DATABASE_SESSION_CONTEXT_ENABLED=true, DATA_SOURCE is the
    // NOBYPASSRLS role and the cross-tenant scan returns 0 rows (proven against a
    // real Postgres) — no inbound message was ever routed. Uses the read-only
    // owner connection already documented for system enumeration.
    @Optional() @Inject(ADMIN_DATA_SOURCE) private readonly adminDs?: DataSource | null,
  ) {
    super(ds, enc);
  }

  /**
   * Every existing phone_number_id -> tenant link (non-null credentials;
   * disconnecting clears credentials_encrypted). Read-only.
   */
  private async listPhoneNumberBindings(): Promise<Array<{ tenantId: string; phoneNumberId: string }>> {
    const ds = this.adminDs ?? null;
    if (!ds) {
      throw new Error('ADMIN_DATA_SOURCE indisponível — resolução de identidade WhatsApp não pode rodar sem conexão de sistema');
    }
    const rows = await ds.getRepository(IntegrationEntity)
      .createQueryBuilder('i')
      .select(['i.tenant_id', 'i.credentials_encrypted'])
      .where('i.provider = :provider AND i.credentials_encrypted IS NOT NULL', { provider: PROVIDER })
      .getMany();
    const out: Array<{ tenantId: string; phoneNumberId: string }> = [];
    for (const row of rows) {
      try {
        const creds = JSON.parse(this.enc.decrypt(row.credentials_encrypted as string)) as Partial<WhatsAppCredentials>;
        if (creds.phoneNumberId) out.push({ tenantId: row.tenant_id, phoneNumberId: String(creds.phoneNumberId) });
      } catch {
        // an unreadable credential never becomes an identity link
      }
    }
    return out;
  }

  async isConfigured(tenantId: string): Promise<boolean> {
    const creds = await this.loadCredentials<WhatsAppCredentials>(tenantId, PROVIDER);
    return !!(creds?.phoneNumberId && creds?.accessToken);
  }

  /**
   * find-2220a85e — explicit identity link (Section 9: string equality does
   * not prove equivalence). Before writing:
   *  1. format: numeric phoneNumberId, non-empty token and wabaId;
   *  2. ownership: the Graph API itself confirms THIS token can access THIS
   *     phone_number_id (otherwise a tenant could pre-register another
   *     tenant's number and receive its inbound messages);
   *  3. uniqueness: the number cannot be linked to another tenant.
   */
  async configure(tenantId: string, phoneNumberId: string, accessToken: string, wabaId: string): Promise<void> {
    const pid = typeof phoneNumberId === 'string' ? phoneNumberId.trim() : '';
    const token = typeof accessToken === 'string' ? accessToken.trim() : '';
    const waba = typeof wabaId === 'string' ? wabaId.trim() : '';
    if (!PHONE_NUMBER_ID_PATTERN.test(pid)) {
      throw new BadRequestException('phoneNumberId inválido: deve ser o ID numérico do número na WhatsApp Cloud API');
    }
    if (!token || !waba) {
      throw new BadRequestException('accessToken e wabaId são obrigatórios');
    }

    await this.assertTokenOwnsPhoneNumber(pid, token);

    const bindings = await this.listPhoneNumberBindings();
    const other = bindings.find((b) => b.phoneNumberId === pid && b.tenantId !== tenantId);
    if (other) {
      this.identityLogger.warn(`configure recusado: phone_number_id já vinculado a outro tenant (tenant solicitante=${tenantId})`);
      throw new ConflictException('Este número do WhatsApp já está vinculado a outra conta');
    }

    await this.saveCredentials(tenantId, PROVIDER, { phoneNumberId: pid, accessToken: token, wabaId: waba });
  }

  /** GET /{phone_number_id} with the tenant's token: a 200 proves access to the number. */
  private async assertTokenOwnsPhoneNumber(phoneNumberId: string, accessToken: string): Promise<void> {
    let res: Response;
    try {
      res = await this.fetch(`${GRAPH_API}/${encodeURIComponent(phoneNumberId)}?fields=id`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      throw new BadGatewayException('Não foi possível validar o número junto à WhatsApp Cloud API — tente novamente');
    }
    const data = await res.json().catch(() => ({}) as Record<string, unknown>);
    if (!res.ok || String((data as { id?: unknown }).id ?? '') !== phoneNumberId) {
      throw new BadRequestException('O accessToken informado não tem acesso a este phoneNumberId na WhatsApp Cloud API');
    }
  }

  async getProviderStatus(tenantId: string) {
    return this.getStatus(tenantId, PROVIDER);
  }

  async disconnectProvider(tenantId: string): Promise<void> {
    await this.disconnect(tenantId, PROVIDER);
  }

  /**
   * Resolves which tenant a webhook phone_number_id belongs to. Never
   * "first matching row": 0 -> unknown, 1 -> resolved, >1 -> conflict
   * (fail-closed; nothing is routed).
   */
  async resolveTenantByPhoneNumberId(phoneNumberId: string): Promise<WhatsAppTenantResolution> {
    const tenants = new Set(
      (await this.listPhoneNumberBindings())
        .filter((b) => b.phoneNumberId === phoneNumberId)
        .map((b) => b.tenantId),
    );
    if (tenants.size === 0) return { kind: 'unknown' };
    if (tenants.size > 1) return { kind: 'conflict', tenantCount: tenants.size };
    return { kind: 'resolved', tenantId: [...tenants][0] };
  }

  async sendTextMessage(tenantId: string, to: string, body: string): Promise<WhatsAppSendResult> {
    const creds = await this.loadCredentials<WhatsAppCredentials>(tenantId, PROVIDER);
    if (!creds?.phoneNumberId || !creds?.accessToken) {
      throw new WhatsAppError('WHATSAPP_NOT_CONFIGURED', 'WhatsApp Cloud API não configurado para este tenant');
    }

    const res = await this.fetch(`${GRAPH_API}/${encodeURIComponent(creds.phoneNumberId)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${creds.accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
    });

    const data = await res.json().catch(() => ({}) as Record<string, unknown>);
    if (!res.ok) throw this.mapUpstreamError(res.status, data);

    const externalMessageId = (data as any)?.messages?.[0]?.id;
    if (!externalMessageId) {
      throw new WhatsAppError('WHATSAPP_UPSTREAM_ERROR', 'WhatsApp Cloud API não retornou o id da mensagem enviada');
    }
    return { externalMessageId };
  }

  private mapUpstreamError(status: number, data: unknown): WhatsAppError {
    const metaError = (data as any)?.error ?? {};
    const metaCode = metaError.code;
    const metaMessage = metaError.message ?? 'erro desconhecido';

    if (status === 401 || metaCode === 190) {
      return new WhatsAppError('WHATSAPP_AUTH_ERROR', `WhatsApp Cloud API respondeu 401: ${metaMessage}`);
    }
    if (status === 429 || metaCode === 4 || metaCode === 80007) {
      return new WhatsAppError('WHATSAPP_RATE_LIMITED', `WhatsApp Cloud API respondeu 429: ${metaMessage}`);
    }
    // 131030 (recipient outside the test-mode allowlist), 131026 (not a valid WhatsApp user)
    if (metaCode === 131030 || metaCode === 131026 || metaCode === 100) {
      return new WhatsAppError('WHATSAPP_INVALID_RECIPIENT', `WhatsApp Cloud API rejeitou o destinatário: ${metaMessage}`);
    }
    return new WhatsAppError('WHATSAPP_UPSTREAM_ERROR', `WhatsApp Cloud API respondeu ${status}: ${metaMessage}`);
  }

  /**
   * Validates Meta's webhook verification (GET). Returns the challenge to
   * echo back when verify_token matches; otherwise throws
   * WHATSAPP_WEBHOOK_INVALID (including when no verify token is configured).
   */
  verifyWebhookChallenge(mode: string | undefined, token: string | undefined, challenge: string | undefined): string {
    const expected = this.config.get<string>('WHATSAPP_WEBHOOK_VERIFY_TOKEN') ?? '';
    if (!expected) {
      throw new WhatsAppError('WHATSAPP_NOT_CONFIGURED', 'WHATSAPP_WEBHOOK_VERIFY_TOKEN não definido no ambiente da API');
    }
    if (mode !== 'subscribe' || !token || !challenge) {
      throw new WhatsAppError('WHATSAPP_WEBHOOK_INVALID', 'Parâmetros de verificação do webhook ausentes ou incorretos');
    }

    const tokenBuf = Buffer.from(token);
    const expectedBuf = Buffer.from(expected);
    if (tokenBuf.length !== expectedBuf.length || !timingSafeEqual(tokenBuf, expectedBuf)) {
      throw new WhatsAppError('WHATSAPP_WEBHOOK_INVALID', 'Verify token inválido');
    }
    return challenge;
  }
}
