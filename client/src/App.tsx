import { Suspense, lazy } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { ErrorBoundary } from "@/components/shared/ErrorBoundary";
import { RouteErrorBoundary } from "@/components/shared/RouteErrorBoundary";
import { PageSkeleton } from "@/components/shared/PageSkeletons";
import { AdminRoute } from "@/components/shared/AdminRoute";
import { createQueryClient } from "@/lib/query-config";

const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Artistas = lazy(() => import("./pages/Artistas"));
const Projetos = lazy(() => import("./pages/Projetos"));
const RegistroMusicas = lazy(() => import("./pages/RegistroMusicas"));
const Lancamentos = lazy(() => import("./pages/Lancamentos"));
const Monitoramento = lazy(() => import("./pages/Monitoramento"));
const Licenciamento = lazy(() => import("./pages/Licenciamento"));
const Takedowns = lazy(() => import("./pages/Takedowns"));
const GestaoShares = lazy(() => import("./pages/GestaoShares"));
const Contratos = lazy(() => import("./pages/Contratos"));
const TemplatesContratos = lazy(() => import("./pages/TemplatesContratos"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const FinanceiroRegras = lazy(() => import("./pages/FinanceiroRegras"));
const Contabilidade = lazy(() => import("./pages/Contabilidade"));
const NotaFiscal = lazy(() => import("./pages/NotaFiscal"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Inventario = lazy(() => import("./pages/Inventario"));
const LanderZap = lazy(() => import("./pages/LanderZap"));
const Usuarios = lazy(() => import("./pages/Usuarios"));
const CRM = lazy(() => import("./pages/CRM"));
const MarketingVisaoGeral = lazy(() => import("./pages/marketing/VisaoGeral"));
const MarketingCampanhas = lazy(() => import("./pages/marketing/Campanhas"));
const MarketingCalendario = lazy(() => import("./pages/marketing/Calendario"));
const MarketingMetricas = lazy(() => import("./pages/marketing/Metricas"));
const MarketingBriefing = lazy(() => import("./pages/marketing/Briefing"));
const MarketingIACriativa = lazy(() => import("./pages/marketing/IACriativa"));
const MarketingTarefas = lazy(() => import("./pages/marketing/Tarefas"));
const Leads = lazy(() => import("./pages/Leads"));
const RH = lazy(() => import("./pages/RH"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const Auditoria = lazy(() => import("./pages/Auditoria"));
const Aparencia = lazy(() => import("./pages/Aparencia"));
const Perfil = lazy(() => import("./pages/Perfil"));
const LeadCapture = lazy(() => import("./pages/LeadCapture"));
const ArtistaCadastro = lazy(() => import("./pages/ArtistaCadastro"));
const ArtistaSignupPublic = lazy(() => import("./pages/ArtistaSignupPublic"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = createQueryClient();

const SuspenseRoute = ({ children }: { children: React.ReactNode }) => (
  <RouteErrorBoundary>
    <Suspense fallback={<PageSkeleton />}>
      {children}
    </Suspense>
  </RouteErrorBoundary>
);

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => (
  <SuspenseRoute>
    {children}
  </SuspenseRoute>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/auth" element={<SuspenseRoute><Auth /></SuspenseRoute>} />
              <Route path="/captar" element={<SuspenseRoute><LeadCapture /></SuspenseRoute>} />
              <Route path="/signup/artista" element={<SuspenseRoute><ArtistaSignupPublic /></SuspenseRoute>} />
              <Route path="/signup/artista/:orgSlug" element={<SuspenseRoute><ArtistaSignupPublic /></SuspenseRoute>} />

              <Route path="/" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/artistas" element={<ProtectedRoute><Artistas /></ProtectedRoute>} />
              <Route path="/artistas/novo" element={<ProtectedRoute><ArtistaCadastro /></ProtectedRoute>} />
              <Route path="/artistas/:id/editar" element={<ProtectedRoute><Artistas /></ProtectedRoute>} />
              <Route path="/projetos" element={<ProtectedRoute><Projetos /></ProtectedRoute>} />
              <Route path="/registro-musicas" element={<ProtectedRoute><RegistroMusicas /></ProtectedRoute>} />
              <Route path="/lancamentos" element={<ProtectedRoute><Lancamentos /></ProtectedRoute>} />
              <Route path="/monitoramento" element={<ProtectedRoute><Monitoramento /></ProtectedRoute>} />
              <Route path="/licenciamento" element={<ProtectedRoute><Licenciamento /></ProtectedRoute>} />
              <Route path="/takedowns" element={<ProtectedRoute><Takedowns /></ProtectedRoute>} />
              <Route path="/gestao-shares" element={<ProtectedRoute><GestaoShares /></ProtectedRoute>} />
              <Route path="/contratos" element={<ProtectedRoute><Contratos /></ProtectedRoute>} />
              <Route path="/contratos/templates" element={<ProtectedRoute><TemplatesContratos /></ProtectedRoute>} />
              <Route path="/financeiro" element={<ProtectedRoute><Financeiro /></ProtectedRoute>} />
              <Route path="/financeiro/regras" element={<ProtectedRoute><FinanceiroRegras /></ProtectedRoute>} />
              <Route path="/contabilidade" element={<ProtectedRoute><Contabilidade /></ProtectedRoute>} />
              <Route path="/nota-fiscal" element={<ProtectedRoute><NotaFiscal /></ProtectedRoute>} />
              <Route path="/agenda" element={<ProtectedRoute><Agenda /></ProtectedRoute>} />
              <Route path="/inventario" element={<ProtectedRoute><Inventario /></ProtectedRoute>} />
              <Route path="/lander" element={<ProtectedRoute><LanderZap /></ProtectedRoute>} />
              <Route path="/usuarios" element={<ProtectedRoute><Usuarios /></ProtectedRoute>} />
              <Route path="/crm" element={<ProtectedRoute><CRM /></ProtectedRoute>} />
              <Route path="/marketing/visao-geral" element={<ProtectedRoute><MarketingVisaoGeral /></ProtectedRoute>} />
              <Route path="/marketing/campanhas" element={<ProtectedRoute><MarketingCampanhas /></ProtectedRoute>} />
              <Route path="/marketing/calendario" element={<ProtectedRoute><MarketingCalendario /></ProtectedRoute>} />
              <Route path="/marketing/metricas" element={<ProtectedRoute><MarketingMetricas /></ProtectedRoute>} />
              <Route path="/marketing/briefing" element={<ProtectedRoute><MarketingBriefing /></ProtectedRoute>} />
              <Route path="/marketing/ia-criativa" element={<ProtectedRoute><MarketingIACriativa /></ProtectedRoute>} />
              <Route path="/marketing/tarefas" element={<ProtectedRoute><MarketingTarefas /></ProtectedRoute>} />
              <Route path="/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
              <Route path="/rh" element={<ProtectedRoute><RH /></ProtectedRoute>} />
              <Route path="/configuracoes" element={<ProtectedRoute><Configuracoes /></ProtectedRoute>} />
              <Route path="/auditoria" element={<SuspenseRoute><AdminRoute><Auditoria /></AdminRoute></SuspenseRoute>} />
              <Route path="/aparencia" element={<ProtectedRoute><Aparencia /></ProtectedRoute>} />
              <Route path="/perfil" element={<ProtectedRoute><Perfil /></ProtectedRoute>} />

              <Route path="*" element={<SuspenseRoute><NotFound /></SuspenseRoute>} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
