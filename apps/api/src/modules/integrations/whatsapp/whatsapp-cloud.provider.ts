import { Injectable, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { DataSource } from 'typeorm';
import { DATA_SOURCE } from '../../../database/database.module';
import { EncryptionService } from '../../../core/security/encryption.service';
import { IntegrationBaseService } from '../integration-base.service';
import { WhatsAppError } from './whatsapp.errors';

// Mesma versão da Graph API já usada pela integração Meta ativa do projeto
// (InstagramService — ver apps/api/src/modules/integrations/instagram/instagram.service.ts).
const GRAPH_API = 'https://graph.facebook.com/v19.0';
const PROVIDER = 'whatsapp';

export interface WhatsAppCredentials {
  phoneNumberId: string;
  accessToken: string;
  wabaId: string;
}

export interface WhatsAppSendResult {
  externalMessageId: string;
}

/**
 * Responsabilidade isolada: enviar/validar/normalizar chamadas ao WhatsApp
 * Cloud API (Meta). Não conhece o domínio de conversas do MusicChat — isso é
 * responsabilidade de quem chama (ver WhatsAppWebhookController).
 */
@Injectable()
export class WhatsAppCloudProvider extends IntegrationBaseService {
  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    enc: EncryptionService,
    private readonly config: ConfigService,
  ) {
    super(ds, enc);
  }

  async isConfigured(tenantId: string): Promise<boolean> {
    const creds = await this.loadCredentials<WhatsAppCredentials>(tenantId, PROVIDER);
    return !!(creds?.phoneNumberId && creds?.accessToken);
  }

  async configure(tenantId: string, phoneNumberId: string, accessToken: string, wabaId: string): Promise<void> {
    await this.saveCredentials(tenantId, PROVIDER, { phoneNumberId, accessToken, wabaId });
  }

  async getProviderStatus(tenantId: string) {
    return this.getStatus(tenantId, PROVIDER);
  }

  async disconnectProvider(tenantId: string): Promise<void> {
    await this.disconnect(tenantId, PROVIDER);
  }

  /** Descobre a que tenant um phone_number_id do webhook pertence. */
  async findTenantByPhoneNumberId(phoneNumberId: string): Promise<string | null> {
    const rows = await this.findAllCredentials<WhatsAppCredentials>(PROVIDER);
    return rows.find((r) => r.credentials?.phoneNumberId === phoneNumberId)?.tenantId ?? null;
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
    // 131030 (destinatário fora da allowlist do modo teste), 131026 (não é usuário WhatsApp válido)
    if (metaCode === 131030 || metaCode === 131026 || metaCode === 100) {
      return new WhatsAppError('WHATSAPP_INVALID_RECIPIENT', `WhatsApp Cloud API rejeitou o destinatário: ${metaMessage}`);
    }
    return new WhatsAppError('WHATSAPP_UPSTREAM_ERROR', `WhatsApp Cloud API respondeu ${status}: ${metaMessage}`);
  }

  /**
   * Validação da verificação de webhook do Meta (GET). Retorna o challenge a
   * ecoar de volta quando o verify_token bate; lança WHATSAPP_WEBHOOK_INVALID
   * caso contrário (inclui verify token não configurado no ambiente).
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
