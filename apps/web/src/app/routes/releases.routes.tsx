import { lazy } from "react";
import { Route } from "react-router-dom";
import type { SuspenseRouteComponent } from "./types";

const Releases = lazy(() => import("@/modules/releases/pages/Releases"));
const Shares = lazy(() => import("@/modules/releases/pages/Shares"));

export function releasesRoutes(P: SuspenseRouteComponent) {
  return (
    <>
      <Route path="/lancamentos" element={<P><Releases /></P>} />
      <Route path="/gestao-shares" element={<P><Shares /></P>} />
    </>
  );
}
