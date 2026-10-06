/**
 * PT-BR label of an artist team contact category (artists.team_contacts[].category).
 * Canonical slugs come from @music-os-360/types; legacy Portuguese slugs not yet
 * backfilled are mapped with the shared LEGACY_TEAM_CONTACT_CATEGORIES (also used by the API).
 */
import {
  ARTIST_TEAM_CONTACT_CATEGORY_LABELS_PT_BR,
  LEGACY_TEAM_CONTACT_CATEGORIES,
  type ArtistTeamContactCategory,
} from "@music-os-360/types";

export const UNKNOWN_TEAM_CONTACT_CATEGORY_LABEL = "Outro";

const has = (map: object, key: string) => Object.prototype.hasOwnProperty.call(map, key);

export function teamContactCategoryLabel(category: string | null | undefined): string {
  const key = (category ?? "").trim().toLowerCase();
  const canonical = has(LEGACY_TEAM_CONTACT_CATEGORIES, key) ? LEGACY_TEAM_CONTACT_CATEGORIES[key] : key;
  return has(ARTIST_TEAM_CONTACT_CATEGORY_LABELS_PT_BR, canonical)
    ? ARTIST_TEAM_CONTACT_CATEGORY_LABELS_PT_BR[canonical as ArtistTeamContactCategory]
    : UNKNOWN_TEAM_CONTACT_CATEGORY_LABEL;
}
