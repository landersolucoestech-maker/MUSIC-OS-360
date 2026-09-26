/**
 * shared/integrations/contracts/email.contract.ts
 *
 * Transactional email contract — target implementation: Resend.
 *
 * CURRENT STATE: useResend hook in modules/integrations/hooks/useResend.ts (mock).
 * FUTURE MIGRATION: IEmailProvider implemented via the Resend SDK in the backend.
 *
 * Use cases in MUSIC OS 360:
 *   - Inviting new users to the tenant
 *   - Contract expiry alerts
 *   - Periodic reports of external rights/accounting receipts
 *   - Release approval/rejection notifications
 *   - Digital signature confirmation (Autentique)
 */

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export type EmailTemplateId =
  | "user-invite"
  | "contract-expiry-alert"
  | "external-data-report"
  | "release-approved"
  | "release-rejected"
  | "signing-completed"
  | "signing-requested"
  | "password-reset"
  | "welcome";

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailAttachment {
  filename: string;
  content: string | ArrayBuffer;
  content_type: string;
}

export interface SendEmailParams {
  to: EmailRecipient | EmailRecipient[];
  subject: string;
  /** Generated HTML or a template_id with variables */
  html?: string;
  text?: string;
  template_id?: EmailTemplateId;
  template_vars?: Record<string, string | number | boolean>;
  attachments?: EmailAttachment[];
  reply_to?: EmailRecipient;
  /** Tenant de origem — usado para from address personalizado */
  tenant_id?: string;
}

export interface SendEmailResult {
  message_id: string;
  status: "queued" | "sent" | "failed";
  sent_at: string;
}

export interface EmailDeliveryStatus {
  message_id: string;
  status: "delivered" | "bounced" | "complained" | "pending";
  events: Array<{ type: string; timestamp: string }>;
}

// ─── Contrato ─────────────────────────────────────────────────────────────────

/**
 * IEmailProvider — transactional email sending contract.
 *
 * Planned implementations:
 *   - MockEmailProvider   (standalone — console log, success toast)
 *   - ResendEmailProvider (production — Resend API via the backend)
 */
export interface IEmailProvider {
  send(params: SendEmailParams): Promise<SendEmailResult>;
  getDeliveryStatus(messageId: string): Promise<EmailDeliveryStatus>;
  /** Checks whether the configured credentials are valid */
  verifyConnection(): Promise<boolean>;
}

// ─── Template helpers ─────────────────────────────────────────────────────────

/** Variables each template expects */
export const EMAIL_TEMPLATE_VARS: Record<EmailTemplateId, string[]> = {
  "user-invite":          ["invitee_name", "inviter_name", "tenant_name", "invite_url"],
  "contract-expiry-alert":["artist_name", "contract_title", "expiry_date", "days_remaining"],
  "external-data-report":       ["period", "total_revenue", "report_url", "tenant_name"],
  "release-approved":     ["release_title", "artist_name", "release_date"],
  "release-rejected":     ["release_title", "artist_name", "rejection_reason"],
  "signing-completed":    ["document_title", "signer_name", "signed_at", "download_url"],
  "signing-requested":    ["document_title", "requester_name", "signing_url", "expires_at"],
  "password-reset":       ["user_name", "reset_url", "expires_at"],
  "welcome":              ["user_name", "tenant_name", "login_url"],
};
