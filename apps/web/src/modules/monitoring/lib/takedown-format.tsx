import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import { TakedownStatus, statusLabelPtBr } from "@music-os-360/types";
import type { Takedown } from "@/modules/monitoring/types/monitoring.types";

/** Takedown shape for rendering (canonical English API fields, CZ-034). */
export interface NormalizedTakedown {
  id: string;
  title: string;
  type: string;
  affectedWork: string;
  artistName: string;
  platform: string;
  priority: string;
  infringingUrl: string;
  reason: string;
  identifiedAt: string;
  description: string;
  evidence: string;
  status: string;
  notes: string;
  created_at?: string;
  updated_at?: string;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
/** First non-empty alias among the candidates. */
const pick = (...vals: unknown[]): string => {
  for (const v of vals) {
    const s = str(v);
    if (s) return s;
  }
  return "";
};

export function formatTakedownDate(value?: string | Date | null): string | null {
  if (!value) return null;

  if (typeof value === "string") {
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export function normalizeTakedown(raw: Takedown & Record<string, unknown>): NormalizedTakedown {
  return {
    id: String(raw.id),
    title: pick(raw.title),
    type: pick(raw.type),
    affectedWork: pick(raw.affected_work),
    artistName: pick(raw.artist_name),
    platform: pick(raw.platform),
    priority: pick(raw.priority),
    infringingUrl: pick(raw.infringing_url),
    reason: pick(raw.reason),
    identifiedAt: pick(raw.identified_at),
    description: pick(raw.description),
    evidence: pick(raw.evidence),
    status: pick(raw.status),
    notes: pick(raw.notes),
    created_at: str(raw.created_at) || undefined,
    updated_at: str(raw.updated_at) || undefined,
  };
}

// ── Status ────────────────────────────────────────────────────────────────────
const STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending: "warning",
  sent: "info",
  processing: "info",
  in_progress: "info",
  completed: "success",
  rejected: "danger",
  failed: "danger",
};

export const isResolved = (status?: string | null) => status === TakedownStatus.COMPLETED;
export const isPending = (status?: string | null) => status === TakedownStatus.PENDING;
export const isInProgress = (status?: string | null) => status === TakedownStatus.IN_PROGRESS;

/** PT-BR label of a TakedownStatus; never the raw technical value. */
export function statusLabel(status?: string | null): string {
  if (!status) return "—";
  return statusLabelPtBr("takedown", status) ?? "Status não reconhecido";
}

export function statusBadge(status?: string | null) {
  return <Badge variant={(status && STATUS_VARIANT[status]) || "neutral"}>{statusLabel(status)}</Badge>;
}

// ── Type ──────────────────────────────────────────────────────────────────────
export const TAKEDOWN_TYPE_OPTIONS = [
  { value: "sent", label: "Enviado por nós" },
  { value: "received", label: "Recebido (Claim)" },
] as const;

export function typeBadge(type?: string | null) {
  if (type === "sent") return <Badge variant="info">Enviado</Badge>;
  if (type === "received") return <Badge variant="warning">Recebido</Badge>;
  return <Badge variant="neutral">—</Badge>;
}

export const typeLabel = (type?: string | null): string =>
  TAKEDOWN_TYPE_OPTIONS.find((o) => o.value === type)?.label ?? "—";

// ── Priority ────────────────────────────────────────────────────────────────────
export const TAKEDOWN_PRIORITY_OPTIONS = [
  { value: "high", label: "Alta" },
  { value: "medium", label: "Média" },
  { value: "low", label: "Baixa" },
] as const;

export const priorityLabel = (p?: string | null): string =>
  TAKEDOWN_PRIORITY_OPTIONS.find((o) => o.value === p)?.label ?? "—";
