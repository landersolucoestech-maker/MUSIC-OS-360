import type { OperationalListItem } from "@/modules/settings/hooks/useOperationalSettings";

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
 */
export function buildGranularToBackendTypeMap(items: OperationalListItem[]): Record<string, BackendEventType> {
  const map: Record<string, BackendEventType> = {};
  for (const item of items) {
    const backendType = item.metadata?.["backend_type"];
    if (typeof backendType === "string" && isBackendEventType(backendType)) {
      map[item.slug] = backendType;
    }
  }
  return map;
}

/** Normalizes a free value (granular slug OR already a coarse enum) to the real coarse enum. */
export function normalizeToBackendType(
  value: string | null | undefined,
  granularMap: Record<string, BackendEventType>,
): BackendEventType {
  if (!value) return "other";
  const v = value.trim().toLowerCase();
  if (isBackendEventType(v)) return v;
  return granularMap[v] ?? "other";
}

/** pt-BR label for the real coarse value of an already-persisted event. */
export function getBackendEventTypeLabel(type: string | null | undefined): string {
  if (!type) return "Evento";
  return backendEventTypeLabels[type as BackendEventType] ?? type;
}
