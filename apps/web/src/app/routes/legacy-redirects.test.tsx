import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { LEGACY_QUERY_KEYS, LEGACY_ROUTES, legacyRoutes, legacyTarget } from "./legacy-redirects";

/**
 * Old Portuguese URLs (bookmarks, links shared with artists, open tabs) must land on
 * the English route with their params, query and hash intact, and every redirect
 * target must be a route the app really declares.
 */
function CurrentLocation() {
  const location = useLocation();
  return <p data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</p>;
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        {legacyRoutes()}
        <Route path="*" element={<CurrentLocation />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("legacy Portuguese routes redirect to the English routes", () => {
  it("keeps path params: the public artist application link shared before the rename still works", () => {
    renderAt("/cadastro/lander-records");
    expect(screen.getByTestId("location").textContent).toBe("/apply/lander-records");
  });

  it("renames legacy query keys and keeps the other query params and the hash", () => {
    renderAt("/registro-musicas?projeto=p1&obra=w1&tab=x#top");
    expect(screen.getByTestId("location").textContent).toBe("/music-registration?project=p1&work=w1&tab=x#top");
  });

  it("maps every legacy deep-link key the old links produced", () => {
    expect(legacyTarget("/music-registration", {}, "?newObra=1", "")).toBe("/music-registration?newWork=1");
    expect(legacyTarget("/music-registration", {}, "?editObra=2", "")).toBe("/music-registration?editWork=2");
    expect(legacyTarget("/music-registration", {}, "?fonograma=3", "")).toBe("/music-registration?phonogram=3");
    expect(legacyTarget("/music-registration", {}, "?editFonograma=4", "")).toBe("/music-registration?phonogram=4");
  });

  it("redirects nested legacy paths (Stripe return URLs of sessions opened before the rename)", () => {
    renderAt("/configuracoes/billing?success=1");
    expect(screen.getByTestId("location").textContent).toBe("/settings/billing?success=1");
  });

  it("redirects the old contracts v2 splat", () => {
    renderAt("/contratos-v2/anything/here");
    expect(screen.getByTestId("location").textContent).toBe("/contracts");
  });

  it("every redirect target is a route declared by the app's route modules", () => {
    const dir = path.resolve(__dirname);
    const declared = new Set<string>();
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".routes.tsx"))) {
      for (const m of fs.readFileSync(path.join(dir, file), "utf8").matchAll(/path="([^"]+)"/g)) declared.add(m[1]);
    }
    const missing = LEGACY_ROUTES.map((r) => r.to).filter((to) => !declared.has(to) && to !== "/");
    expect(missing).toEqual([]);
  });

  it("no legacy path shadows a live English route", () => {
    const dir = path.resolve(__dirname);
    const declared = new Set<string>();
    for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".routes.tsx"))) {
      for (const m of fs.readFileSync(path.join(dir, file), "utf8").matchAll(/path="([^"]+)"/g)) declared.add(m[1]);
    }
    expect(LEGACY_ROUTES.filter((r) => declared.has(r.from)).map((r) => r.from)).toEqual([]);
  });
});

/**
 * The legacy route table, pinned literally and independently of the module under test: renaming, dropping or retargeting any entry fails here.
 * Each row is [legacy path, English route, an old URL that matches it, where that URL must land].
 */
const PINNED_ROUTES: ReadonlyArray<readonly [string, string, string, string]> = [
  ["/artistas", "/artists", "/artistas", "/artists"],
  ["/registro-musicas", "/music-registration", "/registro-musicas", "/music-registration"],
  ["/monitoramento", "/rights-monitoring", "/monitoramento", "/rights-monitoring"],
  ["/rights-monitoring/execucao/:id", "/rights-monitoring", "/rights-monitoring/execucao/abc", "/rights-monitoring"],
  ["/licenciamento", "/licensing", "/licenciamento", "/licensing"],
  ["/contratos", "/contracts", "/contratos", "/contracts"],
  ["/contratos/templates", "/contracts/templates", "/contratos/templates", "/contracts/templates"],
  ["/contratos-v2", "/contracts", "/contratos-v2", "/contracts"],
  ["/contratos-v2/*", "/contracts", "/contratos-v2/a/b", "/contracts"],
  ["/accounting/contabilidade", "/accounting/profit-and-loss", "/accounting/contabilidade", "/accounting/profit-and-loss"],
  ["/accounting/nota-fiscal", "/accounting/invoices", "/accounting/nota-fiscal", "/accounting/invoices"],
  ["/accounting/categorias", "/accounting/categories", "/accounting/categorias", "/accounting/categories"],
  ["/accounting/automacoes", "/accounting/automations", "/accounting/automacoes", "/accounting/automations"],
  ["/financeiro/regras", "/accounting/rules", "/financeiro/regras", "/accounting/rules"],
  ["/financeiro/regras-categorias", "/settings", "/financeiro/regras-categorias", "/settings"],
  ["/lancamentos", "/releases", "/lancamentos", "/releases"],
  ["/gestao-shares", "/shares", "/gestao-shares", "/shares"],
  ["/crm/configuracoes", "/settings", "/crm/configuracoes", "/settings"],
  ["/crm-relacionamentos", "/leads", "/crm-relacionamentos", "/leads"],
  ["/captar", "/leads", "/captar", "/leads"],
  ["/marketing/visao-geral", "/marketing/overview", "/marketing/visao-geral", "/marketing/overview"],
  ["/marketing/campanhas", "/marketing/campaigns", "/marketing/campanhas", "/marketing/campaigns"],
  ["/marketing/calendario", "/marketing/calendar", "/marketing/calendario", "/marketing/calendar"],
  ["/marketing/tarefas", "/marketing/tasks", "/marketing/tarefas", "/marketing/tasks"],
  ["/marketing/metricas", "/marketing/metrics", "/marketing/metricas", "/marketing/metrics"],
  ["/marketing/ia-criativa", "/marketing/creative-ai", "/marketing/ia-criativa", "/marketing/creative-ai"],
  ["/marketing/configuracoes", "/settings", "/marketing/configuracoes", "/settings"],
  ["/marketing/projetos", "/projects", "/marketing/projetos", "/projects"],
  ["/marketing/automacoes", "/marketing/overview", "/marketing/automacoes", "/marketing/overview"],
  ["/marketing/central-criativa", "/marketing/tasks", "/marketing/central-criativa", "/marketing/tasks"],
  ["/marketing/biblioteca-da-marca", "/marketing/tasks", "/marketing/biblioteca-da-marca", "/marketing/tasks"],
  ["/marketing/aprovacoes-criativas", "/marketing/tasks", "/marketing/aprovacoes-criativas", "/marketing/tasks"],
  ["/projetos", "/projects", "/projetos", "/projects"],
  ["/agenda/configuracoes", "/settings", "/agenda/configuracoes", "/settings"],
  ["/inventario", "/inventory", "/inventario", "/inventory"],
  ["/rh", "/hr", "/rh", "/hr"],
  ["/relatorios", "/reports", "/relatorios", "/reports"],
  ["/configuracoes", "/settings", "/configuracoes", "/settings"],
  ["/configuracoes/billing", "/settings/billing", "/configuracoes/billing", "/settings/billing"],
  ["/perfil", "/profile", "/perfil", "/profile"],
  ["/usuarios", "/users", "/usuarios", "/users"],
  ["/auditoria", "/audit", "/auditoria", "/audit"],
  ["/admin/configuracoes", "/admin/settings", "/admin/configuracoes", "/admin/settings"],
  ["/admin/musicchat/automacoes", "/admin/musicchat/automations", "/admin/musicchat/automacoes", "/admin/musicchat/automations"],
  ["/cadastro/:orgSlug", "/apply/:orgSlug", "/cadastro/lander-records", "/apply/lander-records"],
];

describe("every legacy Portuguese route is pinned and redirects to its English route", () => {
  it("the route table is exactly the pinned table (no entry renamed, dropped, added or retargeted)", () => {
    expect(LEGACY_ROUTES.map((r) => [r.from, r.to])).toEqual(PINNED_ROUTES.map(([from, to]) => [from, to]));
  });

  it.each(PINNED_ROUTES)("%s -> %s: the old URL %s lands on %s", (_from, _to, oldUrl, landing) => {
    renderAt(oldUrl);
    expect(screen.getByTestId("location").textContent).toBe(landing);
  });

  it("pins the legacy query keys exactly", () => {
    expect(LEGACY_QUERY_KEYS).toEqual({ projeto: "project", obra: "work", fonograma: "phonogram", newObra: "newWork", editObra: "editWork", editFonograma: "phonogram" });
  });
});
