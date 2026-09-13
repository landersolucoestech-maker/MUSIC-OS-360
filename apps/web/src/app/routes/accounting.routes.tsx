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
      <Route path="/accounting/contabilidade" element={<P><ProfitAndLoss /></P>} />
      <Route path="/accounting/nota-fiscal" element={<P><Invoices /></P>} />
      <Route path="/accounting/rules" element={<P><FinanceCategoryRules /></P>} />
      <Route path="/accounting/categorias" element={<P><FinancialCategories /></P>} />
      {/* Automações financeiras (event-driven) — domínio distinto de /accounting/rules
          (categorização por palavra-chave). Ver Decision Gate item 2+3. */}
      <Route path="/accounting/automacoes" element={<P><FinancialRules /></P>} />
      <Route path="/financeiro/regras" element={<P><FinanceCategoryRules /></P>} />
      <Route path="/financeiro/regras-categorias" element={<Navigate to="/configuracoes?aba=operacional&modulo=financeiro" replace />} />
    </>
  );
}
