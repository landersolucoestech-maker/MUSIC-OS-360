import type { OperationalListItem } from "@/modules/settings/hooks/useOperationalSettings";
import { LEGACY_OPERATIONAL_SLUGS, canonicalOperationalSlug, legacyOperationalSlugs } from "@/modules/settings/lib/operational-vocabulary";

/** Enum actually persisted in events.type (CreateEventDto.type on the backend). */
export const BACKEND_EVENT_TYPES = ["show", "festival", "recording", "meeting", "interview", "tour", "other"] as const;
export type BackendEventType = (typeof BACKEND_EVENT_TYPES)[number];

/** pt-BR labels for the coarse enum actually persisted (not the form's granular category). */
export const backendEventTypeLabels: Record<BackendEventType, string> = {
  show: "Show",
  festival: "Festival",
  recording: "Gravação/Estúdio",
  meeting: "Reunião",
  interview: "Entrevista/Imprensa",
  tour: "Turnê",
  other: "Outro",
};

function isBackendEventType(value: string): value is BackendEventType {
  return (BACKEND_EVENT_TYPES as readonly string[]).includes(value);
}

/**
 * The event category configurable in Settings → Operational is
 * granular (e.g. slug "sessoes_estudio", "ensaios") but the real column
 * `events.type` only stores the backend's coarse enum — there is no column for
 * the granular distinction. Each operational item carries this mapping
 * in `metadata.backend_type` (see useOperationalSettings.ts,
 * DEFAULT_EVENT_TYPES) — this helper reads exactly that source of truth instead
 * of keeping a duplicated, diverging table.
 *
 * The granular ids are canonical English (studio_sessions, meetings...); the
 * pre-OL1 Portuguese slugs (sessoes_estudio, reunioes...) are still resolved
 * (legacy reader) so stored list items, drafts and deep links keep working.
 */
export function buildGranularToBackendTypeMap(items: OperationalListItem[]): Record<string, BackendEventType> {
  const map: Record<string, BackendEventType> = {};
  for (const item of items) {
    const backendType = item.metadata?.["backend_type"];
    if (typeof backendType === "string" && isBackendEventType(backendType)) {
      map[item.slug] = backendType;
      for (const legacy of legacyOperationalSlugs("event_type", item.slug)) {
        if (map[legacy] === undefined) map[legacy] = backendType;
      }
    }
  }
  return map;
}

// ─── Granular event categories (form / filter ids) ──────────────────────────

/** Canonical English ids of the platform event categories (operational list kind `event_type`). */
export const EVENT_CATEGORY_IDS = [
  "studio_sessions",
  "rehearsals",
  "photo_shoots",
  "shows",
  "interviews",
  "podcasts",
  "tv_shows",
  "radio",
  "content_production",
  "meetings",
] as const;
export type EventCategoryId = (typeof EVENT_CATEGORY_IDS)[number];

/** pt-BR display labels (the only place the Portuguese copy of the fallback list lives). */
export const EVENT_CATEGORY_LABELS: Record<EventCategoryId, string> = {
  studio_sessions: "Sessões de estúdio",
  rehearsals: "Ensaios",
  photo_shoots: "Sessões de fotos",
  shows: "Shows",
  interviews: "Entrevistas",
  podcasts: "Podcasts",
  tv_shows: "Programas de TV",
  radio: "Rádio",
  content_production: "Produção de conteúdo",
  meetings: "Reuniões",
};

export const EVENT_CATEGORY_OPTIONS: Array<{ value: EventCategoryId; label: string }> = EVENT_CATEGORY_IDS.map((value) => ({
  value,
  label: EVENT_CATEGORY_LABELS[value],
}));

/** Category -> coarse events.type, fallback when no operational item carries metadata.backend_type. */
export const EVENT_CATEGORY_BACKEND_TYPE: Record<EventCategoryId, BackendEventType> = {
  studio_sessions: "recording",
  rehearsals: "recording",
  photo_shoots: "other",
  shows: "show",
  interviews: "interview",
  podcasts: "interview",
  tv_shows: "interview",
  radio: "interview",
  content_production: "other",
  meetings: "meeting",
};

/** Categories that show the artist/venue fields (everything except internal meetings, which only show the venue). */
export const ARTIST_RELATED_EVENT_CATEGORIES: readonly string[] = EVENT_CATEGORY_IDS.filter((id) => id !== "meetings");
/** Categories whose venue is picked from the CRM. */
export const VENUE_CRM_EVENT_CATEGORIES: readonly string[] = ["shows", "tv_shows", "radio", "podcasts"];

/**
 * Legacy reader (input only): everything an older build, a saved draft, a
 * MusicChat prefill or a persisted coarse `events.type` may hand the form,
 * mapped to the canonical category id. Pre-OL1 Portuguese slugs come from the
 * shared operational vocabulary map; the rest are the historic free-text
 * aliases of the scheduler and the coarse backend enum (a persisted event only
 * keeps the coarse type, so edit resolves it to a representative category).
 */
const EVENT_CATEGORY_INPUT_ALIASES: Readonly<Record<string, EventCategoryId>> = {
  ...(LEGACY_OPERATIONAL_SLUGS["event_type"] as Record<string, EventCategoryId>),
  show: "shows",
  show_teatro: "shows",
  festival: "shows",
  rodeio: "shows",
  lancamento: "shows",
  evento_corporativo: "shows",
  reuniao: "meetings",
  recording: "studio_sessions",
  meeting: "meetings",
  interview: "interviews",
  tour: "shows",
};

/** Normalizes a stored/typed category value (trim, lower-case, accent-less) to the canonical id; unknown values pass through. */
export function canonicalEventCategory(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return EVENT_CATEGORY_INPUT_ALIASES[normalized] ?? canonicalOperationalSlug("event_type", normalized);
}

/** Historic free-text values that mean a coarse type but are not categories (kept for payload mapping only). */
const EXTRA_INPUT_TO_BACKEND_TYPE: Readonly<Record<string, BackendEventType>> = {
  festival: "festival",
  evento_corporativo: "other",
  gravacao: "recording",
  gravacoes: "recording",
  entrevista: "interview",
  turne: "tour",
  tour: "tour",
};

/**
 * Coarse `events.type` for a form category: the operational item's
 * metadata.backend_type wins (granularMap), then the built-in category table,
 * then the historic aliases; anything unknown is `other`.
 */
export function eventCategoryToBackendType(category: string, granularMap: Record<string, BackendEventType>): BackendEventType {
  const raw = (category || "").trim().toLowerCase();
  if (granularMap[raw]) return granularMap[raw];
  const canonical = canonicalEventCategory(raw);
  if (granularMap[canonical]) return granularMap[canonical];
  if (EXTRA_INPUT_TO_BACKEND_TYPE[raw]) return EXTRA_INPUT_TO_BACKEND_TYPE[raw];
  if (isBackendEventType(raw)) return raw;
  return EVENT_CATEGORY_BACKEND_TYPE[canonical as EventCategoryId] ?? "other";
}

/** Normalizes a free value (granular slug OR already a coarse enum) to the real coarse enum. */
export function normalizeToBackendType(
  value: string | null | undefined,
  granularMap: Record<string, BackendEventType>,
): BackendEventType {
  if (!value) return "other";
  const v = value.trim().toLowerCase();
  if (isBackendEventType(v)) return v;
  return granularMap[v] ?? granularMap[canonicalOperationalSlug("event_type", v)] ?? "other";
}

/** pt-BR label for the real coarse value of an already-persisted event. */
export function getBackendEventTypeLabel(type: string | null | undefined): string {
  if (!type) return "Evento";
  return backendEventTypeLabels[type as BackendEventType] ?? type;
}
