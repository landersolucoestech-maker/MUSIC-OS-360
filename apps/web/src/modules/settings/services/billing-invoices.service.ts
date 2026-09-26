/**
 * billing-invoices.service.ts — the workspace's invoice history.
 *
 * Source of truth: Stripe (via backend). NEVER fake data on the screen.
 *     The screen shows an honest empty state (no fake invoices).
 *   - Production: the backend aggregates the Stripe invoices.
 *
 * BACKEND CONTRACT (future):
 *   GET /billing/invoices -> ApiResponse<BillingInvoice[]>
 */
import { api } from "@/shared/lib/api-client";

export interface BillingInvoice {
  id: string;
  /** Invoice number/identifier. */
  number?: string | null;
  date: string;
  amount: string;
  status: string;
  /** Status color class (same pattern as the table). */
  statusColor?: string;
  pdfUrl?: string | null;
  stripeUrl?: string | null;
}

export const billingInvoicesService = {
  async listInvoices(): Promise<BillingInvoice[]> {
    return (await api.get<BillingInvoice[]>("/billing/invoices")) ?? [];
  },
};
