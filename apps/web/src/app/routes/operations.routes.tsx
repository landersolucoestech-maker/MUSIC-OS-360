/**
 * Operations Routes
 * Covers: Projects, Events, Inventory, HR
 * MusicChat (internal chat and support center) lives in chat.routes.tsx.
 */
import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import type { SuspenseRouteComponent } from "./types";

const Projects  = lazy(() => import("@/modules/projects/pages/Projects"));
const Schedule    = lazy(() => import("@/modules/events/pages/Schedule"));
const Inventory = lazy(() => import("@/modules/inventory/pages/Inventory"));
const HR        = lazy(() => import("@/modules/hr/pages/HR"));

export function operationsRoutes(P: SuspenseRouteComponent) {
  return (
    <>
      <Route path="/projects"   element={<P><Projects /></P>} />
      <Route path="/briefings"  element={<Navigate to="/marketing/briefing" replace />} />
      <Route path="/agenda"     element={<P><Schedule /></P>} />
      <Route path="/inventory"  element={<P><Inventory /></P>} />
      <Route path="/hr"         element={<P><HR /></P>} />
    </>
  );
}
