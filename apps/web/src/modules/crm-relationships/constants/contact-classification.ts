// ============================================================================
// Hierarchical Contact classification (config-driven, single source).
// Contact type → Category → Contact profile.
//
// - Contact type: legal nature (individual/company) → `clients.person_type`
//   (Contact.personType).
// - Category: relationship → `clients.category` (Contact.category; slugs of the
//   ContactType enum, keeping the existing filters/"Segmento" column).
// - Contact profile: specific identity → `clients.profile` (Contact.profile;
//   English snake_case machine VALUES, PT-BR labels; mirrors the API vocabulary
//   apps/api/src/modules/clients/client-profile-vocabulary.ts. Rows saved before
//   PV1 may still hold the Portuguese slugs: LEGACY_CONTACT_PROFILES /
//   canonicalContactProfile() read them as canonical. Always shown through
//   profileLabel()).
//
// The whole relationship is centralized here — no scattered ifs/switches.
// ============================================================================

import type { PersonType } from "../types";

export interface ClassificationOption {
  value: string;
  label: string;
}

export const PERSON_TYPE_OPTIONS: ReadonlyArray<{ value: PersonType; label: string }> = [
  { value: "individual", label: "Pessoa Física" },
  { value: "company", label: "Pessoa Jurídica" },
];

/** PT-BR label shown for a person type outside the catalog (never the raw value). */
export const UNKNOWN_PERSON_TYPE_LABEL = "Tipo não identificado";

export function personTypeLabel(value: string): string {
  return PERSON_TYPE_OPTIONS.find((o) => o.value === value)?.label ?? UNKNOWN_PERSON_TYPE_LABEL;
}

// value = slug of the ContactType enum (keeps compatibility with the table/filters).
export const CONTACT_CATEGORY_OPTIONS: ClassificationOption[] = [
  { value: "CORPORATE_CLIENT", label: "Cliente" },
  { value: "PARTNER", label: "Parceiro" },
  { value: "SUPPLIER", label: "Fornecedor" },
  { value: "SERVICE_PROVIDER", label: "Prestador de Serviços" },
  { value: "INVESTOR", label: "Investidor" },
  { value: "COLLECTIVE_MANAGEMENT_ORGANIZATION", label: "Órgão" },
];

const opt = (value: string, label: string): ClassificationOption => ({ value, label });
const OTHER = opt("other", "Outros");

// Profiles per contact type + category.
// Category keys = CONTACT_CATEGORY_OPTIONS slugs.
export const CONTACT_PROFILES: Record<PersonType, Record<string, ClassificationOption[]>> = {
  individual: {
    CORPORATE_CLIENT: [
      opt("artist_or_band", "Artista/Banda"),
      opt("artist_manager", "Empresário Artístico"),
      opt("influencer", "Influenciador"),
      opt("show_booker", "Contratante de Show"),
      opt("partner", "Parceiros"),
      OTHER,
    ],
    PARTNER: [
      opt("artist_manager", "Empresário Artístico"),
      opt("business_partner", "Parceiro Comercial"),
      opt("influencer", "Influenciador"),
      OTHER,
    ],
    SUPPLIER: [OTHER],
    SERVICE_PROVIDER: [
      opt("lawyer", "Advogado"),
      opt("a_and_r", "A&R"),
      opt("beatmaker", "Beatmaker"),
      opt("composer", "Compositor"),
      opt("vocal_coach", "Coach Vocal"),
      opt("accountant", "Contador"),
      opt("music_curator", "Curador Musical"),
      opt("designer", "Designer"),
      opt("director", "Diretor"),
      opt("video_director", "Diretor de Vídeo"),
      opt("video_editor", "Editor de Vídeo"),
      opt("sound_engineer", "Engenheiro de Som"),
      opt("photographer", "Fotógrafo"),
      opt("journalist", "Jornalista"),
      opt("manager", "Manager"),
      opt("mastering_engineer", "Masterizador"),
      opt("mix_engineer", "Mix Engineer"),
      opt("motion_designer", "Motion Designer"),
      opt("camera_operator", "Operador de Câmera"),
      opt("executive_producer", "Produtor Executivo"),
      opt("music_producer", "Produtor Musical"),
      opt("developer", "Programador"),
      opt("psychologist", "Psicólogo"),
      OTHER,
    ],
    INVESTOR: [opt("investor", "Investidor"), opt("investment_fund", "Fundo de Investimento"), OTHER],
    COLLECTIVE_MANAGEMENT_ORGANIZATION: [OTHER],
  },
  company: {
    CORPORATE_CLIENT: [
      opt("company", "Empresa"),
      opt("brand", "Marca"),
      opt("show_booker", "Contratante de Show"),
      opt("event_producer", "Produtora de Eventos"),
      OTHER,
    ],
    PARTNER: [
      opt("agency", "Agência"),
      opt("booking_agency", "Agência de Booking"),
      opt("model_agency", "Agência de Modelos"),
      opt("advertising_agency", "Agência de Publicidade"),
      opt("digital_distributor", "Distribuidora Digital"),
      opt("company", "Empresa"),
      opt("record_label", "Gravadora/Selo"),
      opt("business_partner", "Parceiro Comercial"),
      opt("sponsor", "Patrocinador"),
      opt("digital_platform", "Plataforma Digital"),
      opt("audiovisual_production_company", "Produtora Audiovisual"),
      opt("event_producer", "Produtora de Eventos"),
      OTHER,
    ],
    SUPPLIER: [
      opt("bank", "Banco"),
      opt("notary_office", "Cartório"),
      opt("cloud_provider", "Cloud Provider"),
      opt("construction_company", "Construtora"),
      opt("ai_company", "Empresa de IA"),
      opt("internet_company", "Empresa de Internet"),
      opt("sound_company", "Empresa de Som"),
      opt("studio", "Estúdio"),
      opt("payment_gateway", "Gateway de Pagamento"),
      opt("hosting", "Hosting"),
      opt("auto_repair_shop", "Oficina Mecânica"),
      opt("rehearsal_room", "Sala de Ensaio"),
      OTHER,
    ],
    SERVICE_PROVIDER: [
      opt("audiovisual_production_company", "Produtora Audiovisual"),
      opt("studio", "Estúdio"),
      opt("agency", "Agência"),
      OTHER,
    ],
    INVESTOR: [opt("investment_fund", "Fundo de Investimento"), opt("investor", "Investidor"), OTHER],
    COLLECTIVE_MANAGEMENT_ORGANIZATION: [
      opt("abramus", "ABRAMUS"),
      opt("ecad", "ECAD"),
      opt("inpi", "INPI"),
      opt("city_hall", "Prefeitura"),
      OTHER,
    ],
  },
};

/** Deprecated Portuguese profile slug -> canonical value (mirrors the API map and migration 20260930000012). */
export const LEGACY_CONTACT_PROFILES: Readonly<Record<string, string>> = {
  a_e_r: "a_and_r",
  advogado: "lawyer",
  agencia: "agency",
  agencia_de_booking: "booking_agency",
  agencia_de_modelos: "model_agency",
  agencia_de_publicidade: "advertising_agency",
  artista_banda: "artist_or_band",
  banco: "bank",
  cartorio: "notary_office",
  coach_vocal: "vocal_coach",
  compositor: "composer",
  construtora: "construction_company",
  contador: "accountant",
  contratante_show: "show_booker",
  curador_musical: "music_curator",
  diretor: "director",
  diretor_de_video: "video_director",
  distribuidora_digital: "digital_distributor",
  editor_de_video: "video_editor",
  empresa: "company",
  empresa_de_ia: "ai_company",
  empresa_de_internet: "internet_company",
  empresa_de_som: "sound_company",
  empresario_artistico: "artist_manager",
  engenheiro_de_som: "sound_engineer",
  estudio: "studio",
  fotografo: "photographer",
  fundo_de_investimento: "investment_fund",
  gateway_de_pagamento: "payment_gateway",
  gravadora_selo: "record_label",
  influenciador: "influencer",
  investidor: "investor",
  jornalista: "journalist",
  marca: "brand",
  masterizador: "mastering_engineer",
  oficina_mecanica: "auto_repair_shop",
  operador_de_camera: "camera_operator",
  outros: "other",
  parceiro_comercial: "business_partner",
  parceiros: "partner",
  patrocinador: "sponsor",
  plataforma_digital: "digital_platform",
  prefeitura: "city_hall",
  produtor_executivo: "executive_producer",
  produtor_musical: "music_producer",
  produtora_audiovisual: "audiovisual_production_company",
  produtora_de_eventos: "event_producer",
  programador: "developer",
  psicologo: "psychologist",
  sala_de_ensaio: "rehearsal_room",
};

/** Default profile of a contact created without one (was "outros"). */
export const DEFAULT_CONTACT_PROFILE = "other";

/** Canonical profile of a stored/raw value: canonical wins, deprecated slugs are mapped, unknown values are kept (never guessed). */
export function canonicalContactProfile(value: string): string {
  const key = value.trim().toLowerCase();
  if (CANONICAL_CONTACT_PROFILES.has(key)) return key;
  return Object.prototype.hasOwnProperty.call(LEGACY_CONTACT_PROFILES, key) ? LEGACY_CONTACT_PROFILES[key] : value;
}

const CANONICAL_CONTACT_PROFILES: ReadonlySet<string> = new Set(
  Object.values(CONTACT_PROFILES).flatMap((byCategory) => Object.values(byCategory).flatMap((options) => options.map((o) => o.value))),
);

/** Valid profiles for a Type + Category combination. */
export function getProfiles(type: PersonType, categorySlug: string): ClassificationOption[] {
  return CONTACT_PROFILES[type]?.[categorySlug] ?? [];
}

/** PT-BR label shown for a saved profile slug that no longer exists in the catalog. */
export const UNKNOWN_PROFILE_LABEL = "Perfil não cadastrado";

/**
 * PT-BR label for a profile slug. Looks in the current Type + Category list
 * first, then in the whole catalog (a legacy profile saved under another
 * category keeps its real label); never returns the raw slug.
 */
export function profileLabel(rawSlug: string, type?: PersonType, categorySlug?: string): string {
  if (!rawSlug) return "";
  const slug = canonicalContactProfile(rawSlug);
  if (type && categorySlug) {
    const scoped = getProfiles(type, categorySlug).find((o) => o.value === slug);
    if (scoped) return scoped.label;
  }
  for (const byCategory of Object.values(CONTACT_PROFILES)) {
    for (const options of Object.values(byCategory)) {
      const found = options.find((o) => o.value === slug);
      if (found) return found.label;
    }
  }
  return UNKNOWN_PROFILE_LABEL;
}

/**
 * Ensures a saved (possibly legacy) profile appears in the options list
 * so the data is not lost on edit. Its label comes from profileLabel().
 */
export function ensureProfileOption(
  list: ClassificationOption[],
  rawValue: string,
): ClassificationOption[] {
  const value = rawValue ? canonicalContactProfile(rawValue) : rawValue;
  if (!value || list.some((o) => o.value === value)) return list;
  return [...list, opt(value, profileLabel(value))];
}
