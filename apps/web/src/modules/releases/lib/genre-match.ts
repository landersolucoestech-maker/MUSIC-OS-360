/** Genre text helpers for the release form: own-property lookups only, so user text such as "constructor" never resolves to an inherited member. */
import { MUSICAL_GENRES } from "@/constants/musicalGenres";
import { hasOwnKey } from "@/shared/lib/own-property";

const GENRE_OPTIONS = MUSICAL_GENRES;
export const GENRE_OPTS = GENRE_OPTIONS.map((o) => o.value);
export const GENRE_LABELS: Record<string, string> = Object.fromEntries(
  GENRE_OPTIONS.map((o) => [o.value, o.label]),
);
export const genreLabel = (value: string): string =>
  hasOwnKey(GENRE_LABELS, value) ? GENRE_LABELS[value] : value;
const GENRE_ALIASES: Record<string, string> = {
  eletronico: "eletronica",
  electronico: "eletronica",
  electronica: "eletronica",
  "hip hop": "hip-hop",
  rap: "rap",
  "bossa nova": "bossa-nova",
  "mpb/bossa nova": "bossa-nova",
  forro: "forro",
};
export const normStr = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
export const matchGenre = (raw: string): string => {
  if (!raw) return "";
  const n = normStr(raw);
  const exact = GENRE_OPTS.find((g) => normStr(g) === n);
  if (exact) return exact;
  if (hasOwnKey(GENRE_ALIASES, n)) return GENRE_ALIASES[n];
  const partial = GENRE_OPTS.find(
    (g) => n.startsWith(normStr(g)) || normStr(g).startsWith(n),
  );
  return partial ?? raw.toLowerCase();
};
