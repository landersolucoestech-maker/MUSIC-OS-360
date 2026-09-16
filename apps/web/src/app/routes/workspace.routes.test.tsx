import { Suspense } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes } from "react-router-dom";

/**
 * CODEBASE_MAP Gotcha #26: "only 1 of 6 nav tabs (overview) has a matching
 * route ... the other 5 ... 404". Proves every tab link
 * ArtistWorkspaceLayout renders now resolves to real content in this
 * layout -- either the real overview page or an honest "not built"
 * placeholder -- never a blank Outlet or the generic app 404.
 */
const apiMock = vi.hoisted(() => ({ get: vi.fn(), patch: vi.fn(), post: vi.fn(), delete: vi.fn() }));
vi.mock("@/shared/lib/api-client", () => ({ api: apiMock }));

import { workspaceRoutes } from "./workspace.routes";

function Passthrough({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={null}>{children}</Suspense>;
}

function renderWorkspaceAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter initialEntries={[path]}>
      <QueryClientProvider client={qc}>
        <Routes>{workspaceRoutes(Passthrough)}</Routes>
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("workspaceRoutes — nenhuma aba cai em 404/Outlet vazio (CODEBASE_MAP #26)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.get.mockImplementation((path: string) => {
      if (path.startsWith("/artists/")) return Promise.resolve({ id: "artist-1", name: "Artista Teste" });
      if (path.startsWith("/activity-logs")) return Promise.resolve([]);
      return Promise.resolve([]);
    });
  });

  it("overview (rota registrada) não cai no placeholder 'Em construção'", async () => {
    renderWorkspaceAt("/workspace/artist/artist-1/overview");
    // Two nested lazy() boundaries (layout + page) resolving together can exceed
    // findByText's default 1000ms wait under test-runner load; give it more room.
    expect(await screen.findByText("Métricas", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(screen.queryByText("Em construção")).toBeNull();
  });

  it.each(["releases", "campaigns", "financial", "team", "activity"])(
    "aba '%s' sem rota dedicada mostra o placeholder honesto, não uma tela em branco",
    async (tab) => {
      renderWorkspaceAt(`/workspace/artist/artist-1/${tab}`);
      expect(await screen.findByText("Em construção", {}, { timeout: 5000 })).toBeInTheDocument();
    },
  );
});
