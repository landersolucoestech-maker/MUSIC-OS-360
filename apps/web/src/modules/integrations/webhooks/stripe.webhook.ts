/**
 * integrations/webhooks/stripe.webhook.ts
 *
 * Stripe webhook CONTRACT — documentation of the processed events.
 *
 * CRITICAL RULE: webhooks are ALWAYS processed in the backend.
 * The frontend NEVER receives webhooks directly.
 * The frontend obtains the updated state via polling or domain events emitted
 * after the backend processes the webhook and updates the mockData/DB.
 *
 * Backend endpoint:
 *   POST /webhooks/stripe
 *   Header: stripe-signature (validated with STRIPE_WEBHOOK_SECRET)
 *
 * Events processed by the backend:
 */

export const STRIPE_WEBHOOK_EVENTS = [
  "checkout.session.completed",      // tenant completou upgrade de plano
  "customer.subscription.updated",   // plan change (upgrade/downgrade)
  "customer.subscription.deleted",   // cancelamento de subscription
  "invoice.paid",                    // pagamento de fatura confirmado
  "invoice.payment_failed",          // falha de pagamento → notificar admin
] as const;

export type StripeWebhookEvent = typeof STRIPE_WEBHOOK_EVENTS[number];

/**
 * Stripe webhook payload type (simplified for documentation).
 * The backend uses the official SDK: stripe.webhooks.constructEvent(body, sig, secret)
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
 * Backend actions after processing each event:
 *
 * checkout.session.completed:
 *   → activate the plan on the tenant (DB: tenants.plan = "pro")
 *   → emit domain event: tenant.plan_upgraded
 *
 * customer.subscription.updated:
 *   → update the plan and expiry date on the tenant
 *   → emit domain event: tenant.subscription_updated
 *
 * customer.subscription.deleted:
 *   → downgrade to free, disable premium features
 *   → emit domain event: tenant.subscription_cancelled
 *
 * invoice.paid:
 *   → record the payment in the billing history
 *   → send a confirmation email via Resend
 *
 * invoice.payment_failed:
 *   → notify the admin via email (Resend)
 *   → mark the tenant as in a grace period
 */
export const STRIPE_WEBHOOK_ACTIONS: Record<StripeWebhookEvent, string> = {
  "checkout.session.completed":    "ativar plano + emitir tenant.plan_upgraded",
  "customer.subscription.updated": "atualizar plano + emitir tenant.subscription_updated",
  "customer.subscription.deleted": "downgrade + emitir tenant.subscription_cancelled",
  "invoice.paid":                  "registar pagamento + email confirmação",
  "invoice.payment_failed":        "notificar admin + grace period",
};
