/** PT-BR display labels of the platform metric keys. */
// The same friendly labels already used in ArtistPlatformMetrics.tsx for each
// platform — reused here (item 61: never show "spotify.monthly_listeners" in the UI).
// Covers every key of the API registry (apps/api/.../platform-profiles/metric-keys.ts).
const METRIC_LABELS: Readonly<Record<string, string>> = {
  "spotify.monthly_listeners": "Spotify · Ouvintes mensais",
  "youtube.subscribers": "YouTube · Inscritos",
  "youtube.total_views": "YouTube · Visualizações",
  "youtube.total_videos": "YouTube · Vídeos",
  "deezer.fans": "Deezer · Fãs",
  "soundcloud.followers": "SoundCloud · Seguidores",
  "instagram.followers": "Instagram · Seguidores",
  "tiktok.followers": "TikTok · Seguidores",
  "apple-music.playlist_count": "Apple Music · Playlists",
};

/** PT-BR label of a metric key; an unknown key never reaches the UI as raw text. */
export function metricLabel(metricKey: string): string {
  return METRIC_LABELS[metricKey] ?? "Métrica da plataforma";
}
