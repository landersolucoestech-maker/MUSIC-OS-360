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
 * Content approval follows the same rule: `marketing_content_posts.metadata.approval`
 * held pendente/aprovado/reprovado/ajustes_solicitados; migration
 * 20260930000003 backfills and restricts it, but a web/API build released
 * before that migration can still write the old spellings until it is drained,
 * so the reader accepts them.
 *
 * Removal: delete once marketing_projects.priority / metadata.uiPriority are
 * backfilled to the canonical values, and once no pre-20260930000003 build
 * can write metadata.approval (tracked in the naming ledger).
 */
import type { ApprovalStatus, Priority } from "../types/marketing.types";

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

export const LEGACY_APPROVAL_TO_CANONICAL: Readonly<Record<string, ApprovalStatus>> = {
  pendente: "pending",
  aprovado: "approved",
  reprovado: "rejected",
  ajustes_solicitados: "revision_requested",
};

const CANONICAL_APPROVALS: ReadonlySet<string> = new Set<ApprovalStatus>(["pending", "approved", "rejected", "revision_requested"]);

/**
 * Canonical approval for a persisted/legacy value. Degrades per row: an
 * unknown, empty or non-string value reads as "pending" (the same reading as a
 * missing key) so one bad row cannot break a whole list. The raw value is never
 * surfaced; the API/CHECK constraint is what keeps such values from existing.
 */
export function canonicalApproval(value: unknown): ApprovalStatus {
  if (typeof value === "string") {
    if (CANONICAL_APPROVALS.has(value)) return value as ApprovalStatus;
    if (Object.prototype.hasOwnProperty.call(LEGACY_APPROVAL_TO_CANONICAL, value)) return LEGACY_APPROVAL_TO_CANONICAL[value];
  }
  return "pending";
}
