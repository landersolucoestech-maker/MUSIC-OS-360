import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import type { Takedown } from "@/modules/monitoring/types/monitoring.types";

/**
 * Shape canônico de um takedown para renderização. Centraliza a leitura dos dois
 * shapes que coexistem na base mock: snake_case (seeds/back-end) e camelCase legado
 * (persistido por versões antigas do FormModal). Não inventa dados — apenas resolve
 * o mesmo campo entre os aliases possíveis.
 */
export interface NormalizedTakedown {
  id: string;
  title: string;
  type: string;
  obra_afetada: string;
  artista: string;
  plataforma: string;
  prioridade: string;
  url_infracao: string;
  motivo: string;
  data: string;
  descricao: string;
  evidencias: string;
  status: string;
  observacoes: string;
  created_at?: string;
  updated_at?: string;
}

const str = (v: unknown): string => (typeof v === "string" ? v : "");
/** Primeiro alias não-vazio entre os candidatos. */
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
    obra_afetada: pick(raw.obra_afetada, raw.obraAfetada),
    artista: pick(raw.artista),
    plataforma: pick(raw.plataforma),
    prioridade: pick(raw.prioridade),
    url_infracao: pick(raw.url_infracao, raw.urlInfratora, raw.url),
    motivo: pick(raw.motivo),
    data: pick(raw.data_identificacao, raw.dataIdentificacao, raw.data_solicitacao, raw.data),
    descricao: pick(raw.descricao),
    evidencias: pick(raw.evidencias),
    status: pick(raw.status),
    observacoes: pick(raw.observacoes),
    created_at: str(raw.created_at) || undefined,
    updated_at: str(raw.updated_at) || undefined,
  };
}

// ── Status ────────────────────────────────────────────────────────────────────
/** Normaliza aliases legados para os estados canônicos de UI. */
function canonicalStatus(status?: string | null): string {
  switch (status) {
    case "resolvido": return "completed";
    case "analise": return "in_progress";
    default: return status ?? "";
  }
}

const STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  pending: { label: "Pendente", variant: "warning" },
  in_progress: { label: "Em Andamento", variant: "info" },
  completed: { label: "Concluído", variant: "success" },
  rejected: { label: "Rejeitado", variant: "danger" },
};

export const isResolved = (status?: string | null) => canonicalStatus(status) === "completed";
export const isPending = (status?: string | null) => canonicalStatus(status) === "pending";
export const isInProgress = (status?: string | null) => canonicalStatus(status) === "in_progress";

export function statusLabel(status?: string | null): string {
  const meta = STATUS_META[canonicalStatus(status)];
  return meta?.label ?? (status ? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—");
}

export function statusBadge(status?: string | null) {
  const key = canonicalStatus(status);
  const meta = STATUS_META[key];
  return <Badge variant={meta?.variant ?? "neutral"}>{statusLabel(status)}</Badge>;
}

// ── Tipo ──────────────────────────────────────────────────────────────────────
export function typeBadge(type?: string | null) {
  if (type === "enviado") return <Badge variant="info">Enviado</Badge>;
  if (type === "recebido") return <Badge variant="warning">Recebido</Badge>;
  return <Badge variant="neutral">—</Badge>;
}

export const typeLabel = (type?: string | null): string =>
  type === "enviado" ? "Enviado por nós" : type === "recebido" ? "Recebido (Claim)" : "—";

// ── Prioridade ──────────────────────────────────────────────────────────────────
const PRIORIDADE_LABEL: Record<string, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };
export const prioridadeLabel = (p?: string | null): string => (p ? PRIORIDADE_LABEL[p] ?? p : "—");
