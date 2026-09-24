import { Suspense, lazy, useState } from "react";
import { Toaster as Sonner } from "@/shared/ui/sonner";
import { TooltipProvider } from "@/shared/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/app/providers/AuthContext";
import { TenantProvider } from "@/app/providers/TenantContext";
import { useTenant } from "@/app/providers/TenantContext";
import { BillingProvider, useBilling } from "@/app/providers/BillingContext";
import { BillingNotice } from "@/shared/infrastructure/BillingNotice";
import { ErrorBoundary } from "@/shared/infrastructure/ErrorBoundary";
import { RouteErrorBoundary } from "@/shared/infrastructure/RouteErrorBoundary";
import { PageSkeleton } from "@/shared/components/PageSkeletons";
import { createQueryClient } from "@/shared/lib/query-config";
import type { SuspenseRouteComponent } from "@/app/routes/types";
import "@/shared/domain-events/consistency";
import { RealtimeLayer } from "@/shared/infrastructure/RealtimeLayer";
import { AUTH_DISABLED, DEV_AUTH_BYPASS } from "@/shared/lib/env";
import { runClientMigrations } from "@/shared/lib/migrations";
import { publicRoutes } from "@/app/routes/public.routes";
import { artistRoutes } from "@/app/routes/artist.routes";
import { catalogRoutes } from "@/app/routes/catalog.routes";
import { accountingRoutes } from "@/app/routes/accounting.routes";
import { releasesRoutes } from "@/app/routes/releases.routes";
import { crmRoutes } from "@/app/routes/crm.routes";
import { marketingRoutes } from "@/app/routes/marketing.routes";
import { workspaceRoutes } from "@/app/routes/workspace.routes";
import { settingsRoutes } from "@/app/routes/settings.routes";
import { operationsRoutes } from "@/app/routes/operations.routes";
import { chatRoutes } from "@/app/routes/chat.routes";
import { adminRoutes } from "@/app/routes/admin.routes";
import { contractsRoutes } from "@/app/routes/contracts.routes";
import { reportsRoutes } from "@/app/routes/reports.routes";
import { supportRoutes } from "@/app/routes/support.routes";
import { audiovisualRoutes } from "@/app/routes/audiovisual.routes";

runClientMigrations();

const Dashboard = lazy(() => import("@/modules/dashboard/pages/Dashboard"));
const Landing = lazy(() => import("@/shared/pages/Landing"));
const BillingBlockedPage = lazy(() => import("@/modules/settings/pages/BillingBlockedPage"));

const SuspenseRoute: SuspenseRouteComponent = ({ children }) => (
  <RouteErrorBoundary>
    <Suspense fallback={<PageSkeleton />}>
      {children}
    </Suspense>
  </RouteErrorBoundary>
);

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (AUTH_DISABLED || DEV_AUTH_BYPASS) return <>{children}</>;
  if (loading) return <PageSkeleton />;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function PasswordChangeGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  // Espelha o MustChangePasswordGuard do backend: enquanto a flag estiver
  // ligada, nenhuma rota de domínio é alcançável, mesmo que o backend já
  // tivesse (por bug de UI) deixado passar — a defesa real é o guard do
  // backend; este redirect só evita o usuário ficar preso vendo erros 403
  // avulsos sem saber o motivo.
  if (user?.mustChangePassword) return <Navigate to="/change-required-password" replace />;
  return <>{children}</>;
}

function BillingGuard({ children }: { children: React.ReactNode }) {
  const billing = useBilling();
  const location = window.location.pathname;
  const allowed =
    location.startsWith("/billing") ||
    location.startsWith("/configuracoes/billing") ||
    location.startsWith("/support");
  if (billing.isSuspended && !allowed) return <Navigate to="/billing/blocked" replace />;
  return <>{children}</>;
}

function Home() {
  const { user, loading } = useAuth();
  const { tenant } = useTenant();
  if (AUTH_DISABLED || DEV_AUTH_BYPASS) return <Navigate to="/dashboard" replace />;
  if (loading) return <PageSkeleton />;
  if (!user) return <Landing />;
  if (user.mustChangePassword) return <Navigate to="/change-required-password" replace />;
  if (!tenant.onboarding.completed) return <Navigate to="/onboarding" replace />;
  return <Navigate to="/dashboard" replace />;
}

const ProtectedRoute: SuspenseRouteComponent = ({ children }) => (
  <RouteErrorBoundary>
    <Suspense fallback={<PageSkeleton />}>
      <AuthGuard><PasswordChangeGuard><BillingGuard>{children}</BillingGuard></PasswordChangeGuard></AuthGuard>
    </Suspense>
  </RouteErrorBoundary>
);

function SuperAdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (AUTH_DISABLED || DEV_AUTH_BYPASS) return <>{children}</>;
  if (loading) return <PageSkeleton />;
  const role = user?.role;
  if (!user || role !== "super_admin") return <Navigate to="/" replace />;
  return <>{children}</>;
}

const SuperAdminRoute: SuspenseRouteComponent = ({ children }) => (
  <SuspenseRoute>
    <SuperAdminGuard>{children}</SuperAdminGuard>
  </SuspenseRoute>
);

/**
 * Parte 76 — banner crítico, sempre visível, quando AUTH_DISABLED está ativo.
 * Sem isso, um usuário real podia ver "LANDER RECORDS" / "Owner" no menu e
 * não perceber que está navegando um workspace sentinela falso (auth-disabled
 * user/tenant, ver apps/api/src/core/auth-disabled.ts), sem sessão Supabase
 * real nenhuma por trás.
 */
function AuthDisabledBanner() {
  if (!AUTH_DISABLED) return null;
  return (
    <div
      role="alert"
      className="sticky inset-x-0 top-0 z-[9999] bg-warning px-4 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-warning-foreground"
    >
      ⚠ AUTH_DISABLED ativo — sessão, tenant e permissões são falsos (dev bypass). Nunca use para validar login real.
    </div>
  );
}

/**
 * DEV ONLY — banner crítico, sempre visível, quando VITE_DISABLE_AUTH está
 * ativo. Mesmo propósito do AuthDisabledBanner acima, mas para o bypass
 * puramente de frontend: sem sessão Supabase real nenhuma por trás, e sem
 * suposição de que o backend também tenha auth desligada — chamadas de API
 * autenticadas podem retornar 401/403 normalmente.
 */
function DevAuthBypassBanner() {
  if (!DEV_AUTH_BYPASS) return null;
  return (
    <div
      role="alert"
      className="sticky inset-x-0 top-0 z-[9999] bg-warning px-4 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-warning-foreground"
    >
      ⚠ VITE_DISABLE_AUTH ativo (DEV ONLY) — login, sessão e MFA pulados no frontend. Chamadas de API que exigem auth real podem retornar 401/403. Nunca use para validar login real.
    </div>
  );
}

/**
 * Parte 76 — antes, uma falha em /auth/context (ex.: banco de aplicação
 * indisponível) deixava a organização/usuário em branco para sempre sem
 * nenhum aviso — indistinguível de "ainda carregando". Este banner torna o
 * estado "Contexto indisponível" visível em vez de um skeleton silencioso.
 */
function TenantContextErrorBanner() {
  const { contextError } = useTenant();
  if (!contextError) return null;
  return (
    <div
      role="alert"
      className="sticky inset-x-0 top-0 z-[9998] bg-amber-600 px-4 py-1.5 text-center text-xs font-semibold text-white"
    >
      ⚠ Contexto indisponível — {contextError}
    </div>
  );
}

const App = () => {
  const [queryClient] = useState(() => createQueryClient());
  return (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TenantProvider>
          <BillingProvider>
            <RealtimeLayer />
            <TooltipProvider>
              <Sonner />
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <AuthDisabledBanner />
                <DevAuthBypassBanner />
                <TenantContextErrorBanner />
                <BillingNotice />
                <Routes>
                  {publicRoutes(SuspenseRoute)}

                  <Route path="/" element={<SuspenseRoute><Home /></SuspenseRoute>} />
                  <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                  <Route path="/billing/blocked" element={<ProtectedRoute><BillingBlockedPage /></ProtectedRoute>} />

                  {artistRoutes(ProtectedRoute)}
                  {workspaceRoutes(ProtectedRoute)}
                  {catalogRoutes(ProtectedRoute)}
                  {accountingRoutes(ProtectedRoute)}
                  {releasesRoutes(ProtectedRoute)}
                  {crmRoutes(ProtectedRoute)}
                  {marketingRoutes(ProtectedRoute)}
                  {settingsRoutes(ProtectedRoute)}
                  {operationsRoutes(ProtectedRoute)}
                  {chatRoutes(ProtectedRoute)}
                  {contractsRoutes(ProtectedRoute)}
                  <Route path="/contratos-v2" element={<Navigate to="/contratos" replace />} />
                  <Route path="/contratos-v2/*" element={<Navigate to="/contratos" replace />} />
                  {adminRoutes(SuspenseRoute, SuperAdminRoute)}
                  {reportsRoutes(ProtectedRoute)}
                  {supportRoutes(ProtectedRoute)}
                  {audiovisualRoutes(ProtectedRoute)}
                </Routes>
              </BrowserRouter>
            </TooltipProvider>
          </BillingProvider>
        </TenantProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
  );
};

export default App;

