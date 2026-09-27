import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import type { SuspenseRouteComponent } from "./types";

const Accounting = lazy(() => import("@/modules/accounting/pages/Accounting"));
const ProfitAndLoss = lazy(() => import("@/modules/accounting/pages/ProfitAndLoss"));
const Invoices = lazy(() => import("@/modules/accounting/pages/Invoices"));
const FinanceCategoryRules = lazy(() => import("@/modules/accounting/pages/FinanceCategoryRules"));
const FinancialCategories = lazy(() => import("@/modules/accounting/pages/FinancialCategories"));
const FinancialRules = lazy(() => import("@/modules/accounting/pages/FinancialRules"));

export function accountingRoutes(P: SuspenseRouteComponent) {
  return (
    <>
      <Route path="/accounting" element={<P><Accounting /></P>} />
      <Route path="/accounting/profit-and-loss" element={<P><ProfitAndLoss /></P>} />
      <Route path="/accounting/invoices" element={<P><Invoices /></P>} />
      <Route path="/accounting/rules" element={<P><FinanceCategoryRules /></P>} />
      <Route path="/accounting/categories" element={<P><FinancialCategories /></P>} />
      {/* Financial automations (event-driven) — a domain distinct from /accounting/rules
          (keyword categorization). See Decision Gate items 2+3. */}
      <Route path="/accounting/automations" element={<P><FinancialRules /></P>} />
    </>
  );
}
