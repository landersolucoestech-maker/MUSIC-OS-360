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

  it("mostra 'Não sincronizado' quando ha URL mas nenhum snapshot ainda", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([]);

    renderMetrics();

    expect(await screen.findByTestId("metric-spotify-artist-1")).toHaveTextContent("Não sincronizado");
    expect(screen.getByTestId("metric-youtube-artist-1")).toHaveTextContent("Não sincronizado");
  });

  it("mostra 'Não configurado' quando nao ha URL cadastrada", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([]);

    renderMetrics({ spotifyUrl: null, youtubeUrl: null });

    expect(await screen.findByTestId("metric-spotify-artist-1")).toHaveTextContent("—");
    expect(screen.getByTestId("metric-youtube-artist-1")).toHaveTextContent("—");
    expect(screen.queryByTestId("button-sync-spotify-artist-1")).not.toBeInTheDocument();
    expect(screen.queryByTestId("button-sync-youtube-artist-1")).not.toBeInTheDocument();
  });

  it("renderiza snapshot success com monthly_listeners como Ouvintes", async () => {
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

  it("nunca usa followers como Ouvintes quando monthly_listeners e nulo", async () => {
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

  it("todas as 7 plataformas de artista sao renderizadas (sem hardcode de 2)", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([]);

    renderMetrics();

    for (const platform of ["instagram", "tiktok", "spotify", "youtube", "deezer", "apple-music", "soundcloud"]) {
      expect(await screen.findByTestId(`metric-${platform}-artist-1`)).toBeInTheDocument();
    }
  });

  it("REGRESSAO: a lista de plataformas nao pode depender dos profiles retornados pela API — as 7 continuam visiveis mesmo so com Spotify/YouTube sincronizados", async () => {
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

    // Nenhum perfil cadastrado para as outras plataformas — apenas platformProfiles com spotify+youtube.
    renderMetrics({
      instagramUrl: null,
      tiktokUrl: null,
      deezerUrl: null,
      appleMusicUrl: null,
      soundcloudUrl: null,
    });

    // As 7 continuam presentes no DOM.
    for (const platform of ["instagram", "tiktok", "spotify", "youtube", "deezer", "apple-music", "soundcloud"]) {
      expect(await screen.findByTestId(`metric-${platform}-artist-1`)).toBeInTheDocument();
    }

    // Spotify e YouTube usam dado real.
    expect(screen.getByTestId("metric-spotify-artist-1")).toHaveTextContent("4.321");
    expect(screen.getByTestId("metric-youtube-artist-1")).toHaveTextContent("5.555");

    // Instagram/TikTok/Apple Music/Deezer/SoundCloud sao todos providers reais com sync via
    // ArtistPlatformProfile — sem perfil (URL) cadastrado o estado e "Nao configurado" (—),
    // igual Spotify/YouTube, nunca "0" nem "Indisponivel" (esse fica reservado para
    // sync success sem métrica, nao para "sem URL configurada").
    for (const platform of ["instagram", "tiktok", "apple-music", "deezer", "soundcloud"]) {
      const el = screen.getByTestId(`metric-${platform}-artist-1`);
      expect(el).toHaveTextContent("—");
      expect(el).not.toHaveTextContent("0");
    }
  });

  it("Deezer usa fas sincronizados (ArtistPlatformProfileEntity) quando disponivel, nao o contador manual", async () => {
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

  it("renderiza pending e failed por plataforma", async () => {
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

  it("botao sync chama endpoint correto e nao quebra tela", async () => {
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

  it("renderiza botoes de sync Spotify e YouTube com type button", async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    renderMetrics();

    expect(await screen.findByTestId("button-sync-spotify-artist-1")).toHaveAttribute("type", "button");
    expect(screen.getByTestId("button-sync-youtube-artist-1")).toHaveAttribute("type", "button");
    expect(screen.getByTestId("button-atualizar-metricas-artist-1")).toHaveAttribute("type", "button");
  });

  it("clique em YouTube chama endpoint com platform youtube", async () => {
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

  it("artistId ausente nao chama endpoint e nao quebra", async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    renderMetrics({ artistId: "" });

    const button = await screen.findByTestId("button-sync-spotify-");
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(api.post).not.toHaveBeenCalled();
  });

  it("erro da mutation libera botao novamente", async () => {
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

  it("sucesso invalida e refaz query de platform profiles", async () => {
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

  it("botao Atualizar dispara sync manual para Spotify e YouTube disponiveis", async () => {
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

  it("nao exige spotifyUrl quando ha spotifyUrl valido", async () => {
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

  it("nao exige youtubeUrl quando ha youtubeUrl valido", async () => {
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

  it("link Spotify invalido bloqueia sync sem chamar endpoint", async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    renderMetrics({ spotifyUrl: "https://open.spotify.com/track/abc" });

    fireEvent.click(await screen.findByTestId("button-sync-spotify-artist-1"));

    expect(api.post).not.toHaveBeenCalled();
  });

  it("link YouTube invalido bloqueia sync sem chamar endpoint", async () => {
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

  // find-eb3c5c45-class REGRESSAO: os formatos que antes divergiam entre o
  // validador do formulário (artista.mapper.ts) e o botão "Sincronizar
  // agora" (ArtistPlatformMetrics) agora usam a MESMA função canônica
  // (normalizeYoutubeProfileUrl) — @handle sozinho, /c/NAME e /user/NAME
  // são aceitos pelo clique real em "Sincronizar agora", não só pela regex
  // isolada do formulário.
  it("YouTube: @handle sozinho e aceito pelo sync real (antes rejeitado pelo botao)", async () => {
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

  it("YouTube: /c/NAME (custom URL legado) e aceito pelo sync real", async () => {
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

  it("YouTube: /user/NAME (legado) e aceito pelo sync real", async () => {
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

  // REGRESSAO (bug reportado "Link do Apple Music inválido" para uma URL
  // corretamente cadastrada): a URL SEM locale (/us/, /br/...) é a própria
  // forma que este normalizador produz e sempre produziu — tem que ser aceita
  // pelo clique real em "Sincronizar agora", não só pela função isolada.
  it("Apple Music: link sem locale (https://music.apple.com/artist/ID) e aceito pelo sync real", async () => {
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

  it("Apple Music: link com locale (https://music.apple.com/us/artist/ID) e aceito pelo sync real", async () => {
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

  it("Apple Music: link invalido bloqueia sync sem chamar endpoint", async () => {
    vi.mocked(api.get).mockResolvedValue([]);

    renderMetrics({ appleMusicUrl: "https://fake-apple.com/us/artist/1543163588" });

    fireEvent.click(await screen.findByTestId("button-sync-apple-music-artist-1"));

    expect(api.post).not.toHaveBeenCalled();
  });

  it("Deezer sincroniza pelo PERFIL PUBLICO do artista (URL), sem exigir OAuth/credencial de organizacao", async () => {
    vi.mocked(api.get).mockResolvedValue([]);
    vi.mocked(api.post).mockResolvedValue({
      artist_id: "artist-1",
      enqueued: [{ platform: "deezer", job_id: "job-4" }],
      skipped: [],
    });

    renderMetrics({ deezerUrl: "https://www.deezer.com/br/artist/27" });

    fireEvent.click(await screen.findByTestId("button-sync-deezer-artist-1"));

    await waitFor(() => {
      // Só o profileUrl do artista viaja no corpo — nenhum accessToken/connectionId
      // de conexão OAuth da organização é enviado.
      expect(api.post).toHaveBeenCalledWith("/artists/artist-1/platform-profiles/deezer/sync", {
        profileUrl: "https://www.deezer.com/artist/27",
        source: "profile_url",
      });
    });
  });

  it("SoundCloud sincroniza pelo PERFIL PUBLICO do artista (URL), sem exigir OAuth/credencial de organizacao", async () => {
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

  it("recupera sozinho de sync_status=pending sem refresh manual (poll até assentar)", async () => {
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

    // Simula o worker BullMQ terminando o job entre o enqueue e o próximo poll:
    // 1ª chamada (fetch inicial) → pending; 2ª chamada (refetchInterval) → success.
    vi.mocked(api.get).mockResolvedValueOnce([pendingSnapshot]).mockResolvedValueOnce([successSnapshot]);

    renderMetrics();

    await waitFor(() => expect(screen.getByTestId("metric-spotify-artist-1")).toHaveTextContent("..."));
    // refetchInterval do hook é 2s — espera o poll assentar sem nenhuma ação manual do teste.
    await waitFor(
      () => expect(screen.getByTestId("metric-spotify-artist-1")).toHaveTextContent("12.345"),
      { timeout: 4000, interval: 100 },
    );
    // Escopado ao endpoint de platform-profiles: o card de sucesso com
    // monthly_listeners agora também dispara GrowthBadge (histórico Fase 2),
    // que chama api.get para /platform-profiles/spotify/history — uma
    // chamada real e esperada, não uma regressão no poll de pending→success.
    const platformProfilesCalls = vi
      .mocked(api.get)
      .mock.calls.filter(([path]) => path === "/artists/artist-1/platform-profiles");
    expect(platformProfilesCalls).toHaveLength(2);
  });

  it("Instagram success: followers=123456 renderiza 123.456 via formatCount", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      baseSnapshot({ platform: "instagram", followers: 123456 }),
    ]);

    renderMetrics({ instagramUrl: INSTAGRAM_URL });

    await waitFor(() => {
      expect(screen.getByTestId("metric-instagram-artist-1")).toHaveTextContent("123.456");
    });
  });

  it("TikTok success: followers=654321 renderiza corretamente", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      baseSnapshot({ platform: "tiktok", followers: 654321 }),
    ]);

    renderMetrics({ tiktokUrl: TIKTOK_URL });

    await waitFor(() => {
      expect(screen.getByTestId("metric-tiktok-artist-1")).toHaveTextContent("654.321");
    });
  });

  it("Instagram failed: mostra Erro, NUNCA cai de volta para contador manual", async () => {
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

  it("TikTok failed: mostra Erro, NUNCA cai de volta para contador manual", async () => {
    vi.mocked(api.get).mockResolvedValueOnce([
      baseSnapshot({ platform: "tiktok", sync_status: "failed", last_error: "Soundcharts: rate limit" }),
    ]);

    renderMetrics({ tiktokUrl: TIKTOK_URL });

    await waitFor(() => {
      expect(screen.getByTestId("metric-tiktok-artist-1")).toHaveTextContent("Erro");
    });
    expect(screen.getByText("Soundcharts: rate limit")).toBeInTheDocument();
  });

  it("Instagram/TikTok success com perfil nao localizado (followers=null): Indisponivel, nao Erro", async () => {
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

  it("Apple Music: mostra Indisponivel, nunca 0, nunca usa playlist_count/apple_music_albuns como audiencia", async () => {
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

  it("YouTube: subscribers e total_views sao ambos renderizados no mesmo card", async () => {
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

  it("apos sync bem-sucedido, o card do Instagram usa o novo ArtistPlatformProfile retornado (refetch)", async () => {
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
  it("platform-sync-retry-race: dois cliques rapidos no mesmo botao de sync disparam so UMA chamada de mutation", async () => {
    vi.mocked(api.post).mockResolvedValue({
      artist_id: "artist-1",
      enqueued: [{ platform: "spotify", job_id: "job-1" }],
      skipped: [],
    });

    // Controla exatamente quando o GET disparado pela invalidação (pós-sync)
    // resolve, para provar que o botão continua desabilitado durante essa
    // janela — não só durante o POST em si.
    let resolveRefetch: (value: unknown[]) => void = () => {};
    vi.mocked(api.get).mockImplementationOnce(() => Promise.resolve([])); // fetch inicial
    vi.mocked(api.get).mockImplementationOnce(
      () => new Promise((resolve) => { resolveRefetch = resolve; }),
    );

    renderMetrics();

    const button = await screen.findByTestId("button-sync-spotify-artist-1");
    fireEvent.click(button);

    // POST já disparou; o refetch invalidado ainda não resolveu — o botão
    // deve permanecer desabilitado durante toda essa janela.
    await waitFor(() => expect(api.post).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(button).toBeDisabled());

    // Segundo clique enquanto o refetch está pendente: não pode disparar um
    // segundo POST — é exatamente a race que o bug descrevia.
    fireEvent.click(button);
    expect(api.post).toHaveBeenCalledTimes(1);

    // Libera o refetch e confirma que o botão volta a habilitar normalmente,
    // sem ter havido nenhum POST extra.
    resolveRefetch([]);
    await waitFor(() => expect(button).not.toBeDisabled());
    expect(api.post).toHaveBeenCalledTimes(1);
  });
});
