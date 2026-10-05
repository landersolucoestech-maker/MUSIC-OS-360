import { MUSICAL_GENRE_LABEL_BY_VALUE } from "@/constants/musicalGenres";
import { hasOwnKey } from "@/shared/lib/own-property";
function parseDateParts(value: string | Date): { day: number; month: number; year: number } | null {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return {
      day: value.getDate(),
      month: value.getMonth() + 1,
      year: value.getFullYear(),
    };
  }

  const trimmed = value.trim();
  if (!trimmed) return null;

  const isoDate = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDate) {
    return {
      day: Number(isoDate[3]),
      month: Number(isoDate[2]),
      year: Number(isoDate[1]),
    };
  }

  const slashDate = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (slashDate) {
    return {
      day: Number(slashDate[1]),
      month: Number(slashDate[2]),
      year: Number(slashDate[3]),
    };
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return {
    day: date.getDate(),
    month: date.getMonth() + 1,
    year: date.getFullYear(),
  };
}

export function formatReleaseDate(value?: string | Date | null): string | null {
  if (!value) return null;
  const parts = parseDateParts(value);
  if (!parts) return String(value);

  const day = String(parts.day).padStart(2, "0");
  const month = String(parts.month).padStart(2, "0");
  return `${day}-${month}-${parts.year}`;
}

/** PT-BR label of each canonical release type (CZ-038); never the raw technical value. */
export const RELEASE_TYPE_LABELS: Record<string, string> = {
  single: "Single",
  ep: "EP",
  album: "Álbum",
  compilation: "Coletânea",
  live: "Ao vivo",
  video: "Videoclipe",
  other: "Outro",
};

export const releaseTypeLabel = (type?: string | null): string =>
  (type && hasOwnKey(RELEASE_TYPE_LABELS, type) && RELEASE_TYPE_LABELS[type]) || "Tipo não informado";

/** Release language options (value = language code stored in `language`, label = PT-BR). */
export const RELEASE_LANGUAGE_OPTIONS = [
  { value: "de", label: "Alemão" },
  { value: "ar", label: "Árabe" },
  { value: "zh", label: "Chinês" },
  { value: "ko", label: "Coreano" },
  { value: "es", label: "Espanhol" },
  { value: "fr", label: "Francês" },
  { value: "en", label: "Inglês" },
  { value: "it", label: "Italiano" },
  { value: "ja", label: "Japonês" },
  { value: "pt-br", label: "Português (Brasil)" },
  { value: "pt", label: "Português" },
] as const;

/** PT-BR label of a stored language code; an unknown code is never shown raw. */
export const releaseLanguageLabel = (code?: string | null): string | null => {
  if (!code) return null;
  const normalized = code.trim().toLowerCase();
  return RELEASE_LANGUAGE_OPTIONS.find((o) => o.value === normalized)?.label ?? "Idioma não reconhecido";
};

/** PT-BR label of a stored genre slug (e.g. "sertanejo-universitario" → "Sertanejo Universitário"). */
export const musicGenreLabel = (genre?: string | null): string | null =>
  genre ? (hasOwnKey(MUSICAL_GENRE_LABEL_BY_VALUE, genre) ? MUSICAL_GENRE_LABEL_BY_VALUE[genre] : genre) : null;
