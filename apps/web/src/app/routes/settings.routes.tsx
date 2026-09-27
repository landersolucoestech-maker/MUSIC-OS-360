/**
 * STEP 10 — Routing Modularization: Settings + Admin Routes
 */
import { lazy } from "react";
import { Route } from "react-router-dom";
import type { SuspenseRouteComponent } from "./types";
import { AdminRoute } from "@/shared/infrastructure/AdminRoute";

const Settings = lazy(() => import("@/modules/settings/pages/Settings"));
const Profile = lazy(() => import("@/modules/settings/pages/Profile"));
const Users = lazy(() => import("@/modules/settings/pages/Users"));
const Billing = lazy(() => import("@/modules/settings/pages/Billing"));
const DataAudit = lazy(() => import("@/modules/admin/pages/DataAudit"));
const Onboarding = lazy(() => import("@/modules/auth/pages/Onboarding"));

export function settingsRoutes(P: SuspenseRouteComponent) {
  return (
    <>
      <Route path="/settings" element={<P><AdminRoute><Settings /></AdminRoute></P>} />
      <Route path="/settings/roles" element={<P><AdminRoute><Settings /></AdminRoute></P>} />
      <Route path="/settings/permissions" element={<P><AdminRoute><Settings /></AdminRoute></P>} />
      <Route path="/profile" element={<P><Profile /></P>} />
      <Route path="/users" element={<P><AdminRoute><Users /></AdminRoute></P>} />
      <Route path="/settings/billing" element={<P><Billing /></P>} />
      <Route path="/onboarding" element={<P><Onboarding /></P>} />
      <Route
        path="/audit"
        element={<P><AdminRoute><DataAudit /></AdminRoute></P>}
      />
    </>
  );
}
