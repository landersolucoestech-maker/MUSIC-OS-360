/**
 * organization-industry.ts -- the ONE canonical vocabulary of
 * organizations.industry (web Register/Onboarding send it as `segment`).
 *
 * Persisted machine values are English; PT-BR labels live in the web UI
 * (apps/web/src/modules/auth/constants/organization-industry.ts mirrors this
 * file and a web test keeps the two in sync). The pre-PV1 Portuguese values
 * (Register offered gravadora/editora/produtora/escritorio, Onboarding
 * gravadora/editora/distribuidora/agencia/publisher/outro) are accepted as
 * deprecated input and mapped before validation/persistence; a value that is
 * already canonical always wins. The map mirrors migration
 * 20260930000013_BackfillAndRestrictOrganizationIndustryToEnglish.
 */
export const ORGANIZATION_INDUSTRIES = [
  'record_label',
  'music_publisher',
  'distributor',
  'artist_agency',
  'publisher',
  'indie',
  'other',
  'music_production_company',
  'artist_management',
] as const;

export type OrganizationIndustry = (typeof ORGANIZATION_INDUSTRIES)[number];

/** Industry of a workspace provisioned without one (was the DB default 'gravadora'). */
export const DEFAULT_ORGANIZATION_INDUSTRY: OrganizationIndustry = 'record_label';

/**
 * Deprecated Portuguese value -> canonical value. `produtora`/`escritorio` were
 * only ever offered by the web Register form (the API rejected them), so no
 * persisted rows are expected; they are mapped defensively.
 * `publisher` and `indie` are already canonical and stay distinct values.
 */
export const LEGACY_ORGANIZATION_INDUSTRIES: Readonly<Record<string, OrganizationIndustry>> = {
  gravadora: 'record_label',
  editora: 'music_publisher',
  distribuidora: 'distributor',
  agencia: 'artist_agency',
  outro: 'other',
  produtora: 'music_production_company',
  escritorio: 'artist_management',
};

/**
 * Canonical industry of a raw value (deprecated spellings mapped,
 * case/space-insensitive). Unknown values are returned unchanged (never
 * guessed) so the DTO validator rejects them.
 */
export function canonicalOrganizationIndustry(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const key = value.trim().toLowerCase();
  if ((ORGANIZATION_INDUSTRIES as readonly string[]).includes(key)) return key;
  if (Object.prototype.hasOwnProperty.call(LEGACY_ORGANIZATION_INDUSTRIES, key)) return LEGACY_ORGANIZATION_INDUSTRIES[key];
  return value;
}

/** class-transformer adapter. */
export const transformOrganizationIndustry = ({ value }: { value: unknown }): unknown => canonicalOrganizationIndustry(value);
