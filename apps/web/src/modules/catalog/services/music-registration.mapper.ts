import { PhonogramStatus, WorkStatus } from "@music-os-360/types";
import {
  isWorkAiUsageLevel,
  workLanguageCodeFromProjectLanguage,
  type WorkAiUsageLevel,
  type WorkOrigin,
} from "@/modules/catalog/constants/work-options";
import type {
  Phonogram,
  PhonogramAudioFile,
  PhonogramParticipant,
  PhonogramParticipation,
  Work,
  WorkAiElement,
  WorkParticipant,
} from "@/modules/catalog/types/catalog.types";

export type { WorkAiElement, PhonogramAudioFile, PhonogramParticipant, PhonogramParticipation };

/**
 * Work participant as edited in the work form. `role` holds the canonical
 * WorkParticipantRole value ("unspecified" until the user picks one);
 * `percentage` is the text of the percentage input.
 */
export interface ParticipantForm {
  id: string;
  name: string;
  role: string;
  link: string;
  percentage: string;
}

export interface DurationTextParts {
  minutes: string;
  seconds: string;
}

/** ISRC (ISO 3901) parts: country code, registrant code, year, designation code. */
export interface IsrcParts {
  countryCode: string;
  registrantCode: string;
  year: string;
  designationCode: string;
}

export function parseDurationText(value: unknown): DurationTextParts {
  if (typeof value !== "string" || !value.trim()) {
    return { minutes: "", seconds: "" };
  }
  const parts = value.trim().split(":").map((p) => p.trim());
  // Accept HH:MM:SS or MM:SS
  let minutesRaw = "";
  let secondsRaw = "";
  if (parts.length === 3) {
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    minutesRaw = String(h * 60 + m);
    secondsRaw = parts[2];
  } else if (parts.length === 2) {
    minutesRaw = parts[0];
    secondsRaw = parts[1];
  } else {
    return { minutes: "", seconds: "" };
  }
  const minutesNum = parseInt(minutesRaw, 10);
  const secondsNum = parseInt(secondsRaw, 10);
  return {
    minutes: Number.isFinite(minutesNum) ? String(minutesNum) : "",
    seconds: Number.isFinite(secondsNum) ? String(secondsNum) : "",
  };
}

export function formatDurationText(minutes: string | number, seconds: string | number): string | null {
  const m = Number(minutes) || 0;
  const s = Number(seconds) || 0;
  if (!minutes && !seconds) return null;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function parseIsrc(value: unknown): IsrcParts {
  const empty: IsrcParts = { countryCode: "BR", registrantCode: "", year: "", designationCode: "" };
  if (typeof value !== "string" || !value.trim()) return empty;
  // Accept "BR-XXX-YY-NNNNN" or "BRXXXYYNNNNN"
  const trimmed = value.trim();
  if (trimmed.includes("-")) {
    const parts = trimmed.split("-").map((p) => p.trim());
    return {
      countryCode: parts[0] || "BR",
      registrantCode: parts[1] || "",
      year: parts[2] || "",
      designationCode: parts[3] || "",
    };
  }
  const compact = trimmed.replace(/\s+/g, "");
  if (compact.length >= 12) {
    return {
      countryCode: compact.slice(0, 2),
      registrantCode: compact.slice(2, 5),
      year: compact.slice(5, 7),
      designationCode: compact.slice(7, 12),
    };
  }
  return empty;
}

export function joinIsrc(parts: IsrcParts): string | null {
  const cleaned = [parts.countryCode, parts.registrantCode, parts.year, parts.designationCode]
    .map((p) => (p || "").trim())
    .filter(Boolean);
  return cleaned.length === 4 ? cleaned.join("-") : null;
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v) => typeof v === "string" && v.trim()).map((v) => (v as string).trim());
  }
  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[,;]/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
}

// ── Work: canonical readers (CZ-039 — English wire fields only) ──────────────

const UNSPECIFIED_ROLE = "unspecified";

/** Canonical participant role of a form row: a row without a picked role is "unspecified". */
function canonicalParticipantRole(role: string | null | undefined): string {
  return typeof role === "string" && role.trim() ? role : UNSPECIFIED_ROLE;
}

/**
 * Work → form participants. Source: `participants`; a work that carries only
 * the derived name lists (imported/bulk works) is expanded from
 * `composer_names` (role composer_author) and `translator_names` (role translator).
 */
export function workToParticipants(work: Partial<Work> | null | undefined): ParticipantForm[] {
  if (!work) return [];
  const participants = Array.isArray(work.participants) ? work.participants : [];
  if (participants.length > 0) {
    return participants.map((p) => ({
      id: p.id || crypto.randomUUID(),
      name: p.name ?? "",
      role: canonicalParticipantRole(p.role),
      link: p.link ?? "",
      percentage: p.percentage === null || p.percentage === undefined ? "" : String(p.percentage),
    }));
  }
  const fromNames = (names: unknown, role: string): ParticipantForm[] =>
    normalizeStringArray(names).map((name) => ({
      id: crypto.randomUUID(),
      name,
      role,
      link: "",
      percentage: "",
    }));
  return [
    ...fromNames(work.composer_names, "composer_author"),
    ...fromNames(work.translator_names, "translator"),
  ];
}

/** `composer_names` / `translator_names` derived from the participants (their single source). */
export function participantsToComposerAndTranslatorNames(
  participants: ParticipantForm[],
): { composerNames: string[] | null; translatorNames: string[] | null } {
  const namesWithRole = (role: string): string[] =>
    participants.filter((p) => p.role === role && p.name.trim()).map((p) => p.name.trim());
  const composerNames = namesWithRole("composer_author");
  const translatorNames = namesWithRole("translator");
  return {
    composerNames: composerNames.length > 0 ? composerNames : null,
    translatorNames: translatorNames.length > 0 ? translatorNames : null,
  };
}

export function workTitle(work: any): string {
  if (!work) return "";
  return (work.title as string) ?? (work.titulo as string) ?? "";
}

export function workAlternativeTitles(work: Partial<Work> | null | undefined): string[] {
  return normalizeStringArray(work?.alternative_titles);
}

export function workRelatedReferences(work: Partial<Work> | null | undefined): string[] {
  return normalizeStringArray(work?.related_references);
}

export function workLyrics(work: Partial<Work> | null | undefined): string {
  return typeof work?.lyrics === "string" ? work.lyrics : "";
}

export function workIsInstrumental(work: Partial<Work> | null | undefined): boolean {
  return work?.is_instrumental === true;
}

export function workAiUsed(work: Partial<Work> | null | undefined): boolean {
  return work?.ai_used === true;
}

/** `ai_usage_level` of the work, or "" when none was chosen. */
export function workAiUsageLevel(work: Partial<Work> | null | undefined): WorkAiUsageLevel | "" {
  const level = work?.ai_usage_level;
  return isWorkAiUsageLevel(level) ? level : "";
}

function readAiElement(raw: unknown): WorkAiElement {
  if (!raw || typeof raw !== "object") return { tool: "", prompt: "" };
  const element = raw as Record<string, unknown>;
  return {
    tool: typeof element["tool"] === "string" ? element["tool"] : "",
    prompt: typeof element["prompt"] === "string" ? element["prompt"] : "",
  };
}

export function workAiHarmony(work: Partial<Work> | null | undefined): WorkAiElement {
  return readAiElement(work?.ai_harmony);
}

export function workAiMelody(work: Partial<Work> | null | undefined): WorkAiElement {
  return readAiElement(work?.ai_melody);
}

export function workAiLyrics(work: Partial<Work> | null | undefined): WorkAiElement {
  return readAiElement(work?.ai_lyrics);
}

// ── Normalize helpers (canonical source: shared/lib/normalize.ts) ────────────
// Re-exported for backward-compat with callers that import from this file.
export { normalizeStr, normalizeBool } from "@/shared/lib/normalize";

// ── Work: form fields + writer ───────────────────────────────────────────────

export interface WorkFormFields {
  title: string;
  /** Canonical work status ("" = not chosen; saved as "pending"). */
  status: string;
  musicGenre: string;
  /** ISO 639 code ("" = not chosen). */
  language: string;
  durationMinutes: string;
  durationSeconds: string;
  isInstrumental: boolean;
  ecadCode: string;
  societyCode: string;
  iswc: string;
  aiUsed: boolean;
  aiUsageLevel: WorkAiUsageLevel | "";
  aiHarmony: WorkAiElement;
  aiMelody: WorkAiElement;
  aiLyrics: WorkAiElement;
  participants: ParticipantForm[];
  alternativeTitles: string[];
  relatedReferences: string[];
  lyrics: string;
  artistId: string;
}

/** Work record → form field initial values (single source of truth for the form's useEffect). */
export function workToFormFields(work: Partial<Work> | null | undefined): WorkFormFields {
  const duration = parseDurationText(work?.duration_text);
  return {
    title: workTitle(work),
    status: typeof work?.status === "string" ? work.status : "",
    musicGenre: work?.music_genre?.toLowerCase() || "",
    language: work?.language || "",
    durationMinutes: duration.minutes,
    durationSeconds: duration.seconds,
    isInstrumental: workIsInstrumental(work),
    ecadCode: work?.ecad_code ?? "",
    societyCode: work?.society_code ?? "",
    iswc: work?.iswc || "",
    aiUsed: workAiUsed(work),
    aiUsageLevel: workAiUsageLevel(work),
    aiHarmony: workAiHarmony(work),
    aiMelody: workAiMelody(work),
    aiLyrics: workAiLyrics(work),
    participants: workToParticipants(work),
    alternativeTitles: workAlternativeTitles(work),
    relatedReferences: workRelatedReferences(work),
    lyrics: workLyrics(work),
    artistId: work?.artist_id ?? "",
  };
}

export interface WorkFormInput extends Omit<WorkFormFields, "artistId"> {
  projectId: string | null;
  artistId: string | null;
  workOrigin: WorkOrigin;
}

/** Request body of POST /works and PATCH /works/:id (canonical CZ-039 contract). */
export type WorkPayload = {
  title: string;
  music_genre: string | null;
  language: string | null;
  iswc: string | null;
  ecad_code: string | null;
  society_code: string | null;
  duration_text: string | null;
  is_instrumental: boolean;
  ai_used: boolean;
  ai_usage_level: WorkAiUsageLevel | null;
  ai_harmony: WorkAiElement | null;
  ai_melody: WorkAiElement | null;
  ai_lyrics: WorkAiElement | null;
  alternative_titles: string[] | null;
  related_references: string[] | null;
  lyrics: string | null;
  participants: WorkParticipant[];
  status: string;
  composer_names: string[] | null;
  translator_names: string[] | null;
  project_id: string | null;
  artist_id: string | null;
  work_origin: WorkOrigin;
};

function participantToWire(participant: ParticipantForm): WorkParticipant {
  return {
    id: participant.id,
    name: participant.name,
    role: canonicalParticipantRole(participant.role),
    link: participant.link || null,
    percentage: participant.percentage || null,
  };
}

function aiElementOrNull(element: WorkAiElement): WorkAiElement | null {
  return element.tool || element.prompt ? { tool: element.tool, prompt: element.prompt } : null;
}

/**
 * Form state → request body: one canonical (English) key per form field, and
 * nothing else. org_id is not a form field: the tenant comes from the API's
 * authenticated context. `participants` is always the full list the form
 * holds (an empty list clears them).
 */
export function formToWorkPayload(input: WorkFormInput): WorkPayload {
  const { composerNames, translatorNames } = participantsToComposerAndTranslatorNames(input.participants);
  const alternativeTitles = input.alternativeTitles.filter(Boolean);
  const relatedReferences = input.relatedReferences.filter(Boolean);
  return {
    title: input.title.trim(),
    music_genre: input.musicGenre || null,
    language: input.language || null,
    iswc: input.iswc || null,
    ecad_code: input.ecadCode || null,
    society_code: input.societyCode || null,
    duration_text: formatDurationText(input.durationMinutes, input.durationSeconds),
    is_instrumental: input.isInstrumental,
    ai_used: input.aiUsed,
    ai_usage_level: input.aiUsageLevel || null,
    ai_harmony: aiElementOrNull(input.aiHarmony),
    ai_melody: aiElementOrNull(input.aiMelody),
    ai_lyrics: aiElementOrNull(input.aiLyrics),
    alternative_titles: alternativeTitles.length > 0 ? alternativeTitles : null,
    related_references: relatedReferences.length > 0 ? relatedReferences : null,
    lyrics: input.lyrics || null,
    participants: input.participants.map(participantToWire),
    status: input.status || WorkStatus.PENDING,
    composer_names: composerNames,
    translator_names: translatorNames,
    project_id: input.projectId,
    artist_id: input.artistId,
    work_origin: input.workOrigin,
  };
}

// ── Phonogram: canonical readers + writer (CZ-040 — English wire fields only) ─

/** Minutes/seconds inputs of the phonogram form ("" = empty input). */
export interface DurationParts {
  minutes: string;
  seconds: string;
}

/** `duration_seconds` (total) → minutes/seconds inputs. */
export function durationSecondsToParts(totalSeconds: unknown): DurationParts {
  if (typeof totalSeconds !== "number" || !Number.isInteger(totalSeconds) || totalSeconds < 0) {
    return { minutes: "", seconds: "" };
  }
  return { minutes: String(Math.floor(totalSeconds / 60)), seconds: String(totalSeconds % 60) };
}

/**
 * Minutes/seconds inputs → `duration_seconds` (total). null when both inputs
 * are empty or a part is not a non-negative integer (the form blocks submit
 * on invalid parts before this is called).
 */
export function durationPartsToSeconds(minutes: string, seconds: string): number | null {
  if (!minutes.trim() && !seconds.trim()) return null;
  const m = Number(minutes.trim() || 0);
  const s = Number(seconds.trim() || 0);
  if (!Number.isInteger(m) || !Number.isInteger(s) || m < 0 || s < 0) return null;
  return m * 60 + s;
}

/** `YYYY-MM-DD` of a date/timestamp wire value ("" when absent or not a date). */
export function toDateInputValue(value: unknown): string {
  if (typeof value !== "string") return "";
  const match = /^\d{4}-\d{2}-\d{2}/.exec(value.trim());
  return match ? match[0] : "";
}

export function emptyPhonogramParticipation(): PhonogramParticipation {
  return { phonographic_producers: [], performers: [], session_musicians: [] };
}

function readPhonogramParticipants(raw: unknown): PhonogramParticipant[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item): item is Record<string, unknown> => item !== null && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const participant: PhonogramParticipant = {
        id: typeof item["id"] === "string" && item["id"] ? item["id"] : crypto.randomUUID(),
        name: typeof item["name"] === "string" ? item["name"] : "",
        percentage:
          typeof item["percentage"] === "string" || typeof item["percentage"] === "number"
            ? String(item["percentage"])
            : "",
      };
      if (typeof item["artist_id"] === "string" && item["artist_id"]) participant.artist_id = item["artist_id"];
      return participant;
    });
}

/** `participation` of a phonogram record → the three form categories (canonical keys only). */
export function phonogramToParticipation(phonogram: Partial<Phonogram> | null | undefined): PhonogramParticipation {
  const raw = phonogram?.participation;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return emptyPhonogramParticipation();
  return {
    phonographic_producers: readPhonogramParticipants(raw.phonographic_producers),
    performers: readPhonogramParticipants(raw.performers),
    session_musicians: readPhonogramParticipants(raw.session_musicians),
  };
}

/** `audio_file` of a phonogram record (null when absent or malformed). */
export function phonogramAudioFile(raw: unknown): PhonogramAudioFile | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r["name"] !== "string" || typeof r["size"] !== "number") return null;
  return {
    name: r["name"],
    size: r["size"],
    url: typeof r["url"] === "string" ? r["url"] : undefined,
    fileId: typeof r["fileId"] === "string" ? r["fileId"] : undefined,
  };
}

export interface PhonogramFormFields {
  title: string;
  /** Canonical phonogram status ("" = not chosen; saved as "pending"). */
  status: string;
  ecadCode: string;
  societyCode: string;
  /** PhonogramAggregator value ("" = not chosen). */
  aggregator: string;
  isrcCountryCode: string;
  isrcRegistrantCode: string;
  isrcYear: string;
  isrcDesignationCode: string;
  aiUsed: boolean;
  isInstrumental: boolean;
  isNational: boolean;
  isSimultaneousPublication: boolean;
  /** `YYYY-MM-DD` ("" = empty). */
  issueDate: string;
  recordingDate: string;
  releaseDate: string;
  durationMinutes: string;
  durationSeconds: string;
  musicGenre: string;
  /** PhonogramMediaType value ("" = not chosen). */
  mediaType: string;
  /** PhonogramRecordingClassification value ("" = not chosen). */
  recordingClassification: string;
  /** ISO 3166-1 alpha-2 ("" = not chosen). */
  countryOfRecording: string;
  publicationCountry: string;
  recordLabelName: string;
  notes: string;
  participation: PhonogramParticipation;
  audioFile: PhonogramAudioFile | null;
}

const stringOrEmpty = (value: unknown): string =>
  value === undefined || value === null ? "" : String(value);

/**
 * Phonogram record → form field initial values (single source of truth for the
 * form's state). Reads only the canonical CZ-040 fields. The ISRC parts come
 * from their own columns; a record that carries only the full `isrc` is split.
 * The duration comes from `duration_seconds`; `duration_text` is read only
 * when a record has no `duration_seconds`.
 */
export function phonogramToFormFields(phonogram: Partial<Phonogram> | null | undefined): PhonogramFormFields {
  const isrc = parseIsrc(phonogram?.isrc);
  const duration =
    typeof phonogram?.duration_seconds === "number"
      ? durationSecondsToParts(phonogram.duration_seconds)
      : parseDurationText(phonogram?.duration_text);
  return {
    title: stringOrEmpty(phonogram?.title),
    status: typeof phonogram?.status === "string" ? phonogram.status : "",
    ecadCode: stringOrEmpty(phonogram?.ecad_code),
    societyCode: stringOrEmpty(phonogram?.society_code),
    aggregator: stringOrEmpty(phonogram?.aggregator),
    isrcCountryCode: stringOrEmpty(phonogram?.isrc_country_code) || isrc.countryCode || "BR",
    isrcRegistrantCode: stringOrEmpty(phonogram?.isrc_registrant_code) || isrc.registrantCode,
    isrcYear: stringOrEmpty(phonogram?.isrc_year) || isrc.year,
    isrcDesignationCode: stringOrEmpty(phonogram?.isrc_designation_code) || isrc.designationCode,
    aiUsed: phonogram?.ai_used === true,
    isInstrumental: phonogram?.is_instrumental === true,
    isNational: phonogram?.is_national === true,
    isSimultaneousPublication: phonogram?.is_simultaneous_publication === true,
    issueDate: toDateInputValue(phonogram?.issue_date),
    recordingDate: toDateInputValue(phonogram?.recording_date),
    releaseDate: toDateInputValue(phonogram?.release_date),
    durationMinutes: duration.minutes,
    durationSeconds: duration.seconds,
    musicGenre: stringOrEmpty(phonogram?.music_genre),
    mediaType: stringOrEmpty(phonogram?.media_type),
    recordingClassification: stringOrEmpty(phonogram?.recording_classification),
    countryOfRecording: stringOrEmpty(phonogram?.country_of_recording),
    publicationCountry: stringOrEmpty(phonogram?.publication_country),
    recordLabelName: stringOrEmpty(phonogram?.record_label_name),
    notes: stringOrEmpty(phonogram?.notes),
    participation: phonogramToParticipation(phonogram),
    audioFile: phonogramAudioFile(phonogram?.audio_file),
  };
}

export interface PhonogramFormInput extends PhonogramFormFields {
  workId: string | null;
}

/** Request body of POST /phonograms and PATCH /phonograms/:id (canonical CZ-040 contract). */
export type PhonogramPayload = {
  title: string;
  work_id: string | null;
  isrc: string | null;
  isrc_country_code: string | null;
  isrc_registrant_code: string | null;
  isrc_year: string | null;
  isrc_designation_code: string | null;
  ecad_code: string | null;
  society_code: string | null;
  aggregator: string | null;
  ai_used: boolean;
  is_instrumental: boolean;
  is_national: boolean;
  is_simultaneous_publication: boolean;
  issue_date: string | null;
  recording_date: string | null;
  release_date: string | null;
  duration_seconds: number | null;
  duration_text: string | null;
  music_genre: string | null;
  media_type: string | null;
  recording_classification: string | null;
  country_of_recording: string | null;
  publication_country: string | null;
  status: string;
  record_label_name: string | null;
  notes: string | null;
  participation: PhonogramParticipation;
  audio_file: PhonogramAudioFile | null;
  audio_file_id: string | null;
};

function phonogramParticipantToWire(participant: PhonogramParticipant): PhonogramParticipant {
  const wire: PhonogramParticipant = { id: participant.id, name: participant.name, percentage: participant.percentage };
  if (participant.artist_id) wire.artist_id = participant.artist_id;
  return wire;
}

/**
 * Form state → request body: one canonical (English) key per form field, and
 * nothing else. org_id is not a form field: the tenant comes from the API's
 * authenticated context. `duration_text` is derived from the same inputs as
 * `duration_seconds`, so both always agree.
 */
export function formToPhonogramPayload(input: PhonogramFormInput): PhonogramPayload {
  const isrcParts: IsrcParts = {
    countryCode: input.isrcCountryCode,
    registrantCode: input.isrcRegistrantCode,
    year: input.isrcYear,
    designationCode: input.isrcDesignationCode,
  };
  return {
    title: input.title.trim(),
    work_id: input.workId,
    isrc: joinIsrc(isrcParts),
    isrc_country_code: input.isrcCountryCode || null,
    isrc_registrant_code: input.isrcRegistrantCode || null,
    isrc_year: input.isrcYear || null,
    isrc_designation_code: input.isrcDesignationCode || null,
    ecad_code: input.ecadCode || null,
    society_code: input.societyCode || null,
    aggregator: input.aggregator || null,
    ai_used: input.aiUsed,
    is_instrumental: input.isInstrumental,
    is_national: input.isNational,
    is_simultaneous_publication: input.isSimultaneousPublication,
    issue_date: input.issueDate || null,
    recording_date: input.recordingDate || null,
    release_date: input.releaseDate || null,
    duration_seconds: durationPartsToSeconds(input.durationMinutes, input.durationSeconds),
    duration_text: formatDurationText(input.durationMinutes, input.durationSeconds),
    music_genre: input.musicGenre || null,
    media_type: input.mediaType || null,
    recording_classification: input.recordingClassification || null,
    country_of_recording: input.countryOfRecording || null,
    publication_country: input.publicationCountry || null,
    status: input.status || PhonogramStatus.PENDING,
    record_label_name: input.recordLabelName || null,
    notes: input.notes || null,
    participation: {
      phonographic_producers: input.participation.phonographic_producers.map(phonogramParticipantToWire),
      performers: input.participation.performers.map(phonogramParticipantToWire),
      session_musicians: input.participation.session_musicians.map(phonogramParticipantToWire),
    },
    audio_file: input.audioFile,
    audio_file_id: input.audioFile?.fileId ?? null,
  };
}

// ── Project → Work seed ──────────────────────────────────────────────────────

/**
 * Converts a Project + its first track data into a work-shaped seed (canonical
 * Work fields) that can be passed directly to WorkFormModal as the `work` prop.
 *
 * Guarantees contextual inheritance: when registering a Work from a Project
 * the form is born prefilled with all the project's musical data
 * (title, genre, language, duration, composers, lyrics) and the project's artist.
 * The track language (a constants/languages slug) becomes the ISO code of
 * `works.language`; the track `instrumental` flag ("sim"/"nao", the projects
 * contract) becomes `is_instrumental`.
 *
 * Single source of truth for this transformation. Do NOT duplicate it in the components.
 */
export function projectToWorkSeed(
  project: {
    id: string;
    title?: string | null;
    artist_id?: string | null;
    music_genre?: string | null;
  },
  track?: {
    name?: string;
    genre?: string;
    language?: string;
    durationMinutes?: string;
    durationSeconds?: string;
    instrumental?: string;
    composers?: string[];
    lyrics?: string;
  } | null,
): Partial<Work> {
  const participants: WorkParticipant[] = (track?.composers ?? [])
    .filter((composerName): composerName is string => Boolean(composerName?.trim()))
    .map((composerName) => ({
      id: crypto.randomUUID(),
      name: composerName.trim(),
      role: "composer_author",
      link: null,
      percentage: null,
    }));

  const genre = ((track?.genre || project.music_genre || "").toLowerCase()) || null;

  return {
    project_id: project.id,
    artist_id: project.artist_id ?? null,
    title: track?.name?.trim() || project.title?.trim() || "",
    music_genre: genre,
    language: workLanguageCodeFromProjectLanguage(track?.language),
    duration_text: formatDurationText(track?.durationMinutes ?? "", track?.durationSeconds ?? ""),
    is_instrumental: track?.instrumental === "sim",
    participants: participants.length > 0 ? participants : null,
    lyrics: track?.lyrics || null,
  };
}
