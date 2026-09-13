/**
 * Operations Routes
 * Covers: Projects, Events, Inventory, RH
 * MusicChat (Chat Interno / Central de Atendimento) lives in chat.routes.tsx.
 */
import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import type { SuspenseRouteComponent } from "./types";

const Projects  = lazy(() => import("@/modules/projects/pages/Projects"));
const Agenda    = lazy(() => import("@/modules/events/pages/Agenda"));
const Inventario = lazy(() => import("@/modules/inventory/pages/Inventario"));
const RH        = lazy(() => import("@/modules/rh/pages/RH"));

export function operationsRoutes(P: SuspenseRouteComponent) {
  return (
    <>
      <Route path="/projetos"   element={<P><Projects /></P>} />
      <Route path="/briefings"  element={<Navigate to="/marketing/briefing" replace />} />
      <Route path="/agenda"     element={<P><Agenda /></P>} />
      <Route path="/agenda/configuracoes" element={<Navigate to="/configuracoes?aba=operacional&modulo=agenda" replace />} />
      <Route path="/inventario" element={<P><Inventario /></P>} />
      <Route path="/rh"         element={<P><RH /></P>} />
    </>
  );
}
