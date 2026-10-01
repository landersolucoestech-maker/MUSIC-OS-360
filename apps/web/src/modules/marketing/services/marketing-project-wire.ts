/**
 * Adapter between the marketing UI vocabulary of a project (Portuguese slugs in
 * the `ProjectType` / `ProjectStatus` unions) and the API wire vocabulary
 * (MARKETING_PROJECT_TYPES / MARKETING_PROJECT_STATUSES in
 * apps/api/src/modules/marketing/dto/marketing-projects.dto.ts).
 *
 * The API rejects anything outside its canonical English lists, so the request
 * must carry the canonical value. The exact UI slug travels in `metadata`
 * (`uiType` / `uiStatus`, persisted jsonb) so nothing is lost on read-back; rows
 * that carry no UI slug (created by other clients) are mapped back from the
 * canonical value.
 */
import type { ProjectStatus, ProjectType } from "../types/marketing.types";

export type MarketingProjectApiType =
  | "MUSIC_PROJECT" | "ARTIST" | "COMPANY" | "LABEL" | "PUBLISHER" | "STUDIO" | "EVENT"
  | "CONTENT" | "CAMPAIGN" | "BRANDING" | "CORPORATE" | "PRODUCT" | "CUSTOM";

export type MarketingProjectApiStatus =
  | "draft" | "planning" | "active" | "paused" | "completed" | "cancelled" | "archived";

const TYPE_TO_API: Record<ProjectType, MarketingProjectApiType> = {
  lancamento_musical: "MUSIC_PROJECT",
  videoclipe: "CONTENT",
  audiovisual: "CONTENT",
  campanha_institucional: "BRANDING",
  campanha_promocional: "CAMPAIGN",
  evento: "EVENT",
  conteudo_corporativo: "CORPORATE",
  bastidores: "CONTENT",
  reuniao: "CUSTOM",
  divulgacao_produto: "PRODUCT",
  divulgacao_servico: "PRODUCT",
  divulgacao_saas: "PRODUCT",
  comunicacao_interna: "CORPORATE",
  comunicacao_externa: "CORPORATE",
  portal_noticias: "CONTENT",
  projeto_especial: "CUSTOM",
};

const TYPE_FROM_API: Record<MarketingProjectApiType, ProjectType> = {
  MUSIC_PROJECT: "lancamento_musical",
  ARTIST: "projeto_especial",
  COMPANY: "conteudo_corporativo",
  LABEL: "projeto_especial",
  PUBLISHER: "projeto_especial",
  STUDIO: "audiovisual",
  EVENT: "evento",
  CONTENT: "conteudo_corporativo",
  CAMPAIGN: "campanha_promocional",
  BRANDING: "campanha_institucional",
  CORPORATE: "conteudo_corporativo",
  PRODUCT: "divulgacao_produto",
  CUSTOM: "projeto_especial",
};

const STATUS_TO_API: Record<ProjectStatus, MarketingProjectApiStatus> = {
  planejamento: "planning",
  em_andamento: "active",
  pausado: "paused",
  concluido: "completed",
  cancelado: "cancelled",
};

const STATUS_FROM_API: Record<MarketingProjectApiStatus, ProjectStatus> = {
  draft: "planejamento",
  planning: "planejamento",
  active: "em_andamento",
  paused: "pausado",
  completed: "concluido",
  cancelled: "cancelado",
  archived: "concluido",
};

function has<T extends object>(map: T, key: unknown): key is keyof T {
  return typeof key === "string" && Object.prototype.hasOwnProperty.call(map, key);
}

/** Canonical API type for a UI project type (already-canonical values pass through). */
export function projectTypeToApi(type: unknown): MarketingProjectApiType {
  if (has(TYPE_TO_API, type)) return TYPE_TO_API[type];
  const upper = typeof type === "string" ? type.toUpperCase() : "";
  return has(TYPE_FROM_API, upper) ? upper : "CUSTOM";
}

/** Canonical API status for a UI project status; undefined keeps the API default. */
export function projectStatusToApi(status: unknown): MarketingProjectApiStatus | undefined {
  if (has(STATUS_TO_API, status)) return STATUS_TO_API[status];
  return has(STATUS_FROM_API, status) ? status : undefined;
}

/** UI project type from a stored UI slug or, failing that, the canonical API type. */
export function projectTypeFromApi(uiType: unknown, apiType: unknown): ProjectType {
  if (has(TYPE_TO_API, uiType)) return uiType;
  const upper = typeof apiType === "string" ? apiType.toUpperCase() : "";
  return has(TYPE_FROM_API, upper) ? TYPE_FROM_API[upper] : "projeto_especial";
}

/** UI project status from a stored UI slug or, failing that, the canonical API status. */
export function projectStatusFromApi(uiStatus: unknown, apiStatus: unknown): ProjectStatus {
  if (has(STATUS_TO_API, uiStatus)) return uiStatus;
  return has(STATUS_FROM_API, apiStatus) ? STATUS_FROM_API[apiStatus] : "planejamento";
}
