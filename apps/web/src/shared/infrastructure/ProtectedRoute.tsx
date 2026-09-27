/**
 * shared/infrastructure/ProtectedRoute.tsx
 *
 * Guard de autenticação — redirige para /auth se o utilizador
 * não estiver autenticado ou se a sessão ainda estiver a carregar.
 *
 * REGRA: todas as rotas privadas DEVEM estar envolvidas por este componente.
 * Rotas públicas (login, register, landing) ficam fora.
 *
 * Uso em rotas:
 *   <Route element={<ProtectedRoute />}>
 *     <Route path="/dashboard" element={<Dashboard />} />
 *     ...
 *   </Route>
 *
 * Ou como wrapper directo:
 *   <ProtectedRoute>
 *     <Dashboard />
 *   </ProtectedRoute>
 */

import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/app/providers/AuthContext";
import { AUTH_DISABLED, DEV_AUTH_BYPASS } from "@/shared/lib/env";

interface ProtectedRouteProps {
  /** Se omitido, renderiza as rotas filho via <Outlet> (padrão React Router v6). */
  children?: React.ReactNode;
  /** Rota de redirect quando não autenticado. Por omissão: /auth */
  loginPath?: string;
}

export function ProtectedRoute({
  children,
  loginPath = "/auth",
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  /**
   * O utilizador mock está sempre "autenticado" apenas em desenvolvimento.
   */
  const allowRouteBypass = AUTH_DISABLED || DEV_AUTH_BYPASS;
  if (allowRouteBypass) {
    return children ? <>{children}</> : <Outlet />;
  }

  /**
   * Enquanto o AuthContext ainda está a resolver a sessão (hidratação inicial),
   * mostramos um spinner centralizado para evitar flashes de redirect.
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
   * Sem utilizador autenticado → redirect para a página de login.
   * Guardamos a rota actual em `state.from` para poder redirigir
   * de volta após login bem-sucedido.
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

