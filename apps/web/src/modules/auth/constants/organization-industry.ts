import { hasOwnKey } from "@/shared/lib/own-property";
/**
 * Organization industry (workspace segment) -- web mirror of the API vocabulary
 * apps/api/src/modules/auth/organization-industry.ts (a test keeps the two in
 * sync). Persisted/sent values are English machine ids; PT-BR lives in the
 * labels below. Rows written before the vocabulary change may still hold the
 * deprecated Portuguese values: `normalizeOrganizationIndustry` reads them as
 * canonical so they display correctly.
 */
export const ORGANIZATION_INDUSTRIES = [
  "record_label",
  "music_publisher",
  "distributor",
  "artist_agency",
  "publisher",
  "indie",
  "other",
  "music_production_company",
  "artist_management",
] as const;

export type OrganizationIndustry = (typeof ORGANIZATION_INDUSTRIES)[number];

export const DEFAULT_ORGANIZATION_INDUSTRY: OrganizationIndustry = "record_label";

export const ORGANIZATION_INDUSTRY_LABELS_PT_BR: Record<OrganizationIndustry, string> = {
  record_label: "Gravadora",
  music_publisher: "Editora Musical",
  distributor: "Distribuidora",
  artist_agency: "Agência Artística",
  publisher: "Publisher",
  indie: "Independente",
  other: "Outro",
  music_production_company: "Produtora Musical",
  artist_management: "Escritório Artístico",
};

/** Deprecated Portuguese value -> canonical value (mirrors the API map). */
export const LEGACY_ORGANIZATION_INDUSTRIES: Readonly<Record<string, OrganizationIndustry>> = {
  gravadora: "record_label",
  editora: "music_publisher",
  distribuidora: "distributor",
  agencia: "artist_agency",
  outro: "other",
  produtora: "music_production_company",
  escritorio: "artist_management",
};

/** Values the Register form offers and sends as `segment` (subset of the vocabulary; the API test parses this line). */
export const REGISTER_INDUSTRY_VALUES = ["record_label", "music_publisher", "music_production_company", "artist_management"] as const;

export const REGISTER_INDUSTRY_OPTIONS: ReadonlyArray<{ value: OrganizationIndustry; label: string }> =
  REGISTER_INDUSTRY_VALUES.map((value) => ({ value, label: ORGANIZATION_INDUSTRY_LABELS_PT_BR[value] }));

/** Values the Onboarding form offers. */
export const ONBOARDING_INDUSTRY_VALUES = ["record_label", "music_publisher", "distributor", "artist_agency", "publisher", "other"] as const;

export const ONBOARDING_INDUSTRY_OPTIONS: ReadonlyArray<{ value: OrganizationIndustry; label: string }> =
  ONBOARDING_INDUSTRY_VALUES.map((value) => ({ value, label: ORGANIZATION_INDUSTRY_LABELS_PT_BR[value] }));

/** Canonical industry of a stored/raw value; canonical wins, unknown values fall back to `other`. */
export function normalizeOrganizationIndustry(value: string | null | undefined): OrganizationIndustry {
  const key = (value ?? "").trim().toLowerCase();
  if ((ORGANIZATION_INDUSTRIES as readonly string[]).includes(key)) return key as OrganizationIndustry;
  return hasOwnKey(LEGACY_ORGANIZATION_INDUSTRIES, key) ? LEGACY_ORGANIZATION_INDUSTRIES[key] : "other";
}

export function organizationIndustryLabel(value: string | null | undefined): string {
  return ORGANIZATION_INDUSTRY_LABELS_PT_BR[normalizeOrganizationIndustry(value)];
}
