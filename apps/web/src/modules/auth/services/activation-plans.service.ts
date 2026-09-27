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
  /** Billing/usage period. */
  period?: "mensal" | "anual" | "trial" | null;
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
    return sortByOrder(plans ?? []);
  },
};
