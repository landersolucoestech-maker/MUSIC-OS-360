/**
 * STEP 10 — Routing Modularization: Artist Routes
 */
import { lazy } from "react";
import { Route } from "react-router-dom";
import type { SuspenseRouteComponent } from "./types";

const Artists = lazy(() => import("@/modules/artist/pages/Artists"));

export function artistRoutes(P: SuspenseRouteComponent) {
  return (
    <>
      <Route path="/artistas" element={<P><Artists /></P>} />
    </>
  );
}

