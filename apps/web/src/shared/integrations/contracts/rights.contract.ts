/**
 * shared/integrations/contracts/rights.contract.ts
 *
 * Copyright management and collection contract.
 *
 * Covered entities:
 *   - ECAD    — public performance collection (radio, TV, concerts, streaming)
 *   - UBC     — Brazilian composers' union: registration and distribution
 *   - Abramus — registration of works and phonograms (a working mock already exists)
 *
 * CURRENT STATE:
 *   - Abramus: complete working mock (useAbramus.ts)
 *   - UBC:     complete working mock (useUbc.ts)
 *   - ECAD:    MOCK_DATA, visual reconciliation in ECADViewModal
 *
 * FUTURE MIGRATION: each entity implements IRightsProvider with its own API.
 */

// ─── Identifiers ──────────────────────────────────────────────────────────────

export type RightsEntityId = "ecad" | "ubc" | "abramus";

export type RightsKind = "work" | "phonogram";

// ─── Search DTOs ──────────────────────────────────────────────────────────────

export interface RightsSearchQuery {
  query: string;
  kind: RightsKind;
  limit?: number;
  offset?: number;
}

export interface RightsSearchResult {
  external_id: string;
  kind: RightsKind;
  title: string;
  iswc?: string | null;
  isrc?: string | null;
  composers?: string[] | null;
  performers?: string[] | null;
  label?: string | null;
  producers?: string[] | null;
  genre?: string | null;
  artist_name?: string | null;
  duration?: string | null;
  registered_at?: string | null;
}

// ─── Artist search DTOs ───────────────────────────────────────────────────────

export interface ArtistSearchQuery {
  query: string;
  limit?: number;
}

export interface ArtistSearchResult {
  external_id: string;
  name: string;
  type: "composer" | "performer" | "producer" | "publisher" | "label";
  member_number?: string | null;
  works_count?: number | null;
  phonograms_count?: number | null;
  genres?: string[] | null;
  affiliated_at?: string | null;
}

// ─── Registration DTOs ────────────────────────────────────────────────────────

export interface RightsRegistrationStatus {
  entity: RightsEntityId;
  kind: RightsKind;
  local_id: string;
  external_id?: string | null;
  /** Registration code at the entity (e.g. cod_ecad, cod_entidade) */
  code?: string | null;
  registered: boolean;
  registered_at?: string | null;
  last_synced_at?: string | null;
  iswc?: string | null;
  isrc?: string | null;
}

export interface RegisterWorkInput {
  title: string;
  composers: string[];
  lyricists?: string[];
  publisher?: string;
  genre?: string;
  duration?: string;
  /** Existing ISWC (when available); otherwise the entity generates it */
  iswc?: string;
  /** Local work ID in the catalog */
  local_id: string;
}

export interface RegisterPhonogramInput {
  title: string;
  performers: string[];
  composers?: string[];
  producers?: string[];
  label?: string;
  genre?: string;
  duration?: string;
  /** Existing ISRC (when available); otherwise the entity generates it */
  isrc?: string;
  /** Linked work (ISWC or external_id) */
  work_id?: string;
  /** Local phonogram ID in the catalog */
  local_id: string;
}

export interface RegistrationResult {
  entity: RightsEntityId;
  kind: RightsKind;
  local_id: string;
  external_id: string;
  code: string;
  /** Generated/assigned ISWC (for works) */
  iswc?: string | null;
  /** Generated/assigned ISRC (for phonograms) */
  isrc?: string | null;
  registered_at: string;
  status: "pending" | "registered" | "rejected";
  rejection_reason?: string | null;
}

export interface RegistrationHistoryEntry {
  id: string;
  entity: RightsEntityId;
  kind: RightsKind;
  local_id: string;
  external_id?: string | null;
  title: string;
  action: "registered" | "updated" | "rejected" | "synced";
  iswc?: string | null;
  isrc?: string | null;
  performed_at: string;
  performed_by?: string | null;
  notes?: string | null;
}

// ─── Code generation DTOs ─────────────────────────────────────────────────────

export interface GenerateISWCInput {
  /** Local work ID in the catalog */
  local_work_id: string;
  title: string;
  composers: string[];
  /** When an ISWC already exists, returns it */
  existing_iswc?: string | null;
}

export interface GenerateISWCResult {
  iswc: string;
  local_work_id: string;
  source: "existing" | "generated" | "assigned_by_entity";
  generated_at: string;
}

export interface GenerateISRCInput {
  /** Local phonogram ID in the catalog */
  local_phonogram_id: string;
  title: string;
  performer: string;
  year?: number;
  /** Registrant country (e.g. "BR") */
  country_code?: string;
  /** Registrant code (e.g. "MSC") */
  registrant_code?: string;
  /** When an ISRC already exists, returns it */
  existing_isrc?: string | null;
}

export interface GenerateISRCResult {
  isrc: string;
  local_phonogram_id: string;
  source: "existing" | "generated" | "assigned_by_entity";
  generated_at: string;
}

// ─── Collection DTOs ──────────────────────────────────────────────────────────

export type CollectionType =
  | "public_performance"   // radio, TV, live concerts
  | "streaming"          // digital platforms
  | "synchronization"    // films, series, advertising
  | "mechanical"         // mechanical reproduction, CDs
  | "commercial_venue";       // commercial establishments

export interface CollectionEntry {
  id: string;
  entity: RightsEntityId;
  type: CollectionType;
  work_id?: string | null;
  phonogram_id?: string | null;
  period: string;                // "YYYY-MM"
  gross_amount_cents: number;
  net_amount_cents: number;
  performances?: number;
  source?: string;                 // ex.: "Globo", "Spotify Brasil"
  reference?: string;
  created_at: string;
}

export interface CollectionSummary {
  entity: RightsEntityId;
  period: string;
  total_gross_cents: number;
  total_net_cents: number;
  total_performances: number;
  by_type: Record<CollectionType, number>;
}

// ─── Reconciliation DTOs ─────────────────────────────────────────────────────

export interface ReconciliationResult {
  matched: Array<{
    local_id: string;
    external_id: string;
    title: string;
    difference_cents: number;
  }>;
  unmatched_local: string[];   // Local IDs without a match
  unmatched_external: string[]; // External IDs without a local match
  total_matched: number;
  total_unmatched_local: number;
  total_unmatched_external: number;
}

// ─── Contract ─────────────────────────────────────────────────────────────────

/**
 * IRightsProvider — complete copyright management contract.
 *
 * Planned implementations:
 *   - MockRightsProvider    (standalone — MOCK_DATA)
 *   - EcadRightsProvider    (ECAD API — when available)
 *   - UbcRightsProvider     (UBC API)
 *   - AbramusRightsProvider (Abramus API — already has a working mock)
 */
export interface IRightsProvider {
  readonly entity: RightsEntityId;

  // ── Search ────────────────────────────────────────────────────────────────

  /** Searches works or phonograms in the entity's database */
  search(query: RightsSearchQuery): Promise<RightsSearchResult[]>;

  /** Searches artists, composers, publishers in the entity's database */
  searchArtists(query: ArtistSearchQuery): Promise<ArtistSearchResult[]>;

  // ── Import ──────────────────────────────────────────────────────────────────

  /** Imports an external record into the local catalog */
  import(kind: RightsKind, externalId: string): Promise<{ local_id: string }>;

  /** Checks the registration status of a local item */
  getRegistrationStatus(kind: RightsKind, localId: string): Promise<RightsRegistrationStatus>;

  /** History of registration operations */
  getRegistrationHistory(kind: RightsKind, localId: string): Promise<RegistrationHistoryEntry[]>;

  // ── Registration of new works/sound recordings ──────────────────────────────────────

  /** Registers a new work (composition) at the entity */
  registerWork(input: RegisterWorkInput): Promise<RegistrationResult>;

  /** Updates data of an already registered work */
  updateWorkRegistration(externalId: string, input: Partial<RegisterWorkInput>): Promise<RegistrationResult>;

  /** Registers a new phonogram at the entity */
  registerPhonogram(input: RegisterPhonogramInput): Promise<RegistrationResult>;

  /** Updates data of an already registered phonogram */
  updatePhonogramRegistration(externalId: string, input: Partial<RegisterPhonogramInput>): Promise<RegistrationResult>;

  // ── Code generation ─────────────────────────────────────────────────────────

  /** Generates or retrieves a work's ISWC */
  generateISWC(input: GenerateISWCInput): Promise<GenerateISWCResult>;

  /** Generates or retrieves a phonogram's ISRC */
  generateISRC(input: GenerateISRCInput): Promise<GenerateISRCResult>;

  // ── Synchronization ─────────────────────────────────────────────────────────

  /** Syncs every local record with the external entity */
  syncAll(): Promise<{ synced: number; errors: number }>;

  // ── Collection ──────────────────────────────────────────────────────────────

  /** Looks up collection for a period */
  getCollection(period: string): Promise<CollectionEntry[]>;

  /** Collection summary for a period */
  getCollectionSummary(period: string): Promise<CollectionSummary>;

  /** Reconciles received collection with the local catalog */
  reconcile(period: string): Promise<ReconciliationResult>;

  // ── Health ──────────────────────────────────────────────────────────────────

  /** Checks the connection to the entity */
  verifyConnection(): Promise<boolean>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** localStorage key for cached collection data */
export function collectionStorageKey(entity: RightsEntityId, period: string): string {
  return `musicos360_${entity}_collection_${period}`;
}

/** Generates a canonical ISWC (format T-XXXXXXXXX-C) — MOCK only */
export function generateMockISWC(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
  }
  const abs = Math.abs(hash);
  const body = String(abs).padStart(9, "0").slice(0, 9);
  const check = (abs % 10).toString();
  return `T-${body.slice(0, 3)}.${body.slice(3, 6)}.${body.slice(6)}-${check}`;
}

/** Generates a canonical ISRC (format CC-XXX-YY-NNNNN) — MOCK only */
export function generateMockISRC(
  country: string = "BR",
  registrant: string = "MSC",
  year: number = new Date().getFullYear(),
  sequence: number = Math.floor(Math.random() * 99999),
): string {
  const y = String(year).slice(-2);
  const seq = String(sequence).padStart(5, "0");
  return `${country}-${registrant}-${y}-${seq}`;
}

