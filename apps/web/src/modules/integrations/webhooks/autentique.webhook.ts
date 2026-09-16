/**
 * integrations/webhooks/autentique.webhook.ts
 *
 * CONTRATO de webhook Autentique — documentação dos eventos processados.
 *
 * REGRA CRÍTICA: webhooks são SEMPRE processados no backend.
 * O frontend consulta estado via polling em signingAdapter.getDocument(id).
 *
 * Endpoint backend:
 *   POST /webhooks/autentique
 *   Validação: HMAC-SHA256 com AUTENTIQUE_WEBHOOK_SECRET
 *
 * Eventos processados pelo backend:
 */

export const AUTENTIQUE_WEBHOOK_EVENTS = [
  "document_created",    // documento criado com sucesso na plataforma
  "signer_signed",       // signatário assinou o documento
  "signer_rejected",     // signatário rejeitou o documento
  "document_signed",     // todos os signatários assinaram (documento completo)
  "document_expired",    // prazo de assinatura expirou
  "document_cancelled",  // documento cancelado manualmente
] as const;

export type AutentiqueWebhookEvent = typeof AUTENTIQUE_WEBHOOK_EVENTS[number];

/**
 * Payload do webhook Autentique (simplificado para documentação).
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
 * Acções do backend após processar cada evento:
 *
 * signer_signed:
 *   → atualizar status do signatário no DB
 *   → notificar admin via Resend
 *
 * document_signed:
 *   → atualizar status do contrato para "signed"
 *   → emitir domain event: contrato.signed
 *   → enviar email de confirmação a todos via Resend
 *   → guardar PDF final no R2 (storage)
 *
 * signer_rejected:
 *   → atualizar status do contrato para "rejected"
 *   → emitir domain event: contrato.rejected
 *   → notificar gestor responsável via Resend
 *
 * document_expired:
 *   → atualizar status do contrato para "expired"
 *   → emitir domain event: contrato.expired
 *   → notificar admin para renovar
 *
 * document_cancelled:
 *   → atualizar status do contrato para "cancelled"
 *   → emitir domain event: contrato.cancelled
 */
export const AUTENTIQUE_WEBHOOK_ACTIONS: Record<AutentiqueWebhookEvent, string> = {
  document_created: "registar id Autentique no contrato",
  signer_signed:    "atualizar status signatário + notificar admin",
  signer_rejected:  "status=rejected + emitir contrato.rejected + notificar gestor",
  document_signed:  "status=signed + emitir contrato.signed + PDF no R2 + email",
  document_expired: "status=expired + emitir contrato.expired + notificar admin",
  document_cancelled: "status=cancelled + emitir contrato.cancelled",
};
