/**
 * integrations/hooks/useStripe.ts
 *
 * Stub hook for the Stripe integration (SaaS subscription billing).
 *
 * SCOPE: billing of the MUSIC OS 360 platform per tenant.
 * It does NOT cover external rights receipts or payments to artists (Accounting domain).
 *
 * CURRENT STATE: standalone — no real billing; plan simulated in TenantContext.
 * FUTURE MIGRATION:
 *   1. Configure Stripe with price IDs per plan
 *   2. Implement the webhook endpoint in the backend
 *   3. Replace the TenantBilling mock with real subscription data
 *
 * Contract: @/shared/integrations/contracts/payments.contract → IPaymentsProvider
 */

import { useQuery } from "@tanstack/react-query";
import { api } from "@/shared/lib/api-client";
import type { IntegrationRuntimeStatus } from "@/shared/integrations/types";
import type { TenantSubscription } from "@/shared/integrations/contracts/payments.contract";
import { PLAN_FEATURES } from "@/shared/integrations/contracts/payments.contract";
import { disabledIntegration } from "@/shared/lib/disabled-integration";

// ─── Stripe-specific types ────────────────────────────────────────────────────

export interface StripeStatus extends IntegrationRuntimeStatus {
  integration_id: "stripe";
  publishable_key_configured: boolean;
  webhook_configured: boolean;
  mode: "live" | "test" | "disabled";
}

// ─── Hook de status ───────────────────────────────────────────────────────────

export function useStripeStatus() {
  return useQuery<StripeStatus>({
    queryKey: ["integrations", "stripe", "status"],
    queryFn: async (): Promise<StripeStatus> => ({
      integration_id: "stripe",
      status: "disabled",
      connected: false,
      publishable_key_configured: false,
      webhook_configured: false,
      mode: "disabled",
      last_error: null,
      last_checked_at: new Date().toISOString(),
    }),
    staleTime: Infinity,
  });
}

// ─── Subscription hook (real backend) ────────────────────────────────────────
export function useStripeSubscription(tenantId: string) {
  return useQuery<TenantSubscription | null>({
    queryKey: ["integrations", "stripe", "subscription", tenantId],
    // REAL subscription from the backend (/billing/subscription — Stripe). Never
    // fabricate a subscription: without data, returns null (the true state).
    queryFn: async (): Promise<TenantSubscription | null> =>
      (await api.get<TenantSubscription | null>("/billing/subscription")) ?? null,
    staleTime: 5 * 60_000,
  });
}

// ─── Stubs desabilitados ──────────────────────────────────────────────────────

export function useStripeCheckout() {
  return {
    createSession: () => disabledIntegration("Stripe"),
  };
}

export function useStripePortal() {
  return {
    createSession: () => disabledIntegration("Stripe"),
  };
}
