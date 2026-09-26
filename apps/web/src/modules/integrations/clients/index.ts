/**
 * integrations/clients/index.ts
 *
 * Barrel of all third-party HTTP client stubs.
 * These stubs document the required environment variables,
 * the matching backend endpoints and the SDKs to install
 * when the integration is enabled in production.
 *
 * RULE: none of these clients is called directly by the frontend.
 * The frontend always uses the adapters in integrations/adapters/.
 */

export { stripeClient }  from "./stripe.client";
export type { BillingSubscription } from "./stripe.client";
