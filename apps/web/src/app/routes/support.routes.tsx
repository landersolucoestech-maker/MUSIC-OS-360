import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import type { SuspenseRouteComponent } from "./types";

const SupportDashboard    = lazy(() => import("@/modules/support/pages/SupportDashboard"));
const SupportTickets      = lazy(() => import("@/modules/support/pages/SupportTickets"));
const SupportTicketDetail = lazy(() => import("@/modules/support/pages/SupportTicketDetail"));
const SupportKnowledge      = lazy(() => import("@/modules/support/pages/SupportKnowledge"));
const SupportStatus       = lazy(() => import("@/modules/support/pages/SupportStatus"));
const SupportRequests     = lazy(() => import("@/modules/support/pages/SupportRequests"));

export function supportRoutes(P: SuspenseRouteComponent) {
  return (
    <>
      <Route path="/support"               element={<P><SupportDashboard /></P>} />
      <Route path="/support/tickets"       element={<P><SupportTickets /></P>} />
      <Route path="/support/tickets/:id"   element={<P><SupportTicketDetail /></P>} />
      <Route path="/support/knowledge"        element={<P><SupportKnowledge /></P>} />
      {/* Knowledge Base management is exclusive to the Admin Panel. */}
      <Route path="/support/knowledge/manage" element={<Navigate to="/admin/knowledge" replace />} />
      {/* Live chat — not a second chat system: it points to the
          real MusicChat (/chat), which already covers exactly this use case in the
          "internal" tab (conversation with the team itself). The old SupportChat
          was a demo with fake automatic replies, with no backend at all. */}
      <Route path="/support/chat"          element={<Navigate to="/chat" replace />} />
      <Route path="/support/status"        element={<P><SupportStatus /></P>} />
      <Route path="/support/requests"      element={<P><SupportRequests /></P>} />
    </>
  );
}

