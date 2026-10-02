/**
 * integrations/clients/index.ts
 *
 * Barrel of third-party HTTP clients (currently the Stripe billing client,
 * which is in use). Each client documents the matching backend endpoints.
 *
 * RULE: none of these clients is called directly by the frontend.
 * The frontend always uses the adapters in integrations/adapters/.
 */

export { stripeClient }  from "./stripe.client";
export type { BillingSubscription } from "./stripe.client";
