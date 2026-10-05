/**
 * Vocabulary of the PLATFORM-OWNED operational list items (OL1).
 *
 * `operational_list_items` mixes two kinds of rows: items seeded by the platform
 * (OPERATIONAL_LIST_DEFAULTS) and items authored by tenants. Tenant content is
 * NEVER translated; only the platform defaults get a canonical English slug.
 *
 * Machine values (slug, stable_key) are English, the pt-BR copy lives in `name`
 * (a display label the tenant may edit).
 *
 * Expand-contract (migration 20260930000016):
 *  - `origin` ('platform' | 'tenant'), `stable_key` and `legacy_slug` are added as
 *    nullable columns; `origin IS NULL` means "not classified" (rows that predate
 *    the column and were not proven to be platform defaults).
 *  - a row is proven to be a platform default only by an EXACT match of
 *    (kind, slug, name) against the defaults (canonical or legacy form).
 *  - the read path (service lookups, web readers) accepts the legacy slug.
 *
 * AP3 (R3-03): the marketing_context / marketing_sector / marketing_task_type /
 * briefing_service_type defaults, formerly deferred, now follow the same rule
 * (their slugs are the canonical marketing vocabulary: music_project/artist/company,
 * design/.../communication, campaign, content), and the two contact classification
 * KINDS (contact_pf_classification / contact_pj_classification) are renamed to
 * contact_individual_classification / contact_company_classification. Rows are
 * proven platform defaults by the same exact (kind, slug, name) match
 * (migration 20260930000031); tenant-authored or edited rows are never touched.
 */

/** legacy (Portuguese) slug -> canonical English slug, per kind. Only renamed slugs are listed. */
export const LEGACY_OPERATIONAL_SLUGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  lead_type: {
    artista_banda: 'artist_or_band',
    contratante_show: 'show_booker',
    marca_empresa: 'brand_or_company',
    produtora_eventos: 'event_producer',
    gravadora_selo: 'record_label',
    agencia: 'agency',
    influenciador: 'influencer',
  },
  lead_category: {
    artista_banda: 'artist_or_band',
    contratante_show: 'show_booker',
    marca_empresa: 'brand_or_company',
    agencia: 'agency',
  },
  service_interest: {
    gestao_artistica: 'artist_management',
    producao_musical: 'music_production',
    mixagem: 'mixing',
    masterizacao: 'mastering',
    distribuicao_digital: 'digital_distribution',
    marketing_musical: 'music_marketing',
    producao_audiovisual: 'audiovisual_production',
    design_grafico: 'graphic_design',
    licenciamento: 'licensing',
    consultoria: 'consulting',
    outro: 'other',
  },
  // Canonical set = the LeadStatus enum (packages/types), the ONLY values that
  // leads.status accepts (CHECK from 20260910000016, IsIn in the DTO).
  lead_status: {
    novo_lead: 'new',
    qualificado: 'qualified',
    em_contato: 'in_contact',
    proposta_enviada: 'proposal',
    fechado: 'closed',
    perdido: 'lost',
  },
  lead_segment: {
    musical: 'music',
    eventos: 'events',
    corporativo: 'corporate',
  },
  // AP3: the marketing slugs were the persisted marketing vocabulary (now canonical English; the PT-BR copy is the `name`).
  marketing_context: {
    projeto_musical: 'music_project',
    artista: 'artist',
    empresa: 'company',
  },
  marketing_sector: {
    Design: 'design',
    Audiovisual: 'audiovisual',
    Marketing: 'marketing',
    Comunicação: 'communication',
  },
  marketing_task_type: {
    campanha: 'campaign',
  },
  briefing_service_type: {
    campanha: 'campaign',
    conteudo: 'content',
  },
  event_type: {
    sessoes_estudio: 'studio_sessions',
    ensaios: 'rehearsals',
    sessoes_fotos: 'photo_shoots',
    entrevistas: 'interviews',
    programas_tv: 'tv_shows',
    producao_conteudo: 'content_production',
    reunioes: 'meetings',
  },
};

/**
 * Names the pre-OL1 API seed used when they differ from the current default name
 * (exact-match classification must recognise rows seeded by the old build).
 * kind -> canonical slug -> legacy name.
 */
export const LEGACY_OPERATIONAL_NAMES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  lead_status: {
    new: 'Novo lead',
    proposal: 'Proposta enviada',
  },
};

/**
 * Renamed list KINDS (container ids; AP3): legacy kind -> canonical kind. `pf`/`pj` were the Portuguese
 * abbreviations of pessoa fisica/juridica. Slugs of both kinds were already English.
 */
export const LEGACY_OPERATIONAL_KINDS: Readonly<Record<string, string>> = {
  contact_pf_classification: 'contact_individual_classification',
  contact_pj_classification: 'contact_company_classification',
};

/** Canonical kind for a stored/received kind (legacy kinds mapped, anything else unchanged). */
export function canonicalOperationalKind(kind: string): string {
  return Object.prototype.hasOwnProperty.call(LEGACY_OPERATIONAL_KINDS, kind) ? LEGACY_OPERATIONAL_KINDS[kind] : kind;
}

/** class-transformer @Transform: a deprecated kind in a request is mapped BEFORE validation (strings only). */
export const canonicalOperationalKindTransform = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? canonicalOperationalKind(value) : value;

/** Kinds to match when querying one canonical kind: itself plus the legacy kind(s) not yet backfilled. */
export function operationalKindAliases(kind: string): string[] {
  const canonical = canonicalOperationalKind(kind);
  return [canonical, ...Object.keys(LEGACY_OPERATIONAL_KINDS).filter((legacy) => LEGACY_OPERATIONAL_KINDS[legacy] === canonical)];
}

export const OPERATIONAL_ORIGINS = ['platform', 'tenant'] as const;
export type OperationalListOrigin = (typeof OPERATIONAL_ORIGINS)[number];

/** Canonical slug for a (kind, slug) pair: legacy slugs are mapped, anything else is returned unchanged. */
export function canonicalOperationalSlug(kind: string, slug: string): string {
  const map = Object.prototype.hasOwnProperty.call(LEGACY_OPERATIONAL_SLUGS, kind) ? LEGACY_OPERATIONAL_SLUGS[kind] : undefined;
  return map && Object.prototype.hasOwnProperty.call(map, slug) ? map[slug] : slug;
}

/** Legacy slugs that the canonical slug replaced (reverse lookup, used by the read path). */
export function legacyOperationalSlugs(kind: string, canonicalSlug: string): string[] {
  const map = Object.prototype.hasOwnProperty.call(LEGACY_OPERATIONAL_SLUGS, kind) ? LEGACY_OPERATIONAL_SLUGS[kind] : {};
  return Object.keys(map).filter((legacy) => map[legacy] === canonicalSlug);
}

/** Stable, language-independent id of a platform default: `<kind>.<english id>`. */
export function operationalStableKey(kind: string, slug: string): string {
  return `${kind}.${slug.toLowerCase()}`;
}
