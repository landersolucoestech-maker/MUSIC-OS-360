import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import type { ContrastMode } from "@/shared/lib/image-contrast";
import type { Release } from "@/modules/releases/types";
import { cn } from "@/shared/lib/utils";

/**
 * release-status — the SINGLE closed taxonomy of release status (display),
 * used in the card, filters and ViewModal. Normalizes legacy/internal/platform
 * statuses to one of the 7 canonical values; the legacy `status` is never shown raw.
 */

export type ReleaseStatus =
  | "pendente"
  | "em_espera"
  | "rejeitado"
  | "distribuido"
  | "aprovado"
  | "takedown"
  | "incompleto";

type Hue = "emerald" | "amber" | "orange" | "sky" | "rose" | "slate";

const RELEASE_STATUS_META: Record<ReleaseStatus, { label: string; variant: BadgeVariant; hue: Hue }> = {
  pendente: { label: "Pendente", variant: "warning", hue: "amber" },
  em_espera: { label: "Em Espera", variant: "warning", hue: "orange" },
  aprovado: { label: "Aprovado", variant: "info", hue: "sky" },
  distribuido: { label: "Distribuído", variant: "success", hue: "emerald" },
  rejeitado: { label: "Rejeitado", variant: "danger", hue: "rose" },
  takedown: { label: "Takedown", variant: "danger", hue: "rose" },
  incompleto: { label: "Incompleto", variant: "neutral", hue: "slate" },
};

/**
 * SOLID status tag colors (Distribution page), per the specification:
 * Distributed/Approved green, Pending yellow, Incomplete gray (black text),
 * Rejected red, Takedown dark neutral (info), On Hold yellow (same tone
 * as the "warning" already used in RELEASE_STATUS_META) — all white text (except Incomplete).
 */
const RELEASE_STATUS_SOLID: Record<ReleaseStatus, string> = {
  distribuido: "bg-success text-success-foreground border-transparent",
  aprovado: "bg-success text-success-foreground border-transparent",
  pendente: "bg-warning text-warning-foreground border-transparent",
  incompleto: "bg-border-strong text-foreground border-transparent",
  rejeitado: "bg-destructive text-destructive-foreground border-transparent",
  takedown: "bg-info text-info-foreground border-transparent",
  em_espera: "bg-warning text-warning-foreground border-transparent",
};

/** Options for filter selects (display order). */
export const RELEASE_STATUS_OPTIONS: { value: ReleaseStatus; label: string }[] = (
  ["pendente", "em_espera", "aprovado", "distribuido", "rejeitado", "takedown", "incompleto"] as ReleaseStatus[]
).map((v) => ({ value: v, label: RELEASE_STATUS_META[v].label }));

const str = (v: unknown): string => (typeof v === "string" ? v : "");

// platform_status (real) → 7-set
const PLATFORM_TO_DISPLAY: Record<string, ReleaseStatus> = {
  aprovado: "aprovado",
  distribuido: "distribuido",
  rejeitado: "rejeitado",
  takedown: "takedown",
  on_hold: "em_espera",
  erro: "em_espera",
  cancelado: "em_espera",
  incompleto: "incompleto",
  pendente: "pendente",
};

// internal/legacy (conflated) status → 7-set (temporary mapping requested by the user)
const LEGACY_TO_DISPLAY: Record<string, ReleaseStatus> = {
  // incomplete
  rascunho: "incompleto",
  draft: "incompleto",
  metadata_pending: "incompleto",
  assets_pending: "incompleto",
  em_producao: "incompleto",
  incompleto: "incompleto",
  // pending
  enviado: "pendente",
  aguardando_distribuicao: "pendente",
  analise: "pendente",
  em_analise: "pendente",
  review: "pendente",
  scheduled: "pendente",
  programado: "pendente",
  pronto_para_envio: "pendente",
  pendente: "pendente",
  // approved
  aprovado: "aprovado",
  approved: "aprovado",
  // distributed
  publicado: "distribuido",
  ativo: "distribuido",
  released: "distribuido",
  distributed: "distribuido",
  distribuida: "distribuido",
  distribuido: "distribuido",
  // rejected
  rejeitado: "rejeitado",
  rejected: "rejeitado",
  // takedown
  takedown: "takedown",
  take_down: "takedown",
  remocao: "takedown",
  // on hold
  cancelado: "em_espera",
  cancelled: "em_espera",
  arquivado: "em_espera",
  archived: "em_espera",
  on_hold: "em_espera",
};

/** Are the minimum required fields present for the release to stop being "incomplete"? */
export function hasRequiredForSubmission(release: Release & Record<string, unknown>): boolean {
  return Boolean(str(release.title) && str(release.artist_id) && str(release.music_genre) && str(release.type));
}

/**
 * Display status (7-set), single source. Prefers `platform_status` (real),
 * then legacy `internal_status`/`status`. `planejado` becomes pending/incomplete
 * depending on the presence of required data.
 */
/**
 * Same classification as resolveReleaseStatus(), but from values already
 * aggregated in the backend (GET /releases/stats: GROUP BY status + "required
 * fields filled?"), without needing the full row. `platform_status`/
 * `internal_status` never exist in `releases` (columns never created in the
 * schema — resolveReleaseStatus() always falls back to the legacy `status` in practice),
 * so the only other input the classification depends on is `hasRequired`.
 */
export function resolveStatusFromRawStatus(status: string, hasRequired: boolean): ReleaseStatus {
  const key = (status || "").toLowerCase();
  if (key === "planejado") return hasRequired ? "pendente" : "incompleto";
  return LEGACY_TO_DISPLAY[key] ?? "incompleto";
}

export function resolveReleaseStatus(release: Release & Record<string, unknown>): ReleaseStatus {
  const platform = str(release.platform_status).toLowerCase();
  if (platform && PLATFORM_TO_DISPLAY[platform]) return PLATFORM_TO_DISPLAY[platform];

  const internal = str(release.internal_status).toLowerCase();
  const legacy = str(release.status).toLowerCase();
  const key = internal || legacy;

  if (key === "planejado") return hasRequiredForSubmission(release) ? "pendente" : "incompleto";
  return LEGACY_TO_DISPLAY[key] ?? "incompleto";
}

export const releaseStatusLabel = (s: ReleaseStatus): string => RELEASE_STATUS_META[s].label;

export function releaseStatusBadge(release: Release & Record<string, unknown>) {
  const s = resolveReleaseStatus(release);
  return <Badge className={cn("border", RELEASE_STATUS_SOLID[s])}>{RELEASE_STATUS_META[s].label}</Badge>;
}

/** Normalizes a raw `platform_status` value to the 7-set (or null when missing/unknown). */
export function resolvePlatformStatus(release: Release & Record<string, unknown>): ReleaseStatus | null {
  const platform = str(release.platform_status).toLowerCase();
  return platform && PLATFORM_TO_DISPLAY[platform] ? PLATFORM_TO_DISPLAY[platform] : null;
}

export function platformStatusBadge(release: Release & Record<string, unknown>) {
  const s = resolvePlatformStatus(release);
  if (!s) return null;
  return <Badge className={cn("border", RELEASE_STATUS_SOLID[s])}>{RELEASE_STATUS_META[s].label}</Badge>;
}

// ── Badges over the cover (Release Card): color identity + contrast per mode ──
export interface CardStatusStyle {
  label: string;
  className: string;
}

/**
 * Class of the status badge overlaid on the cover. Uses the official SOLID colors
 * (white/black text), which guarantee contrast over any cover — the contrast
 * mode is ignored to keep the required color identity.
 */
export function cardStatusClasses(release: Release & Record<string, unknown>, _mode: ContrastMode): CardStatusStyle {
  const s = resolveReleaseStatus(release);
  return { label: RELEASE_STATUS_META[s].label, className: RELEASE_STATUS_SOLID[s] };
}
