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

// Mesma versão da Graph API já usada pela integração Meta ativa do projeto
// (InstagramService — ver apps/api/src/modules/integrations/instagram/instagram.service.ts).
const GRAPH_API = 'https://graph.facebook.com/v19.0';
const PROVIDER = 'whatsapp';

export interface WhatsAppCredentials {
  phoneNumberId: string;
  accessToken: string;
  wabaId: string;
}

/** Resultado da resolução de identidade phone_number_id -> tenant (find-2220a85e). */
export type WhatsAppTenantResolution =
  | { kind: 'resolved'; tenantId: string }
  | { kind: 'unknown' }
  | { kind: 'conflict'; tenantCount: number };

/** IDs de número da Cloud API são numéricos (Graph object id). */
const PHONE_NUMBER_ID_PATTERN = /^\d{5,30}$/;

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
  private readonly identityLogger = new Logger('WhatsAppIdentity');

  constructor(
    @Inject(DATA_SOURCE) ds: DataSource | null,
    enc: EncryptionService,
    private readonly config: ConfigService,
    // find-2220a85e: resolução de identidade no webhook público (sem contexto
    // de tenant). Com DATABASE_SESSION_CONTEXT_ENABLED=true o DATA_SOURCE é o
    // role NOBYPASSRLS e a varredura cross-tenant retorna 0 linhas (provado em
    // Postgres real) — nenhuma mensagem inbound jamais era roteada. Usa a
    // conexão owner somente-leitura já documentada para enumeração de sistema.
    @Optional() @Inject(ADMIN_DATA_SOURCE) private readonly adminDs?: DataSource | null,
  ) {
    super(ds, enc);
  }

  /**
   * Todas as vinculações phone_number_id -> tenant existentes (credenciais
   * não nulas; desconectar zera credentials_encrypted). Somente leitura.
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
        // credencial ilegível não vira vínculo de identidade
      }
    }
    return out;
  }

  async isConfigured(tenantId: string): Promise<boolean> {
    const creds = await this.loadCredentials<WhatsAppCredentials>(tenantId, PROVIDER);
    return !!(creds?.phoneNumberId && creds?.accessToken);
  }

  /**
   * find-2220a85e — vínculo de identidade explícito (Seção 9: igualdade de
   * string não prova equivalência). Antes de gravar:
   *  1. formato: phoneNumberId numérico, token e wabaId não vazios;
   *  2. posse: a própria Graph API confirma que ESTE token acessa ESTE
   *     phone_number_id (senão um tenant poderia pré-registrar o número de
   *     outro e receber as mensagens inbound dele);
   *  3. unicidade: o número não pode estar vinculado a outro tenant.
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

  /** GET /{phone_number_id} com o token do tenant: 200 prova acesso ao número. */
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
   * Resolve a que tenant um phone_number_id do webhook pertence. Nunca
   * "primeira linha que bate": 0 -> unknown, 1 -> resolved, >1 -> conflict
   * (fail-closed; nada é roteado).
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
