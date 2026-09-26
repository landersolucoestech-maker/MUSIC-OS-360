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
 * Items 9/12 of the fix: the dev fallback must be "clearly identified",
 * never mistaken for a real Soundcharts metric.
 */
describe("ArtistPlatformMetrics — identification of the dev fallback (raw_payload.source)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("real Soundcharts followers do NOT show the demo label", async () => {
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

  it("dev_mock fallback followers show the 'dados de demonstração (dev)' label", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      baseSnapshot({ platform: "instagram", followers: 42_000, raw_payload: { source: "dev_mock" } }),
    ]);

    renderMetrics();

    await waitFor(() => {
      expect(screen.getByTestId("metric-instagram-artist-1")).toHaveTextContent("42.000");
    });
    expect(screen.getByTestId("metric-instagram-source-artist-1")).toHaveTextContent("dados de demonstração (dev)");
  });

  it("TikTok: same contract as Instagram for the dev_mock label", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      baseSnapshot({ platform: "tiktok", followers: 77_000, raw_payload: { source: "dev_mock" } }),
    ]);

    renderMetrics();

    await waitFor(() => {
      expect(screen.getByTestId("metric-tiktok-artist-1")).toHaveTextContent("77.000");
    });
    expect(screen.getByTestId("metric-tiktok-source-artist-1")).toHaveTextContent("dados de demonstração (dev)");
  });

  it("\"Indisponível\" (followers null) never shows the demo label, even if source=dev_mock by mistake", async () => {
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
