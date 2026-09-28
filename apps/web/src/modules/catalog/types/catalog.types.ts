import type { Json } from "@/shared/types/database";
import type { ArtistRef, ProjectRef } from "@/shared/types/refs";
import type { WorkStatusValue, WorkType, PhonogramStatusValue } from "@/shared/types/enums";
import type {
  WorkAiUsageLevel,
  WorkOrigin,
  WorkParticipantRole,
} from "@/modules/catalog/constants/work-options";

export type { WorkStatusValue, WorkType, PhonogramStatusValue };
export type { WorkAiUsageLevel, WorkOrigin, WorkParticipantRole };

/** AI-generated element of a work (`ai_harmony` / `ai_melody` / `ai_lyrics`). */
export interface WorkAiElement {
  tool: string;
  prompt: string;
}

/** Item of `works.participants` (rows of work_participants). */
export interface WorkParticipant {
  id: string;
  name: string;
  /** WorkParticipantRole; the API keeps unknown legacy roles verbatim. */
  role: WorkParticipantRole | string;
  link: string | null;
  /** decimal(6,3) — returned as a string by the API. */
  percentage: string | number | null;
}

/** Work record of the canonical works contract (CZ-039). */
export interface Work {
  id: string;
  user_id?: string;
  title: string;
  /** Musical classification (API default `composition`). */
  type?: WorkType | string | null;
  /** Free-text composer (bulk/imported works). */
  composer_name?: string | null;
  /** Derived from participants with role `composer_author`. */
  composer_names?: string[] | null;
  /** Derived from participants with role `translator`. */
  translator_names?: string[] | null;
  publisher_name?: string | null;
  isrc?: string | null;
  iswc?: string | null;
  ecad_code?: string | null;
  /** Code at any collective management society (ABRAMUS, UBC, SOCINPRO, ...). */
  society_code?: string | null;
  music_genre?: string | null;
  status?: WorkStatusValue | string | null;
  duration_text?: string | null;
  /** ISO 639 code (`zxx` = instrumental, `und` = other). */
  language?: string | null;
  is_instrumental?: boolean | null;
  ai_used?: boolean | null;
  ai_usage_level?: WorkAiUsageLevel | null;
  ai_harmony?: WorkAiElement | null;
  ai_melody?: WorkAiElement | null;
  ai_lyrics?: WorkAiElement | null;
  alternative_titles?: string[] | null;
  related_references?: string[] | null;
  lyrics?: string | null;
  participants?: WorkParticipant[] | null;
  work_origin?: WorkOrigin | null;
  // Registry fields (read-only, derived by the API).
  duration_seconds?: number | null;
  ai_tools?: string[] | null;
  ai_prompts?: string[] | null;
  registry_status?: string | null;
  external_reference?: string | null;
  origem_externa?: string | null;
  origem_externa_id?: string | null;
  origem_externa_sincronizado_em?: string | null;
  project_id?: string | null;
  artist_id?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type WorkInsert = Omit<Work, "id" | "user_id" | "created_at" | "updated_at">;
export type WorkUpdate = Partial<WorkInsert>;

export interface WorkWithRelations extends Work {
  artistas?: ArtistRef | null;
  projetos?: ProjectRef | null;
}

/** Item of a `phonograms.participation` category (CZ-040). */
export interface PhonogramParticipant {
  id: string;
  name: string;
  /** Share (%) as typed in the form — a string on the wire. */
  percentage: string;
  /** Registered artist picked in the autocomplete, when any. */
  artist_id?: string;
}

/** `phonograms.participation` — three participant categories (CZ-040). */
export interface PhonogramParticipation {
  phonographic_producers: PhonogramParticipant[];
  performers: PhonogramParticipant[];
  session_musicians: PhonogramParticipant[];
}

/** Uploaded audio of a phonogram (`phonograms.audio_file` jsonb). */
export interface PhonogramAudioFile {
  name: string;
  size: number;
  url?: string;
  fileId?: string;
}

/** Phonogram record of the canonical phonograms contract (CZ-040). */
export interface Phonogram {
  id: string;
  user_id?: string;
  title?: string | null;
  work_id?: string | null;
  artist_id?: string | null;
  isrc?: string | null;
  isrc_country_code?: string | null;
  isrc_registrant_code?: string | null;
  isrc_year?: string | null;
  isrc_designation_code?: string | null;
  duration_text?: string | null;
  /** Total duration in seconds (single source of the duration). */
  duration_seconds?: number | null;
  type?: string | null;
  status?: PhonogramStatusValue | string | null;
  // Dropped columns (20260923000002_DropDeadPhonogramsLegacyParticipantColumns):
  // the API no longer returns them; still read by the MusicRegistration list.
  compositores?: string | null;
  interpretes?: string | null;
  produtores?: string | null;
  record_label_name?: string | null;
  /** PhonogramAggregator value. */
  aggregator?: string | null;
  ecad_code?: string | null;
  /** Code at any collective management society (ABRAMUS, UBC, SOCINPRO, ...). */
  society_code?: string | null;
  ai_used?: boolean | null;
  is_instrumental?: boolean | null;
  is_national?: boolean | null;
  is_simultaneous_publication?: boolean | null;
  /** `YYYY-MM-DD`. */
  issue_date?: string | null;
  /** Timestamp (ISO string) on the wire; the form sends `YYYY-MM-DD`. */
  recording_date?: string | null;
  /** Timestamp (ISO string) on the wire; the form sends `YYYY-MM-DD`. */
  release_date?: string | null;
  music_genre?: string | null;
  /** PhonogramRecordingClassification value. */
  recording_classification?: string | null;
  /** PhonogramMediaType value. */
  media_type?: string | null;
  /** ISO 3166-1 alpha-2 (`ZZ` = other/unknown). */
  country_of_recording?: string | null;
  /** ISO 3166-1 alpha-2 (`ZZ` = other/unknown). */
  publication_country?: string | null;
  notes?: string | null;
  audio_file?: PhonogramAudioFile | Json | null;
  audio_file_id?: string | null;
  participation?: Partial<PhonogramParticipation> | null;
  origem_externa?: string | null;
  origem_externa_id?: string | null;
  origem_externa_sincronizado_em?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type PhonogramInsert = Omit<Phonogram, "id" | "user_id" | "created_at" | "updated_at">;
export type PhonogramUpdate = Partial<PhonogramInsert>;

export interface PhonogramWithRelations extends Phonogram {
  artistas?: ArtistRef | null;
}

