// ============================================================================
// Hierarchical Contact classification (config-driven, single source).
// Contact type → Category → Contact profile.
//
// - Contact type: legal nature (individual/legal entity) → persists in tipo_pessoa.
// - Category: relationship → persists in Contact.contactType (slugs of the
//   ContactType enum, keeping the existing filters/"Segmento" column).
// - Contact profile: specific identity → persists in payloadOperacional.perfil.
//
// The whole relationship is centralized here — no scattered ifs/switches.
// ============================================================================

export type ContactPersonType = "pessoa_fisica" | "pessoa_juridica";

export interface ClassificationOption {
  value: string;
  label: string;
}

export const CONTACT_TYPE_OPTIONS: ClassificationOption[] = [
  { value: "pessoa_fisica", label: "Pessoa Física" },
  { value: "pessoa_juridica", label: "Pessoa Jurídica" },
];

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
const OUTROS = opt("outros", "Outros");

// Profiles per contact type + category.
// Category keys = CONTACT_CATEGORY_OPTIONS slugs.
export const CONTACT_PROFILES: Record<ContactPersonType, Record<string, ClassificationOption[]>> = {
  pessoa_fisica: {
    CORPORATE_CLIENT: [
      opt("artista_banda", "Artista/Banda"),
      opt("empresario_artistico", "Empresário Artístico"),
      opt("influenciador", "Influenciador"),
      opt("contratante_show", "Contratante de Show"),
      opt("parceiros", "Parceiros"),
      OUTROS,
    ],
    PARTNER: [
      opt("empresario_artistico", "Empresário Artístico"),
      opt("parceiro_comercial", "Parceiro Comercial"),
      opt("influenciador", "Influenciador"),
      OUTROS,
    ],
    SUPPLIER: [OUTROS],
    SERVICE_PROVIDER: [
      opt("advogado", "Advogado"),
      opt("a_e_r", "A&R"),
      opt("beatmaker", "Beatmaker"),
      opt("compositor", "Compositor"),
      opt("coach_vocal", "Coach Vocal"),
      opt("contador", "Contador"),
      opt("curador_musical", "Curador Musical"),
      opt("designer", "Designer"),
      opt("diretor", "Diretor"),
      opt("diretor_de_video", "Diretor de Vídeo"),
      opt("editor_de_video", "Editor de Vídeo"),
      opt("engenheiro_de_som", "Engenheiro de Som"),
      opt("fotografo", "Fotógrafo"),
      opt("jornalista", "Jornalista"),
      opt("manager", "Manager"),
      opt("masterizador", "Masterizador"),
      opt("mix_engineer", "Mix Engineer"),
      opt("motion_designer", "Motion Designer"),
      opt("operador_de_camera", "Operador de Câmera"),
      opt("produtor_executivo", "Produtor Executivo"),
      opt("produtor_musical", "Produtor Musical"),
      opt("programador", "Programador"),
      opt("psicologo", "Psicólogo"),
      OUTROS,
    ],
    INVESTOR: [opt("investidor", "Investidor"), opt("fundo_de_investimento", "Fundo de Investimento"), OUTROS],
    COLLECTIVE_MANAGEMENT_ORGANIZATION: [OUTROS],
  },
  pessoa_juridica: {
    CORPORATE_CLIENT: [
      opt("empresa", "Empresa"),
      opt("marca", "Marca"),
      opt("contratante_show", "Contratante de Show"),
      opt("produtora_de_eventos", "Produtora de Eventos"),
      OUTROS,
    ],
    PARTNER: [
      opt("agencia", "Agência"),
      opt("agencia_de_booking", "Agência de Booking"),
      opt("agencia_de_modelos", "Agência de Modelos"),
      opt("agencia_de_publicidade", "Agência de Publicidade"),
      opt("distribuidora_digital", "Distribuidora Digital"),
      opt("empresa", "Empresa"),
      opt("gravadora_selo", "Gravadora/Selo"),
      opt("parceiro_comercial", "Parceiro Comercial"),
      opt("patrocinador", "Patrocinador"),
      opt("plataforma_digital", "Plataforma Digital"),
      opt("produtora_audiovisual", "Produtora Audiovisual"),
      opt("produtora_de_eventos", "Produtora de Eventos"),
      OUTROS,
    ],
    SUPPLIER: [
      opt("banco", "Banco"),
      opt("cartorio", "Cartório"),
      opt("cloud_provider", "Cloud Provider"),
      opt("construtora", "Construtora"),
      opt("empresa_de_ia", "Empresa de IA"),
      opt("empresa_de_internet", "Empresa de Internet"),
      opt("empresa_de_som", "Empresa de Som"),
      opt("estudio", "Estúdio"),
      opt("gateway_de_pagamento", "Gateway de Pagamento"),
      opt("hosting", "Hosting"),
      opt("oficina_mecanica", "Oficina Mecânica"),
      opt("sala_de_ensaio", "Sala de Ensaio"),
      OUTROS,
    ],
    SERVICE_PROVIDER: [
      opt("produtora_audiovisual", "Produtora Audiovisual"),
      opt("estudio", "Estúdio"),
      opt("agencia", "Agência"),
      OUTROS,
    ],
    INVESTOR: [opt("fundo_de_investimento", "Fundo de Investimento"), opt("investidor", "Investidor"), OUTROS],
    COLLECTIVE_MANAGEMENT_ORGANIZATION: [
      opt("abramus", "ABRAMUS"),
      opt("ecad", "ECAD"),
      opt("inpi", "INPI"),
      opt("prefeitura", "Prefeitura"),
      OUTROS,
    ],
  },
};

/** Valid profiles for a Type + Category combination. */
export function getPerfis(type: ContactPersonType, categorySlug: string): ClassificationOption[] {
  return CONTACT_PROFILES[type]?.[categorySlug] ?? [];
}

/**
 * Ensures a saved (possibly legacy) profile appears in the options list
 * so the data is not lost on edit.
 */
export function ensurePerfilOption(
  list: ClassificationOption[],
  value: string,
): ClassificationOption[] {
  if (!value || list.some((o) => o.value === value)) return list;
  return [...list, opt(value, value)];
}
