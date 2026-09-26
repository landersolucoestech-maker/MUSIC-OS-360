/**
 * integrations/webhooks/autentique.webhook.ts
 *
 * Autentique webhook CONTRACT — documentation of the processed events.
 *
 * CRITICAL RULE: webhooks are ALWAYS processed in the backend.
 * The frontend queries state by polling signingAdapter.getDocument(id).
 *
 * Backend endpoint:
 *   POST /webhooks/autentique
 *   Validation: HMAC-SHA256 with AUTENTIQUE_WEBHOOK_SECRET
 *
 * Events processed by the backend:
 */

export const AUTENTIQUE_WEBHOOK_EVENTS = [
  "document_created",    // document successfully created on the platform
  "signer_signed",       // a signer signed the document
  "signer_rejected",     // a signer rejected the document
  "document_signed",     // all signers signed (document complete)
  "document_expired",    // prazo de assinatura expirou
  "document_cancelled",  // documento cancelado manualmente
] as const;

export type AutentiqueWebhookEvent = typeof AUTENTIQUE_WEBHOOK_EVENTS[number];

/**
 * Autentique webhook payload (simplified for documentation).
 */
export interface AutentiqueWebhookPayload {
  event:    AutentiqueWebhookEvent;
  document: {
    id:         string;
    name:       string;
    status:     "pending" | "signed" | "rejected" | "expired" | "cancelled";
    created_at: string;
    updated_at: string;
  };
  signer?: {
    email:  string;
    name:   string;
    signed: boolean;
  };
}

/**
 * Backend actions after processing each event:
 *
 * signer_signed:
 *   → update the signer's status in the DB
 *   → notify the admin via Resend
 *
 * document_signed:
 *   → update the contract status to "signed"
 *   → emit domain event: contrato.signed
 *   → send a confirmation email to everyone via Resend
 *   → store the final PDF in R2 (storage)
 *
 * signer_rejected:
 *   → update the contract status to "rejected"
 *   → emit domain event: contrato.rejected
 *   → notify the responsible manager via Resend
 *
 * document_expired:
 *   → update the contract status to "expired"
 *   → emit domain event: contrato.expired
 *   → notify the admin to renew
 *
 * document_cancelled:
 *   → update the contract status to "cancelled"
 *   → emit domain event: contrato.cancelled
 */
export const AUTENTIQUE_WEBHOOK_ACTIONS: Record<AutentiqueWebhookEvent, string> = {
  document_created: "registar id Autentique no contrato",
  signer_signed:    "atualizar status signatário + notificar admin",
  signer_rejected:  "status=rejected + emitir contrato.rejected + notificar gestor",
  document_signed:  "status=signed + emitir contrato.signed + PDF no R2 + email",
  document_expired: "status=expired + emitir contrato.expired + notificar admin",
  document_cancelled: "status=cancelled + emitir contrato.cancelled",
};
