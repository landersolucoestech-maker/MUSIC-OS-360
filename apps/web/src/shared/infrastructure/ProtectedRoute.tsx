/**
 * shared/infrastructure/ProtectedRoute.tsx
 *
 * Authentication guard — redirects to /auth if the user
 * is not authenticated or if the session is still loading.
 *
 * RULE: every private route MUST be wrapped by this component.
 * Public routes (login, register, landing) stay outside.
 *
 * Usage in routes:
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/dashboard" element={<Dashboard />} />
 *     ...
 *   </Route>
 *
 * Or as a direct wrapper:
 *   <ProtectedRoute>
 *     <Dashboard />
 *   </ProtectedRoute>
 */

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/app/providers/AuthContext";
import { AUTH_DISABLED, DEV_AUTH_BYPASS } from "@/shared/lib/env";

interface ProtectedRouteProps {
  /** If omitted, renders the child routes via <Outlet> (React Router v6 pattern). */
  children?: React.ReactNode;
  /** Redirect route when not authenticated. Default: /auth */
  loginPath?: string;
}

export function ProtectedRoute({
  children,
  loginPath = "/auth",
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  /**
   * The mock user is always "authenticated" in development only.
   */
  const allowRouteBypass = AUTH_DISABLED || DEV_AUTH_BYPASS;
  if (allowRouteBypass) {
    return children ? <>{children}</> : <Outlet />;
  }

  /**
   * While AuthContext is still resolving the session (initial hydration),
   * we show a centered spinner to avoid redirect flashes.
   */
  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-h-screen"
        data-testid="protected-route-loading"
        aria-label="Carregando sessão..."
      >
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  /**
   * No authenticated user → redirect to the login page.
   * We store the current route in `state.from` to be able to redirect
   * back after a successful login.
   */
  if (!user) {
    return (
      <Navigate
        to={loginPath}
        replace
        state={{ from: location }}
      />
    );
  }

  return children ? <>{children}</> : <Outlet />;
}

