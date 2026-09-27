/**
 * billing-plans.service.ts — the SINGLE source of the billing plans.
 *
 * GOVERNANCE (source of truth):
 *   Admin Panel → Database → Stripe Sync → Workspaces → Billing screen.
 *
 *   Plans, prices, features, limits, seats and Stripe IDs (Product/Price)
 *   may NOT be hardcoded on the screen. They are created/edited by the Admin Panel and
 *   persisted in the database; Stripe is only synced from the database.
 *
 *   - Production: fetches the active plans from the backend (to be implemented), which reads them from the
 *     Admin-controlled database.
 *
 * BACKEND CONTRACT (future):
 *   GET /billing/plans  ->  ApiResponse<BillingPlan[]>   (only active/visible plans, sorted)
 */
import { api } from "@/shared/lib/api-client";
import { adminPlansService } from "@/modules/admin/services/admin-plans.service";

export interface BillingPlan {
  /** Stable identifier (uuid in production; matches tenant.plan). */
  id: string;
  name: string;
  /** Displayed price label (e.g. "R$ 390/mês"). Source: database (Admin). */
  price: string;
  /** Numeric price value, when applicable (cents or units — defined by the Admin). */
  priceAmount?: number | null;
  /** Billing period. */
  interval?: "mensal" | "anual" | null;
  /** Features shown on the card. */
  features: string[];
  /** Seats included in the plan (null = unlimited). */
  seats?: number | null;
  /** Limits per resource (artists, contracts, storageGb...). */
  limits?: Record<string, number | null>;
  /** Stripe reference — synced from the database, never hardcoded in the UI. */
  stripePriceId?: string | null;
  /** Display order defined by the Admin. */
  order: number;
}

function sortByOrder(plans: BillingPlan[]): BillingPlan[] {
  return [...plans].sort((a, b) => a.order - b.order);
}

export const billingPlansService = {
  /**
   * Lists the plans published by the Admin (active/visible), sorted.
   * The source is the Admin Panel (adminPlansService) — nothing hardcoded here.
   */
  async listPlans(): Promise<BillingPlan[]> {
    const plans = await api.get<BillingPlan[]>("/billing/plans");
    return sortByOrder(plans ?? []);
  },
};
