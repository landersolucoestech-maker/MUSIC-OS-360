// Canonical Apple Music contract (Metrics Phase 1 — fixes the reported bug
// "Link do Apple Music inválido" for a correctly registered URL):
// the 2-letter locale segment (/us/, /br/...) IS OPTIONAL — Apple Music
// accepts URLs with and without it. Shared by the two backend consumers
// (apple-music-artist-profile.provider.ts and artist-external-profile-sync.service.ts)
// and must stay in sync with the frontend mirror
// (ArtistaPlatformMetrics.tsx normalizeAppleMusicProfileUrl) — if one changes,
// the other must change with it.
export const APPLE_MUSIC_URL_PATTERN =
  /^https?:\/\/(?:www\.|music\.)?apple\.com\/(?:[a-z]{2}\/)?artist\/(?:[^/?#]+\/)?(\d+)(?:[/?#].*)?$/i;

export function extractAppleMusicId(value: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return trimmed;
  const match = trimmed.match(APPLE_MUSIC_URL_PATTERN);
  return match?.[1] ?? null;
}
