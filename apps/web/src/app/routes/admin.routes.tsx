/**
 * Admin routes — Painel Super Admin Master Enterprise.
 */
import { lazy } from "react";
import { Route, Navigate } from "react-router-dom";
import type { SuspenseRouteComponent } from "./types";

const Landing             = lazy(() => import("@/shared/pages/Landing"));
const AdminDashboard      = lazy(() => import("@/modules/admin/pages/AdminDashboard"));
const AdminClients        = lazy(() => import("@/modules/admin/pages/AdminClients"));
const AdminPlans          = lazy(() => import("@/modules/admin/pages/AdminPlans"));
const AdminSubscriptions  = lazy(() => import("@/modules/admin/pages/AdminSubscriptions"));
const AdminAudit          = lazy(() => import("@/modules/admin/pages/AdminAudit"));
const AdminSupport        = lazy(() => import("@/modules/admin/pages/AdminSupport"));
const AdminKnowledge      = lazy(() => import("@/modules/admin/pages/AdminKnowledge"));
const AdminSettings       = lazy(() => import("@/modules/admin/pages/AdminSettings"));
const MusicChatAutomationSettings = lazy(() => import("@/modules/musicchat/pages/MusicChatAutomationSettings"));

export function adminRoutes(S: SuspenseRouteComponent, P: SuspenseRouteComponent) {
  return (
    <>
      <Route path="/landing" element={<S><Landing /></S>} />

      {/* Redirect /admin → /admin/dashboard */}
      <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

      {/* Core admin pages */}
      <Route path="/admin/dashboard"      element={<P><AdminDashboard /></P>} />
      <Route path="/admin/clients"        element={<P><AdminClients /></P>} />
      <Route path="/admin/subscriptions"  element={<P><AdminSubscriptions /></P>} />
      <Route path="/admin/revenue"        element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin/plans"          element={<P><AdminPlans /></P>} />
      <Route path="/admin/analytics"      element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/admin/audit"          element={<P><AdminAudit /></P>} />
      <Route path="/admin/support"        element={<P><AdminSupport /></P>} />
      <Route path="/admin/knowledge"      element={<P><AdminKnowledge /></P>} />

      {/* Settings centralizes the general, email, security, notifications, webhooks, API keys, integrations and users tabs */}
      <Route path="/admin/settings"       element={<P><AdminSettings /></P>} />
      <Route path="/admin/musicchat/automations" element={<P><MusicChatAutomationSettings /></P>} />


      {/* Redirects — standalone routes consolidated under /admin/settings */}
      <Route path="/admin/security"       element={<Navigate to="/admin/settings" replace />} />
      <Route path="/admin/integrations"   element={<Navigate to="/admin/settings" replace />} />
      <Route path="/admin/system"         element={<Navigate to="/admin/settings" replace />} />
      <Route path="/admin/notifications"  element={<Navigate to="/admin/settings" replace />} />
      <Route path="/admin/users"          element={<Navigate to="/admin/settings" replace />} />
    </>
  );
}
