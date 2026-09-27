/**
 * Operations Routes
 * Covers: Projects, Events, Inventory, HR
 * MusicChat (Chat Interno / Central de Atendimento) lives in chat.routes.tsx.
 */
import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import type { SuspenseRouteComponent } from "./types";

const Projects  = lazy(() => import("@/modules/projects/pages/Projects"));
const Schedule    = lazy(() => import("@/modules/events/pages/Agenda"));
const Inventory = lazy(() => import("@/modules/inventory/pages/Inventario"));
const HR        = lazy(() => import("@/modules/hr/pages/HR"));

export function operationsRoutes(P: SuspenseRouteComponent) {
  return (
    <>
      <Route path="/projetos"   element={<P><Projects /></P>} />
      <Route path="/briefings"  element={<Navigate to="/marketing/briefing" replace />} />
      <Route path="/agenda"     element={<P><Schedule /></P>} />
      <Route path="/agenda/configuracoes" element={<Navigate to="/configuracoes?aba=operacional&modulo=agenda" replace />} />
      <Route path="/inventario" element={<P><Inventory /></P>} />
      <Route path="/rh"         element={<P><HR /></P>} />
    </>
  );
}
