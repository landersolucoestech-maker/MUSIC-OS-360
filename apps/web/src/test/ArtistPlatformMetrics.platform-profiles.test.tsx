import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentProps } from "react";
import { ArtistPlatformMetrics } from "@/modules/artist/components/ArtistPlatformMetrics";
import { api } from "@/shared/lib/api-client";

vi.mock("@/shared/lib/api-client", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

type MetricsProps = ComponentProps<typeof ArtistPlatformMetrics>;

const SPOTIFY_ID = "4NHQUGzhtTLFvgF5SZesLK";
const YOUTUBE_ID = "UC_x5XG1OV2P6uZZ5FSM9Ttw";
const SPOTIFY_URL = `https://open.spotify.com/artist/${SPOTIFY_ID}`;
const YOUTUBE_URL = `https://www.youtube.com/channel/${YOUTUBE_ID}`;
const INSTAGRAM_URL = "https://www.instagram.com/djstay";
const TIKTOK_URL = "https://www.tiktok.com/@djstay";
const APPLE_MUSIC_URL = "https://music.apple.com/br/artist/dj-stay/123456";

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

function renderMetrics(overrides: Partial<MetricsProps> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });

  const props: MetricsProps = {
    artistId: "artist-1",
    spotifyUrl: SPOTIFY_URL,
    youtubeUrl: YOUTUBE_URL,
    ...overrides,
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <ArtistPlatformMetrics {...props} />
    </QueryClientProvider>,
  );
}

describe("ArtistPlatformMetrics platform profiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows 'Não sincronizado' when a URL exists but there is no snapshot yet", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([]);

    renderMetrics();

    expect(await screen.findByTestId("metric-spotify-artist-1")).toHaveTextContent("Não sincronizado");
    expect(screen.getByTestId("metric-youtube-artist-1")).toHaveTextContent("Não sincronizado");
  });

  it("shows 'Não configurado' when there is no registered URL", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([]);

    renderMetrics({ spotifyUrl: null, youtubeUrl: null });

    expect(await screen.findByTestId("metric-spotify-artist-1")).toHaveTextContent("—");
    expect(screen.getByTestId("metric-youtube-artist-1")).toHaveTextContent("—");
    expect(screen.queryByTestId("button-sync-spotify-artist-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-sync-youtube-artist-1")).not.toBeInTheDocument();
  });

  it("renders a success snapshot with monthly_listeners as 'Ouvintes'", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      {
        tenant_id: "tenant-1",
        artist_id: "artist-1",
        platform: "spotify",
        external_id: SPOTIFY_ID,
        external_url: null,
        display_name: "Artist",
        username: null,
        profile_url: null,
        image_url: null,
        followers: 9999,
        subscribers: null,
        monthly_listeners: 54321,
        popularity: 77,
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

    renderMetrics();

    await waitFor(() => {
      expect(screen.getByTestId("metric-spotify-artist-1")).toHaveTextContent("54.321");
    });
    const spotifyCard = screen.getByTestId("metric-spotify-artist-1").closest("div.rounded-lg");
    expect(spotifyCard).toHaveTextContent("Ouvintes");
    expect(spotifyCard).not.toHaveTextContent("Seguidores");
  });

  it("never uses followers as 'Ouvintes' when monthly_listeners is null", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      {
        tenant_id: "tenant-1",
        artist_id: "artist-1",
        platform: "spotify",
        external_id: SPOTIFY_ID,
        external_url: null,
        display_name: "Artist",
        username: null,
        profile_url: null,
        image_url: null,
        followers: 9999,
        subscribers: null,
        monthly_listeners: null,
        popularity: 77,
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

    renderMetrics();

    await waitFor(() => {
      expect(screen.getByTestId("metric-spotify-artist-1")).toHaveTextContent("Indisponível");
    });
    expect(screen.getByTestId("metric-spotify-artist-1")).not.toHaveTextContent("9.999");
    const spotifyCard = screen.getByTestId("metric-spotify-artist-1").closest("div.rounded-lg");
    expect(spotifyCard).not.toHaveTextContent("Seguidores");
  });

  it("all 7 artist platforms are rendered (no hardcoding of 2)", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([]);

    renderMetrics();

    for (const platform of ["instagram", "tiktok", "spotify", "youtube", "deezer", "apple-music", "soundcloud"]) {
      expect(await screen.findByTestId(`metric-${platform}-artist-1`)).toBeInTheDocument();
    }
  });

  it("REGRESSION: the platform list must not depend on the profiles returned by the API — all 7 stay visible even with only Spotify/YouTube synced", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      {
        tenant_id: "tenant-1",
        artist_id: "artist-1",
        platform: "spotify",
        external_id: SPOTIFY_ID,
        external_url: null,
        display_name: null,
        username: null,
        profile_url: null,
        image_url: null,
        followers: 9999,
        subscribers: null,
        monthly_listeners: 4321,
        popularity: 77,
        total_views: null,
        total_videos: null,
        total_tracks: null,
        total_albums: null,
        raw_payload: {},
        sync_status: "success",
        last_synced_at: "2026-06-12T00:00:00Z",
        last_error: null,
      },
      {
        tenant_id: "tenant-1",
        artist_id: "artist-1",
        platform: "youtube",
        external_id: YOUTUBE_ID,
        external_url: null,
        display_name: null,
        username: null,
        profile_url: null,
        image_url: null,
        followers: null,
        subscribers: 5555,
        monthly_listeners: null,
        popularity: null,
        total_views: "999",
        total_videos: null,
        total_tracks: null,
        total_albums: null,
        raw_payload: {},
        sync_status: "success",
        last_synced_at: "2026-06-12T00:00:00Z",
        last_error: null,
      },
    ]);

    // No registered profile for the other platforms — only platformProfiles with spotify+youtube.
    renderMetrics({
      instagramUrl: null,
      tiktokUrl: null,
      deezerUrl: null,
      appleMusicUrl: null,
      soundcloudUrl: null,
    });

    // All 7 remain present in the DOM.
    for (const platform of ["instagram", "tiktok", "spotify", "youtube", "deezer", "apple-music", "soundcloud"]) {
      expect(await screen.findByTestId(`metric-${platform}-artist-1`)).toBeInTheDocument();
    }

    // Spotify and YouTube use real data.
    expect(screen.getByTestId("metric-spotify-artist-1")).toHaveTextContent("4.321");
    expect(screen.getByTestId("metric-youtube-artist-1")).toHaveTextContent("5.555");

    // Instagram/TikTok/Apple Music/Deezer/SoundCloud are all real providers with sync via
    // ArtistPlatformProfile — with no registered profile (URL) the state is "Nao configurado" (—),
    // same as Spotify/YouTube, never "0" or "Indisponivel" (that one is reserved for
    // a sync success without a metric, not for "no URL configured").
    for (const platform of ["instagram", "tiktok", "apple-music", "deezer", "soundcloud"]) {
      const el = screen.getByTestId(`metric-${platform}-artist-1`);
      expect(el).toHaveTextContent("—");
      expect(el).not.toHaveTextContent("0");
    }
  });

  it("Deezer uses synced fans (ArtistPlatformProfileEntity) when available, not the manual counter", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      {
        tenant_id: "tenant-1",
        artist_id: "artist-1",
        platform: "deezer",
        external_id: "123",
        external_url: null,
        display_name: null,
        username: null,
        profile_url: null,
        image_url: null,
        followers: 77777,
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
      },
    ]);

    renderMetrics({ deezerUrl: "https://www.deezer.com/artist/123" });

    await waitFor(() => {
      expect(screen.getByTestId("metric-deezer-artist-1")).toHaveTextContent("77.777");
    });
  });

  it("renders pending and failed states per platform", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      {
        tenant_id: "tenant-1",
        artist_id: "artist-1",
        platform: "spotify",
        external_id: SPOTIFY_ID,
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
        sync_status: "pending",
        last_synced_at: null,
        last_error: null,
      },
      {
        tenant_id: "tenant-1",
        artist_id: "artist-1",
        platform: "youtube",
        external_id: YOUTUBE_ID,
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
        sync_status: "failed",
        last_synced_at: "2026-06-12T00:00:00Z",
        last_error: "YouTube API error: 403",
      },
    ]);

    renderMetrics();

    await waitFor(() => {
      expect(screen.getByTestId("metric-spotify-artist-1")).toHaveTextContent("...");
      expect(screen.getByTestId("metric-youtube-artist-1")).toHaveTextContent("Erro");
      expect(screen.getByText("YouTube API error: 403")).toBeInTheDocument();
    });
  });

  it("sync button calls the correct endpoint and does not break the screen", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    vi.mocked(api.post).mockResolvedValue({
      artist_id: "artist-1",
      enqueued: [{ platform: "spotify", job_id: "job-1" }],
      skipped: [],
    });

    renderMetrics();

    const button = await screen.findByTestId("button-sync-spotify-artist-1");
    fireEvent.click(button);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/artists/artist-1/platform-profiles/spotify/sync", {
        profileUrl: SPOTIFY_URL,
        source: "profile_url",
      });
    });
  });

  it("renders Spotify and YouTube sync buttons with type button", async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    renderMetrics();

    expect(await screen.findByTestId("button-sync-spotify-artist-1")).toHaveAttribute("type", "button");
    expect(screen.getByTestId("button-sync-youtube-artist-1")).toHaveAttribute("type", "button");
    expect(screen.getByTestId("button-atualizar-metricas-artist-1")).toHaveAttribute("type", "button");
  });

  it("clicking YouTube calls the endpoint with platform youtube", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    vi.mocked(api.post).mockResolvedValue({
      artist_id: "artist-1",
      enqueued: [{ platform: "youtube", job_id: "job-2" }],
      skipped: [],
    });

    renderMetrics();

    fireEvent.click(await screen.findByTestId("button-sync-youtube-artist-1"));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/artists/artist-1/platform-profiles/youtube/sync", {
        profileUrl: YOUTUBE_URL,
        source: "profile_url",
      });
    });
  });

  it("missing artistId does not call the endpoint and does not break", async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    renderMetrics({ artistId: "" });

    const button = await screen.findByTestId("button-sync-spotify-");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(api.post).not.toHaveBeenCalled();
  });

  it("mutation error re-enables the button", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    let rejectPost: (reason?: unknown) => void = () => {};
    vi.mocked(api.post).mockImplementationOnce(
      () => new Promise<never>((_, reject) => { rejectPost = reject; }),
    );

    renderMetrics();

    const button = await screen.findByTestId("button-sync-spotify-artist-1");
    fireEvent.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    rejectPost(new Error("Falha externa"));
    await waitFor(() => expect(button).not.toBeDisabled());
  });

  it("success invalidates and reruns the platform profiles query", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    vi.mocked(api.post).mockResolvedValue({
      artist_id: "artist-1",
      enqueued: [{ platform: "spotify", job_id: "job-1" }],
      skipped: [],
    });

    renderMetrics();

    fireEvent.click(await screen.findByTestId("button-sync-spotify-artist-1"));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/artists/artist-1/platform-profiles/spotify/sync", {
        profileUrl: SPOTIFY_URL,
        source: "profile_url",
      });
      expect(api.get).toHaveBeenCalledWith("/artists/artist-1/platform-profiles");
      expect(api.get).toHaveBeenCalledTimes(2);
    });
  });

  it("'Atualizar' button triggers manual sync for available Spotify and YouTube", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    vi.mocked(api.post).mockResolvedValue({
      artist_id: "artist-1",
      enqueued: [{ platform: "spotify", job_id: "job-1" }],
      skipped: [],
    });

    renderMetrics();

    const atualizarButton = await screen.findByTestId("button-atualizar-metricas-artist-1");
    await waitFor(() => expect(atualizarButton).not.toBeDisabled());
    fireEvent.click(atualizarButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/artists/artist-1/platform-profiles/spotify/sync", {
        profileUrl: SPOTIFY_URL,
        source: "profile_url",
      });
      expect(api.post).toHaveBeenCalledWith("/artists/artist-1/platform-profiles/youtube/sync", {
        profileUrl: YOUTUBE_URL,
        source: "profile_url",
      });
    });
  });

  it("does not require spotifyUrl when a valid spotifyUrl exists", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    vi.mocked(api.post).mockResolvedValue({
      artist_id: "artist-1",
      enqueued: [{ platform: "spotify", job_id: "job-1" }],
      skipped: [],
    });

    renderMetrics({ spotifyUrl: SPOTIFY_URL });

    fireEvent.click(await screen.findByTestId("button-sync-spotify-artist-1"));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/artists/artist-1/platform-profiles/spotify/sync", {
        profileUrl: SPOTIFY_URL,
        source: "profile_url",
      });
    });
  });

  it("does not require youtubeUrl when a valid youtubeUrl exists", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    vi.mocked(api.post).mockResolvedValue({
      artist_id: "artist-1",
      enqueued: [{ platform: "youtube", job_id: "job-2" }],
      skipped: [],
    });

    renderMetrics({ youtubeUrl: YOUTUBE_URL });

    fireEvent.click(await screen.findByTestId("button-sync-youtube-artist-1"));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/artists/artist-1/platform-profiles/youtube/sync", {
        profileUrl: YOUTUBE_URL,
        source: "profile_url",
      });
    });
  });

  it("invalid Spotify link blocks sync without calling the endpoint", async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    renderMetrics({ spotifyUrl: "https://open.spotify.com/track/abc" });

    fireEvent.click(await screen.findByTestId("button-sync-spotify-artist-1"));

    expect(api.post).not.toHaveBeenCalled();
  });

  it("invalid YouTube link blocks sync without calling the endpoint", async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    // find-eb3c5c45-class: /@handle is now a VALID YouTube reference (the
    // canonical parser accepts it, same as the backend) — a genuinely
    // invalid link is a multi-segment non-channel path (a single-segment
    // path like /watch is treated as a legacy custom-URL name, same as
    // the backend's own parser).
    renderMetrics({ youtubeUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ/nested" });

    fireEvent.click(await screen.findByTestId("button-sync-youtube-artist-1"));

    expect(api.post).not.toHaveBeenCalled();
  });

  // find-eb3c5c45-class REGRESSION: the formats that used to diverge between
  // the form validator (artista.mapper.ts) and the "Sincronizar agora"
  // button (ArtistPlatformMetrics) now use the SAME canonical function
  // (normalizeYoutubeProfileUrl) — a bare @handle, /c/NAME and /user/NAME
  // are accepted by the real click on "Sincronizar agora", not just by the
  // form's isolated regex.
  it("YouTube: a bare @handle is accepted by the real sync (previously rejected by the button)", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    vi.mocked(api.post).mockResolvedValue({
      artist_id: "artist-1",
      enqueued: [{ platform: "youtube", job_id: "job-8" }],
      skipped: [],
    });

    renderMetrics({ youtubeUrl: "https://youtube.com/@artistname" });

    fireEvent.click(await screen.findByTestId("button-sync-youtube-artist-1"));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/artists/artist-1/platform-profiles/youtube/sync", {
        profileUrl: "https://youtube.com/@artistname",
        source: "profile_url",
      });
    });
  });

  it("YouTube: /c/NAME (legacy custom URL) is accepted by the real sync", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    vi.mocked(api.post).mockResolvedValue({
      artist_id: "artist-1",
      enqueued: [{ platform: "youtube", job_id: "job-9" }],
      skipped: [],
    });

    renderMetrics({ youtubeUrl: "https://www.youtube.com/c/artistname" });

    fireEvent.click(await screen.findByTestId("button-sync-youtube-artist-1"));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/artists/artist-1/platform-profiles/youtube/sync", {
        profileUrl: "https://www.youtube.com/c/artistname",
        source: "profile_url",
      });
    });
  });

  it("YouTube: /user/NAME (legacy) is accepted by the real sync", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    vi.mocked(api.post).mockResolvedValue({
      artist_id: "artist-1",
      enqueued: [{ platform: "youtube", job_id: "job-10" }],
      skipped: [],
    });

    renderMetrics({ youtubeUrl: "https://www.youtube.com/user/artistname" });

    fireEvent.click(await screen.findByTestId("button-sync-youtube-artist-1"));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/artists/artist-1/platform-profiles/youtube/sync", {
        profileUrl: "https://www.youtube.com/user/artistname",
        source: "profile_url",
      });
    });
  });

  // REGRESSION (bug reported as "Link do Apple Music inválido" for a
  // correctly registered URL): the URL WITHOUT a locale (/us/, /br/...) is
  // the exact form this normalizer produces and always produced — it must be
  // accepted by the real click on "Sincronizar agora", not just by the
  // isolated function.
  it("Apple Music: link without a locale (https://music.apple.com/artist/ID) is accepted by the real sync", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    vi.mocked(api.post).mockResolvedValue({
      artist_id: "artist-1",
      enqueued: [{ platform: "apple-music", job_id: "job-6" }],
      skipped: [],
    });

    renderMetrics({ appleMusicUrl: "https://music.apple.com/artist/1543163588" });

    fireEvent.click(await screen.findByTestId("button-sync-apple-music-artist-1"));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/artists/artist-1/platform-profiles/apple-music/sync", {
        profileUrl: "https://music.apple.com/artist/1543163588",
        source: "profile_url",
      });
    });
  });

  it("Apple Music: link with a locale (https://music.apple.com/us/artist/ID) is accepted by the real sync", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    vi.mocked(api.post).mockResolvedValue({
      artist_id: "artist-1",
      enqueued: [{ platform: "apple-music", job_id: "job-7" }],
      skipped: [],
    });

    renderMetrics({ appleMusicUrl: "https://music.apple.com/us/artist/1543163588" });

    fireEvent.click(await screen.findByTestId("button-sync-apple-music-artist-1"));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/artists/artist-1/platform-profiles/apple-music/sync", {
        profileUrl: "https://music.apple.com/artist/1543163588",
        source: "profile_url",
      });
    });
  });

  it("Apple Music: invalid link blocks sync without calling the endpoint", async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    renderMetrics({ appleMusicUrl: "https://fake-apple.com/us/artist/1543163588" });

    fireEvent.click(await screen.findByTestId("button-sync-apple-music-artist-1"));

    expect(api.post).not.toHaveBeenCalled();
  });

  it("Deezer syncs via the artist's PUBLIC PROFILE (URL), without requiring an organization OAuth/credential", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    vi.mocked(api.post).mockResolvedValue({
      artist_id: "artist-1",
      enqueued: [{ platform: "deezer", job_id: "job-4" }],
      skipped: [],
    });

    renderMetrics({ deezerUrl: "https://www.deezer.com/br/artist/27" });

    fireEvent.click(await screen.findByTestId("button-sync-deezer-artist-1"));

    await waitFor(() => {
      // Only the artist's profileUrl travels in the body — no organization
      // OAuth connection accessToken/connectionId is sent.
      expect(api.post).toHaveBeenCalledWith("/artists/artist-1/platform-profiles/deezer/sync", {
        profileUrl: "https://www.deezer.com/artist/27",
        source: "profile_url",
      });
    });
  });

  it("SoundCloud syncs via the artist's PUBLIC PROFILE (URL), without requiring an organization OAuth/credential", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    vi.mocked(api.post).mockResolvedValue({
      artist_id: "artist-1",
      enqueued: [{ platform: "soundcloud", job_id: "job-5" }],
      skipped: [],
    });

    renderMetrics({ soundcloudUrl: "https://soundcloud.com/artist-handle" });

    fireEvent.click(await screen.findByTestId("button-sync-soundcloud-artist-1"));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/artists/artist-1/platform-profiles/soundcloud/sync", {
        profileUrl: "https://soundcloud.com/artist-handle",
        source: "profile_url",
      });
    });
  });

  it("recovers on its own from sync_status=pending without a manual refresh (polls until it settles)", async () => {
    const pendingSnapshot = {
      tenant_id: "tenant-1",
      artist_id: "artist-1",
      platform: "spotify",
      external_id: SPOTIFY_ID,
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
      sync_status: "pending",
      last_synced_at: null,
      last_error: null,
    };
    const successSnapshot = { ...pendingSnapshot, sync_status: "success", monthly_listeners: 12345, last_synced_at: "2026-06-12T00:00:00Z" };

    // Simulates the BullMQ worker finishing the job between the enqueue and the next poll:
    // 1st call (initial fetch) → pending; 2nd call (refetchInterval) → success.
    vi.mocked(api.get).mockResolvedValueOnce([pendingSnapshot]).mockResolvedValueOnce([successSnapshot]);

    renderMetrics();

    await waitFor(() => expect(screen.getByTestId("metric-spotify-artist-1")).toHaveTextContent("..."));
    // the hook's refetchInterval is 2s — waits for the poll to settle without any manual test action.
    await waitFor(
      () => expect(screen.getByTestId("metric-spotify-artist-1")).toHaveTextContent("12.345"),
      { timeout: 4000, interval: 100 },
    );
    // Scoped to the platform-profiles endpoint: the success card with
    // monthly_listeners now also triggers GrowthBadge (Phase 2 history),
    // which calls api.get for /platform-profiles/spotify/history — a real,
    // expected call, not a regression in the pending→success poll.
    const platformProfilesCalls = vi
      .mocked(api.get)
      .mock.calls.filter(([path]) => path === "/artists/artist-1/platform-profiles");
    expect(platformProfilesCalls).toHaveLength(2);
  });

  it("Instagram success: followers=123456 renders 123.456 via formatCount", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      baseSnapshot({ platform: "instagram", followers: 123456 }),
    ]);

    renderMetrics({ instagramUrl: INSTAGRAM_URL });

    await waitFor(() => {
      expect(screen.getByTestId("metric-instagram-artist-1")).toHaveTextContent("123.456");
    });
  });

  it("TikTok success: followers=654321 renders correctly", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      baseSnapshot({ platform: "tiktok", followers: 654321 }),
    ]);

    renderMetrics({ tiktokUrl: TIKTOK_URL });

    await waitFor(() => {
      expect(screen.getByTestId("metric-tiktok-artist-1")).toHaveTextContent("654.321");
    });
  });

  it("Instagram failed: shows 'Erro', NEVER falls back to the manual counter", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      baseSnapshot({ platform: "instagram", sync_status: "failed", last_error: "Soundcharts: rate limit" }),
    ]);

    renderMetrics({ instagramUrl: INSTAGRAM_URL });

    await waitFor(() => {
      expect(screen.getByTestId("metric-instagram-artist-1")).toHaveTextContent("Erro");
    });
    expect(screen.getByText("Soundcharts: rate limit")).toBeInTheDocument();
    expect(screen.getByTestId("metric-instagram-artist-1")).not.toHaveTextContent("Indisponível");
  });

  it("TikTok failed: shows 'Erro', NEVER falls back to the manual counter", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      baseSnapshot({ platform: "tiktok", sync_status: "failed", last_error: "Soundcharts: rate limit" }),
    ]);

    renderMetrics({ tiktokUrl: TIKTOK_URL });

    await waitFor(() => {
      expect(screen.getByTestId("metric-tiktok-artist-1")).toHaveTextContent("Erro");
    });
    expect(screen.getByText("Soundcharts: rate limit")).toBeInTheDocument();
  });

  it("Instagram/TikTok success with a profile that wasn't found (followers=null): 'Indisponivel', not 'Erro'", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      baseSnapshot({ platform: "instagram", followers: null }),
      baseSnapshot({ platform: "tiktok", followers: null }),
    ]);

    renderMetrics({ instagramUrl: INSTAGRAM_URL, tiktokUrl: TIKTOK_URL });

    await waitFor(() => {
      expect(screen.getByTestId("metric-instagram-artist-1")).toHaveTextContent("Indisponível");
      expect(screen.getByTestId("metric-tiktok-artist-1")).toHaveTextContent("Indisponível");
    });
  });

  it("Apple Music: shows 'Indisponivel', never 0, never uses playlist_count/apple_music_albuns as audience", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      baseSnapshot({ platform: "apple-music", raw_payload: { soundcharts_uuid: "u1", playlist_count: 734 } }),
    ]);

    renderMetrics({ appleMusicUrl: APPLE_MUSIC_URL });

    await waitFor(() => {
      const el = screen.getByTestId("metric-apple-music-artist-1");
      expect(el).toHaveTextContent("Indisponível");
      expect(el).not.toHaveTextContent("734");
      expect(el).not.toHaveTextContent(/(^|\D)0(\D|$)/);
    });
  });

  it("YouTube: subscribers and total_views are both rendered in the same card", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      baseSnapshot({ platform: "youtube", subscribers: 15400, total_views: "123456789" }),
    ]);

    renderMetrics();

    await waitFor(() => {
      const el = screen.getByTestId("metric-youtube-artist-1");
      expect(el).toHaveTextContent("15.400");
    });
    const youtubeCard = screen.getByTestId("metric-youtube-artist-1").closest("div.rounded-lg");
    expect(youtubeCard).toHaveTextContent("123.456.789");
  });

  it("after a successful sync, the Instagram card uses the new ArtistPlatformProfile returned (refetch)", async () => {
    vi.mocked(api.get)
      .mockResolvedValueOnce([baseSnapshot({ platform: "instagram", sync_status: "pending", followers: null })])
      .mockResolvedValueOnce([baseSnapshot({ platform: "instagram", sync_status: "success", followers: 4242 })]);

    renderMetrics({ instagramUrl: INSTAGRAM_URL });

    await waitFor(() => expect(screen.getByTestId("metric-instagram-artist-1")).toHaveTextContent("..."));
    await waitFor(
      () => expect(screen.getByTestId("metric-instagram-artist-1")).toHaveTextContent("4.242"),
      { timeout: 4000, interval: 100 },
    );
  });

  // platform-sync-retry-race: onSuccess now awaits the invalidated refetch
  // before the mutation resolves, so `isPending` (and the disabled button)
  // stays true for the whole window where the cache still shows the stale
  // sync_status — a second rapid click on the same platform's button during
  // that window must NOT fire a second POST /sync.
  it("platform-sync-retry-race: two quick clicks on the same sync button fire only ONE mutation call", async () => {
    vi.mocked(api.post).mockResolvedValue({
      artist_id: "artist-1",
      enqueued: [{ platform: "spotify", job_id: "job-1" }],
      skipped: [],
    });

    // Controls exactly when the GET fired by the (post-sync) invalidation
    // resolves, to prove the button stays disabled during that
    // window — not only during the POST itself.
    let resolveRefetch: (value: unknown[]) => void = () => {};
    vi.mocked(api.get).mockImplementationOnce(() => Promise.resolve([])); // fetch inicial
    vi.mocked(api.get).mockImplementationOnce(
      () => new Promise((resolve) => { resolveRefetch = resolve; }),
    );

    renderMetrics();

    const button = await screen.findByTestId("button-sync-spotify-artist-1");
    fireEvent.click(button);

    // The POST already fired; the invalidated refetch has not resolved yet — the button
    // must stay disabled during that whole window.
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(button).toBeDisabled());

    // Second click while the refetch is pending: it must not fire a
    // second POST — this is exactly the race the bug described.
    fireEvent.click(button);
    expect(api.post).toHaveBeenCalledTimes(1);

    // Releases the refetch and confirms the button becomes enabled again normally,
    // without any extra POST.
    resolveRefetch([]);
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(api.post).toHaveBeenCalledTimes(1);
  });
});
