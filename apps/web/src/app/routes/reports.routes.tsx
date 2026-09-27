import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import type { SuspenseRouteComponent } from "./types";

const Reports = lazy(() => import("@/modules/reports/pages/Relatorios"));

export function reportsRoutes(P: SuspenseRouteComponent) {
  return (
    <>
      <Route path="/relatorios" element={<P><Reports /></P>} />
      <Route path="/analytics" element={<Navigate to="/relatorios" replace />} />
    </>
  );
}
