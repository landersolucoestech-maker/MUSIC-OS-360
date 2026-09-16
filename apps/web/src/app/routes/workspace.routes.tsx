import { lazy } from 'react';
import { Route, Navigate } from 'react-router-dom';
import type { SuspenseRouteComponent } from './types';

const ArtistWorkspaceLayout = lazy(() => import('@/modules/workspace/layouts/ArtistWorkspaceLayout'));
const ArtistOverview = lazy(() => import('@/modules/workspace/pages/ArtistOverview'));
const WorkspaceTabPlaceholder = lazy(() => import('@/modules/workspace/pages/WorkspaceTabPlaceholder'));

export function workspaceRoutes(P: SuspenseRouteComponent) {
  return (
    <>
      <Route path="/workspace/artist/:artistId" element={<P><ArtistWorkspaceLayout /></P>}>
        <Route index element={<Navigate to="overview" replace />} />
        <Route path="overview" element={<P><ArtistOverview /></P>} />
        {/* CODEBASE_MAP Gotcha #26: releases/campaigns/financial/team/activity tabs
            (see ArtistWorkspaceLayout's tab list) have no dedicated route yet --
            an honest "not built" placeholder instead of a silent 404/blank Outlet. */}
        <Route path="*" element={<P><WorkspaceTabPlaceholder /></P>} />
      </Route>
    </>
  );
}


