import { formatGenres } from "@/modules/releases/lib/genre-match";

/** Review-step text of the release genres (primary and secondary), rendered inside the review grid. */
export function ReleaseGenresSummary({ genre, secondaryGenre }: { genre: string; secondaryGenre: string }) {
  return <>{formatGenres(genre, secondaryGenre)}</>;
}
