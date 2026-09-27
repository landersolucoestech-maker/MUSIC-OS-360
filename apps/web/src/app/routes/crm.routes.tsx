import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import type { SuspenseRouteComponent } from "./types";

const LeadsPage = lazy(() => import("@/modules/leads/pages/LeadsPage"));

export function crmRoutes(P: SuspenseRouteComponent) {
  return (
    <>
      <Route path="/leads" element={<P><LeadsPage /></P>} />
      <Route path="/crm" element={<Navigate to="/leads" replace />} />
      <Route path="/crm/leads/new" element={<Navigate to="/leads?modal=lead" replace />} />
      <Route path="/crm/contacts/new" element={<Navigate to="/leads" replace />} />
      <Route path="/crm/proposals/new" element={<Navigate to="/leads" replace />} />
    </>
  );
}
