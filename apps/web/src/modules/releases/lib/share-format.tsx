import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import type { Share, ShareType } from "@/modules/releases/types";

/**
 * share-format — utilidades de Shares: discrimina interno × externo e renderiza
 * status com contraste AA. Lê o campo novo `share_type` e, quando ausente (dados
 * legados), deriva o type dos campos existentes — sem inventar dados.
 */

const str = (v: unknown): string => (typeof v === "string" ? v : "");

/**
 * Resolve o type do share. Preferência: `share_type` explícito. Fallback (legado):
 * vínculo a lançamento ou função de distribuição → interno; música/pagador externo
 * → externo. Default conservador: interno (compatível com os seeds atuais de royalties).
 */
export function resolveShareType(share: Share & Record<string, unknown>): ShareType {
  const explicit = str(share.share_type);
  if (explicit === "internal_release" || explicit === "external_receivable") return explicit;
  if (str(share.release_id)) return "internal_release";
  if (str(share.music_title) || str(share.pagador) || str(share.artista_externo)) return "external_receivable";
  // Royalty splits existentes (work_id + artist_id/holder) são tratados como internos.
  return "internal_release";
}

export const isInternalShare = (s: Share & Record<string, unknown>) => resolveShareType(s) === "internal_release";
export const isExternalShare = (s: Share & Record<string, unknown>) => resolveShareType(s) === "external_receivable";

export const shareTypeLabel = (t: ShareType): string =>
  t === "internal_release" ? "Release Interno" : "Share Externo a Receber";

// ── Status ──────────────────────────────────────────────────────────────────────
const STATUS_META: Record<string, { label: string; variant: BadgeVariant }> = {
  pendente: { label: "Pendente", variant: "warning" },
  parcial: { label: "Parcial", variant: "info" },
  enviado: { label: "Enviado", variant: "info" },
  aceito: { label: "Aceito", variant: "success" },
  recebido: { label: "Recebido", variant: "success" },
  recusado: { label: "Recusado", variant: "danger" },
  erro: { label: "Erro", variant: "danger" },
  cancelado: { label: "Cancelado", variant: "neutral" },
};

export function shareStatusLabel(status?: string | null): string {
  const meta = STATUS_META[str(status)];
  return meta?.label ?? (status ? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : "—");
}

export function shareStatusBadge(status?: string | null) {
  const meta = STATUS_META[str(status)];
  return <Badge variant={meta?.variant ?? "neutral"}>{shareStatusLabel(status)}</Badge>;
}

// ── Função (type) ─────────────────────────────────────────────────────────────
export const FUNCAO_LABELS: Record<string, string> = {
  compositor: "Compositor / Autor",
  interprete: "Intérprete",
  produtor: "Produtor",
  editora: "Editora",
  gravadora: "Gravadora",
  empresario: "Empresário",
  outro: "Outro",
};
export const funcaoLabel = (t?: string | null): string =>
  t ? (FUNCAO_LABELS[t] ?? t.replace(/\b\w/g, (c) => c.toUpperCase())) : "—";
