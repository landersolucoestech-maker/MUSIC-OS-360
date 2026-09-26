/**
 * Audiovisual / Video Production routes
 *
 * Unified audiovisual module.
 * The main /audiovisual route renders the project list directly.
 * Old routes remain only as redirects to avoid breaking saved links.
 */
import { lazy } from "react";
import { Route, Navigate } from "react-router-dom";
import type { SuspenseRouteComponent } from "./types";

const ProjectsListPage = lazy(() => import("@/modules/audiovisual/pages/AudiovisualProjectsList"));
const NewProjectPage = lazy(() => import("@/modules/audiovisual/pages/AudiovisualNewProject"));
const ProjectDetails = lazy(() => import("@/modules/audiovisual/pages/AudiovisualProjectDetails"));

export function audiovisualRoutes(P: SuspenseRouteComponent) {
  return (
    <>
      <Route path="/audiovisual" element={<P><ProjectsListPage /></P>} />

      <Route path="/audiovisual/dashboard" element={<Navigate to="/audiovisual" replace />} />
      <Route path="/audiovisual/projects" element={<Navigate to="/audiovisual" replace />} />

      <Route path="/audiovisual/projects/new" element={<P><NewProjectPage /></P>} />
      <Route path="/audiovisual/projects/:id" element={<P><ProjectDetails /></P>} />
    </>
  );
}
