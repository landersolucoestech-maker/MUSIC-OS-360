/**
 * services/public-plans.service.ts
 *
 * Decision Gate item 1 (product-completion audit): SINGLE source of the Landing's
 * public pricing — GET /billing/plans/public, unauthenticated, the same
 * real catalog as the Admin panel (AdminPlans → synchronized with Stripe).
 * Never hardcode a price here; never read ADMIN_PLANS (mock, always empty) —
 * see apps/api/src/modules/billing/billing-plans.service.ts::listPublic()
 * for the field allow-list.
 */
import { api } from "@/shared/lib/api-client";

export interface PublicPlan {
  slug: string;
  name: string;
  description: string | null;
  /** Valor em centavos. */
  amount: number;
  currency: string;
  interval: string;
  features: string[];
}

export const publicPlansService = {
  async list(): Promise<PublicPlan[]> {
    return api.get<PublicPlan[]>("/billing/plans/public");
  },
};
