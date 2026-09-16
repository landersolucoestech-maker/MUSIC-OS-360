/**
 * integrations/webhooks/stripe.webhook.ts
 *
 * CONTRATO de webhook Stripe — documentação dos eventos processados.
 *
 * REGRA CRÍTICA: webhooks são SEMPRE processados no backend.
 * O frontend NUNCA recebe webhooks directamente.
 * O frontend obtém estado atualizado via polling ou domain events emitidos
 * após o backend processar o webhook e atualizar o mockData/DB.
 *
 * Endpoint backend:
 *   POST /webhooks/stripe
 *   Header: stripe-signature (validado com STRIPE_WEBHOOK_SECRET)
 *
 * Eventos processados pelo backend:
 */

export const STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",      // tenant completou upgrade de plano
  "customer.subscription.updated",   // mudança de plano (upgrade/downgrade)
  "customer.subscription.deleted",   // cancelamento de subscription
  "invoice.paid",                    // pagamento de fatura confirmado
  "invoice.payment_failed",          // falha de pagamento → notificar admin
] as const;

export type StripeWebhookEvent = typeof STRIPE_WEBHOOK_EVENTS[number];

/**
 * Tipo do payload do webhook Stripe (simplificado para documentação).
 * O backend usa o SDK oficial: stripe.webhooks.constructEvent(body, sig, secret)
 */
export interface StripeWebhookPayload {
  id:       string;
  type:     StripeWebhookEvent;
  created:  number;
  data: {
    object: Record<string, unknown>;
  };
}

/**
 * Acções do backend após processar cada evento:
 *
 * checkout.session.completed:
 *   → activar plano no tenant (DB: tenants.plan = "pro")
 *   → emitir domain event: tenant.plan_upgraded
 *
 * customer.subscription.updated:
 *   → atualizar plano e data de expiração no tenant
 *   → emitir domain event: tenant.subscription_updated
 *
 * customer.subscription.deleted:
 *   → downgrade para free, desativar features premium
 *   → emitir domain event: tenant.subscription_cancelled
 *
 * invoice.paid:
 *   → registar pagamento no histórico de billing
 *   → enviar email de confirmação via Resend
 *
 * invoice.payment_failed:
 *   → notificar admin via email (Resend)
 *   → marcar tenant em grace period
 */
export const STRIPE_WEBHOOK_ACTIONS: Record<StripeWebhookEvent, string> = {
  "checkout.session.completed":    "ativar plano + emitir tenant.plan_upgraded",
  "customer.subscription.updated": "atualizar plano + emitir tenant.subscription_updated",
  "customer.subscription.deleted": "downgrade + emitir tenant.subscription_cancelled",
  "invoice.paid":                  "registar pagamento + email confirmação",
  "invoice.payment_failed":        "notificar admin + grace period",
};
