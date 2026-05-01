import { useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  Headphones,
  Instagram,
  Music,
  Music2,
  RefreshCw,
  Youtube,
  AlertCircle,
} from "lucide-react";
import { SiApplemusic, SiSoundcloud } from "react-icons/si";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  SpotifyDataError,
  useSpotifyArtist,
  useSpotifyEvolution,
  useSpotifyStatus,
} from "@/hooks/useSpotify";
import {
  YouTubeDataError,
  useYouTubeChannel,
  useYouTubeEvolution,
  useYouTubeStatus,
} from "@/hooks/useYouTube";
import {
  DeezerDataError,
  extractDeezerArtistIdFromUrl,
  useDeezerArtist,
  useDeezerEvolution,
} from "@/hooks/useDeezer";
import {
  AppleMusicDataError,
  extractAppleMusicArtistIdFromUrl,
  useAppleMusicArtist,
  useAppleMusicEvolution,
  useAppleMusicStatus,
} from "@/hooks/useAppleMusic";
import {
  SoundCloudDataError,
  extractSoundCloudHandleFromUrl,
  useSoundCloudEvolution,
  useSoundCloudUser,
} from "@/hooks/useSoundCloud";
import { PlatformMiniTrend } from "./PlatformMiniTrend";

interface ArtistaPlatformMetricsProps {
  artistaId: string;
  spotifyArtistId?: string | null;
  youtubeChannelId?: string | null;
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

/**
 * Texto curto exibido no card quando a métrica não pôde ser carregada.
 * 409 = credenciais não configuradas (caso esperado para orgs sem Spotify/YouTube).
 */
function shortErrorLabel(
  err:
    | SpotifyDataError
    | YouTubeDataError
    | DeezerDataError
    | AppleMusicDataError
    | SoundCloudDataError,
): string {
  if (err.status === 409) return "Não configurado";
  if (err.status === 422) return "ID inválido";
  if (err.status === 401) return "Sem acesso";
  if (err.status === 502) return "Falha externa";
  return "Erro";
}

export function ArtistaPlatformMetrics({
  artistaId,
  spotifyArtistId,
  youtubeChannelId,
  deezerUrl,
  appleMusicUrl,
  soundcloudUrl,
}: ArtistaPlatformMetricsProps) {
  const qc = useQueryClient();

  const spotifyStatus = useSpotifyStatus();
  const youtubeStatus = useYouTubeStatus();
  const appleMusicStatus = useAppleMusicStatus();

  const spotifyConfigured =
    spotifyStatus.data?.connected || spotifyStatus.data?.has_global_fallback;
  const youtubeConfigured =
    youtubeStatus.data?.connected || youtubeStatus.data?.has_global_fallback;

  const spotifyEnabledId = spotifyConfigured ? spotifyArtistId ?? null : null;
  const youtubeEnabledId = youtubeConfigured ? youtubeChannelId ?? null : null;

  const spotifyQuery = useSpotifyArtist(spotifyEnabledId);
  const youtubeQuery = useYouTubeChannel(youtubeEnabledId);

  // Deezer / Apple Music / SoundCloud não exigem credenciais por org —
  // as edge functions usam APIs públicas. Por isso os tiles só dependem
  // da URL cadastrada.
  const deezerArtistId = extractDeezerArtistIdFromUrl(deezerUrl);
  const deezerQuery = useDeezerArtist(deezerUrl ?? null);

  const appleMusicArtistId = extractAppleMusicArtistIdFromUrl(appleMusicUrl);
  const appleMusicQuery = useAppleMusicArtist(appleMusicUrl ?? null);

  const soundcloudHandle = extractSoundCloudHandleFromUrl(soundcloudUrl);
  const soundcloudQuery = useSoundCloudUser(soundcloudUrl ?? null);

  // Histórico (snapshots diários — Task #354/#359) usado para mostrar a
  // variação % e a sparkline diretamente nos tiles do card.
  const spotifyEvolution = useSpotifyEvolution(
    spotifyArtistId ? artistaId : null,
    30,
  );
  const youtubeEvolution = useYouTubeEvolution(
    youtubeChannelId ? artistaId : null,
    30,
  );
  const deezerEvolution = useDeezerEvolution(
    deezerArtistId ? artistaId : null,
    30,
  );
  const appleMusicEvolution = useAppleMusicEvolution(
    appleMusicArtistId ? artistaId : null,
    30,
  );
  const soundcloudEvolution = useSoundCloudEvolution(
    soundcloudHandle ? artistaId : null,
    30,
  );

  const spotifyFollowers = spotifyQuery.data?.followers?.total ?? null;
  const youtubeChannel = youtubeQuery.data?.items?.[0];
  const subscriberCount = youtubeChannel?.statistics?.subscriberCount ?? null;
  const hiddenSubscribers = Boolean(
    youtubeChannel?.statistics?.hiddenSubscriberCount,
  );
  const deezerFans = deezerQuery.data?.nb_fan ?? null;
  const appleMusicAlbumCount = appleMusicQuery.data?.albumCount ?? null;
  const appleMusicMonthlyListeners = appleMusicQuery.data?.monthlyListeners ?? null;
  const appleMusicSource = appleMusicQuery.data?.source ?? null;
  const appleMusicLatestRelease = appleMusicQuery.data?.latestRelease ?? null;
  const appleMusicGenre = appleMusicQuery.data?.primaryGenreName ?? null;
  const appleMusicJwtConnected = appleMusicStatus.data?.connected === true;
  const soundcloudFollowers = soundcloudQuery.data?.followers_count ?? null;
  const soundcloudTracks = soundcloudQuery.data?.track_count ?? null;

  const appleMusicUrlTrimmed = (appleMusicUrl ?? "").trim();
  const soundcloudUrlTrimmed = (soundcloudUrl ?? "").trim();

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["spotify", "status"] });
    qc.invalidateQueries({ queryKey: ["youtube", "status"] });
    qc.invalidateQueries({ queryKey: ["apple_music", "status"] });
    qc.invalidateQueries({ queryKey: ["spotify", "artist", spotifyArtistId ?? ""] });
    qc.invalidateQueries({ queryKey: ["youtube", "channel", youtubeChannelId ?? ""] });
    qc.invalidateQueries({ queryKey: ["deezer", "artist", deezerArtistId ?? ""] });
    qc.invalidateQueries({
      queryKey: ["apple-music", "artist", appleMusicArtistId ?? ""],
    });
    qc.invalidateQueries({
      queryKey: ["soundcloud", "user", soundcloudHandle ?? ""],
    });
  };

  const isFetching =
    spotifyQuery.isFetching ||
    youtubeQuery.isFetching ||
    deezerQuery.isFetching ||
    appleMusicQuery.isFetching ||
    soundcloudQuery.isFetching;

  return (
    <div className="border border-t-0 rounded-b-lg bg-card p-4 -mt-1">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-medium text-foreground">Métricas de Plataformas</p>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground gap-1 h-7"
          onClick={refresh}
          disabled={isFetching}
          data-testid={`button-atualizar-metricas-${artistaId}`}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Instagram (placeholder — sem integração ainda) */}
        <div
          className="rounded-lg p-3"
          style={{ background: "linear-gradient(135deg, #833AB4 0%, #FD1D1D 50%, #F77737 100%)" }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Instagram className="h-4 w-4 text-white" />
            <span className="text-xs text-white font-medium">Instagram</span>
          </div>
          <p className="text-lg font-bold text-white" data-testid={`metric-instagram-${artistaId}`}>
            N/D
          </p>
          <p className="text-xs text-white/70">Seguidores</p>
        </div>

        {/* TikTok (placeholder — sem integração ainda) */}
        <div className="bg-black rounded-lg p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <Music className="h-4 w-4 text-white" />
            <span className="text-xs text-white font-medium">TikTok</span>
          </div>
          <p className="text-lg font-bold text-white" data-testid={`metric-tiktok-${artistaId}`}>
            N/D
          </p>
          <p className="text-xs text-white/70">Seguidores</p>
        </div>

        {/* Spotify */}
        <div className="bg-[#1DB954] rounded-lg p-3 lg:col-span-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Music2 className="h-4 w-4 text-white" />
            <span className="text-xs text-white font-medium">Spotify</span>
            {spotifyQuery.error ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertCircle
                    className="h-3.5 w-3.5 text-white/90 ml-auto cursor-help"
                    data-testid={`icon-spotify-error-${artistaId}`}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-[260px]">{spotifyQuery.error.message}</p>
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          {!spotifyConfigured ? (
            <>
              <p
                className="text-sm font-semibold text-white"
                data-testid={`metric-spotify-${artistaId}`}
              >
                Não configurado
              </p>
              <p className="text-xs text-white/70">Configure em Integrações</p>
            </>
          ) : !spotifyArtistId ? (
            <>
              <p
                className="text-sm font-semibold text-white"
                data-testid={`metric-spotify-${artistaId}`}
              >
                Sem perfil
              </p>
              <p className="text-xs text-white/70">Cadastre a URL do Spotify</p>
            </>
          ) : spotifyQuery.isLoading ? (
            <>
              <p
                className="text-lg font-bold text-white animate-pulse"
                data-testid={`metric-spotify-${artistaId}`}
              >
                ···
              </p>
              <p className="text-xs text-white/70">Carregando…</p>
            </>
          ) : spotifyQuery.error ? (
            <>
              <p
                className="text-sm font-semibold text-white"
                data-testid={`metric-spotify-${artistaId}`}
              >
                {shortErrorLabel(spotifyQuery.error)}
              </p>
              <p className="text-xs text-white/70 truncate">{spotifyQuery.error.message}</p>
            </>
          ) : (
            <>
              <p
                className="text-lg font-bold text-white"
                data-testid={`metric-spotify-${artistaId}`}
              >
                {formatCount(spotifyFollowers)}
              </p>
              <p className="text-xs text-white/70">
                Seguidores
                {typeof spotifyQuery.data?.popularity === "number"
                  ? ` · Pop ${spotifyQuery.data.popularity}`
                  : ""}
              </p>
              <PlatformMiniTrend
                points={spotifyEvolution.data}
                metric="followers"
                variant="white"
                testIdPrefix={`metric-spotify-${artistaId}`}
              />
            </>
          )}
        </div>

        {/* YouTube */}
        <div className="bg-[#FF0000] rounded-lg p-3 lg:col-span-2">
          <div className="flex items-center gap-1.5 mb-1">
            <Youtube className="h-4 w-4 text-white" />
            <span className="text-xs text-white font-medium">YouTube</span>
            {youtubeQuery.error ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertCircle
                    className="h-3.5 w-3.5 text-white/90 ml-auto cursor-help"
                    data-testid={`icon-youtube-error-${artistaId}`}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-[260px]">{youtubeQuery.error.message}</p>
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          {!youtubeConfigured ? (
            <>
              <p
                className="text-sm font-semibold text-white"
                data-testid={`metric-youtube-${artistaId}`}
              >
                Não configurado
              </p>
              <p className="text-xs text-white/70">Configure em Integrações</p>
            </>
          ) : !youtubeChannelId ? (
            <>
              <p
                className="text-sm font-semibold text-white"
                data-testid={`metric-youtube-${artistaId}`}
              >
                Sem canal
              </p>
              <p className="text-xs text-white/70">Cadastre a URL do canal do YouTube</p>
            </>
          ) : youtubeQuery.isLoading ? (
            <>
              <p
                className="text-lg font-bold text-white animate-pulse"
                data-testid={`metric-youtube-${artistaId}`}
              >
                ···
              </p>
              <p className="text-xs text-white/70">Carregando…</p>
            </>
          ) : youtubeQuery.error ? (
            <>
              <p
                className="text-sm font-semibold text-white"
                data-testid={`metric-youtube-${artistaId}`}
              >
                {shortErrorLabel(youtubeQuery.error)}
              </p>
              <p className="text-xs text-white/70 truncate">{youtubeQuery.error.message}</p>
            </>
          ) : !youtubeChannel ? (
            <>
              <p
                className="text-sm font-semibold text-white"
                data-testid={`metric-youtube-${artistaId}`}
              >
                Não encontrado
              </p>
              <p className="text-xs text-white/70">Verifique a URL do canal</p>
            </>
          ) : (
            <>
              <p
                className="text-lg font-bold text-white"
                data-testid={`metric-youtube-${artistaId}`}
              >
                {hiddenSubscribers ? "Oculto" : formatCount(subscriberCount)}
              </p>
              <p className="text-xs text-white/70">
                Inscritos · {formatCount(youtubeChannel.statistics?.viewCount)} views
              </p>
              <PlatformMiniTrend
                points={youtubeEvolution.data}
                metric="followers"
                variant="white"
                testIdPrefix={`metric-youtube-${artistaId}`}
              />
            </>
          )}
        </div>

        {/* Deezer — usa a edge function pública `deezer-metrics` (Task #354).
            Não depende de credenciais por org, então o tile só pede a URL. */}
        <div
          className="rounded-lg p-3 lg:col-span-2"
          style={{
            background:
              "linear-gradient(135deg, #00C7F2 0%, #A238FF 50%, #FF1898 100%)",
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <Headphones className="h-4 w-4 text-white" />
            <span className="text-xs text-white font-medium">Deezer</span>
            {deezerQuery.error ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertCircle
                    className="h-3.5 w-3.5 text-white/90 ml-auto cursor-help"
                    data-testid={`icon-deezer-error-${artistaId}`}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-[260px]">{deezerQuery.error.message}</p>
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          {!deezerArtistId ? (
            <>
              <p
                className="text-sm font-semibold text-white"
                data-testid={`metric-deezer-${artistaId}`}
              >
                Sem perfil
              </p>
              <p className="text-xs text-white/70">Cadastre a URL do Deezer</p>
            </>
          ) : deezerQuery.isLoading ? (
            <>
              <p
                className="text-lg font-bold text-white animate-pulse"
                data-testid={`metric-deezer-${artistaId}`}
              >
                ···
              </p>
              <p className="text-xs text-white/70">Carregando…</p>
            </>
          ) : deezerQuery.error ? (
            <>
              <p
                className="text-sm font-semibold text-white"
                data-testid={`metric-deezer-${artistaId}`}
              >
                {shortErrorLabel(deezerQuery.error)}
              </p>
              <p className="text-xs text-white/70 truncate">{deezerQuery.error.message}</p>
            </>
          ) : (
            <>
              <p
                className="text-lg font-bold text-white"
                data-testid={`metric-deezer-${artistaId}`}
              >
                {formatCount(deezerFans)}
              </p>
              <p className="text-xs text-white/70">
                Fãs
                {typeof deezerQuery.data?.nb_album === "number"
                  ? ` · ${deezerQuery.data.nb_album} álbuns`
                  : ""}
              </p>
              <PlatformMiniTrend
                points={deezerEvolution.data}
                metric="followers"
                variant="white"
                testIdPrefix={`metric-deezer-${artistaId}`}
              />
            </>
          )}
        </div>

        {/* Apple Music — dois modos (Task #364):
            - Com MusicKit JWT configurado (Configurações → Integrações → Apple Music for Artists):
              edge function chama Apple Music Catalog API e retorna dados enriquecidos.
              `monthlyListeners` é mostrado se a API retornar esse dado; caso contrário
              mantém o fallback de álbuns (Apple Music Catalog API pública não expõe listeners).
            - Sem JWT: iTunes Lookup API pública — mostra albumCount + último lançamento. */}
        <div
          className="rounded-lg p-3 lg:col-span-2"
          style={{
            background: "linear-gradient(135deg, #FA243C 0%, #FB5C74 100%)",
          }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <SiApplemusic className="h-4 w-4 text-white" />
            <span className="text-xs text-white font-medium">Apple Music</span>
            {appleMusicQuery.error ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertCircle
                    className="h-3.5 w-3.5 text-white/90 ml-auto cursor-help"
                    data-testid={`icon-apple-music-error-${artistaId}`}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-[260px]">
                    {appleMusicQuery.error.message}
                  </p>
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          {!appleMusicUrlTrimmed ? (
            <>
              <p
                className="text-sm font-semibold text-white"
                data-testid={`metric-apple-music-${artistaId}`}
              >
                Sem perfil
              </p>
              <p className="text-xs text-white/70">Cadastre a URL do Apple Music</p>
            </>
          ) : !appleMusicArtistId ? (
            <>
              <p
                className="text-sm font-semibold text-white"
                data-testid={`metric-apple-music-${artistaId}`}
              >
                URL inválida
              </p>
              <a
                href={appleMusicUrlTrimmed}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-white/90 hover:text-white underline underline-offset-2"
                data-testid={`link-apple-music-${artistaId}`}
              >
                Abrir perfil
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </>
          ) : appleMusicQuery.isLoading ? (
            <>
              <p
                className="text-lg font-bold text-white animate-pulse"
                data-testid={`metric-apple-music-${artistaId}`}
              >
                ···
              </p>
              <p className="text-xs text-white/70">Carregando…</p>
            </>
          ) : appleMusicQuery.error ? (
            <>
              <p
                className="text-sm font-semibold text-white"
                data-testid={`metric-apple-music-${artistaId}`}
              >
                {shortErrorLabel(appleMusicQuery.error)}
              </p>
              <p className="text-xs text-white/70 truncate">
                {appleMusicQuery.error.message}
              </p>
            </>
          ) : (
            <>
              <p
                className="text-lg font-bold text-white"
                data-testid={`metric-apple-music-${artistaId}`}
              >
                {appleMusicMonthlyListeners !== null
                  ? formatCount(appleMusicMonthlyListeners)
                  : formatCount(appleMusicAlbumCount)}
              </p>
              <p className="text-xs text-white/70 truncate">
                {appleMusicMonthlyListeners !== null
                  ? "Ouvintes mensais"
                  : `Álbuns${appleMusicLatestRelease ? ` · ${appleMusicLatestRelease}` : appleMusicGenre ? ` · ${appleMusicGenre}` : ""}`}
              </p>
              {appleMusicSource === "apple_music_catalog" && appleMusicMonthlyListeners === null && (
                <p className="text-xs text-white/50 truncate">
                  {appleMusicLatestRelease ?? appleMusicGenre ?? ""}
                </p>
              )}
              <PlatformMiniTrend
                points={appleMusicEvolution.data}
                metric="followers"
                variant="white"
                testIdPrefix={`metric-apple-music-${artistaId}`}
              />
            </>
          )}
        </div>

        {/* SoundCloud — usa edge function pública `soundcloud-metrics`
            (Task #359). Lê a contagem de seguidores e faixas direto do
            HTML público do perfil (sem necessidade de OAuth). */}
        <div className="bg-[#FF5500] rounded-lg p-3 lg:col-span-2">
          <div className="flex items-center gap-1.5 mb-1">
            <SiSoundcloud className="h-4 w-4 text-white" />
            <span className="text-xs text-white font-medium">SoundCloud</span>
            {soundcloudQuery.error ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertCircle
                    className="h-3.5 w-3.5 text-white/90 ml-auto cursor-help"
                    data-testid={`icon-soundcloud-error-${artistaId}`}
                  />
                </TooltipTrigger>
                <TooltipContent>
                  <p className="text-xs max-w-[260px]">
                    {soundcloudQuery.error.message}
                  </p>
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
          {!soundcloudUrlTrimmed ? (
            <>
              <p
                className="text-sm font-semibold text-white"
                data-testid={`metric-soundcloud-${artistaId}`}
              >
                Sem perfil
              </p>
              <p className="text-xs text-white/70">Cadastre a URL do SoundCloud</p>
            </>
          ) : !soundcloudHandle ? (
            <>
              <p
                className="text-sm font-semibold text-white"
                data-testid={`metric-soundcloud-${artistaId}`}
              >
                URL inválida
              </p>
              <a
                href={soundcloudUrlTrimmed}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-xs text-white/90 hover:text-white underline underline-offset-2"
                data-testid={`link-soundcloud-${artistaId}`}
              >
                Abrir perfil
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
              </a>
            </>
          ) : soundcloudQuery.isLoading ? (
            <>
              <p
                className="text-lg font-bold text-white animate-pulse"
                data-testid={`metric-soundcloud-${artistaId}`}
              >
                ···
              </p>
              <p className="text-xs text-white/70">Carregando…</p>
            </>
          ) : soundcloudQuery.error ? (
            <>
              <p
                className="text-sm font-semibold text-white"
                data-testid={`metric-soundcloud-${artistaId}`}
              >
                {shortErrorLabel(soundcloudQuery.error)}
              </p>
              <p className="text-xs text-white/70 truncate">
                {soundcloudQuery.error.message}
              </p>
            </>
          ) : (
            <>
              <p
                className="text-lg font-bold text-white"
                data-testid={`metric-soundcloud-${artistaId}`}
              >
                {formatCount(soundcloudFollowers)}
              </p>
              <p className="text-xs text-white/70">
                Seguidores
                {typeof soundcloudTracks === "number"
                  ? ` · ${soundcloudTracks} faixas`
                  : ""}
              </p>
              <PlatformMiniTrend
                points={soundcloudEvolution.data}
                metric="followers"
                variant="white"
                testIdPrefix={`metric-soundcloud-${artistaId}`}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
