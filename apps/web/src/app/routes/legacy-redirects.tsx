/**
 * Portuguese URLs from before the English route names. Bookmarks, links shared with
 * artists (the public application form), links in old e-mails and open browser tabs keep
 * working: each legacy path redirects to its English route, carrying its path params,
 * the query string (legacy query keys renamed) and the hash.
 *
 * This is the only place legacy Portuguese paths may appear; it is registered in
 * docs/naming/canonical-naming-map.json as TEMPORARY_MIGRATION_COMPATIBILITY and is
 * removed once the legacy paths stop receiving traffic.
 */
import { Navigate, Route, generatePath, useLocation, useParams } from "react-router-dom";

export const LEGACY_QUERY_KEYS: Readonly<Record<string, string>> = {
  projeto: "project",
  obra: "work",
  fonograma: "phonogram",
  newObra: "newWork",
  editObra: "editWork",
  editFonograma: "phonogram",
};

export const LEGACY_ROUTES: ReadonlyArray<{ from: string; to: string }> = [
  { from: "/artistas", to: "/artists" },
  { from: "/registro-musicas", to: "/music-registration" },
  { from: "/monitoramento", to: "/rights-monitoring" },
  { from: "/rights-monitoring/execucao/:id", to: "/rights-monitoring" },
  { from: "/licenciamento", to: "/licensing" },
  { from: "/contratos", to: "/contracts" },
  { from: "/contratos/templates", to: "/contracts/templates" },
  { from: "/contratos-v2", to: "/contracts" },
  { from: "/contratos-v2/*", to: "/contracts" },
  { from: "/accounting/contabilidade", to: "/accounting/profit-and-loss" },
  { from: "/accounting/nota-fiscal", to: "/accounting/invoices" },
  { from: "/accounting/categorias", to: "/accounting/categories" },
  { from: "/accounting/automacoes", to: "/accounting/automations" },
  { from: "/financeiro/regras", to: "/accounting/rules" },
  { from: "/financeiro/regras-categorias", to: "/settings" },
  { from: "/lancamentos", to: "/releases" },
  { from: "/gestao-shares", to: "/shares" },
  { from: "/crm/configuracoes", to: "/settings" },
  { from: "/crm-relacionamentos", to: "/leads" },
  { from: "/captar", to: "/leads" },
  { from: "/marketing/visao-geral", to: "/marketing/overview" },
  { from: "/marketing/campanhas", to: "/marketing/campaigns" },
  { from: "/marketing/calendario", to: "/marketing/calendar" },
  { from: "/marketing/tarefas", to: "/marketing/tasks" },
  { from: "/marketing/metricas", to: "/marketing/metrics" },
  { from: "/marketing/ia-criativa", to: "/marketing/creative-ai" },
  { from: "/marketing/configuracoes", to: "/settings" },
  { from: "/marketing/projetos", to: "/projects" },
  { from: "/marketing/automacoes", to: "/marketing/overview" },
  { from: "/marketing/central-criativa", to: "/marketing/tasks" },
  { from: "/marketing/biblioteca-da-marca", to: "/marketing/tasks" },
  { from: "/marketing/aprovacoes-criativas", to: "/marketing/tasks" },
  { from: "/projetos", to: "/projects" },
  { from: "/agenda/configuracoes", to: "/settings" },
  { from: "/inventario", to: "/inventory" },
  { from: "/rh", to: "/hr" },
  { from: "/relatorios", to: "/reports" },
  { from: "/configuracoes", to: "/settings" },
  { from: "/configuracoes/billing", to: "/settings/billing" },
  { from: "/perfil", to: "/profile" },
  { from: "/usuarios", to: "/users" },
  { from: "/auditoria", to: "/audit" },
  { from: "/admin/configuracoes", to: "/admin/settings" },
  { from: "/admin/musicchat/automacoes", to: "/admin/musicchat/automations" },
  { from: "/cadastro/:orgSlug", to: "/apply/:orgSlug" },
];

/** English URL for a legacy location: path params, renamed query keys and hash carried over. */
export function legacyTarget(to: string, params: Record<string, string | undefined>, search: string, hash: string): string {
  const query = new URLSearchParams();
  new URLSearchParams(search).forEach((value, key) => query.append(LEGACY_QUERY_KEYS[key] ?? key, value));
  const qs = query.toString();
  return `${generatePath(to, params)}${qs ? `?${qs}` : ""}${hash}`;
}

function LegacyRedirect({ to }: { to: string }) {
  const location = useLocation();
  const params = useParams();
  return <Navigate to={legacyTarget(to, params, location.search, location.hash)} replace />;
}

export function legacyRoutes() {
  return (
    <>
      {LEGACY_ROUTES.map(({ from, to }) => (
        <Route key={from} path={from} element={<LegacyRedirect to={to} />} />
      ))}
    </>
  );
}
