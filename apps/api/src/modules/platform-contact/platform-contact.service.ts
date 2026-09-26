/**
 * modules/platform-contact/platform-contact.service.ts
 *
 * Platform Commercial Contact (2026-08-22 product decision): institutional/
 * commercial contact about Music OS 360 itself — it does NOT belong to
 * any operational tenant. Forwards by e-mail via MailService (Resend,
 * already real and existing — core/mail/mail.service.ts) to
 * PLATFORM_CONTACT_RECIPIENT_EMAIL. Never creates a Support Ticket, a MusicChat
 * conversation, a lead or any record inside a tenant. Persists
 * nothing — the requirement is only to forward by e-mail.
 */
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService, escapeHtml } from '../../core/mail/mail.service';
import type { PlatformContactDto } from './dto/platform-contact.dto';

@Injectable()
export class PlatformContactService {
  private readonly logger = new Logger(PlatformContactService.name);

  constructor(
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  async submit(dto: PlatformContactDto): Promise<{ accepted: true }> {
    // Honeypot — same pattern already used in the Artist Public Form
    // (leads.service.ts submitPublicArtistApplication): silently accepts,
    // never reveals to the bot that it was detected.
    if (dto.website) {
      return { accepted: true };
    }

    const recipient = this.config.get<string>('PLATFORM_CONTACT_RECIPIENT_EMAIL');
    if (!recipient) {
      this.logger.warn(
        'PlatformContactService: PLATFORM_CONTACT_RECIPIENT_EMAIL not configured — institutional contact unavailable (pending operational setup)',
      );
      throw new ServiceUnavailableException(
        'Contato institucional temporariamente indisponível. Tente novamente mais tarde.',
      );
    }

    const safeName = escapeHtml(dto.name.trim());
    const safeEmail = escapeHtml(dto.email.trim());
    const safeCompany = dto.company?.trim() ? escapeHtml(dto.company.trim()) : null;
    const safeMessage = escapeHtml(dto.message.trim()).replace(/\n/g, '<br>');

    await this.mail.send({
      to: recipient,
      subject: `Contato comercial — MUSIC OS 360${safeCompany ? ` (${safeCompany})` : ''}`,
      replyTo: dto.email.trim(),
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
          <h1 style="color:#1d4ed8">🎵 MUSIC OS 360 — Contato Comercial</h1>
          <p><strong>Nome:</strong> ${safeName}</p>
          <p><strong>E-mail:</strong> ${safeEmail}</p>
          ${safeCompany ? `<p><strong>Empresa:</strong> ${safeCompany}</p>` : ''}
          <p><strong>Mensagem:</strong></p>
          <p style="white-space:pre-wrap">${safeMessage}</p>
        </div>
      `,
      tags: [{ name: 'type', value: 'platform_commercial_contact' }],
    });

    this.logger.log('PlatformContactService: contato institucional encaminhado');
    return { accepted: true };
  }
}
