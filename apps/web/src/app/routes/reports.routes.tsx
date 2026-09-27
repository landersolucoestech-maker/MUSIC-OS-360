import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import type { SuspenseRouteComponent } from "./types";

const Reports = lazy(() => import("@/modules/reports/pages/Reports"));

export function reportsRoutes(P: SuspenseRouteComponent) {
  return (
    <>
      <Route path="/reports" element={<P><Reports /></P>} />
      <Route path="/analytics" element={<Navigate to="/reports" replace />} />
    </>
  );
}
