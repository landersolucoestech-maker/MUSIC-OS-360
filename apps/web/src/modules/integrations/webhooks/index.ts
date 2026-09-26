/**
 * integrations/webhooks/index.ts
 *
 * Barrel of the contracts/documentation of every MUSIC OS 360 webhook.
 *
 * RULE: these modules are ONLY documentation and types.
 * No webhook is processed in the frontend.
 * Every webhook is received and validated in the backend.
 */

export {
  STRIPE_WEBHOOK_EVENTS,
  STRIPE_WEBHOOK_ACTIONS,
} from "./stripe.webhook";

export type {
  StripeWebhookEvent,
  StripeWebhookPayload,
} from "./stripe.webhook";

export {
  AUTENTIQUE_WEBHOOK_EVENTS,
  AUTENTIQUE_WEBHOOK_ACTIONS,
} from "./autentique.webhook";

export type {
  AutentiqueWebhookEvent,
  AutentiqueWebhookPayload,
} from "./autentique.webhook";
