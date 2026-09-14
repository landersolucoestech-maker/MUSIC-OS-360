// @ts-nocheck
// Integration test para ArtistVision360Modal.
//
// Verifica os cards de Spotify / YouTube na seção "Perfis e Redes Sociais"
// do modal Visão 360°, respeitando o backend real de platform-profiles:
//   * Sem URL cadastrada → "—" e nenhum botão de sincronização.
//   * Com URL cadastrada mas sem snapshot ainda → "Não sincronizado".
//   * Com snapshot de sucesso → valores reais retornados pelo backend.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Estabiliza o ResponsiveContainer do recharts (usado por outras seções
// do modal) para evitar avisos sobre dimensões zero no jsdom.
vi.mock("recharts", async () => {
  const actual: any = await vi.importActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => (
      <div style={{ width: 400, height: 200 }}>{children}</div>
    ),
  };
});

// Mocks dos hooks de dados do modal (não nos importam aqui — só queremos
// renderizar a tab "Perfil"). Retornam arrays vazios.
vi.mock("@/modules/catalog/hooks/useObras", () => ({
  useObras: () => ({ obras: [], isLoading: false }),
}));
vi.mock("@/modules/catalog/hooks/useFonogramas", () => ({
  useFonogramas: () => ({ fonogramas: [], isLoading: false }),
}));
vi.mock("@/modules/releases/hooks/useLancamentos", () => ({
  useLancamentos: () => ({ lancamentos: [], isLoading: false }),
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
  // Navega para a aba "Perfil" onde ficam os cards de plataforma.
  // Radix Tabs trigger usa pointer events; combinamos pointerDown + click.
  const tab = screen.getByRole("tab", { name: /perfil/i });
  await act(async () => {
    fireEvent.pointerDown(tab, { button: 0, ctrlKey: false });
    fireEvent.mouseDown(tab, { button: 0 });
    fireEvent.click(tab);
  });
  // Confirma que a tab "Perfil" foi ativada e as métricas estão visíveis.
  await screen.findByTestId("metric-spotify-art-1");
  return utils;
}

describe("<ArtistVision360Modal /> cards de plataforma na aba Perfil", () => {
  beforeEach(() => {
    vi.mocked(api.get).mockReset();
    vi.mocked(api.post).mockReset();
  });

  it("renderiza traço quando nenhuma URL de plataforma está configurada", async () => {
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

  it("renderiza 'Não sincronizado' quando ha URL mas nenhum snapshot ainda", async () => {
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

  it("renderiza valores reais do snapshot quando o backend ja sincronizou", async () => {
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
