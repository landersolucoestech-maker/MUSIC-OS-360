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

/** Deezer public API — only needs an artist id/URL, no OAuth. */
function normalizeDeezerProfileUrl(input: string | null | undefined): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) return `https://www.deezer.com/artist/${value}`;
  const match = value.match(/deezer\.com\/(?:[a-z]{2}\/)?artist\/(\d+)/i);
  return match?.[1] ? `https://www.deezer.com/artist/${match[1]}` : null;
}

/** SoundCloud /resolve — only needs an app client_id, no artist/tenant login. */
function normalizeSoundCloudProfileUrl(input: string | null | undefined): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;
  if (/^[A-Za-z0-9_-]+$/.test(value)) return `https://soundcloud.com/${value}`;
  const match = value.match(/^https?:\/\/(?:www\.|m\.)?soundcloud\.com\/([A-Za-z0-9_-]+)\/?(?:[?#].*)?$/i);
  return match?.[1] ? `https://soundcloud.com/${match[1]}` : null;
}

// Mirror exactly extractInstagramUsername/extractTikTokUsername/extractAppleMusicId
// in artist-external-profile-sync.service.ts (backend) — same canonical URL format.
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

// Canonical Apple Music contract (Metrics Phase 1 — fixes the reported bug
// "Link do Apple Music inválido" for a correctly registered URL): the 2-letter
// locale segment (/us/, /br/...) IS OPTIONAL — Apple Music accepts URLs with
// and without it, and this normalizer always produced the locale-less form,
// while the mirrored backend extractor (artist-external-profile-sync.service.ts
// extractAppleMusicId) required the locale. Both regexes must accept exactly
// the same URL set — if one changes, the other must change too.
const APPLE_MUSIC_URL_PATTERN = /^https?:\/\/(?:www\.|music\.)?apple\.com\/(?:[a-z]{2}\/)?artist\/(?:[^/?#]+\/)?(\d+)(?:[/?#].*)?$/i;

function normalizeAppleMusicProfileUrl(input: string | null | undefined): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;
  if (/^\d+$/.test(value)) return `https://music.apple.com/artist/${value}`;
  const match = value.match(APPLE_MUSIC_URL_PATTERN);
  return match?.[1] ? `https://music.apple.com/artist/${match[1]}` : null;
}

/**
 * `true` when the snapshot came from the dev/local demo fallback
 * (dev-social-metrics-mock.ts in the backend), never from production — used
 * only to label the value as demo data and never mistake it for a real
 * Soundcharts metric.
 */
function isDevMockSnapshot(snapshot: ArtistPlatformProfileSnapshot | null): boolean {
  return snapshot?.raw_payload?.["source"] === "dev_mock";
}

/**
 * Instagram/TikTok may resolve followers via the canonical UUID (spotify→
 * youtube→deezer→soundcloud) when the own handle is not indexed standalone on
 * Soundcharts (see instagram-artist-profile.provider.ts) — the backend already
 * classifies that resolution in `raw_payload.primary_identity_status`
 * ('VERIFIED_EXACT' | 'INSUFFICIENT_EVIDENCE' | 'PROFILE_NOT_FOUND') but,
 * until this fix, no screen showed the distinction: a fallback value without
 * registry confirmation appeared with the same visual confidence as an exact
 * one. Original finding of this fix: the Soundcharts catalog can fragment a
 * real artist into several internal entities, and the canonical fallback can
 * resolve to an entity different from the artist's real Instagram/TikTok
 * account.
 */
function isUnverifiedIdentitySnapshot(snapshot: ArtistPlatformProfileSnapshot | null): boolean {
  return snapshot?.raw_payload?.["primary_identity_status"] === "INSUFFICIENT_EVIDENCE";
}

/**
 * User-facing copy for a failed sync. `last_error` is an internal technical
 * diagnostic (raw provider/HTTP/network error, English) and is NEVER rendered:
 * the presentation layer maps the failed state to Portuguese copy.
 */
export const PLATFORM_SYNC_FAILED_COPY = "Não foi possível sincronizar. Verifique o link do perfil e tente novamente.";

/**
 * States shared by the cards with a real sync (artist public profile →
 * provider → ArtistPlatformProfileEntity). With no registered profile it is
 * "Não configurado"; with a profile but no sync yet it is "Não sincronizado" —
 * neither becomes "0" or is hidden.
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
        <p className="text-xs text-muted-foreground">{PLATFORM_SYNC_FAILED_COPY}</p>
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

  // Main metric per platform, resolved via the capabilities registry
  // (metrics/platform-metric-capabilities.ts) instead of a hardcoded field.
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
          data-testid={`button-refresh-metrics-${artistId}`}
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
        {/* Instagram — Soundcharts /audience/instagram (canonical UUID via spotify→youtube→
            deezer→soundcloud→handle). success+followers=null is "Indisponível" (Soundcharts
            has no social account linked for this artist) — never the legacy manual
            counter (metadata.instagram_seguidores) as a fallback. */}
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
                <p
                  className="text-sm font-bold text-foreground"
                  data-testid={`metric-instagram-${artistId}`}
                  title={isUnverifiedIdentitySnapshot(instagramSnapshot) ? "Perfil resolvido por associação indireta (via outra plataforma cadastrada), sem confirmação exata do handle Instagram — número pode pertencer a um perfil diferente." : undefined}
                >
                  {formatCount(instagramMetric.value)}
                  {isUnverifiedIdentitySnapshot(instagramSnapshot) ? (
                    <span className="ml-1 text-[10px] font-normal text-amber-600" data-testid={`metric-instagram-unverified-${artistId}`}>
                      ⚠
                    </span>
                  ) : null}
                </p>
                <p className="text-[10px] text-muted-foreground" data-testid={`metric-instagram-source-${artistId}`}>
                  Seguidores
                  {isDevMockSnapshot(instagramSnapshot) ? " · dados de demonstração (dev)" : ""}
                  {isUnverifiedIdentitySnapshot(instagramSnapshot) ? " · não confirmado" : ""}
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

        {/* TikTok — same contract as Instagram: Soundcharts /audience/tiktok, the same
            success+null ("Indisponível") vs failed ("Erro") distinction, no silent
            fallback to metadata.tiktok_seguidores. */}
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
                <p
                  className="text-sm font-bold text-foreground"
                  data-testid={`metric-tiktok-${artistId}`}
                  title={isUnverifiedIdentitySnapshot(tiktokSnapshot) ? "Perfil resolvido por associação indireta (via outra plataforma cadastrada), sem confirmação exata do handle TikTok — número pode pertencer a um perfil diferente." : undefined}
                >
                  {formatCount(tiktokMetric.value)}
                  {isUnverifiedIdentitySnapshot(tiktokSnapshot) ? (
                    <span className="ml-1 text-[10px] font-normal text-amber-600" data-testid={`metric-tiktok-unverified-${artistId}`}>
                      ⚠
                    </span>
                  ) : null}
                </p>
                <p className="text-[10px] text-muted-foreground" data-testid={`metric-tiktok-source-${artistId}`}>
                  Seguidores
                  {isDevMockSnapshot(tiktokSnapshot) ? " · dados de demonstração (dev)" : ""}
                  {isUnverifiedIdentitySnapshot(tiktokSnapshot) ? " · não confirmado" : ""}
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

        {/* Spotify — artist public profile: GET/POST /artists/:id/platform-profiles/spotify */}
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
                {/* The Spotify public API (client_credentials) does not expose monthly listeners —
                    never use spotifySnapshot.followers here as a substitute. */}
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

        {/* YouTube — artist public channel: GET/POST /artists/:id/platform-profiles/youtube */}
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
                Inscritos · {formatCount(youtubeSnapshot?.total_views)} visualizações
              </p>
            </>,
          )}
          {hasYouTubeProfileInput ? syncButton("youtube", youtubeSnapshot) : null}
        </div>

        {/* Deezer — public API (nb_fan), no credential/OAuth: GET/POST /artists/:id/platform-profiles/deezer */}
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

        {/* Apple Music — Soundcharts has NO audience metric for Apple Music (see
            SoundchartsService.getAppleMusicPlaylistCount). The card knows the real
            snapshot/status (pending/failed/not configured), but the success value is
            ALWAYS "Indisponível" — never an invented number, never 0, and never the
            legacy manual counter (metadata.apple_music_albuns) shown as if it were a
            Soundcharts audience. */}
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

        {/* SoundCloud — public /resolve (app client_id only): GET/POST /artists/:id/platform-profiles/soundcloud */}
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
