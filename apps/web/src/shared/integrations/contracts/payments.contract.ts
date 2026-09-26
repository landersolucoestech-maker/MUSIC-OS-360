/**
 * shared/integrations/contracts/payments.contract.ts
 *
 * Payments contract — target implementation: Stripe.
 *
 * CURRENT STATE: standalone — no real billing.
 * FUTURE MIGRATION: IPaymentsProvider implemented via the Stripe SDK in the backend.
 *
 * Scope: per-tenant SaaS subscriptions (not external artist rights receipts).
 * External rights receipts are a separate domain (accounting + rights).
 */

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export type SubscriptionPlan =
  | "starter"
  | "professional"
  | "enterprise"
  | "custom";

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "paused";

export type PaymentStatus =
  | "succeeded"
  | "pending"
  | "failed"
  | "refunded";

export interface SubscriptionFeatures {
  maxArtists: number | "unlimited";
  maxObras: number | "unlimited";
  maxUsers: number | "unlimited";
  hasAnalytics: boolean;
  hasAdvancedReports: boolean;
  hasApiAccess: boolean;
  hasPrioritySupport: boolean;
}

export interface TenantSubscription {
  tenant_id: string;
  subscription_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  current_period_start: string;
  current_period_end: string;
  trial_end?: string | null;
  cancel_at?: string | null;
  features: SubscriptionFeatures;
  /** Price in cents (BRL) */
  amount_cents: number;
  currency: "brl" | "usd";
}

export interface PaymentMethod {
  id: string;
  type: "card" | "boleto" | "pix";
  last4?: string;
  brand?: string;
  exp_month?: number;
  exp_year?: number;
  is_default: boolean;
}

export interface Invoice {
  id: string;
  tenant_id: string;
  subscription_id: string;
  amount_cents: number;
  currency: string;
  status: PaymentStatus;
  invoice_url: string;
  pdf_url: string;
  issued_at: string;
  due_at: string;
  paid_at?: string | null;
}

export interface CreateCheckoutParams {
  tenant_id: string;
  plan: SubscriptionPlan;
  success_url: string;
  cancel_url: string;
  trial_days?: number;
}

export interface CreatePortalParams {
  tenant_id: string;
  return_url: string;
}

// ─── Contrato ─────────────────────────────────────────────────────────────────

/**
 * IPaymentsProvider — SaaS billing and subscriptions contract.
 *
 * Planned implementations:
 *   - MockPaymentsProvider   (standalone — fixed data)
 *   - StripePaymentsProvider (production — Stripe API via the backend)
 */
export interface IPaymentsProvider {
  /** The tenant's active subscription data */
  getSubscription(tenantId: string): Promise<TenantSubscription | null>;

  /** Creates a Checkout session to subscribe or upgrade */
  createCheckoutSession(params: CreateCheckoutParams): Promise<{ url: string }>;

  /** Creates a Customer Portal session to manage billing */
  createPortalSession(params: CreatePortalParams): Promise<{ url: string }>;

  /** Lists the tenant's payment methods */
  listPaymentMethods(tenantId: string): Promise<PaymentMethod[]>;

  /** Lista facturas emitidas */
  listInvoices(tenantId: string, limit?: number): Promise<Invoice[]>;

  /** Cancels the subscription at the end of the period */
  cancelSubscription(tenantId: string): Promise<void>;

  /** Checks whether the tenant's plan grants access to a feature */
  hasFeature(tenantId: string, feature: keyof SubscriptionFeatures): Promise<boolean>;
}

// ─── Limites por plano ────────────────────────────────────────────────────────

export const PLAN_FEATURES: Record<SubscriptionPlan, SubscriptionFeatures> = {
  starter: {
    maxArtists: 5,
    maxObras: 100,
    maxUsers: 3,
    hasAnalytics: false,
    hasAdvancedReports: false,
    hasApiAccess: false,
    hasPrioritySupport: false,
  },
  professional: {
    maxArtists: 25,
    maxObras: 1000,
    maxUsers: 10,
    hasAnalytics: true,
    hasAdvancedReports: true,
    hasApiAccess: false,
    hasPrioritySupport: false,
  },
  enterprise: {
    maxArtists: "unlimited",
    maxObras: "unlimited",
    maxUsers: "unlimited",
    hasAnalytics: true,
    hasAdvancedReports: true,
    hasApiAccess: true,
    hasPrioritySupport: true,
  },
  custom: {
    maxArtists: "unlimited",
    maxObras: "unlimited",
    maxUsers: "unlimited",
    hasAnalytics: true,
    hasAdvancedReports: true,
    hasApiAccess: true,
    hasPrioritySupport: true,
  },
};

