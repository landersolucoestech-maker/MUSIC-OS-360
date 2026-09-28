import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import { ShareStatus, statusLabelPtBr } from "@music-os-360/types";
import type { Share, ShareType } from "@/modules/releases/types";

/**
 * share-format — Shares utilities: discriminates internal × external and renders
 * status with AA contrast. Reads the new `share_type` field and, when missing (legacy
 * data), derives the type from the existing fields — without inventing data.
 */

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * Resolves the share type. Preference: explicit `share_type`. Fallback (legacy):
 * link to a release or distribution role → internal; external song/payer
 * → external. Conservative default: internal (compatible with the current royalty seeds).
 */
export function resolveShareType(share: Share & Record<string, unknown>): ShareType {
  const explicit = str(share.share_type);
  if (explicit === "internal_release" || explicit === "external_receivable") return explicit;
  if (str(share.release_id)) return "internal_release";
  if (str(share.music_title) || str(share.payer) || str(share.external_artist_name)) return "external_receivable";
  // Existing royalty splits (work_id + artist_id/holder) are treated as internal.
  return "internal_release";
}

export const isInternalShare = (s: Share & Record<string, unknown>) => resolveShareType(s) === "internal_release";
export const isExternalShare = (s: Share & Record<string, unknown>) => resolveShareType(s) === "external_receivable";

export const shareTypeLabel = (t: ShareType): string =>
  t === "internal_release" ? "Release Interno" : "Share Externo a Receber";

// ── Status ──────────────────────────────────────────────────────────────────────
const STATUS_VARIANT: Record<string, BadgeVariant> = {
  [ShareStatus.ACTIVE]: "success",
  [ShareStatus.INACTIVE]: "neutral",
  [ShareStatus.PENDING]: "warning",
  [ShareStatus.SETTLED]: "success",
  [ShareStatus.PARTIAL]: "info",
  [ShareStatus.SENT]: "info",
  [ShareStatus.ACCEPTED]: "success",
  [ShareStatus.RECEIVED]: "success",
  [ShareStatus.REFUSED]: "danger",
  [ShareStatus.ERROR]: "danger",
  [ShareStatus.CANCELLED]: "neutral",
};

/** Share statuses still awaiting settlement (KPI "a receber/a enviar"). */
export const isPendingShareStatus = (status?: string | null): boolean =>
  status === ShareStatus.PENDING || status === ShareStatus.PARTIAL;

/** Financial statuses offered by the share form (value = ShareStatus, label = PT-BR). */
export const SHARE_FORM_STATUS_OPTIONS = [
  ShareStatus.PENDING,
  ShareStatus.SENT,
  ShareStatus.ACCEPTED,
  ShareStatus.RECEIVED,
  ShareStatus.REFUSED,
  ShareStatus.ERROR,
  ShareStatus.CANCELLED,
].map((value) => ({ value, label: shareStatusLabel(value) }));

/** PT-BR label of a ShareStatus; never the raw technical value. */
export function shareStatusLabel(status?: string | null): string {
  if (!status) return "—";
  return statusLabelPtBr("share", status) ?? "Status não reconhecido";
}

export function shareStatusBadge(status?: string | null) {
  return <Badge variant={(status && STATUS_VARIANT[status]) || "neutral"}>{shareStatusLabel(status)}</Badge>;
}

// ── Direction ─────────────────────────────────────────────────────────────────
export const SHARE_DIRECTION_LABELS: Record<string, string> = {
  receivable: "A receber",
  payable: "A enviar",
};

// ── Participant function (`type`) ─────────────────────────────────────────────
export const SHARE_FUNCTION_OPTIONS = [
  { value: "composer", label: "Compositor / Autor" },
  { value: "performer", label: "Intérprete" },
  { value: "producer", label: "Produtor" },
  { value: "publisher", label: "Editora" },
  { value: "record_label", label: "Gravadora" },
  { value: "manager", label: "Empresário" },
  { value: "other", label: "Outro" },
] as const;

export const shareFunctionLabel = (t?: string | null): string =>
  t ? (SHARE_FUNCTION_OPTIONS.find((o) => o.value === t)?.label ?? "Função não reconhecida") : "—";
