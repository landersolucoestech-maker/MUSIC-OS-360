/**
 * PT-BR label of an artist team contact category (artists.team_contacts[].category).
 * Canonical slugs come from @music-os-360/types; legacy Portuguese slugs not yet
 * backfilled are mapped with the same table as the API
 * (apps/api/src/modules/artists/artist-legacy-fields.ts LEGACY_TEAM_CONTACT_CATEGORIES).
 */
import {
  ARTIST_TEAM_CONTACT_CATEGORY_LABELS_PT_BR,
  type ArtistTeamContactCategory,
} from "@music-os-360/types";

const LEGACY_TEAM_CONTACT_CATEGORIES: Readonly<Record<string, ArtistTeamContactCategory>> = {
  empresario: "agent",
  gravadora: "record_label",
  editora: "publisher",
  juridico: "legal",
  financeiro: "finance",
  contador: "accountant",
  assessoria: "press_office",
  editora_musical: "publisher",
  gestor: "agent",
};

export const UNKNOWN_TEAM_CONTACT_CATEGORY_LABEL = "Outro";

const has = (map: object, key: string) => Object.prototype.hasOwnProperty.call(map, key);

export function teamContactCategoryLabel(category: string | null | undefined): string {
  const key = (category ?? "").trim().toLowerCase();
  const canonical = has(LEGACY_TEAM_CONTACT_CATEGORIES, key) ? LEGACY_TEAM_CONTACT_CATEGORIES[key] : key;
  return has(ARTIST_TEAM_CONTACT_CATEGORY_LABELS_PT_BR, canonical)
    ? ARTIST_TEAM_CONTACT_CATEGORY_LABELS_PT_BR[canonical as ArtistTeamContactCategory]
    : UNKNOWN_TEAM_CONTACT_CATEGORY_LABEL;
}
