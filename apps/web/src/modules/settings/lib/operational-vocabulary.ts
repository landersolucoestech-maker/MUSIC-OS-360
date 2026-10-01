import type { OperationalListKind } from "@/modules/settings/hooks/useOperationalSettings";

/**
 * Legacy (Portuguese) slugs of the PLATFORM-OWNED operational list defaults and
 * the canonical English slug that replaced them (OL1). Mirror of
 * apps/api/src/modules/operational-lists/operational-list-vocabulary.ts (a spec
 * asserts both maps are identical). Only the platform defaults are renamed:
 * tenant-authored items are never translated, so a stored item is migrated only
 * when its (kind, slug, name) EXACTLY equals a legacy default.
 *
 * AP3 (R3-03): the marketing_context / marketing_sector / marketing_task_type /
 * briefing_service_type defaults follow the same rule (canonical marketing
 * vocabulary as slug, PT-BR copy as name), and the two contact classification KINDS were
 * renamed (LEGACY_OPERATIONAL_KINDS below). A stored item under a legacy KIND moves to the
 * canonical kind as a whole (a kind is a container id, tenant items included).
 */
export const LEGACY_OPERATIONAL_SLUGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  lead_type: { artista_banda: "artist_or_band", contratante_show: "show_booker", marca_empresa: "brand_or_company", produtora_eventos: "event_producer", gravadora_selo: "record_label", agencia: "agency", influenciador: "influencer" },
  lead_category: { artista_banda: "artist_or_band", contratante_show: "show_booker", marca_empresa: "brand_or_company", agencia: "agency" },
  service_interest: { gestao_artistica: "artist_management", producao_musical: "music_production", mixagem: "mixing", masterizacao: "mastering", distribuicao_digital: "digital_distribution", marketing_musical: "music_marketing", producao_audiovisual: "audiovisual_production", design_grafico: "graphic_design", licenciamento: "licensing", consultoria: "consulting", outro: "other" },
  lead_status: { novo_lead: "new", qualificado: "qualified", em_contato: "in_contact", proposta_enviada: "proposal", fechado: "closed", perdido: "lost" },
  lead_segment: { musical: "music", eventos: "events", corporativo: "corporate" },
  marketing_context: { projeto_musical: "music_project", artista: "artist", empresa: "company" },
  marketing_sector: { Design: "design", Audiovisual: "audiovisual", Marketing: "marketing", "Comunicação": "communication" },
  marketing_task_type: { campanha: "campaign" },
  briefing_service_type: { campanha: "campaign", conteudo: "content" },
  event_type: { sessoes_estudio: "studio_sessions", ensaios: "rehearsals", sessoes_fotos: "photo_shoots", entrevistas: "interviews", programas_tv: "tv_shows", producao_conteudo: "content_production", reunioes: "meetings" },
};

/** Names the pre-OL1 API seed wrote when they differ from the current default name (kind -> canonical slug -> name). */
export const LEGACY_OPERATIONAL_NAMES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  lead_status: { new: "Novo lead", proposal: "Proposta enviada" },
};

/** Renamed list kinds: legacy -> canonical (mirror of the API LEGACY_OPERATIONAL_KINDS). */
export const LEGACY_OPERATIONAL_KINDS: Readonly<Record<string, OperationalListKind>> = {
  contact_pf_classification: "contact_individual_classification",
  contact_pj_classification: "contact_company_classification",
};

/** Canonical kind for a stored value (legacy kinds mapped, anything else unchanged). */
export function canonicalOperationalKind(kind: string): string {
  return Object.prototype.hasOwnProperty.call(LEGACY_OPERATIONAL_KINDS, kind) ? LEGACY_OPERATIONAL_KINDS[kind] : kind;
}

/** Canonical slug for a stored value: a legacy default slug is mapped, anything else is returned unchanged. */
export function canonicalOperationalSlug(kind: OperationalListKind | string, slug: string): string {
  const map = LEGACY_OPERATIONAL_SLUGS[kind];
  return map && Object.prototype.hasOwnProperty.call(map, slug) ? map[slug] : slug;
}

/** Legacy slugs a canonical slug replaced (reverse lookup). */
export function legacyOperationalSlugs(kind: OperationalListKind | string, canonicalSlug: string): string[] {
  const map = LEGACY_OPERATIONAL_SLUGS[kind] ?? {};
  return Object.keys(map).filter((legacy) => map[legacy] === canonicalSlug);
}

interface SlugNamed {
  kind: string;
  slug: string;
  name: string;
  metadata?: Record<string, unknown>;
}

/**
 * Legacy reader: a stored item that is EXACTLY a pre-OL1 platform default
 * (kind + legacy slug + legacy name) is returned with the canonical slug;
 * everything else (tenant-authored or edited items) is returned untouched.
 * `defaults` are the current canonical defaults, used to find the expected name.
 */
export function migrateLegacyDefaultItem<T extends SlugNamed>(stored: T, defaults: ReadonlyArray<SlugNamed>): T {
  const kind = canonicalOperationalKind(stored.kind);
  const item = kind === stored.kind ? stored : { ...stored, kind };
  const canonical = LEGACY_OPERATIONAL_SLUGS[item.kind]?.[item.slug];
  if (canonical === undefined) return item;
  const target = defaults.find((d) => d.kind === item.kind && d.slug === canonical);
  if (!target) return item;
  const expectedName = LEGACY_OPERATIONAL_NAMES[item.kind]?.[canonical] ?? target.name;
  return item.name === expectedName ? { ...item, slug: canonical } : item;
}

/** Maps legacy service slugs inside `metadata.allowed_service_slugs` (lead_type items) to the canonical ones. */
export function canonicalAllowedServiceSlugs(metadata: Record<string, unknown> | undefined): string[] | undefined {
  const raw = metadata?.["allowed_service_slugs"];
  if (!Array.isArray(raw)) return undefined;
  return raw.filter((v): v is string => typeof v === "string").map((slug) => canonicalOperationalSlug("service_interest", slug));
}
