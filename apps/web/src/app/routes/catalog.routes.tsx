/**
 * Catalog + Monitoring + Rights + Licensing Routes
 */
import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import type { SuspenseRouteComponent } from "./types";

const MusicRegistration  = lazy(() => import("@/modules/catalog/pages/MusicRegistration"));
const Takedowns        = lazy(() => import("@/modules/monitoring/pages/Takedowns"));
const Licensing    = lazy(() => import("@/modules/licensing/pages/Licensing"));
const RightsMonitoring = lazy(() => import("@/modules/monitoring/rights/pages/RightsMonitoring"));

export function catalogRoutes(P: SuspenseRouteComponent) {
  return (
    <>
      <Route path="/music-registration" element={<P><MusicRegistration /></P>} />
      {/* Redirect legacy route */}
      <Route path="/rights-monitoring" element={<P><RightsMonitoring /></P>} />
      {/* Legacy per-execution detail route removed — RIGHTS_EXECUCOES mock always
          empty in production, this page could never resolve an id. Row detail is
          covered by DetectionDetailModal on the list itself. */}
      <Route path="/takedowns" element={<P><Takedowns /></P>} />
      <Route path="/licensing" element={<P><Licensing /></P>} />
    </>
  );
}
