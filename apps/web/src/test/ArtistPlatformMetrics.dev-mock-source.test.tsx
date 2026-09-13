import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ArtistPlatformMetrics } from "@/modules/artist/components/ArtistPlatformMetrics";
import { api } from "@/shared/lib/api-client";

vi.mock("@/shared/lib/api-client", () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const INSTAGRAM_URL = "https://www.instagram.com/djstay";
const TIKTOK_URL = "https://www.tiktok.com/@djstay";

function baseSnapshot(overrides: Partial<Record<string, unknown>>) {
  return {
    tenant_id: "tenant-1",
    artist_id: "artist-1",
    external_id: null,
    external_url: null,
    display_name: null,
    username: null,
    profile_url: null,
    image_url: null,
    followers: null,
    subscribers: null,
    monthly_listeners: null,
    popularity: null,
    total_views: null,
    total_videos: null,
    total_tracks: null,
    total_albums: null,
    raw_payload: {},
    sync_status: "success",
    last_synced_at: "2026-06-12T00:00:00Z",
    last_error: null,
    ...overrides,
  };
}

function renderMetrics(overrides: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ArtistPlatformMetrics
        artistId="artist-1"
        instagramUrl={INSTAGRAM_URL}
        tiktokUrl={TIKTOK_URL}
        {...overrides}
      />
    </QueryClientProvider>,
  );
}

/**
 * Item 9/12 da correção: fallback de dev deve ser "claramente identificado",
 * nunca confundido com métrica real da Soundcharts.
 */
describe("ArtistPlatformMetrics — identificação do fallback de dev (raw_payload.source)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("followers real da Soundcharts NÃO mostra rótulo de demonstração", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      baseSnapshot({ platform: "instagram", followers: 180_600, raw_payload: { source: "soundcharts" } }),
    ]);

    renderMetrics();

    await waitFor(() => {
      expect(screen.getByTestId("metric-instagram-artist-1")).toHaveTextContent("180.600");
    });
    expect(screen.getByTestId("metric-instagram-source-artist-1")).toHaveTextContent("Seguidores");
    expect(screen.getByTestId("metric-instagram-source-artist-1")).not.toHaveTextContent("demonstração");
  });

  it("followers do fallback dev_mock mostra rótulo 'dados de demonstração (dev)'", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      baseSnapshot({ platform: "instagram", followers: 42_000, raw_payload: { source: "dev_mock" } }),
    ]);

    renderMetrics();

    await waitFor(() => {
      expect(screen.getByTestId("metric-instagram-artist-1")).toHaveTextContent("42.000");
    });
    expect(screen.getByTestId("metric-instagram-source-artist-1")).toHaveTextContent("dados de demonstração (dev)");
  });

  it("TikTok: mesmo contrato do Instagram para o rótulo de dev_mock", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      baseSnapshot({ platform: "tiktok", followers: 77_000, raw_payload: { source: "dev_mock" } }),
    ]);

    renderMetrics();

    await waitFor(() => {
      expect(screen.getByTestId("metric-tiktok-artist-1")).toHaveTextContent("77.000");
    });
    expect(screen.getByTestId("metric-tiktok-source-artist-1")).toHaveTextContent("dados de demonstração (dev)");
  });

  it("Indisponível (followers null) nunca mostra rótulo de demonstração, mesmo se source=dev_mock por engano", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      baseSnapshot({ platform: "instagram", followers: null, raw_payload: { source: "dev_mock" } }),
    ]);

    renderMetrics();

    await waitFor(() => {
      expect(screen.getByTestId("metric-instagram-artist-1")).toHaveTextContent("Indisponível");
    });
    expect(screen.queryByTestId("metric-instagram-source-artist-1")).not.toBeInTheDocument();
  });
});
