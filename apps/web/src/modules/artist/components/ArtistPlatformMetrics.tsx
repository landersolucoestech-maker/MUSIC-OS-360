import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { SiApplemusic, SiSoundcloud, SiInstagram, SiTiktok, SiSpotify, SiYoutube } from "react-icons/si";
import { DeezerIcon } from "@/shared/ui/deezer-icon";
import { Button } from "@/shared/ui/button";
import { primaryMetricFor } from "@/modules/artist/metrics/platform-metric-capabilities";
import { normalizeYoutubeProfileUrl } from "@/modules/artist/services/artist.mapper";
import {
  useArtistPlatformProfiles,
  useSyncArtistPlatformProfile,
  type ArtistPlatformProfileSnapshot,
  type SocialPlatform,
} from "@/modules/artist/hooks/useArtistPlatformProfiles";
import { toast } from "sonner";

interface ArtistPlatformMetricsProps {
  artistId: string;
  spotifyUrl?: string | null;
  youtubeUrl?: string | null;
  instagramUrl?: string | null;
  tiktokUrl?: string | null;
  deezerUrl?: string | null;
  appleMusicUrl?: string | null;
  soundcloudUrl?: string | null;
}

const numberFormatter = new Intl.NumberFormat("pt-BR");

function formatCount(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "N/D";
  const num = typeof value === "string" ? Number(value) : value;
  if (!Number.isFinite(num)) return "N/D";
  return numberFormatter.format(num);
}

function normalizeSpotifyProfileUrl(input: string | null | undefined): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;
  if (/^[A-Za-z0-9]{22}$/.test(value)) return `https://open.spotify.com/artist/${value}`;
  const match = value.match(/^https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?artist\/([A-Za-z0-9]{22})(?:[/?#].*)?$/i);
  return match?.[1] ? `https://open.spotify.com/artist/${match[1]}` : null;
}

// find-eb3c5c45-class: YouTube parsing lives in artist.mapper.ts's
// `normalizeYoutubeProfileUrl`/`parseYoutubeRef` — the one canonical
// implementation shared with the form validator — imported above instead
// of a second, narrower hand-rolled regex here.

/** API pública do Deezer — só exige um artist id/URL, sem OAuth. */
function normalizeDeezerProfileUrl(input: string | null | undefined): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) return `https://www.deezer.com/artist/${value}`;
  const match = value.match(/deezer\.com\/(?:[a-z]{2}\/)?artist\/(\d+)/i);
  return match?.[1] ? `https://www.deezer.com/artist/${match[1]}` : null;
}

/** SoundCloud /resolve — só exige client_id de app, sem login do artista/tenant. */
function normalizeSoundCloudProfileUrl(input: string | null | undefined): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;
  if (/^[A-Za-z0-9_-]+$/.test(value)) return `https://soundcloud.com/${value}`;
  const match = value.match(/^https?:\/\/(?:www\.|m\.)?soundcloud\.com\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/i);
  return match?.[1] ? `https://soundcloud.com/${match[1]}` : null;
}

// Espelham exatamente extractInstagramUsername/extractTikTokUsername/extractAppleMusicId
// em artist-external-profile-sync.service.ts (backend) — mesmo formato de URL canônica.
function normalizeInstagramProfileUrl(input: string | null | undefined): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;
  if (/^[A-Za-z0-9._]{1,30}$/.test(value)) return `https://www.instagram.com/${value}`;
  const match = value.match(/^https?:\/\/(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#].*)?$/i);
  return match?.[1] ? `https://www.instagram.com/${match[1]}` : null;
}

function normalizeTikTokProfileUrl(input: string | null | undefined): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;
  const bare = value.replace(/^@/, "");
  if (/^[A-Za-z0-9._]{1,24}$/.test(bare)) return `https://www.tiktok.com/@${bare}`;
  const match = value.match(/^https?:\/\/(?:www\.)?tiktok\.com\/@([A-Za-z0-9._]{1,24})\/?(?:[?#].*)?$/i);
  return match?.[1] ? `https://www.tiktok.com/@${match[1]}` : null;
}

// Contrato canônico Apple Music (Métricas Fase 1 — corrige bug reportado
// "Link do Apple Music inválido" para uma URL corretamente cadastrada):
// o segmento de locale de 2 letras (/us/, /br/...) É OPCIONAL — a Apple Music
// aceita URLs com e sem ele, e este normalizador sempre produzia a forma SEM
// locale, enquanto o extractor espelhado no backend
// (artist-external-profile-sync.service.ts extractAppleMusicId) exigia o
// locale como obrigatório. Os dois regexes têm que aceitar exatamente o
// mesmo conjunto de URLs — se um mudar, o outro precisa mudar junto.
const APPLE_MUSIC_URL_PATTERN = /^https?:\/\/(?:www\.|music\.)?apple\.com\/(?:[a-z]{2}\/)?artist\/(?:[^/?#]+\/)?(\d+)(?:[/?#].*)?$/i;

function normalizeAppleMusicProfileUrl(input: string | null | undefined): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) return `https://music.apple.com/artist/${value}`;
  const match = value.match(APPLE_MUSIC_URL_PATTERN);
  return match?.[1] ? `https://music.apple.com/artist/${match[1]}` : null;
}

/**
 * `true` quando o snapshot veio do fallback de demonstração de dev/local
 * (dev-social-metrics-mock.ts no backend), nunca de produção — usado só
 * para rotular o valor como "dados de demonstração" e nunca confundi-lo
 * com métrica real da Soundcharts.
 */
function isDevMockSnapshot(snapshot: ArtistPlatformProfileSnapshot | null): boolean {
  return snapshot?.raw_payload?.["source"] === "dev_mock";
}

/**
 * Estados comuns aos cards com sync real (perfil público do artista →
 * provider → ArtistPlatformProfileEntity). Sem perfil cadastrado é
 * "Não configurado"; com perfil mas sem sync ainda é "Não sincronizado" —
 * nenhum dos dois vira "0" ou é escondido.
 */
function renderSyncState(
  testId: string,
  hasProfileInput: boolean,
  snapshot: ArtistPlatformProfileSnapshot | null,
  successNode: ReactNode,
): ReactNode {
  if (!hasProfileInput) {
    return (
      <>
        <p className="text-sm font-bold text-foreground" data-testid={testId}>—</p>
        <p className="text-[10px] text-muted-foreground">Não configurado</p>
      </>
    );
  }
  if (snapshot?.sync_status === "pending") {
    return (
      <>
        <p className="text-sm font-bold text-foreground animate-pulse" data-testid={testId}>...</p>
        <p className="text-[10px] text-muted-foreground">Sincronizando</p>
      </>
    );
  }
  if (snapshot?.sync_status === "failed") {
    return (
      <>
        <p className="text-sm font-semibold text-foreground" data-testid={testId}>Erro</p>
        <p className="text-xs text-muted-foreground truncate">{snapshot.last_error ?? "Falha na sincronização"}</p>
      </>
    );
  }
  if (snapshot?.sync_status === "success") {
    return successNode;
  }
  return (
    <>
      <p className="text-sm font-semibold text-foreground" data-testid={testId}>Não sincronizado</p>
      <p className="text-[10px] text-muted-foreground">Clique em "Sincronizar agora"</p>
    </>
  );
}

export function ArtistPlatformMetrics({
  artistId,
  spotifyUrl,
  youtubeUrl,
  instagramUrl,
  tiktokUrl,
  deezerUrl,
  appleMusicUrl,
  soundcloudUrl,
}: ArtistPlatformMetricsProps) {
  const qc = useQueryClient();
  const platformProfiles = useArtistPlatformProfiles(artistId);
  const syncPlatformProfile = useSyncArtistPlatformProfile(artistId);

  const snapshots = platformProfiles.data ?? [];
  const spotifySnapshot = snapshots.find((profile) => profile.platform === "spotify") ?? null;
  const youtubeSnapshot = snapshots.find((profile) => profile.platform === "youtube") ?? null;
  const deezerSnapshot = snapshots.find((profile) => profile.platform === "deezer") ?? null;
  const soundcloudSnapshot = snapshots.find((profile) => profile.platform === "soundcloud") ?? null;
  const instagramSnapshot = snapshots.find((profile) => profile.platform === "instagram") ?? null;
  const tiktokSnapshot = snapshots.find((profile) => profile.platform === "tiktok") ?? null;
  const appleMusicSnapshot = snapshots.find((profile) => profile.platform === "apple-music") ?? null;

  // Métrica principal por plataforma, resolvida via registro de capacidades
  // (metrics/platform-metric-capabilities.ts) em vez de campo hardcoded.
  const instagramMetric = primaryMetricFor("instagram", instagramSnapshot);
  const tiktokMetric = primaryMetricFor("tiktok", tiktokSnapshot);
  const spotifyMetric = primaryMetricFor("spotify", spotifySnapshot);
  const youtubeMetric = primaryMetricFor("youtube", youtubeSnapshot);
  const deezerMetric = primaryMetricFor("deezer", deezerSnapshot);
  const soundcloudMetric = primaryMetricFor("soundcloud", soundcloudSnapshot);

  const spotifyProfileInput = (spotifyUrl ?? "").trim();
  const youtubeProfileInput = (youtubeUrl ?? "").trim();
  const deezerProfileInput = (deezerUrl ?? "").trim();
  const soundcloudProfileInput = (soundcloudUrl ?? "").trim();
  const instagramProfileInput = (instagramUrl ?? "").trim();
  const tiktokProfileInput = (tiktokUrl ?? "").trim();
  const appleMusicProfileInput = (appleMusicUrl ?? "").trim();
  const spotifyProfileUrl = normalizeSpotifyProfileUrl(spotifyProfileInput);
  const youtubeProfileUrl = normalizeYoutubeProfileUrl(youtubeProfileInput);
  const deezerProfileUrl = normalizeDeezerProfileUrl(deezerProfileInput);
  const soundcloudProfileUrl = normalizeSoundCloudProfileUrl(soundcloudProfileInput);
  const instagramProfileUrl = normalizeInstagramProfileUrl(instagramProfileInput);
  const tiktokProfileUrl = normalizeTikTokProfileUrl(tiktokProfileInput);
  const appleMusicProfileUrl = normalizeAppleMusicProfileUrl(appleMusicProfileInput);
  const hasSpotifyProfileInput = spotifyProfileInput.length > 0;
  const hasYouTubeProfileInput = youtubeProfileInput.length > 0;
  const hasDeezerProfileInput = deezerProfileInput.length > 0;
  const hasSoundCloudProfileInput = soundcloudProfileInput.length > 0;
  const hasInstagramProfileInput = instagramProfileInput.length > 0;
  const hasTikTokProfileInput = tiktokProfileInput.length > 0;
  const hasAppleMusicProfileInput = appleMusicProfileInput.length > 0;
  const hasAnyProfileInput =
    hasSpotifyProfileInput ||
    hasYouTubeProfileInput ||
    hasDeezerProfileInput ||
    hasSoundCloudProfileInput ||
    hasInstagramProfileInput ||
    hasTikTokProfileInput ||
    hasAppleMusicProfileInput;

  const enqueueProfileSync = (platform: SocialPlatform, profileUrl: string) => {
    syncPlatformProfile.mutate({ platform, profileUrl, source: "profile_url" });
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["artists", artistId, "platform-profiles"] });
    let dispatched = false;
    const attempts: Array<[SocialPlatform, string | null, ArtistPlatformProfileSnapshot | null]> = [
      ["spotify", spotifyProfileUrl, spotifySnapshot],
      ["youtube", youtubeProfileUrl, youtubeSnapshot],
      ["deezer", deezerProfileUrl, deezerSnapshot],
      ["soundcloud", soundcloudProfileUrl, soundcloudSnapshot],
      ["instagram", instagramProfileUrl, instagramSnapshot],
      ["tiktok", tiktokProfileUrl, tiktokSnapshot],
      ["apple-music", appleMusicProfileUrl, appleMusicSnapshot],
    ];
    for (const [platform, profileUrl, snapshot] of attempts) {
      if (artistId && profileUrl && snapshot?.sync_status !== "pending") {
        enqueueProfileSync(platform, profileUrl);
        dispatched = true;
      }
    }
    if (!dispatched && hasAnyProfileInput) {
      toast.error("Nenhum link válido de plataforma para sincronizar.");
    }
  };

  const profileUrlFor: Record<SocialPlatform, string | null> = {
    spotify: spotifyProfileUrl,
    youtube: youtubeProfileUrl,
    deezer: deezerProfileUrl,
    soundcloud: soundcloudProfileUrl,
    instagram: instagramProfileUrl,
    tiktok: tiktokProfileUrl,
    "apple-music": appleMusicProfileUrl,
  };
  const invalidLinkMessage: Record<SocialPlatform, string> = {
    spotify: "Link do Spotify inválido.",
    youtube: "Link do YouTube inválido.",
    deezer: "Link do Deezer inválido.",
    soundcloud: "Link do SoundCloud inválido.",
    instagram: "Link do Instagram inválido.",
    tiktok: "Link do TikTok inválido.",
    "apple-music": "Link do Apple Music inválido.",
  };

  const syncNow = (platform: SocialPlatform) => {
    const profileUrl = profileUrlFor[platform];
    if (!profileUrl) {
      toast.error(invalidLinkMessage[platform]);
      return;
    }
    enqueueProfileSync(platform, profileUrl);
  };

  const isFetching = platformProfiles.isFetching;

  const syncButton = (platform: SocialPlatform, snapshot: ArtistPlatformProfileSnapshot | null) => (
    <Button
      variant="ghost"
      size="sm"
      type="button"
      className="mt-2 h-6 w-full px-1 text-[10px]"
      onClick={() => syncNow(platform)}
      disabled={!artistId || syncPlatformProfile.isPending || snapshot?.sync_status === "pending"}
      data-testid={`button-sync-${platform}-${artistId}`}
    >
      <RefreshCw className={`h-3 w-3 ${syncPlatformProfile.isPending ? "animate-spin" : ""}`} />
      Sincronizar agora
    </Button>
  );

  return (
    <div className="border border-t-0 rounded-b-lg bg-card p-4 -mt-1">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-foreground">Métricas de Plataformas</p>
        <Button
          variant="ghost"
          size="sm"
          type="button"
          className="text-muted-foreground gap-1 h-7"
          onClick={refresh}
          disabled={isFetching || syncPlatformProfile.isPending || !hasAnyProfileInput}
          data-testid={`button-atualizar-metricas-${artistId}`}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching || syncPlatformProfile.isPending ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>
      {platformProfiles.isError ? (
        <p className="mb-2 text-xs text-destructive" data-testid={`metrics-load-error-${artistId}`}>
          Falha ao carregar métricas de plataformas. Tente novamente em instantes.
        </p>
      ) : null}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {/* Instagram — Soundcharts /audience/instagram (UUID canônico via spotify→youtube→
            deezer→soundcloud→handle). success+followers=null é "Indisponível" (Soundcharts
            não tem conta social vinculada para este artista) — nunca o contador manual
            legado (metadata.instagram_seguidores) como fallback. */}
        <div className="rounded-lg border border-border bg-card p-2">
          <div className="flex items-center gap-1 mb-1">
            <SiInstagram className="h-3 w-3 text-foreground" />
            <span className="text-[10px] text-foreground font-medium">Instagram</span>
          </div>
          {renderSyncState(
            `metric-instagram-${artistId}`,
            hasInstagramProfileInput,
            instagramSnapshot,
            instagramMetric?.value != null ? (
              <>
                <p className="text-sm font-bold text-foreground" data-testid={`metric-instagram-${artistId}`}>
                  {formatCount(instagramMetric.value)}
                </p>
                <p className="text-[10px] text-muted-foreground" data-testid={`metric-instagram-source-${artistId}`}>
                  Seguidores{isDevMockSnapshot(instagramSnapshot) ? " · dados de demonstração (dev)" : ""}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-foreground" data-testid={`metric-instagram-${artistId}`}>
                  Indisponível
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Seguidores · perfil não localizado na fonte
                </p>
              </>
            ),
          )}
          {hasInstagramProfileInput ? syncButton("instagram", instagramSnapshot) : null}
        </div>

        {/* TikTok — mesmo contrato do Instagram: Soundcharts /audience/tiktok, mesma
            distinção success+null ("Indisponível") vs failed ("Erro"), sem fallback
            silencioso para metadata.tiktok_seguidores. */}
        <div className="rounded-lg border border-border bg-card p-2">
          <div className="flex items-center gap-1 mb-1">
            <SiTiktok className="h-3 w-3 text-foreground" />
            <span className="text-[10px] text-foreground font-medium">TikTok</span>
          </div>
          {renderSyncState(
            `metric-tiktok-${artistId}`,
            hasTikTokProfileInput,
            tiktokSnapshot,
            tiktokMetric?.value != null ? (
              <>
                <p className="text-sm font-bold text-foreground" data-testid={`metric-tiktok-${artistId}`}>
                  {formatCount(tiktokMetric.value)}
                </p>
                <p className="text-[10px] text-muted-foreground" data-testid={`metric-tiktok-source-${artistId}`}>
                  Seguidores{isDevMockSnapshot(tiktokSnapshot) ? " · dados de demonstração (dev)" : ""}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-foreground" data-testid={`metric-tiktok-${artistId}`}>
                  Indisponível
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Seguidores · perfil não localizado na fonte
                </p>
              </>
            ),
          )}
          {hasTikTokProfileInput ? syncButton("tiktok", tiktokSnapshot) : null}
        </div>

        {/* Spotify — perfil público do artista: GET/POST /artists/:id/platform-profiles/spotify */}
        <div className="rounded-lg border border-border bg-card p-2">
          <div className="flex items-center gap-1 mb-1">
            <SiSpotify className="h-3 w-3 text-foreground" />
            <span className="text-[10px] text-foreground font-medium">Spotify</span>
          </div>
          {renderSyncState(
            `metric-spotify-${artistId}`,
            hasSpotifyProfileInput,
            spotifySnapshot,
            spotifyMetric?.value != null ? (
              <>
                <p className="text-sm font-bold text-foreground" data-testid={`metric-spotify-${artistId}`}>
                  {formatCount(spotifyMetric.value)}
                </p>
                <p className="text-[10px] text-muted-foreground">Ouvintes</p>
              </>
            ) : (
              <>
                {/* API pública do Spotify (client_credentials) não expõe monthly listeners —
                    nunca usar spotifySnapshot.followers aqui como substituto. */}
                <p className="text-sm font-semibold text-foreground" data-testid={`metric-spotify-${artistId}`}>
                  Indisponível
                </p>
                <p className="text-[10px] text-muted-foreground">
                  Ouvintes · API do Spotify não fornece este dado
                </p>
              </>
            ),
          )}
          {hasSpotifyProfileInput ? syncButton("spotify", spotifySnapshot) : null}
        </div>

        {/* YouTube — canal público do artista: GET/POST /artists/:id/platform-profiles/youtube */}
        <div className="rounded-lg border border-border bg-card p-2">
          <div className="flex items-center gap-1 mb-1">
            <SiYoutube className="h-3 w-3 text-foreground" />
            <span className="text-[10px] text-foreground font-medium">YouTube</span>
          </div>
          {renderSyncState(
            `metric-youtube-${artistId}`,
            hasYouTubeProfileInput,
            youtubeSnapshot,
            <>
              <p className="text-sm font-bold text-foreground" data-testid={`metric-youtube-${artistId}`}>
                {formatCount(youtubeMetric?.value)}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Inscritos · {formatCount(youtubeSnapshot?.total_views)} views
              </p>
            </>,
          )}
          {hasYouTubeProfileInput ? syncButton("youtube", youtubeSnapshot) : null}
        </div>

        {/* Deezer — API pública (nb_fan), sem credencial/OAuth: GET/POST /artists/:id/platform-profiles/deezer */}
        <div className="rounded-lg border border-border bg-card p-2">
          <div className="flex items-center gap-1 mb-1">
            <DeezerIcon className="h-3 w-3 text-foreground" />
            <span className="text-[10px] text-foreground font-medium">Deezer</span>
          </div>
          {renderSyncState(
            `metric-deezer-${artistId}`,
            hasDeezerProfileInput,
            deezerSnapshot,
            <>
              <p className="text-sm font-bold text-foreground" data-testid={`metric-deezer-${artistId}`}>
                {formatCount(deezerMetric?.value)}
              </p>
              <p className="text-[10px] text-muted-foreground">Fãs</p>
            </>,
          )}
          {hasDeezerProfileInput ? syncButton("deezer", deezerSnapshot) : null}
        </div>

        {/* Apple Music — a Soundcharts NÃO tem métrica de audiência para Apple Music
            (ver SoundchartsService.getAppleMusicPlaylistCount). O card conhece o
            snapshot/status real (pending/failed/não configurado), mas o valor de
            sucesso é SEMPRE "Indisponível" — nunca um número inventado, nunca 0, e
            nunca o contador manual legado (metadata.apple_music_albuns) exibido como
            se fosse audiência Soundcharts. */}
        <div className="rounded-lg border border-border bg-card p-2">
          <div className="flex items-center gap-1 mb-1">
            <SiApplemusic className="h-3 w-3 text-foreground" />
            <span className="text-[10px] text-foreground font-medium">Apple Music</span>
          </div>
          {renderSyncState(
            `metric-apple-music-${artistId}`,
            hasAppleMusicProfileInput,
            appleMusicSnapshot,
            <>
              <p className="text-sm font-semibold text-foreground" data-testid={`metric-apple-music-${artistId}`}>
                Indisponível
              </p>
              <p className="text-[10px] text-muted-foreground">
                Apple Music não fornece métrica de audiência
              </p>
            </>,
          )}
          {hasAppleMusicProfileInput ? syncButton("apple-music", appleMusicSnapshot) : null}
        </div>

        {/* SoundCloud — /resolve público (só client_id de app): GET/POST /artists/:id/platform-profiles/soundcloud */}
        <div className="rounded-lg border border-border bg-card p-2">
          <div className="flex items-center gap-1 mb-1">
            <SiSoundcloud className="h-3 w-3 text-foreground" />
            <span className="text-[10px] text-foreground font-medium">SoundCloud</span>
          </div>
          {renderSyncState(
            `metric-soundcloud-${artistId}`,
            hasSoundCloudProfileInput,
            soundcloudSnapshot,
            <>
              <p className="text-sm font-bold text-foreground" data-testid={`metric-soundcloud-${artistId}`}>
                {formatCount(soundcloudMetric?.value)}
              </p>
              <p className="text-[10px] text-muted-foreground">Seguidores</p>
            </>,
          )}
          {hasSoundCloudProfileInput ? syncButton("soundcloud", soundcloudSnapshot) : null}
        </div>
      </div>
    </div>
  );
}
