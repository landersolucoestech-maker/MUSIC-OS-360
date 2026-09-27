/**
 * STEP 10 — Routing Modularization: Settings + Admin Routes
 */
import { lazy } from "react";
import { Route } from "react-router-dom";
import type { SuspenseRouteComponent } from "./types";
import { AdminRoute } from "@/shared/infrastructure/AdminRoute";

const Settings = lazy(() => import("@/modules/settings/pages/Configuracoes"));
const Profile = lazy(() => import("@/modules/settings/pages/Perfil"));
const Users = lazy(() => import("@/modules/settings/pages/Usuarios"));
const Billing = lazy(() => import("@/modules/settings/pages/Billing"));
const Auditoria = lazy(() => import("@/modules/admin/pages/Auditoria"));
const Onboarding = lazy(() => import("@/modules/auth/pages/Onboarding"));

export function settingsRoutes(P: SuspenseRouteComponent) {
  return (
    <>
      <Route path="/configuracoes" element={<P><AdminRoute><Settings /></AdminRoute></P>} />
      <Route path="/settings/roles" element={<P><AdminRoute><Settings /></AdminRoute></P>} />
      <Route path="/settings/permissions" element={<P><AdminRoute><Settings /></AdminRoute></P>} />
      <Route path="/perfil" element={<P><Profile /></P>} />
      <Route path="/usuarios" element={<P><AdminRoute><Users /></AdminRoute></P>} />
      <Route path="/configuracoes/billing" element={<P><Billing /></P>} />
      <Route path="/onboarding" element={<P><Onboarding /></P>} />
      <Route
        path="/auditoria"
        element={<P><AdminRoute><Auditoria /></AdminRoute></P>}
      />
    </>
  );
}
