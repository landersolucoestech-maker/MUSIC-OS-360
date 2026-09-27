import { lazy } from "react";
import { Route } from "react-router-dom";
import type { SuspenseRouteComponent } from "./types";

// MusicChat: a single navigation point (/chat) with two tabs — Internal
// Chat (team <-> team) and the Service Center (team <-> external
// public). Each domain has its own component tree/service/entity
// (see modules/musicchat-internal and modules/musicchat/components);
// the parent page never mounts both simultaneously (no Tabs forceMount).
const MusicChat = lazy(() => import("@/modules/musicchat/pages/MusicChat"));

export function chatRoutes(P: SuspenseRouteComponent) {
  return (
    <>
      <Route path="/chat" element={<P><MusicChat /></P>} />
    </>
  );
}
