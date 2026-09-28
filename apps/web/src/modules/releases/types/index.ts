import type { ArtistRef, WorkRef } from "@/shared/types/refs";
import type { ReleaseStatusValue, ReleaseType, ShareStatus, ShareFunction, ShareDirection, ShareType } from "@/shared/types/enums";

export type { ReleaseStatusValue, ReleaseType, ShareStatus, ShareFunction, ShareDirection, ShareType };

export interface ReleaseAssets {
  audio_master_url?: string | null;
  cover_url?: string | null;
  music_video_url?: string | null;
  lyrics?: string | null;
  credits?: string | null;
  press_release?: string | null;
  epk_url?: string | null;
  [key: string]: string | null | undefined;
}

export interface ReleaseSchedule {
  recording_date?: string | null;
  mix_master_date?: string | null;
  distributor_delivery_date?: string | null;
  [key: string]: string | null | undefined;
}

/**
 * Error returned by a distribution platform, per field.
 * `fieldKey` may be global (`upc`, `copyrightHolder`) or per track (`tracks[0].isrc`).
 */
export interface PlatformError {
  fieldKey: string;
  message: string;
  code?: string;
  source?: string;
  attemptId?: string;
  createdAt?: string;
}

/**
 * Attempt to send to a platform (typed scaffolding — filled by a real
 * integration in the future; never simulated). Kept outside the form schema.
 */
export interface ReleasePlatformAttempt {
  id: string;
  releaseId: string;
  platformKey: string;
  status: string;
  requestPayload?: Record<string, unknown> | null;
  responsePayload?: Record<string, unknown> | null;
  validationErrors?: PlatformError[] | null;
  submittedAt?: string | null;
  updatedAt?: string | null;
}

export interface Release {
  id: string;
  user_id?: string;
  title: string;
  type?: ReleaseType | string | null;
  status?: ReleaseStatusValue | string | null;
  artist_id?: string | null;
  release_date?: string | null;
  cover_url?: string | null;
  distributor?: string | null;
  platforms?: string[] | null;
  fonograma_ids?: string[] | null;
  notes?: string | null;
  isrc_global?: string | null;
  upc?: string | null;
  internal_notes?: string | null;
  assets?: ReleaseAssets | null;
  schedule?: ReleaseSchedule | null;
  // Additional fields present in the mock and the form
  music_genre?: string | null;
  language?: string | null;
  record_label?: string | null;
  copyright?: string | null;
  work_id?: string | null;
  fonograma_id?: string | null;
  codigo_upc?: string | null;
  // ── Internal status × platform status separation ─────────────────────────────
  /** Internal operational status (control). See `release-status`. */
  internal_status?: string | null;
  /** Status returned by the platform — NEVER manually editable; null = internal control. */
  platform_status?: string | null;
  /** Selected distribution platform (catalog id). */
  selected_platform_id?: string | null;
  /** Platform-specific data (built according to the connected platform's schema). */
  platform_specific_data?: Record<string, unknown> | null;
  /** Errors returned by the platform, per field. */
  platform_errors?: PlatformError[] | null;
  platform_last_attempt_at?: string | null;
  platform_last_sync_at?: string | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type ReleaseInsert = Omit<Release, "id" | "user_id" | "created_at" | "updated_at">;
export type ReleaseUpdate = Partial<ReleaseInsert>;

export interface ReleaseWithRelations extends Release {
  artistas?: ArtistRef | null;
}

export interface Share {
  id: string;
  user_id?: string;
  /** Internal/external discriminator. When missing, derive it via `resolveShareType`. */
  share_type?: ShareType | string | null;
  work_id?: string | null;
  /** Company artist/project linked to the share (external receivable). */
  artist_id?: string | null;
  percentage?: number | null;
  type?: ShareFunction | string | null;
  direction?: ShareDirection | string | null;
  status?: ShareStatus | string | null;
  total_amount?: number | null;
  settled_amount?: number | null;
  holder?: string | null;
  recipient?: string | null;
  // ── Internal flow (release) ──────────────────────────────────────────────────
  release_id?: string | null;
  // ── External flow (receivable) ───────────────────────────────────────────────
  music_title?: string | null;
  external_artist_name?: string | null;
  payer?: string | null;
  payer_contact?: string | null;
  agreement_source?: string | null;
  expected_at?: string | null;
  documents?: string | null;
  // ── Agreement / traceability (shared) ─────────────────────────────────────────
  agreement_notes?: string | null;
  agreement_url?: string | null;
  notes?: string | null;
  version?: number | null;
  history?: ShareHistoryEntry[] | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type ShareInsert = Omit<Share, "id" | "user_id" | "created_at" | "updated_at">;
export type ShareUpdate = Partial<ShareInsert>;

export interface ShareWithRelations extends Share {
  obras?: WorkRef | null;
  artistas?: ArtistRef | null;
}

export interface ShareHistoryEntry {
  date: string;
  action?: string | null;
  user?: string | null;
  note?: string | null;
  previous_value?: number | null;
  new_value?: number | null;
  version?: number | string | null;
  /** Canonical field for newly-written entries. */
  percentage?: number | null;
  /** @deprecated Legacy key on already-persisted (append-only) entries written before the
   * naming-normalization rename; kept for backward-compatible reads only, never written anew. */
  percentual?: number | null;
  description?: string | null;
  author?: string | null;
}

