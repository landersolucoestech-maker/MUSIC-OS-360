/**
 * queues/processors/email.processor.ts
 *
 * Processor BullMQ para a fila "emails".
 * Envia emails reais via Resend (através do MailService).
 * Se RESEND_API_KEY não estiver configurada, MailService.send() retorna
 * { skipped: true } sem lançar excepção — comportamento gracioso em dev.
 */

import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger }    from '@nestjs/common';
import { Job }                   from 'bullmq';
import { QUEUE_NAMES, EMAIL_JOB_NAMES } from '../queue.constants';
import { MailService }           from '../../core/mail/mail.service';

// ─── Payloads tipados por job ─────────────────────────────────────────────────

export interface WelcomeEmailPayload {
  tenantId: string;
  userId:   string;
  email:    string;
  name:     string;
}

export interface PasswordResetEmailPayload {
  email:     string;
  resetLink: string;
}

export interface ContractExpiryEmailPayload {
  tenantId:       string;
  contractId:     string;
  contractTitle?: string;
  artistName:     string;
  expiresAt:      string;
  daysLeft?:      number;
  recipientEmail: string;
}

export interface ContractSignedEmailPayload {
  tenantId:       string;
  contractId:     string;
  contractTitle:  string;
  recipientEmail: string;
}

export interface InviteUserEmailPayload {
  tenantId:    string;
  inviterName: string;
  email:       string;
  inviteLink:  string;
  orgName?:    string;
}

export interface PaymentFailedEmailPayload {
  email: string;
  plan:  string;
}

export interface MonitoringAlertEmailPayload {
  tenantId:       string;
  recipientEmail: string;
  alertType:      string;
  trackTitle:     string;
  platform:       string;
  detectedAt:     string;
}

export type EmailJobPayload =
  | WelcomeEmailPayload
  | PasswordResetEmailPayload
  | ContractExpiryEmailPayload
  | ContractSignedEmailPayload
  | InviteUserEmailPayload
  | PaymentFailedEmailPayload
  | MonitoringAlertEmailPayload;

// ─── Processor ────────────────────────────────────────────────────────────────

@Processor(QUEUE_NAMES.EMAILS)
@Injectable()
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private readonly mail: MailService) { super(); }

  async process(job: Job<EmailJobPayload>): Promise<void> {
    this.logger.log(`[emails] job="${job.name}" id=${job.id} attempt=${job.attemptsMade + 1}`);

    switch (job.name) {
      // ── Novos jobs tipados ────────────────────────────────────────────────
      case 'welcome':
      case EMAIL_JOB_NAMES.WELCOME: {
        const d = job.data as WelcomeEmailPayload;
        await this.mail.send({
          to:      d.email,
          subject: 'Bem-vindo ao MUSIC OS 360°',
          html:    this.mail.welcomeHtml(d.name),
          idempotencyKey: job.id,
        });
        break;
      }

      case 'contract_expiring':
      case EMAIL_JOB_NAMES.CONTRACT_EXPIRY: {
        const d = job.data as ContractExpiryEmailPayload;
        const title    = d.contractTitle ?? `Contrato ${d.contractId}`;
        const daysLeft = d.daysLeft ?? 0;
        await this.mail.send({
          to:      d.recipientEmail,
          subject: `⚠️ Contrato vencendo em ${daysLeft} dias: ${title}`,
          html:    this.mail.contractExpiringHtml(title, daysLeft),
          idempotencyKey: job.id,
        });
        break;
      }

      case 'contract_signed': {
        const d = job.data as ContractSignedEmailPayload;
        await this.mail.send({
          to:      d.recipientEmail,
          subject: `✅ Contrato assinado: ${d.contractTitle}`,
          html:    this.mail.contractSignedHtml(d.contractTitle),
          idempotencyKey: job.id,
        });
        break;
      }

      case 'payment_failed': {
        const d = job.data as PaymentFailedEmailPayload;
        await this.mail.send({
          to:      d.email,
          subject: '⚠️ Falha no pagamento da sua assinatura MUSIC OS 360°',
          html:    this.mail.paymentFailedHtml(d.plan),
          idempotencyKey: job.id,
        });
        break;
      }

      case 'invite':
      case EMAIL_JOB_NAMES.INVITE_USER: {
        const d = job.data as InviteUserEmailPayload;
        await this.mail.send({
          to:      d.email,
          subject: `Convite para ${d.orgName ?? 'MUSIC OS 360°'}`,
          html:    this.mail.inviteHtml(d.orgName ?? 'MUSIC OS 360°', d.inviteLink),
          idempotencyKey: job.id,
        });
        break;
      }

      case EMAIL_JOB_NAMES.PASSWORD_RESET: {
        const d = job.data as PasswordResetEmailPayload;
        await this.mail.sendPasswordReset(d.email, d.resetLink, job.id);
        break;
      }

      case EMAIL_JOB_NAMES.MONITORING_ALERT: {
        const d = job.data as MonitoringAlertEmailPayload;
        await this.mail.sendTakedownConfirmation(d.recipientEmail, d.trackTitle, d.platform, job.id);
        break;
      }

      default:
        this.logger.warn(`[emails] job desconhecido: "${job.name}" — ignorado`);
        return;
    }

    this.logger.log(`[emails] job="${job.name}" id=${job.id} enviado`);
  }
}
