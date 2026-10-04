// @ts-nocheck
// Legacy embedded team contacts (old data / public self-signup) carry the old
// Portuguese category keys; the Vision 360 profile tab must still render their labels.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("recharts", async () => {
  const actual: any = await vi.importActual("recharts");
  return { ...actual, ResponsiveContainer: ({ children }: any) => <div style={{ width: 400, height: 200 }}>{children}</div> };
});
vi.mock("@/modules/catalog/hooks/useWorks", () => ({ useWorks: () => ({ works: [], isLoading: false }) }));
vi.mock("@/modules/catalog/hooks/usePhonograms", () => ({ usePhonograms: () => ({ phonograms: [], isLoading: false }) }));
vi.mock("@/modules/releases/hooks/useReleases", () => ({ useReleases: () => ({ releases: [], isLoading: false }) }));
vi.mock("@/modules/projects/hooks/useProjects", () => ({ useProjects: () => ({ projects: [], isLoading: false }) }));
vi.mock("@/modules/marketing/hooks/useGoals", () => ({ useGoals: () => ({ goals: [], isLoading: false }) }));
vi.mock("@/modules/contracts/hooks/useContracts", () => ({ useContracts: () => ({ contracts: [], isLoading: false }) }));
vi.mock("@/app/providers/TenantContext", () => ({
  useTenant: () => ({
    tenant: { id: "tenant-test", name: "Tenant Teste", permissions: {} },
    permissionKeys: ["*"],
    isFeatureEnabled: () => true,
    hasPermission: () => true,
    canRead: () => true,
    canWrite: () => true,
    canDelete: () => true,
    canExport: () => true,
    setTenant: vi.fn(),
  }),
}));
vi.mock("@/shared/lib/api-client", () => ({ api: { get: vi.fn(), post: vi.fn() } }));

import { ArtistVision360Modal } from "@/modules/artist/components/ArtistVision360Modal";
import { api } from "@/shared/lib/api-client";

// [legacy team-contact category key, label rendered for it]
const LEGACY_TEAM_CATEGORIES: ReadonlyArray<readonly [string, string]> = [
  ["assessoria", "Assessoria de Imprensa"],
  ["contador", "Contador"],
  ["empresario", "Empresário"],
  ["juridico", "Jurídico"],
  ["editora_musical", "Editora Musical"],
  ["gestor", "Gestor"],
  ["financeiro", "Financeiro"],
  ["categoria_desconhecida", "Outro"],
];

async function renderProfileTab(artist) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ArtistVision360Modal open onOpenChange={() => {}} artist={artist} />
    </QueryClientProvider>,
  );
  const tab = screen.getByRole("tab", { name: /perfil/i });
  await act(async () => {
    fireEvent.pointerDown(tab, { button: 0, ctrlKey: false });
    fireEvent.mouseDown(tab, { button: 0 });
    fireEvent.click(tab);
  });
  await screen.findByTestId(`metric-spotify-${artist.id}`);
}

describe("<ArtistVision360Modal /> legacy team contact category keys", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.get).mockResolvedValue([]);
  });

  it("renders the PT-BR label of every legacy category key, never the raw key", async () => {
    await renderProfileTab({
      id: "art-1",
      stageName: "Teste",
      spotifyUrl: null,
      youtubeUrl: null,
      teamContacts: LEGACY_TEAM_CATEGORIES.map(([key], i) => ({ name: `Contato ${i}`, category: key, email: `c${i}@example.test` })),
    });

    LEGACY_TEAM_CATEGORIES.forEach(([key, label], i) => {
      const card = screen.getByText(`Contato ${i}`).closest("div.rounded-lg") as HTMLElement;
      expect(card).not.toBeNull();
      expect(card).toHaveTextContent(label);
      expect(card).not.toHaveTextContent(key);
    });
  });
});
