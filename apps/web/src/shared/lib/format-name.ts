/**
 * Formatting of people's names — PRESENTATION layer ONLY.
 *
 * Applies per-word title case, keeping pt-BR particles lowercase
 * (de, da, do, das, dos, e, …) when they are not the first word of the name.
 *
 * Does NOT change persisted data, DTOs, services nor the database. Must not be used
 * for stage names (`artistas` module), which may have intentional capitalization.
 */

/** Particles that stay lowercase when they do not start the name. */
const LOWERCASE_PARTICLES = new Set([
  "de", "da", "do", "das", "dos",
  "e",
  "di", "du", "del", "della", "van", "von", "der", "la", "le",
]);

/** Capitalizes a single token, preserving hyphens (Ana-Maria) and apostrophes (D'Angelo). */
function capitalizeToken(token: string): string {
  if (!token) return token;
  // Splits into sub-tokens by hyphen/apostrophe, capitalizes each and rejoins with the separator.
  return token.replace(/[^-'\s]+/g, (part) => {
    const lower = part.toLocaleLowerCase("pt-BR");
    return lower.charAt(0).toLocaleUpperCase("pt-BR") + lower.slice(1);
  });
}

/**
 * Formats a person's name for display.
 * - `null`/`undefined`/empty → returns the fallback (default: empty string).
 * - Collapses spaces; capitalizes each word; pt-BR particles in lowercase (except the 1st).
 */
export function formatPersonName(name: string | null | undefined, fallback = ""): string {
  if (name == null) return fallback;
  const trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return fallback;

  const words = trimmed.split(" ");
  return words
    .map((word, index) => {
      const lower = word.toLocaleLowerCase("pt-BR");
      if (index > 0 && LOWERCASE_PARTICLES.has(lower)) return lower;
      return capitalizeToken(word);
    })
    .join(" ");
}
