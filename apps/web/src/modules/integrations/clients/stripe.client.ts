/**
 * integrations/clients/stripe.client.ts
 *
 * HTTP client for the Stripe Billing backend.
 *
 * CRITICAL RULE: the Stripe secret key NEVER reaches the frontend.
 * The frontend calls backend endpoints that make the Stripe calls server-side.
 *
 * Backend endpoints:
 *   POST /billing/checkout     → creates a Checkout Session → returns { url }
 *   POST /billing/portal       → opens the Customer Portal  → returns { url }
 *   GET  /billing/subscription → queries the tenant's subscription
 */

import { api } from '@/shared/lib/api-client';

export const stripeClient = {
  createCheckout: (plan: string, successUrl: string, cancelUrl: string) =>
    api.post<{ url: string }>('/billing/checkout', { plan, successUrl, cancelUrl }),

  openPortal: (returnUrl: string) =>
    api.post<{ url: string }>('/billing/portal', { returnUrl }),

  getSubscription: () =>
    api.get<BillingSubscription | null>('/billing/subscription'),
};

export interface BillingSubscription {
  id:                 string;
  org_id:             string;
  stripe_customer_id: string | null;
  stripe_sub_id:      string | null;
  stripe_subscription_id?: string | null;
  stripe_price_id?: string | null;
  plan:               'starter' | 'professional' | 'enterprise';
  status:             'trial' | 'trialing' | 'active' | 'past_due' | 'unpaid' | 'cancelled' | 'paused' | 'incomplete' | 'incomplete_expired';
  trial_ends_at:      string | null;
  current_period_start?: string | null;
  current_period_end: string | null;
  grace_until?:       string | null;
  suspended_at?:      string | null;
  resumed_at?:        string | null;
  seats:              number;
  seats_used:         number;
  billing_state?: {
    status?: 'active' | 'trial' | 'payment_grace' | 'read_only' | 'suspended' | 'cancelled';
    grace_until?: string | null;
    next_payment_at?: string | null;
    suspended_at?: string | null;
  } | null;
  latest_invoice?: {
    stripe_invoice_id?: string | null;
    amount_due?: number | null;
    amount_paid?: number | null;
    currency?: string | null;
    status?: string | null;
    due_date?: string | null;
    hosted_invoice_url?: string | null;
    invoice_pdf?: string | null;
    attempt_count?: number | null;
  } | null;
  created_at:         string;
  updated_at:         string;
}
