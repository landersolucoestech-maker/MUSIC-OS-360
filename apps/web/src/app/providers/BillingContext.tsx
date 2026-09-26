import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "@/shared/lib/api-client";
import { AUTH_DISABLED } from "@/shared/lib/env";
import { PasswordChangeRequiredError } from "@/shared/lib/errors";
import { captureError } from "@/shared/lib/error-logger";
import { useAuth } from "./AuthContext";
import { useTenant, type TenantBillingStatus } from "./TenantContext";

interface BillingState {
  status: TenantBillingStatus;
  graceUntil?: string;
  amountDue?: number;
  invoiceUrl?: string;
  invoicePdf?: string;
  daysRemaining?: number;
  isReadOnly: boolean;
  isSuspended: boolean;
  isPaymentGrace: boolean;
  refresh: () => Promise<void>;
}

interface BillingSubscriptionResponse {
  status?: string;
  current_period_end?: string | null;
  trial_ends_at?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  stripe_sub_id?: string | null;
  billing_state?: {
    status?: string;
    grace_until?: string | null;
    next_payment_at?: string | null;
    suspended_at?: string | null;
  } | null;
  latest_invoice?: {
    amount_due?: number | null;
    hosted_invoice_url?: string | null;
    invoice_pdf?: string | null;
    due_date?: string | null;
  } | null;
}

const BillingContext = createContext<BillingState | undefined>(undefined);

function normalizeStatus(status: string | undefined): TenantBillingStatus {
  if (
    status === "active" ||
    status === "trial" ||
    status === "suspended" ||
    status === "cancelled" ||
    status === "past_due" ||
    status === "payment_grace" ||
    status === "read_only"
  ) {
    return status;
  }
  if (status === "trialing") return "trial";
  if (status === "unpaid") return "payment_grace";
  return "trial";
}

function daysUntil(value?: string): number | undefined {
  if (!value) return undefined;
  const ms = new Date(value).getTime() - Date.now();
  if (!Number.isFinite(ms)) return undefined;
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function BillingProvider({ children }: { children: React.ReactNode }) {
  const { session, user } = useAuth();
  const { tenant, setTenant } = useTenant();
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    // Part 77 — while the mandatory password change is pending, the
    // backend blocks every domain route (including /billing/subscription)
    // with 403 MUST_CHANGE_PASSWORD. Fetching billing in that state serves
    // no purpose (the billing UI is not even shown before the change) and only
    // produces an unhandled error every 60s.
    if (AUTH_DISABLED || !session?.access_token || user?.mustChangePassword) return;
    setLoading(true);
    try {
      const subscription = await api.get<BillingSubscriptionResponse | null>("/billing/subscription");
      if (!subscription) return;
      const status = normalizeStatus(subscription.billing_state?.status ?? subscription.status);
      setTenant(prev => ({
        ...prev,
        billing: {
          ...prev.billing,
          status,
          trialEndsAt: subscription.trial_ends_at ?? prev.billing.trialEndsAt,
          currentPeriodEnd: subscription.current_period_end ?? prev.billing.currentPeriodEnd,
          customerId: subscription.stripe_customer_id ?? prev.billing.customerId,
          subscriptionId: subscription.stripe_subscription_id ?? subscription.stripe_sub_id ?? prev.billing.subscriptionId,
          graceUntil: subscription.billing_state?.grace_until ?? prev.billing.graceUntil,
          amountDue: subscription.latest_invoice?.amount_due ?? prev.billing.amountDue,
          invoiceUrl: subscription.latest_invoice?.hosted_invoice_url ?? prev.billing.invoiceUrl,
        },
      }));
    } catch (error) {
      // Never let a billing failure (403 must-change-password, 503
      // unavailable dependency, network) escape as an unhandled rejection —
      // that already caused a real crash of the whole React tree (Part 77).
      if (!(error instanceof PasswordChangeRequiredError)) {
        captureError(error instanceof Error ? error : new Error(String(error)), { extra: { source: "BillingContext.refresh" } });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.mustChangePassword) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(timer);
  }, [session?.access_token, user?.mustChangePassword]);

  const value = useMemo<BillingState>(() => {
    const status = tenant.billing.status;
    return {
      status,
      graceUntil: tenant.billing.graceUntil,
      amountDue: tenant.billing.amountDue,
      invoiceUrl: tenant.billing.invoiceUrl,
      daysRemaining: daysUntil(tenant.billing.graceUntil),
      isReadOnly: status === "read_only",
      isSuspended: status === "suspended",
      isPaymentGrace: status === "payment_grace" || status === "past_due",
      refresh,
    };
  }, [tenant.billing.status, tenant.billing.graceUntil, tenant.billing.amountDue, tenant.billing.invoiceUrl, loading]);

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useBilling(): BillingState {
  const ctx = useContext(BillingContext);
  if (!ctx) throw new Error("useBilling must be used within a BillingProvider");
  return ctx;
}
