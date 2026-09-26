import { Badge, type BadgeVariant } from "@/shared/ui/badge";
import type { ContrastMode } from "@/shared/lib/image-contrast";
import type { Release } from "@/modules/releases/types";
import { cn } from "@/shared/lib/utils";

/**
 * release-status — taxonomia ÚNICA e fechada de status de release (display),
 * usada em card, filtros e ViewModal. Normaliza status legados/internos/de
 * plataforma para um dos 7 valores canônicos; o `status` legado nunca é exibido cru.
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
 * Cores SÓLIDAS das tags de status (página de Distribuição), conforme especificação:
 * Distribuído/Aprovado verde, Pendente amarelo, Incompleto cinza (texto preto),
 * Rejeitado vermelho, Takedown neutro escuro (info), Em Espera amarelo (mesmo tom
 * de "warning" já usado em RELEASE_STATUS_META) — todas texto branco (exceto Incompleto).
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

/** Opções para selects de filtro (ordem de exibição). */
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

// status interno/legado (conflado) → 7-set (mapeamento temporário pedido pelo usuário)
const LEGACY_TO_DISPLAY: Record<string, ReleaseStatus> = {
  // incompletos
  rascunho: "incompleto",
  draft: "incompleto",
  metadata_pending: "incompleto",
  assets_pending: "incompleto",
  em_producao: "incompleto",
  incompleto: "incompleto",
  // pendentes
  enviado: "pendente",
  aguardando_distribuicao: "pendente",
  analise: "pendente",
  em_analise: "pendente",
  review: "pendente",
  scheduled: "pendente",
  programado: "pendente",
  pronto_para_envio: "pendente",
  pendente: "pendente",
  // aprovados
  aprovado: "aprovado",
  approved: "aprovado",
  // distribuídos
  publicado: "distribuido",
  ativo: "distribuido",
  released: "distribuido",
  distributed: "distribuido",
  distribuida: "distribuido",
  distribuido: "distribuido",
  // rejeitados
  rejeitado: "rejeitado",
  rejected: "rejeitado",
  // takedown
  takedown: "takedown",
  take_down: "takedown",
  remocao: "takedown",
  // em espera
  cancelado: "em_espera",
  cancelled: "em_espera",
  arquivado: "em_espera",
  archived: "em_espera",
  on_hold: "em_espera",
};

/** Há campos obrigatórios mínimos para o release deixar de ser "incompleto"? */
export function hasRequiredForSubmission(release: Release & Record<string, unknown>): boolean {
  return Boolean(str(release.title) && str(release.artist_id) && str(release.music_genre) && str(release.type));
}

/**
 * Status de exibição (7-set), fonte única. Prioriza `platform_status` (real),
 * depois `internal_status`/`status` legado. `planejado` vira pendente/incompleto
 * conforme presença de dados obrigatórios.
 */
/**
 * Mesma classificação de resolveReleaseStatus(), mas a partir de valores já
 * agregados no backend (GET /releases/stats: GROUP BY status + "campos
 * obrigatórios preenchidos?"), sem precisar da row completa. `platform_status`/
 * `internal_status` nunca existem em `releases` (colunas nunca criadas no
 * schema — resolveReleaseStatus() sempre cai no `status` legado na prática),
 * então a única outra entrada de que a classificação depende é `hasRequired`.
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

/** Normaliza um valor de `platform_status` cru para o 7-set (ou null se ausente/desconhecido). */
export function resolvePlatformStatus(release: Release & Record<string, unknown>): ReleaseStatus | null {
  const platform = str(release.platform_status).toLowerCase();
  return platform && PLATFORM_TO_DISPLAY[platform] ? PLATFORM_TO_DISPLAY[platform] : null;
}

export function platformStatusBadge(release: Release & Record<string, unknown>) {
  const s = resolvePlatformStatus(release);
  if (!s) return null;
  return <Badge className={cn("border", RELEASE_STATUS_SOLID[s])}>{RELEASE_STATUS_META[s].label}</Badge>;
}

// ── Badges sobre a capa (Release Card): identidade de cor + contraste por modo ──
export interface CardStatusStyle {
  label: string;
  className: string;
}

/**
 * Classe do badge de status sobreposto na capa. Usa as cores SÓLIDAS oficiais
 * (texto branco/preto), que garantem contraste sobre qualquer capa — o modo de
 * contraste é ignorado para manter a identidade de cor exigida.
 */
export function cardStatusClasses(release: Release & Record<string, unknown>, _mode: ContrastMode): CardStatusStyle {
  const s = resolveReleaseStatus(release);
  return { label: RELEASE_STATUS_META[s].label, className: RELEASE_STATUS_SOLID[s] };
}
