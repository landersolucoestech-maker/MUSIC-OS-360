/**
 * artist.mapper.ts
 * ─────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for every artist data transformation.
 *
 * Two distinct translation boundaries live here:
 *   1. API wire (canonical snake_case CZ-042 contract) ↔ internal `Artist`
 *      model (camelCase). See `wireToArtist`/`artistToWirePayload`, used
 *      exclusively where data enters/leaves the API
 *      (`useArtist*` hooks/`artist.service.ts`).
 *   2. Internal `Artist` model ↔ form state (react-hook-form).
 *      Export, import and the form must consume these functions to guarantee
 *      full consistency across CREATE, EDIT, VIEW and LIST.
 * ─────────────────────────────────────────────────────────────────
 */

import type {
  Artist,
  ArtistDocument,
  ArtistGender,
  ArtistProfileType,
  ArtistRelationship,
  ArtistRelationshipContactType,
  ArtistResponsible,
  ArtistLinkedContact,
  ArtistSpecialty,
  ArtistTeamContact,
  DistributorEntry,
} from "@/modules/artist/types/artist.types";
import type { ArtistRelationshipType } from "@music-os-360/types";

// ─── Internal utilities ──────────────────────────────────────────

function str(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  return s;
}

function strOrNull(v: unknown): string | null {
  const s = str(v);
  return s !== "" ? s : null;
}

function numOrNull(v: unknown): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(String(v).trim());
  return isNaN(n) ? null : n;
}

/**
 * Removes diacritics and lowercases for case-insensitive, accent-tolerant
 * matching.
 */
function normalizeKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Returns the Excel row value for the first matching header, comparing after
 * Unicode/case normalization. This handles Excel saving "Tipo de Perfil" with a
 * different NFD form.
 */
export function pickRow(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    // Exact attempt first (faster)
    if (key in row) return row[key];
    // Fallback: normalizado
    const normKey = normalizeKey(key);
    for (const rowKey of Object.keys(row)) {
      if (normalizeKey(rowKey) === normKey) return row[rowKey];
    }
  }
  return undefined;
}

// ─── Option values ↔ PT-BR labels (CZ-042) ───────────────────────
// Stored/wire values are the canonical English enum values; every label shown
// to the user is PT-BR. An unknown value never leaks raw into the UI — it
// falls back to a PT-BR placeholder.

export const PROFILE_TYPE_LABELS: Record<ArtistProfileType, string> = {
  independent:  "Independente",
  managed:      "Com empresário",
  record_label: "Com gravadora",
  publisher:    "Com editora",
};

export const RELATIONSHIP_TYPE_LABELS: Record<ArtistRelationshipContactType, string> = {
  agent:        "Empresário",
  record_label: "Gravadora",
  publisher:    "Editora",
  booker:       "Booker",
  legal:        "Jurídico",
  finance:      "Financeiro",
  accountant:   "Contador",
  press_office: "Assessoria de Imprensa",
};

export const GENDER_LABELS: Record<ArtistGender, string> = {
  male:   "Masculino",
  female: "Feminino",
};

/**
 * Canonical enum → readable label mapping.
 * Single source of truth for the form, the 360 view, export and import.
 */
export const SPECIALTY_LABELS: Record<ArtistSpecialty, string> = {
  dj:          "DJ",
  dj_producer: "DJ/Produtor",
  songwriter:  "Compositor/Autor",
  performer:   "Intérprete",
  producer:    "Produtor",
};

function labelFrom(map: Record<string, string>, value: unknown, fallback: string): string {
  const key = str(value);
  if (!key) return fallback;
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key]! : fallback;
}

export function profileTypeLabel(value: unknown): string {
  return labelFrom(PROFILE_TYPE_LABELS, value, "Perfil não reconhecido");
}

export function relationshipTypeLabel(value: unknown): string {
  return labelFrom(RELATIONSHIP_TYPE_LABELS, value, "Relacionamento não reconhecido");
}

export function genderLabel(value: unknown): string {
  return labelFrom(GENDER_LABELS, value, "Não informado");
}

export function specialtyLabel(value: unknown): string {
  return labelFrom(SPECIALTY_LABELS, value, "Especialidade não reconhecida");
}

/**
 * Normalizes an imported "Tipo de Perfil" cell to the canonical enum,
 * accepting the canonical value, the PT-BR label, or the value written by
 * spreadsheets exported before CZ-042 (independente/com_empresario/…),
 * tolerant to case, spaces and accents.
 */
export function normalizeProfileType(raw: unknown): ArtistProfileType {
  const v = normalizeKey(str(raw)).replace(/\s+/g, "_");
  if (!v) return "independent";
  for (const [value, label] of Object.entries(PROFILE_TYPE_LABELS)) {
    if (v === value || v === normalizeKey(label).replace(/\s+/g, "_")) return value as ArtistProfileType;
  }
  if (v === "managed" || v.includes("empresari")) return "managed";
  if (v.includes("gravadora") || v === "record_label") return "record_label";
  if (v.includes("editora")) return "publisher";
  return "independent";
}

/** Normalizes an imported "Gênero" cell (canonical value or PT-BR label). */
export function normalizeGender(raw: unknown): ArtistGender | "" {
  const v = normalizeKey(str(raw));
  if (!v) return "";
  for (const [value, label] of Object.entries(GENDER_LABELS)) {
    if (v === value || v === normalizeKey(label)) return value as ArtistGender;
  }
  return "";
}

/** Reverse mapping: normalized label → internal enum. */
const SPECIALTY_ENUM: Record<string, ArtistSpecialty> = Object.fromEntries(
  Object.entries(SPECIALTY_LABELS).map(([k, v]) => [normalizeKey(v), k as ArtistSpecialty]),
);

/**
 * Pre-CZ-042 spreadsheet values (the old Portuguese enum) → canonical value.
 * Only used when parsing user-supplied import files, never on the API wire.
 */
const SPECIALTY_PRE_CZ042_IMPORT_VALUES: Record<string, ArtistSpecialty> = {
  dj_produtor: "dj_producer",
  compositor_autor: "songwriter",
  interprete: "performer",
  produtor: "producer",
};

/**
 * Converts any label or enum variation into the internal value.
 * Returns "" for unrecognized values (filtered out on import).
 */
export function normalizeSpecialty(raw: string): ArtistSpecialty | "" {
  const v1 = normalizeKey(raw);
  if (SPECIALTY_ENUM[v1]) return SPECIALTY_ENUM[v1]!;

  const v2 = normalizeKey(raw.replace(/_/g, "/"));
  if (SPECIALTY_ENUM[v2]) return SPECIALTY_ENUM[v2]!;

  const asEnum = v1.replace(/\//g, "_");
  if (Object.prototype.hasOwnProperty.call(SPECIALTY_LABELS, asEnum)) return asEnum as ArtistSpecialty;
  if (SPECIALTY_PRE_CZ042_IMPORT_VALUES[asEnum]) return SPECIALTY_PRE_CZ042_IMPORT_VALUES[asEnum]!;

  return "";
}

// ─── Artist slug ──────────────────────────────────────────────────

/**
 * Generates a slug from the artist name: removes accents, lowercases and
 * replaces spaces with hyphens.
 */
export function generateArtisticSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// ─── Platform URL validators ─────────────────────────────────────
// The domain works exclusively with URLs — no layer extracts or rebuilds a
// platform ID. The regexes below mirror exactly the `@Matches` of
// CreateArtistDto/UpdateArtistDto in the backend (the validation source of
// truth); here they only give immediate visual feedback in the form.

export type UrlValidationState = "idle" | "valid" | "invalid";

const SPOTIFY_ARTIST_URL_RE = /^https:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?artist\/[A-Za-z0-9]{22}(?:[/?#].*)?$/i;

export function validateSpotifyUrl(url: string): UrlValidationState {
  if (!url.trim()) return "idle";
  return SPOTIFY_ARTIST_URL_RE.test(url.trim()) ? "valid" : "invalid";
}

export type YoutubeRef = { kind: "id" | "handle" | "username" | "custom"; value: string };

/**
 * find-eb3c5c45-class (naming-canonical.md "one business rule, one
 * authoritative implementation"): single canonical YouTube channel
 * reference parser for the frontend, mirroring
 * apps/api/.../platform-profiles/youtube-ref.util.ts's `parseYoutubeRef`
 * (bare `UC…` id, `@handle`, and URLs `/channel/UC…`, `/@handle`,
 * `/user/NAME`, `/c/NAME`, bare `/NAME`). This used to be two separate,
 * narrower hand-rolled regexes here — one on the form validator, one on
 * the "Sincronizar agora" button — that disagreed on which inputs were
 * valid. TypeScript can't import the backend module into the web bundle,
 * so this is a deliberate parallel implementation of the same shape; both
 * `validateYoutubeUrl` and `normalizeYoutubeProfileUrl` (used by
 * ArtistPlatformMetrics's sync button) now route through this one
 * function instead of duplicating the regex set.
 */
export function parseYoutubeRef(raw: string): YoutubeRef | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  if (/^UC[A-Za-z0-9_-]{20,}$/.test(value)) return { kind: "id", value };
  if (/^@[A-Za-z0-9._-]+$/.test(value)) return { kind: "handle", value: value.slice(1) };

  let path = value;
  try {
    if (/^https?:\/\//i.test(value)) path = new URL(value).pathname;
  } catch { /* treat as raw path */ }
  path = path.replace(/^\/+|\/+$/g, "");

  const channel = path.match(/^channel\/(UC[A-Za-z0-9_-]{20,})/);
  if (channel) return { kind: "id", value: channel[1]! };
  const handle = path.match(/^@([A-Za-z0-9._-]+)/);
  if (handle) return { kind: "handle", value: handle[1]! };
  const user = path.match(/^user\/([A-Za-z0-9._-]+)/i);
  if (user) return { kind: "username", value: user[1]! };
  const custom = path.match(/^c\/([A-Za-z0-9._-]+)/i);
  if (custom) return { kind: "custom", value: custom[1]! };
  const bare = path.match(/^([A-Za-z0-9._-]+)$/);
  if (bare) return { kind: "custom", value: bare[1]! };
  return null;
}

export function validateYoutubeUrl(url: string): UrlValidationState {
  if (!url.trim()) return "idle";
  return parseYoutubeRef(url) ? "valid" : "invalid";
}

/**
 * Normalizes any accepted YouTube channel reference (bare id/handle or
 * full URL, http or https) to the value sent as `profileUrl` for sync —
 * the backend's own `parseYoutubeRef` accepts the same shapes, so no URL
 * reconstruction is needed, just pass-through of a value proven parseable.
 */
export function normalizeYoutubeProfileUrl(input: string | null | undefined): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;
  return parseYoutubeRef(value) ? value : null;
}

/**
 * Validates that `url` is a real URL whose host is (a subdomain of) `host`.
 * Parses the URL instead of matching an unanchored substring regex, so a value
 * like `https://evil.com/?x=instagram.com/` is correctly rejected (CWE-20).
 */
function hasHost(url: string, host: string): boolean {
  const trimmed = url.trim();
  // Tolerate scheme-less input (users paste "instagram.com/x") without weakening
  // the check: the value is still parsed as a URL and the HOST is compared.
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const h = new URL(candidate).hostname.toLowerCase();
    return h === host || h.endsWith(`.${host}`);
  } catch {
    return false;
  }
}

export function validateInstagramUrl(url: string): UrlValidationState {
  if (!url.trim()) return "idle";
  return hasHost(url, "instagram.com") ? "valid" : "invalid";
}

export function validateTiktokUrl(url: string): UrlValidationState {
  if (!url.trim()) return "idle";
  return hasHost(url, "tiktok.com") ? "valid" : "invalid";
}

export function validateSoundcloudUrl(url: string): UrlValidationState {
  if (!url.trim()) return "idle";
  return hasHost(url, "soundcloud.com") ? "valid" : "invalid";
}

export function validateDeezerUrl(url: string): UrlValidationState {
  if (!url.trim()) return "idle";
  return hasHost(url, "deezer.com") ? "valid" : "invalid";
}

export function validateAppleMusicUrl(url: string): UrlValidationState {
  if (!url.trim()) return "idle";
  return hasHost(url, "music.apple.com") ? "valid" : "invalid";
}

// ════════════════════════════════════════════════════════════════
// ─── Boundary 1: API wire (canonical CZ-042 contract) ↔ Artist ────
// ════════════════════════════════════════════════════════════════
// Request DTO keys and response keys are the canonical snake_case columns
// (`stage_name`, `agent_name`, …) plus the decrypted `email`/`phone`/
// `cpf_cnpj`/`manager_contact` and the allow-listed metadata-only keys
// (`gender`, `spotify_listeners`, …). These functions are the ONLY place
// that knows both names of each field. No pre-CZ-042 Portuguese key is ever
// read or sent.

type WireDistributorEntry = { id: string; email: string; customName?: string };
type WireResponsiblePerson = { name: string; phone: string; email: string };
type WireRelationship = {
  type: ArtistRelationshipContactType;
  name: string;
  phone: string;
  email: string;
  office?: string;
  crc?: string;
  responsibles?: WireResponsiblePerson[];
  distributors?: WireDistributorEntry[];
};
type WireLinkedContact = { contactId: string; distributors?: WireDistributorEntry[] };
type WireTeamContact = {
  name: string;
  category: string;
  phone: string;
  email: string;
  distributors: WireDistributorEntry[];
};

/** Shape of the JSON exchanged with the API (canonical CZ-042 contract). */
export type ArtistWireRecord = {
  id: string;
  user_id?: string;
  stage_name?: string;
  full_name?: string | null;
  status?: string | null;
  registration_status?: string | null;
  relationship?: ArtistRelationshipType | null;
  music_genre?: string | null;
  email?: string | null;
  phone?: string | null;
  cpf_cnpj?: string | null;
  photo_url?: string | null;
  notes?: string | null;
  contract_id?: string | null;
  artist_slug?: string | null;
  music_tags?: string[] | null;
  career_stage?: string | null;
  relationships?: WireRelationship[] | null;
  spotify_url?: string | null;
  spotify_listeners?: number | null;
  youtube_url?: string | null;
  youtube_subscribers?: number | null;
  deezer_url?: string | null;
  deezer_fans?: number | null;
  apple_music_url?: string | null;
  apple_music_albums?: number | null;
  soundcloud_url?: string | null;
  soundcloud_followers?: number | null;
  instagram_url?: string | null;
  instagram_followers?: number | null;
  tiktok_url?: string | null;
  tiktok_followers?: number | null;
  gender?: string | null;
  birth_date?: string | null;
  rg?: string | null;
  address?: string | null;
  bank_name?: string | null;
  bank_branch?: string | null;
  bank_account?: string | null;
  pix_key?: string | null;
  account_holder?: string | null;
  specialties?: string[] | null;
  profile_type?: string | null;
  agent_id?: string | null;
  agent_name?: string | null;
  agent_phone?: string | null;
  agent_email?: string | null;
  record_label_id?: string | null;
  record_label_name?: string | null;
  record_label_phone?: string | null;
  record_label_email?: string | null;
  record_label_contact_id?: string | null;
  record_label_contact_name?: string | null;
  record_label_contact_phone?: string | null;
  record_label_contact_email?: string | null;
  selected_distributors?: Record<string, boolean> | null;
  distributor_emails?: Record<string, string> | null;
  company_selected_distributors?: Record<string, boolean> | null;
  company_distributor_emails?: Record<string, string> | null;
  personal_documents_url?: string | null;
  press_kit_url?: string | null;
  internal_notes?: string | null;
  gallery_urls?: string[] | null;
  manager_name?: string | null;
  manager_contact?: string | null;
  executive_producer?: string | null;
  booking_agency?: string | null;
  partner_label?: string | null;
  documents?: ArtistDocument[] | null;
  general_distributors?: WireDistributorEntry[] | null;
  linked_contacts?: WireLinkedContact[] | null;
  team_contacts?: WireTeamContact[] | null;
  created_at?: string;
  updated_at?: string;
};

/**
 * Scalar fields whose internal name maps 1:1 to a wire key with no value
 * transform. Single table used by BOTH directions, so a field can never be
 * renamed on one side only.
 */
const SCALAR_FIELDS = [
  ["stageName", "stage_name"],
  ["fullName", "full_name"],
  ["status", "status"],
  ["registrationStatus", "registration_status"],
  ["musicGenre", "music_genre"],
  ["email", "email"],
  ["phone", "phone"],
  ["taxId", "cpf_cnpj"],
  ["photoUrl", "photo_url"],
  ["notes", "notes"],
  ["contractId", "contract_id"],
  ["artistSlug", "artist_slug"],
  ["musicTags", "music_tags"],
  ["careerStage", "career_stage"],
  ["spotifyUrl", "spotify_url"],
  ["spotifyListeners", "spotify_listeners"],
  ["youtubeUrl", "youtube_url"],
  ["youtubeSubscribers", "youtube_subscribers"],
  ["deezerUrl", "deezer_url"],
  ["deezerFans", "deezer_fans"],
  ["appleMusicUrl", "apple_music_url"],
  ["appleMusicAlbums", "apple_music_albums"],
  ["soundcloudUrl", "soundcloud_url"],
  ["soundcloudFollowers", "soundcloud_followers"],
  ["instagramUrl", "instagram_url"],
  ["instagramFollowers", "instagram_followers"],
  ["tiktokUrl", "tiktok_url"],
  ["tiktokFollowers", "tiktok_followers"],
  ["gender", "gender"],
  ["birthDate", "birth_date"],
  ["idDocument", "rg"],
  ["address", "address"],
  ["bankName", "bank_name"],
  ["bankBranch", "bank_branch"],
  ["bankAccount", "bank_account"],
  ["pixKey", "pix_key"],
  ["accountHolder", "account_holder"],
  ["specialties", "specialties"],
  ["profileType", "profile_type"],
  ["agentId", "agent_id"],
  ["agentName", "agent_name"],
  ["agentPhone", "agent_phone"],
  ["agentEmail", "agent_email"],
  ["recordLabelId", "record_label_id"],
  ["recordLabelName", "record_label_name"],
  ["recordLabelPhone", "record_label_phone"],
  ["recordLabelEmail", "record_label_email"],
  ["recordLabelContactId", "record_label_contact_id"],
  ["recordLabelContactName", "record_label_contact_name"],
  ["recordLabelContactPhone", "record_label_contact_phone"],
  ["recordLabelContactEmail", "record_label_contact_email"],
  ["selectedDistributors", "selected_distributors"],
  ["distributorEmails", "distributor_emails"],
  ["companySelectedDistributors", "company_selected_distributors"],
  ["companyDistributorEmails", "company_distributor_emails"],
  ["personalDocumentsUrl", "personal_documents_url"],
  ["pressKitUrl", "press_kit_url"],
  ["internalNotes", "internal_notes"],
  ["galleryUrls", "gallery_urls"],
  ["managerName", "manager_name"],
  ["managerContact", "manager_contact"],
  ["executiveProducer", "executive_producer"],
  ["bookingAgency", "booking_agency"],
  ["partnerLabel", "partner_label"],
  ["documents", "documents"],
] as const satisfies ReadonlyArray<readonly [keyof Artist, keyof ArtistWireRecord]>;

function distributorFromWire(d: WireDistributorEntry): DistributorEntry {
  return { id: d.id, email: d.email, ...(d.customName !== undefined ? { customName: d.customName } : {}) };
}
function distributorToWire(d: DistributorEntry): WireDistributorEntry {
  return { id: d.id, email: d.email, ...(d.customName !== undefined ? { customName: d.customName } : {}) };
}

function responsibleFromWire(r: WireResponsiblePerson): ArtistResponsible {
  return { name: r.name ?? "", phone: r.phone ?? "", email: r.email ?? "" };
}
function responsibleToWire(r: ArtistResponsible): WireResponsiblePerson {
  return { name: r.name ?? "", phone: r.phone ?? "", email: r.email ?? "" };
}

function relationshipFromWire(r: WireRelationship): ArtistRelationship {
  return {
    type: r.type,
    name: r.name ?? "",
    phone: r.phone ?? "",
    email: r.email ?? "",
    ...(r.office !== undefined ? { office: r.office } : {}),
    ...(r.crc !== undefined ? { crc: r.crc } : {}),
    ...(r.responsibles ? { responsibles: r.responsibles.map(responsibleFromWire) } : {}),
    ...(r.distributors ? { distributors: r.distributors.map(distributorFromWire) } : {}),
  };
}
function relationshipToWire(r: ArtistRelationship): WireRelationship {
  return {
    type: r.type,
    name: r.name ?? "",
    phone: r.phone ?? "",
    email: r.email ?? "",
    ...(r.office !== undefined ? { office: r.office } : {}),
    ...(r.crc !== undefined ? { crc: r.crc } : {}),
    ...(r.responsibles ? { responsibles: r.responsibles.map(responsibleToWire) } : {}),
    ...(r.distributors ? { distributors: r.distributors.map(distributorToWire) } : {}),
  };
}

function linkedContactFromWire(c: WireLinkedContact): ArtistLinkedContact {
  return {
    contactId: c.contactId,
    ...(c.distributors ? { distributors: c.distributors.map(distributorFromWire) } : {}),
  };
}
function linkedContactToWire(c: ArtistLinkedContact): WireLinkedContact {
  return {
    contactId: c.contactId,
    ...(c.distributors ? { distributors: c.distributors.map(distributorToWire) } : {}),
  };
}

function teamContactFromWire(c: WireTeamContact): ArtistTeamContact {
  return {
    name: c.name ?? "",
    category: c.category ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    distributors: Array.isArray(c.distributors) ? c.distributors.map(distributorFromWire) : [],
  };
}
function teamContactToWire(c: ArtistTeamContact): WireTeamContact {
  return {
    name: c.name ?? "",
    category: c.category ?? "",
    phone: c.phone ?? "",
    email: c.email ?? "",
    distributors: Array.isArray(c.distributors) ? c.distributors.map(distributorToWire) : [],
  };
}

/** Maps an array field, preserving an explicit null/undefined as-is. */
function mapList<I, O>(v: I[] | null | undefined, fn: (item: I) => O): O[] | null | undefined {
  return Array.isArray(v) ? v.map(fn) : v;
}

/**
 * Converts a record coming from the API (canonical contract) into the internal
 * `Artist` model. Only the canonical keys are read — there is no pass-through
 * of raw wire keys into the internal model.
 */
export function wireToArtist(w: ArtistWireRecord): Artist {
  const artist: Record<string, unknown> = {
    id: w.id,
    ...(w.user_id !== undefined ? { user_id: w.user_id } : {}),
    created_at: w.created_at,
    updated_at: w.updated_at,
  };
  for (const [key, wireKey] of SCALAR_FIELDS) {
    if (w[wireKey] !== undefined) artist[key] = w[wireKey];
  }
  artist.stageName = w.stage_name ?? "";
  if (w.relationship !== undefined) artist.relationship = w.relationship;
  if (w.relationships !== undefined) artist.relationships = mapList(w.relationships, relationshipFromWire);
  if (w.general_distributors !== undefined) artist.generalDistributors = mapList(w.general_distributors, distributorFromWire);
  if (w.linked_contacts !== undefined) artist.linkedContacts = mapList(w.linked_contacts, linkedContactFromWire);
  if (w.team_contacts !== undefined) artist.teamContacts = mapList(w.team_contacts, teamContactFromWire);
  return artist as unknown as Artist;
}

/**
 * Converts an internal `Artist` payload (partial — create or update) into the
 * request body the API accepts (canonical contract). Only keys present in the
 * input are emitted, so a PATCH never clears a column it did not touch.
 * `expectedUpdatedAt` (optimistic concurrency) is forwarded unchanged.
 * Used at the exit point (`useArtist*` hooks), never in components.
 */
export function artistToWirePayload(
  a: Partial<Artist> & { expectedUpdatedAt?: string },
): Partial<ArtistWireRecord> & { expectedUpdatedAt?: string } {
  const w: Record<string, unknown> = {};
  for (const [key, wireKey] of SCALAR_FIELDS) {
    if (key in a) w[wireKey] = a[key];
  }
  if ("relationships" in a) w.relationships = mapList(a.relationships, relationshipToWire);
  if ("generalDistributors" in a) w.general_distributors = mapList(a.generalDistributors, distributorToWire);
  if ("linkedContacts" in a) w.linked_contacts = mapList(a.linkedContacts, linkedContactToWire);
  if ("teamContacts" in a) w.team_contacts = mapList(a.teamContacts, teamContactToWire);
  if (a.expectedUpdatedAt !== undefined) w.expectedUpdatedAt = a.expectedUpdatedAt;
  return w as Partial<ArtistWireRecord> & { expectedUpdatedAt?: string };
}

// ════════════════════════════════════════════════════════════════
// ─── Boundary 2: Artist ↔ form state ─────────────────────────────
// ════════════════════════════════════════════════════════════════

export interface ArtistFormResponsible {
  name: string;
  phone: string;
  email: string;
}

export interface ArtistFormRelationship {
  type: ArtistRelationshipContactType;
  name: string;
  phone: string;
  email: string;
  office: string;
  crc: string;
  responsibles: ArtistFormResponsible[];
  distributors: DistributorEntry[];
}

export interface ArtistFormFieldValues {
  stageName: string;
  artistSlug: string;
  musicTags: string[];
  careerStage: string;
  musicGenre: string;
  artistStatus: string;
  specialties: string[];
  biography: string;
  internalNotes: string;
  fullName: string;
  birthDate: string;
  taxId: string;
  rg: string;
  address: string;
  phone: string;
  email: string;
  bankName: string;
  bankBranch: string;
  bankAccount: string;
  pixKey: string;
  accountHolder: string;
  spotify: string;
  spotifyListeners: string;
  instagram: string;
  instagramFollowers: string;
  youtube: string;
  youtubeSubscribers: string;
  tiktok: string;
  tiktokFollowers: string;
  soundcloud: string;
  soundcloudFollowers: string;
  deezer: string;
  deezerFans: string;
  appleMusic: string;
  appleMusicAlbums: string;
  // commercial relationships (new relational model)
  relationships: ArtistFormRelationship[];
  // legacy — kept for backward compat with the CRM select
  profileType: ArtistProfileType;
  agentId: string;
  agentName: string;
  agentPhone: string;
  agentEmail: string;
  recordLabelId: string;
  recordLabelName: string;
  recordLabelPhone: string;
  recordLabelEmail: string;
  recordLabelContactId: string;
  recordLabelContactName: string;
  recordLabelContactPhone: string;
  recordLabelContactEmail: string;
  selectedDistributors: Record<string, boolean>;
  distributorEmails: Record<string, string>;
  companySelectedDistributors: Record<string, boolean>;
  companyDistributorEmails: Record<string, string>;
  photoUrl: string;
  personalDocumentsUrl: string;
  pressKitUrl: string;
  contractId: string;
}

function emptyRelationship(type: ArtistFormRelationship["type"]): ArtistFormRelationship {
  return { type, name: "", phone: "", email: "", office: "", crc: "", responsibles: [], distributors: [] };
}

function relationshipToFormRelationship(r: ArtistRelationship): ArtistFormRelationship {
  return {
    type: r.type,
    name: r.name ?? "",
    phone: r.phone ?? "",
    email: r.email ?? "",
    office: r.office ?? "",
    crc: r.crc ?? "",
    responsibles: Array.isArray(r.responsibles)
      ? r.responsibles.map((rv) => ({ name: rv.name ?? "", phone: rv.phone ?? "", email: rv.email ?? "" }))
      : [],
    distributors: Array.isArray(r.distributors) ? r.distributors : [],
  };
}

/** Builds DistributorEntry[] from the legacy distributor fields. */
function buildLegacyDistributors(
  selected: Record<string, boolean> | null | undefined,
  emails: Record<string, string> | null | undefined,
): DistributorEntry[] {
  if (!selected) return [];
  return Object.entries(selected)
    .filter(([, isSelected]) => isSelected)
    .map(([id]) => ({ id, email: emails?.[id] ?? "" }));
}

/**
 * Migrates legacy fields into the new relationships array when the artist has
 * no `relationships` but has agent* / recordLabel* fields filled in.
 * Also migrates legacy distributors and legacy recordLabelContact* fields.
 */
function migrateLegacyRelationships(artist: Artist): ArtistFormRelationship[] {
  const rels: ArtistFormRelationship[] = [];

  // Legacy distributors — assigned to the first agent or label
  const legacyDists = buildLegacyDistributors(
    artist.selectedDistributors,
    artist.distributorEmails,
  );
  const legacyCompanyDists = buildLegacyDistributors(
    artist.companySelectedDistributors,
    artist.companyDistributorEmails,
  );

  if (artist.agentName) {
    rels.push({
      type: "agent",
      name: str(artist.agentName),
      phone: str(artist.agentPhone),
      email: str(artist.agentEmail),
      office: "",
      crc: "",
      responsibles: [],
      distributors: legacyDists,
    });
  }

  if (artist.recordLabelName) {
    const relType: ArtistFormRelationship["type"] =
      str(artist.profileType) === "publisher" ? "publisher" : "record_label";
    // Migrate the single legacy contact person (recordLabelContact*) into the array
    const responsibles: ArtistFormResponsible[] = [];
    if (artist.recordLabelContactName) {
      responsibles.push({
        name: str(artist.recordLabelContactName),
        phone: str(artist.recordLabelContactPhone),
        email: str(artist.recordLabelContactEmail),
      });
    }
    rels.push({
      type: relType,
      name: str(artist.recordLabelName),
      phone: str(artist.recordLabelPhone),
      email: str(artist.recordLabelEmail),
      office: "",
      crc: "",
      responsibles,
      // If an agent exists, legacyDists were assigned to it; otherwise assign them here
      distributors: artist.agentName ? legacyCompanyDists : legacyDists,
    });
  }

  return rels;
}

const PROFILE_TYPES = Object.keys(PROFILE_TYPE_LABELS) as ArtistProfileType[];

function toProfileType(v: unknown): ArtistProfileType {
  const s = str(v);
  return (PROFILE_TYPES as string[]).includes(s) ? (s as ArtistProfileType) : "independent";
}

/**
 * Converts an artist record (internal `Artist` model) into form state.
 * Used in ArtistFormModal's useEffect when open=true.
 */
export function artistToFormFields(artist: Artist | null | undefined): ArtistFormFieldValues {
  const emptyBase: ArtistFormFieldValues = {
    stageName: "",
    artistSlug: "",
    musicTags: [],
    careerStage: "",
    musicGenre: "",
    artistStatus: "signed",
    specialties: [],
    biography: "",
    internalNotes: "",
    fullName: "",
    birthDate: "",
    taxId: "",
    rg: "",
    address: "",
    phone: "",
    email: "",
    bankName: "",
    bankBranch: "",
    bankAccount: "",
    pixKey: "",
    accountHolder: "",
    spotify: "",
    spotifyListeners: "",
    instagram: "",
    instagramFollowers: "",
    youtube: "",
    youtubeSubscribers: "",
    tiktok: "",
    tiktokFollowers: "",
    soundcloud: "",
    soundcloudFollowers: "",
    deezer: "",
    deezerFans: "",
    appleMusic: "",
    appleMusicAlbums: "",
    relationships: [],
    profileType: "independent",
    agentId: "",
    agentName: "",
    agentPhone: "",
    agentEmail: "",
    recordLabelId: "",
    recordLabelName: "",
    recordLabelPhone: "",
    recordLabelEmail: "",
    recordLabelContactId: "",
    recordLabelContactName: "",
    recordLabelContactPhone: "",
    recordLabelContactEmail: "",
    selectedDistributors: {},
    distributorEmails: {},
    companySelectedDistributors: {},
    companyDistributorEmails: {},
    photoUrl: "",
    personalDocumentsUrl: "",
    pressKitUrl: "",
    contractId: "",
  };

  if (!artist) return emptyBase;

  // Relationships: use the new field or migrate from legacy
  const relationships: ArtistFormRelationship[] =
    Array.isArray(artist.relationships) && artist.relationships.length > 0
      ? artist.relationships.map(relationshipToFormRelationship)
      : migrateLegacyRelationships(artist);

  const countOrEmpty = (n: number | null | undefined) => (n != null ? String(n) : "");

  return {
    stageName: str(artist.stageName),
    artistSlug: str(artist.artistSlug),
    musicTags: Array.isArray(artist.musicTags) ? artist.musicTags : [],
    careerStage: str(artist.careerStage),
    musicGenre: str(artist.musicGenre),
    artistStatus: str(artist.status) || "signed",
    specialties: Array.isArray(artist.specialties) ? artist.specialties : [],
    biography: str(artist.notes),
    internalNotes: str(artist.internalNotes),
    // Personal
    fullName: str(artist.fullName),
    birthDate: str(artist.birthDate),
    taxId: str(artist.taxId),
    rg: str(artist.idDocument),
    address: str(artist.address),
    phone: str(artist.phone),
    email: str(artist.email),
    // Banking
    bankName: str(artist.bankName),
    bankBranch: str(artist.bankBranch),
    bankAccount: str(artist.bankAccount),
    pixKey: str(artist.pixKey),
    accountHolder: str(artist.accountHolder),
    // Platforms — the URL is the persisted data (no rebuilding from an ID)
    spotify: str(artist.spotifyUrl),
    spotifyListeners: countOrEmpty(artist.spotifyListeners),
    instagram: str(artist.instagramUrl),
    instagramFollowers: countOrEmpty(artist.instagramFollowers),
    youtube: str(artist.youtubeUrl),
    youtubeSubscribers: countOrEmpty(artist.youtubeSubscribers),
    tiktok: str(artist.tiktokUrl),
    tiktokFollowers: countOrEmpty(artist.tiktokFollowers),
    soundcloud: str(artist.soundcloudUrl),
    soundcloudFollowers: countOrEmpty(artist.soundcloudFollowers),
    deezer: str(artist.deezerUrl),
    deezerFans: countOrEmpty(artist.deezerFans),
    appleMusic: str(artist.appleMusicUrl),
    appleMusicAlbums: countOrEmpty(artist.appleMusicAlbums),
    // Relationships
    relationships,
    // Legacy
    profileType: toProfileType(artist.profileType),
    agentId: str(artist.agentId),
    agentName: str(artist.agentName),
    agentPhone: str(artist.agentPhone),
    agentEmail: str(artist.agentEmail),
    recordLabelId: str(artist.recordLabelId),
    recordLabelName: str(artist.recordLabelName),
    recordLabelPhone: str(artist.recordLabelPhone),
    recordLabelEmail: str(artist.recordLabelEmail),
    recordLabelContactId: str(artist.recordLabelContactId),
    recordLabelContactName: str(artist.recordLabelContactName),
    recordLabelContactPhone: str(artist.recordLabelContactPhone),
    recordLabelContactEmail: str(artist.recordLabelContactEmail),
    selectedDistributors: artist.selectedDistributors ?? {},
    distributorEmails: artist.distributorEmails ?? {},
    companySelectedDistributors: artist.companySelectedDistributors ?? {},
    companyDistributorEmails: artist.companyDistributorEmails ?? {},
    // Files
    photoUrl: str(artist.photoUrl),
    personalDocumentsUrl: str(artist.personalDocumentsUrl),
    pressKitUrl: str(artist.pressKitUrl),
    contractId: str(artist.contractId),
  };
}

export type FormToArtistInput = ArtistFormFieldValues;

/**
 * Converts the form state into a persistence-ready payload (internal `Artist`
 * model). Saves every field — including type and status — so export and
 * re-import lose no data.
 */
export function formToArtistPayload(f: FormToArtistInput): Omit<Artist, "id" | "user_id" | "created_at" | "updated_at"> {
  // Converts ArtistFormRelationship[] → ArtistRelationship[]
  const relationships: ArtistRelationship[] = f.relationships
    .filter((r) => r.name.trim() !== "")
    .map((r) => {
      const validResponsibles = (r.responsibles ?? []).filter((rv) => rv.name.trim() !== "");
      return {
        type: r.type,
        name: r.name.trim(),
        phone: r.phone.trim(),
        email: r.email.trim(),
        ...(r.office.trim() ? { office: r.office.trim() } : {}),
        ...(r.crc.trim() ? { crc: r.crc.trim() } : {}),
        ...(validResponsibles.length > 0
          ? { responsibles: validResponsibles.map((rv) => ({ name: rv.name, phone: rv.phone, email: rv.email })) }
          : {}),
        ...(r.distributors.length > 0 ? { distributors: r.distributors } : {}),
      };
    });

  // Derives the legacy distributor maps from the new relational model
  // (agent + record label + publisher have their own distributors in the new model)
  const agentRels = f.relationships.filter((r) => r.type === "agent");
  const labelRels = f.relationships.filter((r) => r.type === "record_label" || r.type === "publisher");

  const selectedDistributors: Record<string, boolean> = {};
  const distributorEmails: Record<string, string>      = {};
  for (const rel of agentRels) {
    for (const d of rel.distributors) {
      selectedDistributors[d.id] = true;
      if (d.email) distributorEmails[d.id] = d.email;
    }
  }
  // Without an agent, use the label's distributors for the legacy map
  if (agentRels.length === 0) {
    for (const rel of labelRels) {
      for (const d of rel.distributors) {
        selectedDistributors[d.id] = true;
        if (d.email) distributorEmails[d.id] = d.email;
      }
    }
  }
  // "company" map (the label's distributors when an agent also exists)
  const companySelectedDistributors: Record<string, boolean> = {};
  const companyDistributorEmails: Record<string, string>      = {};
  if (agentRels.length > 0) {
    for (const rel of labelRels) {
      for (const d of rel.distributors) {
        companySelectedDistributors[d.id] = true;
        if (d.email) companyDistributorEmails[d.id] = d.email;
      }
    }
  }

  // First contact person of the first label → legacy fields
  const firstLabel = labelRels[0];
  const firstResp = firstLabel?.responsibles?.[0];

  return {
    stageName: f.stageName.trim(),
    artistSlug: strOrNull(f.artistSlug),
    musicTags: f.musicTags.length > 0 ? f.musicTags : null,
    careerStage: strOrNull(f.careerStage),
    fullName: strOrNull(f.fullName),
    status: (f.artistStatus || null) as Artist["status"],
    musicGenre: strOrNull(f.musicGenre),
    specialties: f.specialties.length > 0 ? f.specialties : null,
    notes: strOrNull(f.biography),
    photoUrl: strOrNull(f.photoUrl),
    // Personal
    birthDate: strOrNull(f.birthDate),
    idDocument: strOrNull(f.rg),
    address: strOrNull(f.address),
    phone: strOrNull(f.phone),
    email: strOrNull(f.email),
    taxId: strOrNull(f.taxId),
    // Banking
    bankName: strOrNull(f.bankName),
    bankBranch: strOrNull(f.bankBranch),
    bankAccount: strOrNull(f.bankAccount),
    pixKey: strOrNull(f.pixKey),
    accountHolder: strOrNull(f.accountHolder),
    // Platforms — persists the URL directly (backend contract: spotify_url/youtube_url)
    spotifyUrl: strOrNull(f.spotify),
    spotifyListeners: numOrNull(f.spotifyListeners),
    youtubeUrl: strOrNull(f.youtube),
    youtubeSubscribers: numOrNull(f.youtubeSubscribers),
    deezerUrl: strOrNull(f.deezer),
    deezerFans: numOrNull(f.deezerFans),
    appleMusicUrl: strOrNull(f.appleMusic),
    appleMusicAlbums: numOrNull(f.appleMusicAlbums),
    soundcloudUrl: strOrNull(f.soundcloud),
    soundcloudFollowers: numOrNull(f.soundcloudFollowers),
    instagramUrl: strOrNull(f.instagram),
    instagramFollowers: numOrNull(f.instagramFollowers),
    tiktokUrl: strOrNull(f.tiktok),
    tiktokFollowers: numOrNull(f.tiktokFollowers),
    // Relationships (new)
    relationships: relationships.length > 0 ? relationships : null,
    // Legacy (kept for backward compat — derived from the new relational model)
    profileType: f.profileType,
    agentId: strOrNull(f.agentId),
    agentName: strOrNull(f.agentName),
    agentPhone: strOrNull(f.agentPhone),
    agentEmail: strOrNull(f.agentEmail),
    recordLabelId: strOrNull(f.recordLabelId),
    recordLabelName: strOrNull(f.recordLabelName),
    recordLabelPhone: strOrNull(f.recordLabelPhone),
    recordLabelEmail: strOrNull(f.recordLabelEmail),
    // Label contact person — derived from the first contact of the first label relationship
    recordLabelContactId: strOrNull(f.recordLabelContactId),
    recordLabelContactName: firstResp ? firstResp.name || null : strOrNull(f.recordLabelContactName),
    recordLabelContactPhone: firstResp ? firstResp.phone || null : strOrNull(f.recordLabelContactPhone),
    recordLabelContactEmail: firstResp ? firstResp.email || null : strOrNull(f.recordLabelContactEmail),
    // Distributors — derived from the new relational model so legacy data is not erased
    selectedDistributors: Object.keys(selectedDistributors).length > 0 ? selectedDistributors : null,
    distributorEmails: Object.keys(distributorEmails).length > 0 ? distributorEmails : null,
    companySelectedDistributors: Object.keys(companySelectedDistributors).length > 0 ? companySelectedDistributors : null,
    companyDistributorEmails: Object.keys(companyDistributorEmails).length > 0 ? companyDistributorEmails : null,
    internalNotes: strOrNull(f.internalNotes),
    // Documents / press kit
    personalDocumentsUrl: strOrNull(f.personalDocumentsUrl),
    pressKitUrl: strOrNull(f.pressKitUrl),
  };
}

// Re-export emptyRelationship for use in the form component
export { emptyRelationship };
