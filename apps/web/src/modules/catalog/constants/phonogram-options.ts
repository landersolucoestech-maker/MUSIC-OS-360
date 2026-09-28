/**
 * phonogram-options.ts — canonical vocabulary of the phonograms contract (CZ-040).
 *
 * Every persisted/wire value here is the technical English value the API
 * stores and returns (apps/api/src/modules/phonograms/phonogram-legacy-fields.ts,
 * dto/create-phonogram.dto.ts); every label is the PT-BR text the end user
 * sees. Components render labels only through these maps — never a raw value.
 */
import { PHONOGRAM_STATUS_LABELS_PT_BR, type PhonogramStatus } from "@music-os-360/types";

type Option<T extends string> = { value: T; label: string };

function hasKey<T extends string>(map: Readonly<Record<T, string>>, value: unknown): value is T {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(map, value);
}

// ── Media type (phonograms.media_type) ───────────────────────────────────────

export const PHONOGRAM_MEDIA_TYPES = ["all", "digital", "physical", "streaming"] as const;
export type PhonogramMediaType = (typeof PHONOGRAM_MEDIA_TYPES)[number];

export const PHONOGRAM_MEDIA_TYPE_LABELS: Readonly<Record<PhonogramMediaType, string>> = {
  all: "Todas",
  digital: "Digital",
  physical: "Física",
  streaming: "Streaming",
};

export const PHONOGRAM_MEDIA_TYPE_OPTIONS: ReadonlyArray<Option<PhonogramMediaType>> = PHONOGRAM_MEDIA_TYPES.map(
  (value) => ({ value, label: PHONOGRAM_MEDIA_TYPE_LABELS[value] }),
);

/** PT-BR label of a media type; null when outside the contract (never the raw value). */
export function phonogramMediaTypeLabel(value: unknown): string | null {
  return hasKey(PHONOGRAM_MEDIA_TYPE_LABELS, value) ? PHONOGRAM_MEDIA_TYPE_LABELS[value] : null;
}

// ── Recording classification (phonograms.recording_classification) ──────────

export const PHONOGRAM_RECORDING_CLASSIFICATIONS = ["studio", "live", "remix", "demo", "other"] as const;
export type PhonogramRecordingClassification = (typeof PHONOGRAM_RECORDING_CLASSIFICATIONS)[number];

export const PHONOGRAM_RECORDING_CLASSIFICATION_LABELS: Readonly<Record<PhonogramRecordingClassification, string>> = {
  studio: "Estúdio",
  live: "Ao vivo",
  remix: "Remix",
  demo: "Demo",
  other: "Outra",
};

export const PHONOGRAM_RECORDING_CLASSIFICATION_OPTIONS: ReadonlyArray<Option<PhonogramRecordingClassification>> =
  PHONOGRAM_RECORDING_CLASSIFICATIONS.map((value) => ({ value, label: PHONOGRAM_RECORDING_CLASSIFICATION_LABELS[value] }));

export function phonogramRecordingClassificationLabel(value: unknown): string | null {
  return hasKey(PHONOGRAM_RECORDING_CLASSIFICATION_LABELS, value)
    ? PHONOGRAM_RECORDING_CLASSIFICATION_LABELS[value]
    : null;
}

// ── Aggregator (phonograms.aggregator) ───────────────────────────────────────

export const PHONOGRAM_AGGREGATORS = [
  "cd_baby",
  "distrokid",
  "tunecore",
  "ditto_music",
  "onerpm",
  "imusics",
  "symphonic",
  "other",
] as const;
export type PhonogramAggregator = (typeof PHONOGRAM_AGGREGATORS)[number];

/** Brand names are proper nouns; `other` is the only translated label. */
export const PHONOGRAM_AGGREGATOR_LABELS: Readonly<Record<PhonogramAggregator, string>> = {
  cd_baby: "CD Baby",
  distrokid: "DistroKid",
  tunecore: "TuneCore",
  ditto_music: "Ditto Music",
  onerpm: "ONErpm",
  imusics: "iMusics",
  symphonic: "Symphonic",
  other: "Outra",
};

export const PHONOGRAM_AGGREGATOR_OPTIONS: ReadonlyArray<Option<PhonogramAggregator>> = PHONOGRAM_AGGREGATORS.map(
  (value) => ({ value, label: PHONOGRAM_AGGREGATOR_LABELS[value] }),
);

export function phonogramAggregatorLabel(value: unknown): string | null {
  return hasKey(PHONOGRAM_AGGREGATOR_LABELS, value) ? PHONOGRAM_AGGREGATOR_LABELS[value] : null;
}

// ── Country (country_of_recording / publication_country — ISO 3166-1 alpha-2) ─

/** Countries offered by the form. `ZZ` = user-assigned "unknown/other region". */
export const PHONOGRAM_COUNTRY_CODES = ["BR", "US", "GB", "PT", "AR", "ZZ"] as const;
export type PhonogramCountryCode = (typeof PHONOGRAM_COUNTRY_CODES)[number];

export const PHONOGRAM_COUNTRY_LABELS: Readonly<Record<PhonogramCountryCode, string>> = {
  BR: "Brasil",
  US: "Estados Unidos",
  GB: "Reino Unido",
  PT: "Portugal",
  AR: "Argentina",
  ZZ: "Outro",
};

export const PHONOGRAM_COUNTRY_OPTIONS: ReadonlyArray<Option<PhonogramCountryCode>> = PHONOGRAM_COUNTRY_CODES.map(
  (value) => ({ value, label: PHONOGRAM_COUNTRY_LABELS[value] }),
);

/** PT-BR label of an ISO country code; null when the code is not in the catalog (never the raw code). */
export function phonogramCountryLabel(code: unknown): string | null {
  return hasKey(PHONOGRAM_COUNTRY_LABELS, code) ? PHONOGRAM_COUNTRY_LABELS[code] : null;
}

// ── Participation (phonograms.participation categories) ──────────────────────

export const PHONOGRAM_PARTICIPATION_CATEGORIES = ["phonographic_producers", "performers", "session_musicians"] as const;
export type PhonogramParticipationCategory = (typeof PHONOGRAM_PARTICIPATION_CATEGORIES)[number];

export const PHONOGRAM_PARTICIPATION_CATEGORY_LABELS: Readonly<Record<PhonogramParticipationCategory, string>> = {
  phonographic_producers: "Produtor Fonográfico",
  performers: "Intérprete",
  session_musicians: "Músico Acompanhante",
};

/** Maximum share (%) of each category in the ECAD phonogram split (41,7 / 41,7 / 16,6). */
export const PHONOGRAM_PARTICIPATION_CATEGORY_MAX_PERCENTAGE: Readonly<Record<PhonogramParticipationCategory, number>> = {
  phonographic_producers: 41.7,
  performers: 41.7,
  session_musicians: 16.6,
};

// ── Status (phonograms.status) ───────────────────────────────────────────────

/** Statuses offered in the phonogram form select (canonical value, PT-BR label). */
export const PHONOGRAM_STATUS_OPTIONS: ReadonlyArray<{ value: string; label: string }> = (
  ["under_review", "pending", "registered", "rejected"] as const
).map((value) => ({ value, label: PHONOGRAM_STATUS_LABELS_PT_BR[value as PhonogramStatus] }));

/** PT-BR label of a phonogram status; "Status desconhecido" for a value outside the contract. */
export function phonogramStatusLabel(status: unknown): string {
  if (typeof status !== "string" || !status) return "—";
  return hasKey(PHONOGRAM_STATUS_LABELS_PT_BR as Readonly<Record<string, string>>, status)
    ? (PHONOGRAM_STATUS_LABELS_PT_BR as Readonly<Record<string, string>>)[status]
    : "Status desconhecido";
}

// ── List filters (GET /phonograms query values) ──────────────────────────────

/** `has_work` query value of GET /phonograms (linked work or not). */
export type PhonogramHasWorkFilter = "true" | "false";

/** `ecad` query value of GET /phonograms. */
export type PhonogramEcadFilter = "with_code" | "without_code";
