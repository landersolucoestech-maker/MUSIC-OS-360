/**
 * Category of an artist team contact (artists.team_contacts[].category).
 * The column is free text: this tuple is the canonical vocabulary the UI offers,
 * it is not an enforced constraint. `roadie` is kept because the signup already
 * sends it (owner decision pending).
 */
export const ARTIST_TEAM_CONTACT_CATEGORIES = [
  "booker", "press_office", "legal", "finance", "accountant", "publisher", "agent", "record_label", "roadie",
] as const;
export type ArtistTeamContactCategory = (typeof ARTIST_TEAM_CONTACT_CATEGORIES)[number];

export const ARTIST_TEAM_CONTACT_CATEGORY_LABELS_PT_BR: Readonly<Record<ArtistTeamContactCategory, string>> = {
  booker: "Booker",
  press_office: "Assessoria de imprensa",
  legal: "Jurídico",
  finance: "Financeiro",
  accountant: "Contador",
  publisher: "Editora musical",
  agent: "Empresário",
  record_label: "Gravadora",
  roadie: "Roadie",
};
