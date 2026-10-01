/**
 * Adapter between the marketing UI vocabulary of a project (canonical English
 * slugs in the `ProjectType` / `ProjectStatus` unions, finer-grained than the API
 * types) and the API wire vocabulary
 * (MARKETING_PROJECT_TYPES / MARKETING_PROJECT_STATUSES in
 * apps/api/src/modules/marketing/dto/marketing-projects.dto.ts).
 *
 * The API rejects anything outside its canonical English lists, so the request
 * must carry the canonical value. The exact UI slug travels in `metadata`
 * (`uiType` / `uiStatus`, persisted jsonb) so nothing is lost on read-back; rows
 * that carry no UI slug (created by other clients) are mapped back from the
 * canonical value. Rows persisted before migration 20260930000026 carry the
 * Portuguese UI slug: it is read through canonicalProjectType/Status.
 */
import type { ProjectStatus, ProjectType } from "../types/marketing.types";
import { canonicalProjectStatus, canonicalProjectType } from "../utils/marketing-legacy-vocabulary";

export type MarketingProjectApiType =
  | "MUSIC_PROJECT" | "ARTIST" | "COMPANY" | "LABEL" | "PUBLISHER" | "STUDIO" | "EVENT"
  | "CONTENT" | "CAMPAIGN" | "BRANDING" | "CORPORATE" | "PRODUCT" | "CUSTOM";

export type MarketingProjectApiStatus =
  | "draft" | "planning" | "active" | "paused" | "completed" | "cancelled" | "archived";

const TYPE_TO_API: Record<ProjectType, MarketingProjectApiType> = {
  music_release: "MUSIC_PROJECT",
  music_video: "CONTENT",
  audiovisual: "CONTENT",
  institutional_campaign: "BRANDING",
  promotional_campaign: "CAMPAIGN",
  event: "EVENT",
  corporate_content: "CORPORATE",
  behind_the_scenes: "CONTENT",
  meeting: "CUSTOM",
  product_promotion: "PRODUCT",
  service_promotion: "PRODUCT",
  saas_promotion: "PRODUCT",
  internal_communication: "CORPORATE",
  external_communication: "CORPORATE",
  news_portal: "CONTENT",
  special_project: "CUSTOM",
};

const TYPE_FROM_API: Record<MarketingProjectApiType, ProjectType> = {
  MUSIC_PROJECT: "music_release",
  ARTIST: "special_project",
  COMPANY: "corporate_content",
  LABEL: "special_project",
  PUBLISHER: "special_project",
  STUDIO: "audiovisual",
  EVENT: "event",
  CONTENT: "corporate_content",
  CAMPAIGN: "promotional_campaign",
  BRANDING: "institutional_campaign",
  CORPORATE: "corporate_content",
  PRODUCT: "product_promotion",
  CUSTOM: "special_project",
};

const STATUS_TO_API: Record<ProjectStatus, MarketingProjectApiStatus> = {
  planning: "planning",
  active: "active",
  paused: "paused",
  completed: "completed",
  cancelled: "cancelled",
};

const STATUS_FROM_API: Record<MarketingProjectApiStatus, ProjectStatus> = {
  draft: "planning",
  planning: "planning",
  active: "active",
  paused: "paused",
  completed: "completed",
  cancelled: "cancelled",
  archived: "completed",
};

function has<T extends object>(map: T, key: unknown): key is keyof T {
  return typeof key === "string" && Object.prototype.hasOwnProperty.call(map, key);
}

/** Canonical API type for a UI project type (already-canonical values pass through). */
export function projectTypeToApi(rawType: unknown): MarketingProjectApiType {
  const type = canonicalProjectType(rawType) ?? rawType;
  if (has(TYPE_TO_API, type)) return TYPE_TO_API[type];
  const upper = typeof type === "string" ? type.toUpperCase() : "";
  return has(TYPE_FROM_API, upper) ? upper : "CUSTOM";
}

/** Canonical API status for a UI project status; undefined keeps the API default. */
export function projectStatusToApi(rawStatus: unknown): MarketingProjectApiStatus | undefined {
  const status = canonicalProjectStatus(rawStatus) ?? rawStatus;
  if (has(STATUS_TO_API, status)) return STATUS_TO_API[status];
  return has(STATUS_FROM_API, status) ? status : undefined;
}

/** UI project type from a stored UI slug or, failing that, the canonical API type. */
export function projectTypeFromApi(uiType: unknown, apiType: unknown): ProjectType {
  const canonicalUi = canonicalProjectType(uiType);
  if (canonicalUi) return canonicalUi;
  const upper = typeof apiType === "string" ? apiType.toUpperCase() : "";
  return has(TYPE_FROM_API, upper) ? TYPE_FROM_API[upper] : "special_project";
}

/** UI project status from a stored UI slug or, failing that, the canonical API status. */
export function projectStatusFromApi(uiStatus: unknown, apiStatus: unknown): ProjectStatus {
  const canonicalUi = canonicalProjectStatus(uiStatus);
  if (canonicalUi) return canonicalUi;
  return has(STATUS_FROM_API, apiStatus) ? STATUS_FROM_API[apiStatus] : "planning";
}
