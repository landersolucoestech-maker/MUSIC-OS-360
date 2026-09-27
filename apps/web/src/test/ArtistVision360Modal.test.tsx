// @ts-nocheck
// Integration test for ArtistVision360Modal.
//
// Checks the Spotify / YouTube cards in the "Perfis e Redes Sociais" section
// of the 360° View modal, respecting the real platform-profiles backend:
//   * No registered URL → "—" and no sync button.
//   * Registered URL but no snapshot yet → "Não sincronizado".
//   * With a successful snapshot → real values returned by the backend.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Stabilizes recharts' ResponsiveContainer (used by other sections
// of the modal) to avoid warnings about zero dimensions in jsdom.
vi.mock("recharts", async () => {
  const actual: any = await vi.importActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => (
      <div style={{ width: 400, height: 200 }}>{children}</div>
    ),
  };
});

// Mocks of the modal's data hooks (irrelevant here — we only want to
// render the "Perfil" tab). They return empty arrays.
vi.mock("@/modules/catalog/hooks/useObras", () => ({
  useWorks: () => ({ works: [], isLoading: false }),
}));
vi.mock("@/modules/catalog/hooks/useFonogramas", () => ({
  usePhonograms: () => ({ phonograms: [], isLoading: false }),
}));
vi.mock("@/modules/releases/hooks/useReleases", () => ({
  useReleases: () => ({ releases: [], isLoading: false }),
}));
vi.mock("@/modules/projects/hooks/useProjects", () => ({
  useProjects: () => ({ projects: [], isLoading: false }),
}));
vi.mock("@/modules/marketing/hooks/useMetas", () => ({
  useMetas: () => ({ metas: [], isLoading: false }),
}));
vi.mock("@/modules/contracts/hooks/useContracts", () => ({
  useContracts: () => ({ contracts: [], isLoading: false }),
}));

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

vi.mock("@/shared/lib/api-client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

import { ArtistVision360Modal } from "@/modules/artist/components/ArtistVision360Modal";
import { api } from "@/shared/lib/api-client";

async function renderModal(artista: any) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ArtistVision360Modal
        open
        onOpenChange={() => {}}
        artista={artista}
      />
    </QueryClientProvider>,
  );
  // Navigates to the "Perfil" tab where the platform cards live.
  // The Radix Tabs trigger uses pointer events; we combine pointerDown + click.
  const tab = screen.getByRole("tab", { name: /perfil/i });
  await act(async () => {
    fireEvent.pointerDown(tab, { button: 0, ctrlKey: false });
    fireEvent.mouseDown(tab, { button: 0 });
    fireEvent.click(tab);
  });
  // Confirms the "Perfil" tab was activated and the metrics are visible.
  await screen.findByTestId("metric-spotify-art-1");
  return utils;
}

describe("<ArtistVision360Modal /> cards de plataforma na aba Perfil", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
  });

  it("renders a dash when no platform URL is configured", async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    await renderModal({
      id: "art-1",
      nome_artistico: "Teste",
      spotify_url: null,
      youtube_url: null,
    });

    expect(screen.getByTestId("metric-spotify-art-1")).toHaveTextContent("—");
    expect(screen.getByTestId("metric-youtube-art-1")).toHaveTextContent("—");
    expect(screen.queryByTestId("button-sync-spotify-art-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-sync-youtube-art-1")).not.toBeInTheDocument();
  });

  it("renders 'Não sincronizado' when a URL exists but no snapshot yet", async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    await renderModal({
      id: "art-1",
      nome_artistico: "Teste",
      spotify_url: "https://open.spotify.com/artist/spot-1",
      youtube_url: "https://www.youtube.com/channel/UC00000000000000000001",
    });

    expect(screen.getByTestId("metric-spotify-art-1")).toHaveTextContent("Não sincronizado");
    expect(screen.getByTestId("metric-youtube-art-1")).toHaveTextContent("Não sincronizado");
  });

  it("renders the real snapshot values once the backend has synced", async () => {
    vi.mocked(api.get).mockResolvedValue([
      {
        tenant_id: "tenant-1",
        artist_id: "art-1",
        platform: "spotify",
        external_id: "spot-1",
        external_url: null,
        display_name: null,
        username: null,
        profile_url: null,
        image_url: null,
        followers: null,
        subscribers: null,
        monthly_listeners: 1042,
        popularity: 50,
        total_views: null,
        total_videos: null,
        total_tracks: null,
        total_albums: null,
        raw_payload: {},
        sync_status: "success",
        last_synced_at: "2026-06-12T00:00:00Z",
        last_error: null,
      },
    ]);

    await renderModal({
      id: "art-1",
      nome_artistico: "Teste",
      spotify_url: "https://open.spotify.com/artist/spot-1",
      youtube_url: null,
    });

    expect(screen.getByTestId("metric-spotify-art-1")).toHaveTextContent("1.042");
  });
});
