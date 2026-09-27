/**
 * Catalog + Monitoring + Rights + Licensing Routes
 */
import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import type { SuspenseRouteComponent } from "./types";

const MusicRegistration  = lazy(() => import("@/modules/catalog/pages/RegistroMusicas"));
const Takedowns        = lazy(() => import("@/modules/monitoring/pages/Takedowns"));
const Licenciamento    = lazy(() => import("@/modules/licensing/pages/Licenciamento"));
const RightsMonitoring = lazy(() => import("@/modules/monitoring/rights/pages/RightsMonitoring"));

export function catalogRoutes(P: SuspenseRouteComponent) {
  return (
    <>
      <Route path="/registro-musicas" element={<P><MusicRegistration /></P>} />
      {/* Redirect legacy route */}
      <Route path="/monitoramento" element={<Navigate to="/rights-monitoring" replace />} />
      <Route path="/rights-monitoring" element={<P><RightsMonitoring /></P>} />
      {/* Legacy per-execution detail route removed — RIGHTS_EXECUCOES mock always
          empty in production, this page could never resolve an id. Row detail is
          covered by DetectionDetailModal on the list itself. */}
      <Route path="/rights-monitoring/execucao/:id" element={<Navigate to="/rights-monitoring" replace />} />
      <Route path="/takedowns" element={<P><Takedowns /></P>} />
      <Route path="/licenciamento" element={<P><Licenciamento /></P>} />
    </>
  );
}
