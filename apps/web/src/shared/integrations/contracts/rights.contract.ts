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

export type RightsKind = "obra" | "fonograma";

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
  compositores?: string[] | null;
  interpretes?: string[] | null;
  gravadora?: string | null;
  produtores?: string[] | null;
  genero?: string | null;
  artista_nome?: string | null;
  duracao?: string | null;
  data_registro?: string | null;
}

// ─── Artist search DTOs ───────────────────────────────────────────────────────

export interface ArtistSearchQuery {
  query: string;
  limit?: number;
}

export interface ArtistSearchResult {
  external_id: string;
  nome: string;
  type: "compositor" | "interprete" | "produtor" | "editora" | "gravadora";
  numero_filiado?: string | null;
  obras_count?: number | null;
  fonogramas_count?: number | null;
  generos?: string[] | null;
  data_filiacao?: string | null;
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
  interpretes: string[];
  compositores?: string[];
  produtores?: string[];
  gravadora?: string;
  genero?: string;
  duracao?: string;
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
  compositores: string[];
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
  local_fonograma_id: string;
  title: string;
  interprete: string;
  ano?: number;
  /** Registrant country (e.g. "BR") */
  country_code?: string;
  /** Registrant code (e.g. "MSC") */
  registrant_code?: string;
  /** When an ISRC already exists, returns it */
  existing_isrc?: string | null;
}

export interface GenerateISRCResult {
  isrc: string;
  local_fonograma_id: string;
  source: "existing" | "generated" | "assigned_by_entity";
  generated_at: string;
}

// ─── Collection DTOs ──────────────────────────────────────────────────────────

export type CollectionType =
  | "execucao_publica"   // radio, TV, live concerts
  | "streaming"          // digital platforms
  | "sincronizacao"      // films, series, advertising
  | "mecanica"           // mechanical reproduction, CDs
  | "sonorizacao";       // commercial establishments

export interface CollectionEntry {
  id: string;
  entity: RightsEntityId;
  type: CollectionType;
  work_id?: string | null;
  fonograma_id?: string | null;
  periodo: string;                // "YYYY-MM"
  valor_bruto_cents: number;
  valor_liquido_cents: number;
  execucoes?: number;
  fonte?: string;                 // ex.: "Globo", "Spotify Brasil"
  referencia?: string;
  created_at: string;
}

export interface CollectionSummary {
  entity: RightsEntityId;
  periodo: string;
  total_bruto_cents: number;
  total_liquido_cents: number;
  total_execucoes: number;
  por_tipo: Record<CollectionType, number>;
}

// ─── Reconciliation DTOs ─────────────────────────────────────────────────────

export interface ReconciliationResult {
  matched: Array<{
    local_id: string;
    external_id: string;
    title: string;
    diferenca_cents: number;
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
  getCollection(periodo: string): Promise<CollectionEntry[]>;

  /** Collection summary for a period */
  getCollectionSummary(periodo: string): Promise<CollectionSummary>;

  /** Reconciles received collection with the local catalog */
  conciliar(periodo: string): Promise<ReconciliationResult>;

  // ── Health ──────────────────────────────────────────────────────────────────

  /** Checks the connection to the entity */
  verifyConnection(): Promise<boolean>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** localStorage key for cached collection data */
export function collectionStorageKey(entity: RightsEntityId, periodo: string): string {
  return `musicos360_${entity}_arrecadacao_${periodo}`;
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

