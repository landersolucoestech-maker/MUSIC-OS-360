/**
 * Deprecated Portuguese marketing vocabulary (READ side only).
 *
 * Before the technical-language canonicalization the web stored its UI
 * vocabulary as-is: marketing PROJECT rows persisted `priority` as
 * baixa/media/alta/urgente (and kept the same word again in
 * `metadata.uiPriority`). Those rows are still in the database, so the
 * projects reader must translate them to the canonical English `Priority`.
 * This is the only place in the web that knows the Portuguese spellings;
 * nothing ever writes them.
 *
 * Removal: delete once marketing_projects.priority / metadata.uiPriority are
 * backfilled to the canonical values (tracked in the naming ledger).
 */
import type { Priority } from "../types/marketing.types";

export const LEGACY_PRIORITY_TO_CANONICAL: Readonly<Record<string, Priority>> = {
  baixa: "low",
  media: "normal",
  alta: "high",
  urgente: "urgent",
};

const CANONICAL_PRIORITIES: ReadonlySet<string> = new Set<Priority>(["low", "normal", "high", "urgent"]);

/**
 * Canonical priority for a persisted/legacy value. An unknown value is a
 * contract violation, not something to guess: it throws instead of silently
 * becoming "normal".
 */
export function canonicalPriority(value: unknown): Priority {
  if (typeof value === "string") {
    if (CANONICAL_PRIORITIES.has(value)) return value as Priority;
    if (Object.prototype.hasOwnProperty.call(LEGACY_PRIORITY_TO_CANONICAL, value)) return LEGACY_PRIORITY_TO_CANONICAL[value];
  }
  throw new Error(`[marketing] unknown priority received from the API: ${String(value)}`);
}
