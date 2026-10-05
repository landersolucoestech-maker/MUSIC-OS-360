import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import type { ContrastMode } from "@/shared/lib/image-contrast";
import type { Release } from "@/modules/releases/types";
import { cn } from "@/shared/lib/utils";
import { ReleaseStatus as PkgReleaseStatus } from "@music-os-360/types";

/**
 * release-status — the SINGLE closed taxonomy of release status (display),
 * used in the card, filters and ViewModal. Normalizes backend/platform
 * statuses to one of the 7 display values (English keys, PT-BR labels); the
 * raw `status` is never shown.
 */

export type ReleaseDisplayStatus =
  | "pending"
  | "on_hold"
  | "rejected"
  | "distributed"
  | "approved"
  | "takedown"
  | "incomplete";

type Hue = "emerald" | "amber" | "orange" | "sky" | "rose" | "slate";

const RELEASE_STATUS_META: Record<ReleaseDisplayStatus, { label: string; variant: BadgeVariant; hue: Hue }> = {
  pending: { label: "Pendente", variant: "warning", hue: "amber" },
  on_hold: { label: "Em Espera", variant: "warning", hue: "orange" },
  approved: { label: "Aprovado", variant: "info", hue: "sky" },
  distributed: { label: "Distribuído", variant: "success", hue: "emerald" },
  rejected: { label: "Rejeitado", variant: "danger", hue: "rose" },
  takedown: { label: "Takedown", variant: "danger", hue: "rose" },
  incomplete: { label: "Incompleto", variant: "neutral", hue: "slate" },
};

/**
 * SOLID status tag colors (Distribution page), per the specification:
 * Distributed/Approved green, Pending yellow, Incomplete gray (black text),
 * Rejected red, Takedown dark neutral (info), On Hold yellow (same tone
 * as the "warning" already used in RELEASE_STATUS_META) — all white text (except Incomplete).
 */
const RELEASE_STATUS_SOLID: Record<ReleaseDisplayStatus, string> = {
  distributed: "bg-success text-success-foreground border-transparent",
  approved: "bg-success text-success-foreground border-transparent",
  pending: "bg-warning text-warning-foreground border-transparent",
  incomplete: "bg-border-strong text-foreground border-transparent",
  rejected: "bg-destructive text-destructive-foreground border-transparent",
  takedown: "bg-info text-info-foreground border-transparent",
  on_hold: "bg-warning text-warning-foreground border-transparent",
};

const str = (v: unknown): string => (typeof v === "string" ? v : "");

// platform_status (distribution platform) → display set
const PLATFORM_TO_DISPLAY: Record<string, ReleaseDisplayStatus> = {
  approved: "approved",
  distributed: "distributed",
  rejected: "rejected",
  takedown: "takedown",
  on_hold: "on_hold",
  error: "on_hold",
  cancelled: "on_hold",
  incomplete: "incomplete",
  pending: "pending",
};

/** Backend `ReleaseStatus` (packages/types) → display set. */
const BACKEND_TO_DISPLAY: Record<string, ReleaseDisplayStatus> = {
  [PkgReleaseStatus.DRAFT]: "incomplete",
  [PkgReleaseStatus.METADATA_PENDING]: "incomplete",
  [PkgReleaseStatus.ASSETS_PENDING]: "incomplete",
  [PkgReleaseStatus.REVIEW]: "pending",
  [PkgReleaseStatus.SCHEDULED]: "pending",
  [PkgReleaseStatus.APPROVED]: "approved",
  [PkgReleaseStatus.DISTRIBUTED]: "distributed",
  [PkgReleaseStatus.RELEASED]: "distributed",
  [PkgReleaseStatus.CANCELLED]: "on_hold",
  [PkgReleaseStatus.ARCHIVED]: "on_hold",
};

/**
 * Legacy Portuguese statuses with no ReleaseStatus equivalent (migration
 * 20260928000019 maps every other one; BLK-RELEASES-STATUS-CHECK).
 */
const UNMAPPED_LEGACY_TO_DISPLAY: Record<string, ReleaseDisplayStatus> = {
  rejeitado: "rejected",
  takedown: "takedown",
  take_down: "takedown",
  remocao: "takedown",
};

/**
 * Backend statuses of each display group — what the status filter sends
 * (GET /releases?status=a,b). Groups without backend statuses (rejected,
 * takedown only come from the distribution platform) are not filterable.
 */
export const RELEASE_DISPLAY_TO_BACKEND_STATUSES: Partial<Record<ReleaseDisplayStatus, string[]>> = Object.entries(BACKEND_TO_DISPLAY)
  .reduce<Partial<Record<ReleaseDisplayStatus, string[]>>>((acc, [backend, display]) => {
    (acc[display] ??= []).push(backend);
    return acc;
  }, {});

/** Options for filter selects (display order); value = display group. */
export const RELEASE_STATUS_OPTIONS: { value: ReleaseDisplayStatus; label: string }[] = (
  ["pending", "on_hold", "approved", "distributed", "incomplete"] as ReleaseDisplayStatus[]
).map((v) => ({ value: v, label: RELEASE_STATUS_META[v].label }));

const displayOf = (status: string): ReleaseDisplayStatus =>
  BACKEND_TO_DISPLAY[status] ?? UNMAPPED_LEGACY_TO_DISPLAY[status] ?? "incomplete";

/**
 * Display status of a backend status — used by GET /releases/stats (GROUP BY
 * status) with the SAME classification as resolveReleaseStatus().
 * `platform_status`/`internal_status` are not columns of `releases`, so in
 * practice both functions classify the backend `status`.
 */
export function resolveStatusFromRawStatus(status: string): ReleaseDisplayStatus {
  return displayOf((status || "").toLowerCase());
}

/** Display status (7-set), single source: `platform_status` first, then `internal_status`/`status`. */
export function resolveReleaseStatus(release: Release & Record<string, unknown>): ReleaseDisplayStatus {
  const platform = str(release.platform_status).toLowerCase();
  if (platform && PLATFORM_TO_DISPLAY[platform]) return PLATFORM_TO_DISPLAY[platform];

  const internal = str(release.internal_status).toLowerCase();
  return displayOf(internal || str(release.status).toLowerCase());
}

export const releaseStatusLabel = (s: ReleaseDisplayStatus): string => RELEASE_STATUS_META[s].label;

export function releaseStatusBadge(release: Release & Record<string, unknown>) {
  const s = resolveReleaseStatus(release);
  return <Badge className={cn("border", RELEASE_STATUS_SOLID[s])}>{RELEASE_STATUS_META[s].label}</Badge>;
}

/** Normalizes a raw `platform_status` value to the 7-set (or null when missing/unknown). */
export function resolvePlatformStatus(release: Release & Record<string, unknown>): ReleaseDisplayStatus | null {
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
