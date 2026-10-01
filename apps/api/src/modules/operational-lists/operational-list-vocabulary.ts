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
 * DEFERRED kinds (marketing_*, briefing_service_type): their slugs are the
 * persisted vocabulary of the marketing module (tasks/briefings metadata and the
 * web view-model MarketingTarget, BLK-MARKETING-TARGET-WEB-VOCABULARY). Their slug
 * stays as seeded; only the English `stable_key` is assigned, so the marketing
 * slice can later flip the slug without another classification pass.
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

/** English stable ids of the DEFERRED kinds (slug unchanged): kind -> slug -> id. */
export const DEFERRED_STABLE_IDS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  marketing_context: { projeto_musical: 'music_project', artista: 'artist', empresa: 'company' },
  marketing_sector: { Design: 'design', Audiovisual: 'audiovisual', Marketing: 'marketing', 'Comunicação': 'communication' },
  marketing_task_type: { design: 'design', campanha: 'campaign', copywriting: 'copywriting', audiovisual: 'audiovisual' },
  briefing_service_type: { campanha: 'campaign', conteudo: 'content', design: 'design', audiovisual: 'audiovisual' },
};

export const OPERATIONAL_ORIGINS = ['platform', 'tenant'] as const;
export type OperationalListOrigin = (typeof OPERATIONAL_ORIGINS)[number];

/** Canonical slug for a (kind, slug) pair: legacy slugs are mapped, anything else is returned unchanged. */
export function canonicalOperationalSlug(kind: string, slug: string): string {
  const map = LEGACY_OPERATIONAL_SLUGS[kind];
  return map && Object.prototype.hasOwnProperty.call(map, slug) ? map[slug] : slug;
}

/** Legacy slugs that the canonical slug replaced (reverse lookup, used by the read path). */
export function legacyOperationalSlugs(kind: string, canonicalSlug: string): string[] {
  const map = LEGACY_OPERATIONAL_SLUGS[kind] ?? {};
  return Object.keys(map).filter((legacy) => map[legacy] === canonicalSlug);
}

/** Stable, language-independent id of a platform default: `<kind>.<english id>`. */
export function operationalStableKey(kind: string, slug: string): string {
  const id = DEFERRED_STABLE_IDS[kind]?.[slug] ?? slug.toLowerCase();
  return `${kind}.${id}`;
}
