/**
 * registry-fields.util.ts
 *
 * Shared helpers for registry fields that exist in two shapes. One shape is
 * authoritative, the other is DERIVED and rewritten on every write:
 *   - duration_seconds (integer)  is authoritative; duration_text ("MM:SS") is derived.
 *   - isrc (compact 12 chars)     is authoritative; isrc_country_code / isrc_registrant_code /
 *                                 isrc_year / isrc_designation_code (2/3/2/5) are derived.
 *
 * Pure functions, no I/O: the services (phonograms) and the bulk import call them so the
 * rule has ONE implementation and the server check stays authoritative.
 */
import { normalizeIsrc, isValidIsrc } from '../../modules/registry/validators/registry-validators';

/**
 * `duration_text` ("MM:SS", the only format the write path ever produces; parsing also
 * accepts "HH:MM:SS" for defensiveness) -> `duration_seconds` (integer).
 */
export function parseDurationTextToSeconds(durationText: string | null | undefined): number | null {
  if (typeof durationText !== 'string' || !durationText.trim()) return null;
  const parts = durationText.trim().split(':').map((p) => parseInt(p, 10));
  if (parts.some((p) => Number.isNaN(p))) return null;
  if (parts.length === 2) {
    const [min, sec] = parts;
    return min * 60 + sec;
  }
  if (parts.length === 3) {
    const [hour, min, sec] = parts;
    return hour * 3600 + min * 60 + sec;
  }
  return null;
}

/** `duration_seconds` -> "MM:SS" (minutes may exceed 59, never an hour field). null for a non-integer/negative input. */
export function formatDurationText(seconds: number | null | undefined): string | null {
  if (typeof seconds !== 'number' || !Number.isInteger(seconds) || seconds < 0) return null;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`;
}

export interface IsrcParts {
  isrc_country_code: string;
  isrc_registrant_code: string;
  isrc_year: string;
  isrc_designation_code: string;
}

export const ISRC_PART_KEYS = ['isrc_country_code', 'isrc_registrant_code', 'isrc_year', 'isrc_designation_code'] as const;

/** Compact ISRC -> its four parts (2/3/2/5). null when the ISRC is not valid. */
export function deriveIsrcParts(isrc: string | null | undefined): IsrcParts | null {
  if (typeof isrc !== 'string' || !isValidIsrc(isrc)) return null;
  const compact = normalizeIsrc(isrc);
  return {
    isrc_country_code: compact.slice(0, 2),
    isrc_registrant_code: compact.slice(2, 5),
    isrc_year: compact.slice(5, 7),
    isrc_designation_code: compact.slice(7, 12),
  };
}

/** The four parts -> compact ISRC (normalised, NOT validated). null when any part is missing/blank. */
export function composeIsrc(parts: Partial<Record<keyof IsrcParts, string | null | undefined>>): string | null {
  const values = ISRC_PART_KEYS.map((key) => parts[key]);
  if (values.some((v) => typeof v !== 'string' || v.trim() === '')) return null;
  return normalizeIsrc((values as string[]).join(''));
}

export type DerivedFieldIssueCode =
  | 'PHONOGRAM_DURATION_TEXT_INVALID'
  | 'PHONOGRAM_DURATION_MISMATCH'
  | 'PHONOGRAM_ISRC_INVALID'
  | 'PHONOGRAM_ISRC_MISMATCH'
  | 'WORK_DURATION_TEXT_INVALID';

export interface DerivedFieldIssue {
  code: DerivedFieldIssueCode;
  field: string;
  message: string;
}

export interface DerivedFieldsResult {
  values: Record<string, unknown>;
  issue?: DerivedFieldIssue;
}

const present = (v: unknown): v is string => typeof v === 'string' && v.trim() !== '';

const ISRC_INVALID_MESSAGE = 'ISRC inválido. Formato esperado: CCXXXYYNNNNN (12 caracteres, hífens opcionais).';

/**
 * Resolves the authoritative/derived pairs of a phonogram write.
 *
 * `incoming` is the write payload (null/undefined/'' mean "absent": null never clears a column);
 * `current` is the persisted row on a PATCH (null on create/import). `incoming.duration_seconds` must already
 * hold the legacy `duration` alias if any. Returns the values to persist (only keys that must be written) or
 * the first issue found.
 */
export function resolvePhonogramDerivedFields(
  incoming: Record<string, unknown>,
  current: Record<string, unknown> | null,
): DerivedFieldsResult {
  const values: Record<string, unknown> = {};

  // ── duration ──────────────────────────────────────────────────────────────
  const inSeconds = typeof incoming['duration_seconds'] === 'number' ? (incoming['duration_seconds'] as number) : undefined;
  const inText = present(incoming['duration_text']) ? incoming['duration_text'] : undefined;
  let seconds = inSeconds;
  if (inText !== undefined) {
    const parsed = parseDurationTextToSeconds(inText);
    if (parsed === null) {
      return { values, issue: { code: 'PHONOGRAM_DURATION_TEXT_INVALID', field: 'duration_text', message: 'Duração inválida. Formato esperado: MM:SS.' } };
    }
    if (inSeconds !== undefined && parsed !== inSeconds) {
      return { values, issue: { code: 'PHONOGRAM_DURATION_MISMATCH', field: 'duration_text', message: 'A duração em texto não corresponde à duração em segundos.' } };
    }
    seconds ??= parsed;
  }
  if (seconds !== undefined) {
    const text = formatDurationText(seconds);
    if (text === null) {
      return { values, issue: { code: 'PHONOGRAM_DURATION_TEXT_INVALID', field: 'duration_seconds', message: 'Duração inválida. Informe segundos inteiros e não negativos.' } };
    }
    values['duration_seconds'] = seconds;
    values['duration_text'] = text;
  }

  // ── isrc ──────────────────────────────────────────────────────────────────
  const inIsrc = present(incoming['isrc']) ? normalizeIsrc(incoming['isrc']) : undefined;
  const inParts: Partial<Record<keyof IsrcParts, string>> = {};
  for (const key of ISRC_PART_KEYS) {
    const raw = incoming[key];
    if (present(raw)) inParts[key] = normalizeIsrc(raw);
  }
  const incomingPartKeys = ISRC_PART_KEYS.filter((key) => inParts[key] !== undefined);

  let compact: string | undefined;
  if (inIsrc !== undefined) {
    if (!isValidIsrc(inIsrc)) {
      return { values, issue: { code: 'PHONOGRAM_ISRC_INVALID', field: 'isrc', message: ISRC_INVALID_MESSAGE } };
    }
    const derived = deriveIsrcParts(inIsrc)!;
    // Only the parts sent now are compared: parts persisted for the OLD isrc are rewritten, not a conflict.
    const disagree = incomingPartKeys.find((key) => inParts[key] !== derived[key]);
    if (disagree) {
      return { values, issue: { code: 'PHONOGRAM_ISRC_MISMATCH', field: disagree, message: 'As partes do ISRC não correspondem ao ISRC informado.' } };
    }
    compact = inIsrc;
  } else if (incomingPartKeys.length > 0) {
    const merged: Partial<Record<keyof IsrcParts, string>> = {};
    for (const key of ISRC_PART_KEYS) {
      const fallback = current?.[key];
      merged[key] = inParts[key] ?? (present(fallback) ? normalizeIsrc(fallback) : undefined);
    }
    const composed = composeIsrc(merged);
    if (composed !== null) {
      if (!isValidIsrc(composed)) {
        return { values, issue: { code: 'PHONOGRAM_ISRC_INVALID', field: incomingPartKeys[0], message: ISRC_INVALID_MESSAGE } };
      }
      compact = composed;
    }
  }
  if (compact !== undefined) {
    values['isrc'] = compact;
    Object.assign(values, deriveIsrcParts(compact));
  }

  return { values };
}
