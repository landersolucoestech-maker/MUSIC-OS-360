// @ts-nocheck
// Team contacts linked from the CRM (artist.linkedContacts resolved through useContacts) show the
// PT-BR label of their category in the "Equipe Vinculada (CRM)" card of the profile tab.
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
vi.mock("@/modules/crm-relationships/hooks/useContacts", () => ({
  useContacts: () => ({
    contacts: [
      { id: "c1", name: "Ana Filmes", category: "VIDEOMAKER", phone: "111" },
      { id: "c2", name: "Bruno Silva", category: "LAWYER" },
      { id: "c3", name: "Zeca", category: "NOT_A_CATEGORY" },
      { id: "c4", name: "Nao Vinculado", category: "PRODUCER" },
    ],
  }),
}));
vi.mock("@/shared/lib/api-client", () => ({ api: { get: vi.fn(), post: vi.fn() } }));

import { ArtistVision360Modal } from "@/modules/artist/components/ArtistVision360Modal";
import { api } from "@/shared/lib/api-client";


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

const cardOf = (name: string) => screen.getByText(name).closest("div.rounded-lg") as HTMLElement;

describe("<ArtistVision360Modal /> linked CRM team category label", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
    vi.mocked(api.get).mockResolvedValue([]);
  });

  it("shows the PT-BR category label of each linked CRM contact, never the raw value", async () => {
    await renderProfileTab({
      id: "art-1",
      stageName: "Teste",
      spotifyUrl: null,
      youtubeUrl: null,
      linkedContacts: [{ contactId: "c1" }, { contactId: "c2" }, { contactId: "c3" }],
    });
    expect(screen.getByText("Equipe Vinculada (CRM)")).toBeInTheDocument();
    expect(cardOf("Ana Filmes")).toHaveTextContent("Videomaker");
    expect(cardOf("Bruno Silva")).toHaveTextContent("Advogado");
    expect(cardOf("Zeca")).toHaveTextContent("Não identificado");
    expect(screen.queryByText("VIDEOMAKER")).toBeNull();
    expect(screen.queryByText("LAWYER")).toBeNull();
    expect(screen.queryByText("NOT_A_CATEGORY")).toBeNull();
    // negative: a CRM contact that is not linked to the artist is not listed
    expect(screen.queryByText("Nao Vinculado")).toBeNull();
  });
});
