/**
 * core/mail/mail.service.ts
 *
 * MailService — envio transacional via Resend.
 * Se RESEND_API_KEY não estiver definida, regista warning e retorna sem enviar.
 * Templates em HTML inline (sem dependências externas).
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService }      from '@nestjs/config';

/**
 * MAIL-01: every template below interpolated tenant/user-controlled strings
 * (tenant names, signer names, document/contract/track titles, org names)
 * directly into HTML with no escaping — a tenant naming their org
 * `<img src=x onerror=...>` would have that markup rendered as-is by any
 * recipient's email client. Escapes the 5 HTML-significant characters;
 * applied to every string template parameter below (URLs included, for
 * defense-in-depth against quote-breakout inside href attributes).
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export interface SendMailOptions {
  to:       string | string[];
  subject:  string;
  html:     string;
  replyTo?: string;
  tags?:    Array<{ name: string; value: string }>;
  /**
   * find-a4445173: EmailProcessor runs under BullMQ's default retry policy
   * -- a retried job (same job.id) must reuse the same idempotencyKey so a
   * transient failure/redelivery can't double-send. Resend deduplicates
   * requests carrying the same Idempotency-Key header. Optional -- callers
   * outside the queue (one-off sends with no natural retry) may omit it.
   */
  idempotencyKey?: string;
}

export interface MailResult {
  id?:      string;
  skipped?: boolean;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly fromEmail: string;
  private readonly apiKey:    string | undefined;
  private readonly nodeEnv:   string;
  /**
   * STAGING-01: em NODE_ENV=staging, envios ficam limitados a domínios desta
   * lista — sem isto, testar manualmente "convidar utilizador" ou qualquer
   * outro fluxo transacional em staging enviaria emails reais para o que quer
   * que um testador digite. Produção/development não são afetados.
   */
  private readonly stagingAllowedDomains: string[];

  constructor(@Inject(ConfigService) private readonly config: ConfigService) {
    this.apiKey    = config.get<string>('RESEND_API_KEY');
    this.fromEmail = config.get<string>('RESEND_FROM_EMAIL') ?? 'noreply@musicos360.com.br';
    this.nodeEnv   = config.get<string>('NODE_ENV') ?? 'development';
    this.stagingAllowedDomains = (config.get<string>('STAGING_MAIL_ALLOWLIST_DOMAINS') ?? 'example.com')
      .split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
  }

  // ─── Envio base ───────────────────────────────────────────────────────────

  async send(opts: SendMailOptions): Promise<MailResult> {
    if (!this.apiKey) {
      this.logger.warn(`MailService: RESEND_API_KEY não configurada — email para ${Array.isArray(opts.to) ? opts.to.join(', ') : opts.to} ignorado`);
      return { skipped: true };
    }

    let recipients = Array.isArray(opts.to) ? opts.to : [opts.to];
    const isStaging = this.nodeEnv === 'staging';

    if (isStaging) {
      const allowed = recipients.filter((r) =>
        this.stagingAllowedDomains.some((domain) => r.toLowerCase().endsWith(`@${domain}`)),
      );
      const blockedCount = recipients.length - allowed.length;
      if (blockedCount > 0) {
        this.logger.warn(
          `MailService[STAGING]: ${blockedCount} destinatário(s) fora do allowlist (STAGING_MAIL_ALLOWLIST_DOMAINS) — não enviado(s)`,
        );
      }
      recipients = allowed;
      if (recipients.length === 0) return { skipped: true };
    }

    const subject = isStaging ? `[STAGING] ${opts.subject}` : opts.subject;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
        ...(opts.idempotencyKey ? { 'Idempotency-Key': opts.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from:     this.fromEmail,
        to:       recipients,
        subject,
        html:     opts.html,
        reply_to: opts.replyTo,
        tags:     opts.tags,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Resend erro ${res.status}: ${body}`);
    }

    const data = await res.json() as { id: string };
    this.logger.log(`Email enviado: ${data.id} → ${recipients.join(', ')}`);
    return { id: data.id };
  }

  // ─── Templates de domínio ─────────────────────────────────────────────────

  async sendWelcome(to: string, tenantName: string): Promise<MailResult> {
    const appUrl = this.config.get<string>('APP_URL') ?? 'https://musicos360.com.br';
    const safeTenantName = escapeHtml(tenantName);
    return this.send({
      to,
      subject: `Bem-vindo ao MUSIC OS 360 — ${tenantName}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
          <h1 style="color:#1d4ed8">🎵 MUSIC OS 360</h1>
          <p>Olá,</p>
          <p>O tenant <strong>${safeTenantName}</strong> está pronto. Acesse a plataforma:</p>
          <a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:12px 24px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0">
            Acessar MUSIC OS 360
          </a>
          <p style="color:#6b7280;font-size:12px;margin-top:32px">MUSIC OS 360 — Enterprise Music Management SaaS</p>
        </div>
      `,
      tags: [{ name: 'type', value: 'welcome' }],
    });
  }

  async sendContractReady(to: string, signerName: string, documentName: string, signingUrl: string): Promise<MailResult> {
    return this.send({
      to,
      subject: `Documento aguardando sua assinatura: ${documentName}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
          <h1 style="color:#1d4ed8">🎵 MUSIC OS 360</h1>
          <p>Olá, <strong>${escapeHtml(signerName)}</strong>,</p>
          <p>O documento <strong>${escapeHtml(documentName)}</strong> está aguardando a sua assinatura digital.</p>
          <a href="${escapeHtml(signingUrl)}" style="display:inline-block;padding:12px 24px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0">
            Assinar Documento
          </a>
          <p style="color:#6b7280;font-size:12px;margin-top:32px">
            Se você não esperava este email, ignore esta mensagem.
          </p>
        </div>
      `,
      tags: [{ name: 'type', value: 'contract_signing' }],
    });
  }

  async sendPasswordReset(to: string, resetUrl: string, idempotencyKey?: string): Promise<MailResult> {
    return this.send({
      to,
      idempotencyKey,
      subject: 'Redefinir senha — MUSIC OS 360',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
          <h1 style="color:#1d4ed8">🎵 MUSIC OS 360</h1>
          <p>Recebemos um pedido para redefinir a senha da sua conta.</p>
          <a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 24px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0">
            Redefinir Senha
          </a>
          <p style="color:#6b7280;font-size:12px">Este link expira em 1 hora. Se não foi você, ignore este email.</p>
        </div>
      `,
      tags: [{ name: 'type', value: 'password_reset' }],
    });
  }

  async sendInvoiceReady(to: string, invoiceNumber: string, amount: string, dueDate: string, downloadUrl: string): Promise<MailResult> {
    const safeInvoiceNumber = escapeHtml(invoiceNumber);
    return this.send({
      to,
      subject: `Nota Fiscal ${invoiceNumber} disponível`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
          <h1 style="color:#1d4ed8">🎵 MUSIC OS 360</h1>
          <p>A Nota Fiscal <strong>${safeInvoiceNumber}</strong> está disponível.</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0">
            <tr><td style="padding:8px;border:1px solid #e5e7eb">Número</td><td style="padding:8px;border:1px solid #e5e7eb">${safeInvoiceNumber}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb">Valor</td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(amount)}</td></tr>
            <tr><td style="padding:8px;border:1px solid #e5e7eb">Vencimento</td><td style="padding:8px;border:1px solid #e5e7eb">${escapeHtml(dueDate)}</td></tr>
          </table>
          <a href="${escapeHtml(downloadUrl)}" style="display:inline-block;padding:12px 24px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px">
            Baixar NF-e
          </a>
          <p style="color:#6b7280;font-size:12px;margin-top:32px">MUSIC OS 360</p>
        </div>
      `,
      tags: [{ name: 'type', value: 'invoice' }],
    });
  }

  // ─── Métodos de template HTML (usados pelo EmailProcessor) ──────────────────

  welcomeHtml(name: string): string {
    const appUrl = this.config.get<string>('APP_URL') ?? 'https://musicos360.com.br';
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Bem-vindo ao MUSIC OS 360</title></head>
<body>
  <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
    <h1 style="color:#1d4ed8">MUSIC OS 360</h1>
    <p>Olá, <strong>${escapeHtml(name)}</strong>!</p>
    <p>A sua conta está pronta. Acesse a plataforma:</p>
    <a href="${escapeHtml(appUrl)}" style="display:inline-block;padding:12px 24px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0">
      Acessar MUSIC OS 360
    </a>
    <p style="color:#6b7280;font-size:12px;margin-top:32px">MUSIC OS 360 — Enterprise Music Management SaaS</p>
  </div>
</body>
</html>`;
  }

  contractExpiringHtml(contractTitle: string, daysLeft: number): string {
    return `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
        <h1 style="color:#1d4ed8">🎵 MUSIC OS 360</h1>
        <p>⚠️ O contrato <strong>${escapeHtml(contractTitle)}</strong> vence em <strong>${daysLeft} dias</strong>.</p>
        <p>Acesse a plataforma para tomar as providências necessárias.</p>
        <p style="color:#6b7280;font-size:12px;margin-top:32px">MUSIC OS 360</p>
      </div>
    `;
  }

  contractSignedHtml(contractTitle: string): string {
    return `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
        <h1 style="color:#1d4ed8">🎵 MUSIC OS 360</h1>
        <p>✅ O contrato <strong>${escapeHtml(contractTitle)}</strong> foi assinado com sucesso.</p>
        <p style="color:#6b7280;font-size:12px;margin-top:32px">MUSIC OS 360</p>
      </div>
    `;
  }

  paymentFailedHtml(plan: string): string {
    const appUrl = this.config.get<string>('APP_URL') ?? 'https://musicos360.com.br';
    return `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
        <h1 style="color:#1d4ed8">🎵 MUSIC OS 360</h1>
        <p>⚠️ O pagamento da sua assinatura <strong>${escapeHtml(plan)}</strong> falhou.</p>
        <p>Acesse o portal de billing para atualizar o método de pagamento:</p>
        <a href="${escapeHtml(appUrl)}/configuracoes/billing" style="display:inline-block;padding:12px 24px;background:#dc2626;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0">
          Atualizar Pagamento
        </a>
        <p style="color:#6b7280;font-size:12px;margin-top:32px">MUSIC OS 360</p>
      </div>
    `;
  }

  inviteHtml(orgName: string, inviteUrl: string): string {
    return `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
        <h1 style="color:#1d4ed8">🎵 MUSIC OS 360</h1>
        <p>Você foi convidado para a organização <strong>${escapeHtml(orgName)}</strong> no MUSIC OS 360.</p>
        <a href="${escapeHtml(inviteUrl)}" style="display:inline-block;padding:12px 24px;background:#1d4ed8;color:#fff;text-decoration:none;border-radius:6px;margin:16px 0">
          Aceitar Convite
        </a>
        <p style="color:#6b7280;font-size:12px;margin-top:32px">Se não esperava este convite, ignore este email.</p>
      </div>
    `;
  }

  async sendTakedownConfirmation(to: string, trackTitle: string, platform: string, idempotencyKey?: string): Promise<MailResult> {
    const safeTrackTitle = escapeHtml(trackTitle);
    const safePlatform = escapeHtml(platform);
    return this.send({
      to,
      idempotencyKey,
      subject: `Takedown solicitado: ${trackTitle} em ${platform}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
          <h1 style="color:#1d4ed8">🎵 MUSIC OS 360</h1>
          <p>O takedown foi submetido com sucesso.</p>
          <ul>
            <li><strong>Obra:</strong> ${safeTrackTitle}</li>
            <li><strong>Plataforma:</strong> ${safePlatform}</li>
            <li><strong>Status:</strong> Em processamento</li>
          </ul>
          <p>Você será notificado assim que o processo for concluído.</p>
          <p style="color:#6b7280;font-size:12px;margin-top:32px">MUSIC OS 360</p>
        </div>
      `,
      tags: [{ name: 'type', value: 'takedown' }],
    });
  }
}
