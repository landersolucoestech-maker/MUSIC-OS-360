/**
 * STEP 10 — Routing Modularization: Public Routes
 *
 * Exports a function (not a component) for inline use inside <Routes>.
 * React Router v6 requires the children of <Routes> to be <Route> or <React.Fragment>.
 * Calling it as a function — {publicRoutes(...)} — returns a valid fragment.
 */
import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
import type { SuspenseRouteComponent } from "./types";

const Auth = lazy(() => import("@/modules/auth/pages/Auth"));
const Register = lazy(() => import("@/modules/auth/pages/Register"));
const ResetPassword = lazy(() => import("@/modules/auth/pages/ResetPassword"));
const ChangeRequiredPassword = lazy(() => import("@/modules/auth/pages/ChangeRequiredPassword"));
const ArtistSignupPublic = lazy(() => import("@/modules/auth/pages/ArtistaSignupPublic"));
const NotFound = lazy(() => import("@/shared/pages/NotFound"));
const OAuthPopupPage    = lazy(() => import("@/modules/integrations/pages/OAuthPopupPage"));
const OAuthCallbackPage = lazy(() => import("@/modules/integrations/pages/OAuthCallbackPage"));

export function publicRoutes(S: SuspenseRouteComponent) {
  return (
    <>
      <Route path="/oauth/callback" element={<S><OAuthCallbackPage /></S>} />
      <Route path="/oauth/:platform" element={<S><OAuthPopupPage /></S>} />
      <Route path="/auth" element={<S><Auth /></S>} />
      <Route path="/login" element={<S><Auth /></S>} />
      <Route path="/forgot-password" element={<S><Auth /></S>} />
      <Route path="/register" element={<S><Register /></S>} />
      <Route path="/signup" element={<S><Register /></S>} />
      <Route path="/reset-password" element={<S><ResetPassword /></S>} />
      <Route path="/change-required-password" element={<S><ChangeRequiredPassword /></S>} />
      <Route path="/captar" element={<Navigate to="/leads" replace />} />
      <Route path="/cadastro/:orgSlug" element={<S><ArtistSignupPublic /></S>} />
      <Route path="*" element={<S><NotFound /></S>} />
    </>
  );
}

