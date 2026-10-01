/**
 * activation-plans.service.ts — SINGLE source of the registration activation plans.
 *
 * BUSINESS RULE:
 *   Plans are NOT hardcoded in the registration form code.
 *   They are defined by administrators in the admin panel (source of truth)
 *   and only the plans that are ACTIVE and VISIBLE in registration are exposed publicly.
 *
 *   The form reads them through this service layer, never from a list inside the
 *   component. The public catalog is fetched from the backend (see the contract
 *   below). The backend must return ONLY plans that are active +
 *   visible + available to new companies, already ordered.
 *
 * BACKEND CONTRACT (not implemented in apps/api yet; Register.tsx already calls it):
 *   GET /api/v1/public/activation-plans  ->  ApiResponse<ActivationPlan[]>
 */
import { publicApi } from "@/shared/lib/api-client";

export type ActivationPlanPeriod = "monthly" | "yearly" | "trial";

/**
 * Dual-read of the period: the contract is still only documented here (no API
 * route yet), so a backend/seed may send the PT-BR slugs (mensal | anual) or the
 * billing interval vocabulary (month | year); all resolve to the canonical value.
 */
export function normalizeActivationPlanPeriod(value: unknown): ActivationPlanPeriod | null {
  switch (typeof value === "string" ? value.trim().toLowerCase() : "") {
    case "monthly": case "month": case "mensal": return "monthly";
    case "yearly": case "year": case "anual": return "yearly";
    case "trial": return "trial";
    default: return null;
  }
}

/** PT-BR price suffix shown next to the plan price. */
export function activationPlanPeriodSuffix(period: unknown): string {
  const normalized = normalizeActivationPlanPeriod(period);
  return normalized === "monthly" ? "/mês" : normalized === "yearly" ? "/ano" : "";
}

/** Public model of an activation plan (subset exposed to registration). */
export interface ActivationPlan {
  /** Stable plan identifier (uuid in production). Sent as activationPlanId. */
  id: string;
  /** Display name (e.g. "Trial 14 dias"). */
  name: string;
  /** Short description shown on the card. */
  description: string;
  /** Periodic price, when applicable. null/undefined = no price (trial / on request). */
  price?: number | null;
  /** ISO currency of the price (e.g. "BRL"). */
  currency?: string | null;
  /** Billing/usage period (canonical English; see normalizeActivationPlanPeriod for dual-read). */
  period?: ActivationPlanPeriod | null;
  /** Trial days, when applicable. */
  trialDays?: number | null;
  /** Display order defined by the admin (asc). */
  order: number;
}

/**
 * Orders plans by the admin-defined `order` (ascending), without mutating
 * the input array. The backend is expected to return them ordered already;
 * this keeps the display order deterministic regardless.
 */
function sortByOrder(plans: ActivationPlan[]): ActivationPlan[] {
  return [...plans].sort((a, b) => a.order - b.order);
}

export const activationPlansService = {
  /**
   * Lists the activation plans publicly available for registration.
   * Returns only active/visible plans, ordered by `order`.
   */
  async listPublicPlans(): Promise<ActivationPlan[]> {
    const plans = await publicApi.get<ActivationPlan[]>("/public/activation-plans");
    return sortByOrder((plans ?? []).map((plan) => ({ ...plan, period: normalizeActivationPlanPeriod(plan.period) })));
  },
};
