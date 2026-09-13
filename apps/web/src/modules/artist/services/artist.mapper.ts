/**
 * artist.mapper.ts
 * ─────────────────────────────────────────────────────────────────
 * ÚNICA FONTE DE VERDADE para toda transformação de dados de artista.
 *
 * Duas fronteiras distintas de tradução vivem aqui:
 *   1. Fio da API (PT, DTO do backend — inalterado) ↔ modelo interno
 *      `Artist` (campos em inglês). Ver `wireToArtist`/`artistToWirePayload`,
 *      usadas exclusivamente no ponto onde os dados entram/saem da API
 *      (hooks `useArtist*`/`artist.service.ts`).
 *   2. Modelo interno `Artist` ↔ estado do formulário (react-hook-form).
 *      Exportação, importação e formulário devem consumir estas funções
 *      para garantir consistência total entre CREATE, EDIT, VIEW e LIST.
 * ─────────────────────────────────────────────────────────────────
 */

import type {
  Artist,
  ArtistInsert,
  ArtistRelationship,
  ArtistResponsible,
  ArtistLinkedContact,
  ArtistTeamContact,
  DistributorEntry,
} from "@/modules/artist/types/artist.types";

// ─── Utilidades internas ──────────────────────────────────────────

function str(v: unknown): string {
  if (v == null) return "";
  const s = String(v).trim();
  return s;
}

function strOrNull(v: unknown): string | null {
  const s = str(v);
  return s !== "" ? s : null;
}

function numOrNull(v: unknown): number | null {
  if (v == null || String(v).trim() === "") return null;
  const n = Number(String(v).trim());
  return isNaN(n) ? null : n;
}

/**
 * Remove diacritics e coloca em lowercase para matching
 * case-insensitive e tolerante a acentuação variada.
 */
function normalizeKey(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Retorna o valor da linha Excel para o primeiro cabeçalho que corresponda,
 * comparando após normalização de Unicode/case.
 * Isso resolve casos em que Excel salva "Tipo de Perfil" com NFD diferente.
 */
export function pickRow(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    // Tentativa exata primeiro (mais rápida)
    if (key in row) return row[key];
    // Fallback: normalizado
    const normKey = normalizeKey(key);
    for (const rowKey of Object.keys(row)) {
      if (normalizeKey(rowKey) === normKey) return row[rowKey];
    }
  }
  return undefined;
}

/**
 * Normaliza o valor de "Tipo de Perfil" para o enum interno,
 * aceitando qualquer variação razoável de caixa, espaços ou acentos.
 */
export function normalizeProfileType(
  raw: unknown,
): "independente" | "com_empresario" | "gravadora" | "editora" {
  const v = normalizeKey(str(raw));
  if (!v || v === "independente") return "independente";
  if (v === "gravadora") return "gravadora";
  if (v === "editora") return "editora";
  if (
    v === "com_empresario" ||
    v.startsWith("com_") ||
    v.startsWith("com ") ||
    v.includes("empresario") ||
    v.includes("empresarial")
  )
    return "com_empresario";
  return "independente";
}

// ─── Especialidades (Função) ─────────────────────────────────────

/**
 * Mapeamento canônico enum → label legível.
 * Fonte única de verdade para formulário, Visão360, export e import.
 */
export const SPECIALTY_LABELS: Record<string, string> = {
  dj:               "DJ",
  dj_produtor:      "DJ/Produtor",
  compositor_autor: "Compositor/Autor",
  interprete:       "Intérprete",
  produtor:         "Produtor",
};

/** Mapeamento inverso: label normalizado → enum interno. */
const SPECIALTY_ENUM: Record<string, string> = Object.fromEntries(
  Object.entries(SPECIALTY_LABELS).map(([k, v]) => [normalizeKey(v), k]),
);

/**
 * Converte qualquer variação de label ou enum para o valor interno.
 * Retorna "" para valores não reconhecidos (serão filtrados no import).
 */
export function normalizeSpecialty(raw: string): string {
  const v1 = normalizeKey(raw);
  if (SPECIALTY_ENUM[v1]) return SPECIALTY_ENUM[v1];

  const v2 = normalizeKey(raw.replace(/_/g, "/"));
  if (SPECIALTY_ENUM[v2]) return SPECIALTY_ENUM[v2];

  const asEnum = v1.replace(/\//g, "_");
  if (SPECIALTY_LABELS[asEnum]) return asEnum;

  return "";
}

// ─── Slug artístico ───────────────────────────────────────────────

/**
 * Gera um slug a partir do nome artístico:
 * remove acentos, converte para lowercase, substitui espaços por hífens.
 */
export function generateArtisticSlug(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

// ─── Validadores de URL de plataformas ───────────────────────────
// O domínio trabalha exclusivamente com URLs — não existe extração nem
// reconstrução de ID de plataforma em nenhuma camada. Os regexes abaixo
// espelham exatamente os `@Matches` de CreateArtistDto/UpdateArtistDto no
// backend (fonte de verdade da validação); aqui servem só de feedback
// visual imediato no formulário.

export type UrlValidationState = "idle" | "valid" | "invalid";

const SPOTIFY_ARTIST_URL_RE = /^https:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?artist\/[A-Za-z0-9]{22}(?:[/?#].*)?$/i;

export function validateSpotifyUrl(url: string): UrlValidationState {
  if (!url.trim()) return "idle";
  return SPOTIFY_ARTIST_URL_RE.test(url.trim()) ? "valid" : "invalid";
}

export type YoutubeRef = { kind: "id" | "handle" | "username" | "custom"; value: string };

/**
 * find-eb3c5c45-class (naming-canonical.md "one business rule, one
 * authoritative implementation"): single canonical YouTube channel
 * reference parser for the frontend, mirroring
 * apps/api/.../platform-profiles/youtube-ref.util.ts's `parseYoutubeRef`
 * (bare `UC…` id, `@handle`, and URLs `/channel/UC…`, `/@handle`,
 * `/user/NAME`, `/c/NAME`, bare `/NAME`). This used to be two separate,
 * narrower hand-rolled regexes here — one on the form validator, one on
 * the "Sincronizar agora" button — that disagreed on which inputs were
 * valid. TypeScript can't import the backend module into the web bundle,
 * so this is a deliberate parallel implementation of the same shape; both
 * `validateYoutubeUrl` and `normalizeYoutubeProfileUrl` (used by
 * ArtistPlatformMetrics's sync button) now route through this one
 * function instead of duplicating the regex set.
 */
export function parseYoutubeRef(raw: string): YoutubeRef | null {
  const value = (raw ?? "").trim();
  if (!value) return null;

  if (/^UC[A-Za-z0-9_-]{20,}$/.test(value)) return { kind: "id", value };
  if (/^@[A-Za-z0-9._-]+$/.test(value)) return { kind: "handle", value: value.slice(1) };

  let path = value;
  try {
    if (/^https?:\/\//i.test(value)) path = new URL(value).pathname;
  } catch { /* treat as raw path */ }
  path = path.replace(/^\/+|\/+$/g, "");

  const channel = path.match(/^channel\/(UC[A-Za-z0-9_-]{20,})/);
  if (channel) return { kind: "id", value: channel[1]! };
  const handle = path.match(/^@([A-Za-z0-9._-]+)/);
  if (handle) return { kind: "handle", value: handle[1]! };
  const user = path.match(/^user\/([A-Za-z0-9._-]+)/i);
  if (user) return { kind: "username", value: user[1]! };
  const custom = path.match(/^c\/([A-Za-z0-9._-]+)/i);
  if (custom) return { kind: "custom", value: custom[1]! };
  const bare = path.match(/^([A-Za-z0-9._-]+)$/);
  if (bare) return { kind: "custom", value: bare[1]! };
  return null;
}

export function validateYoutubeUrl(url: string): UrlValidationState {
  if (!url.trim()) return "idle";
  return parseYoutubeRef(url) ? "valid" : "invalid";
}

/**
 * Normalizes any accepted YouTube channel reference (bare id/handle or
 * full URL, http or https) to the value sent as `profileUrl` for sync —
 * the backend's own `parseYoutubeRef` accepts the same shapes, so no URL
 * reconstruction is needed, just pass-through of a value proven parseable.
 */
export function normalizeYoutubeProfileUrl(input: string | null | undefined): string | null {
  const value = (input ?? "").trim();
  if (!value) return null;
  return parseYoutubeRef(value) ? value : null;
}

/**
 * Validates that `url` is a real URL whose host is (a subdomain of) `host`.
 * Parses the URL instead of matching an unanchored substring regex, so a value
 * like `https://evil.com/?x=instagram.com/` is correctly rejected (CWE-20).
 */
function hasHost(url: string, host: string): boolean {
  const trimmed = url.trim();
  // Tolerate scheme-less input (users paste "instagram.com/x") without weakening
  // the check: the value is still parsed as a URL and the HOST is compared.
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const h = new URL(candidate).hostname.toLowerCase();
    return h === host || h.endsWith(`.${host}`);
  } catch {
    return false;
  }
}

export function validateInstagramUrl(url: string): UrlValidationState {
  if (!url.trim()) return "idle";
  return hasHost(url, "instagram.com") ? "valid" : "invalid";
}

export function validateTiktokUrl(url: string): UrlValidationState {
  if (!url.trim()) return "idle";
  return hasHost(url, "tiktok.com") ? "valid" : "invalid";
}

export function validateSoundcloudUrl(url: string): UrlValidationState {
  if (!url.trim()) return "idle";
  return hasHost(url, "soundcloud.com") ? "valid" : "invalid";
}

export function validateDeezerUrl(url: string): UrlValidationState {
  if (!url.trim()) return "idle";
  return hasHost(url, "deezer.com") ? "valid" : "invalid";
}

export function validateAppleMusicUrl(url: string): UrlValidationState {
  if (!url.trim()) return "idle";
  return hasHost(url, "music.apple.com") ? "valid" : "invalid";
}

// ════════════════════════════════════════════════════════════════
// ─── Fronteira 1: fio da API (PT, DTO do backend) ↔ Artist (EN) ──
// ════════════════════════════════════════════════════════════════
// O backend (CreateArtistDto/UpdateArtistDto/entities.ts) NÃO muda nesta
// tarefa — continua em português (`nome_artistico`, `genero_musical` etc).
// Estas funções são o ÚNICO lugar que conhece os dois nomes de cada campo.

type WireDistributorEntry = { id: string; email: string; nomeCustom?: string };
type WireResponsavel = { nome: string; telefone: string; email: string };
type WireRelacionamento = {
  type: ArtistRelationship["type"];
  nome: string;
  telefone: string;
  email: string;
  escritorio?: string;
  crc?: string;
  responsaveis?: WireResponsavel[];
  distribuidoras?: WireDistributorEntry[];
};
type WireContatoVinculado = { contactId: string; distribuidoras?: WireDistributorEntry[] };
type WireContatoEquipe = {
  nome: string;
  categoria: string;
  telefone: string;
  email: string;
  distribuidoras: WireDistributorEntry[];
};

/** Shape do JSON realmente trafegado pela API (contrato do backend — inalterado). */
export type ArtistWireRecord = Record<string, unknown> & {
  id: string;
  user_id?: string;
  nome_artistico?: string;
  nome_civil?: string | null;
  nome?: string | null;
  status?: string | null;
  status_cadastro?: string | null;
  genero_musical?: string | null;
  email?: string | null;
  telefone?: string | null;
  cpf_cnpj?: string | null;
  foto_url?: string | null;
  observacoes?: string | null;
  contrato_id?: string | null;
  slug_artistico?: string | null;
  tags_musicais?: string[] | null;
  fase_carreira?: string | null;
  relacionamentos?: WireRelacionamento[] | null;
  spotify_url?: string | null;
  spotify_ouvintes?: number | null;
  youtube_url?: string | null;
  youtube_inscritos?: number | null;
  deezer_url?: string | null;
  deezer_fas?: number | null;
  apple_music_url?: string | null;
  apple_music_albuns_url?: number | null;
  soundcloud_url?: string | null;
  soundcloud_seguidores_url?: number | null;
  instagram_url?: string | null;
  instagram_seguidores?: number | null;
  facebook?: string | null;
  tiktok_url?: string | null;
  tiktok_seguidores?: number | null;
  twitter?: string | null;
  website?: string | null;
  tipo_pessoa?: string | null;
  data_nascimento?: string | null;
  rg?: string | null;
  endereco?: string | null;
  banco?: string | null;
  agencia?: string | null;
  conta?: string | null;
  chave_pix?: string | null;
  titular_conta?: string | null;
  especialidades?: string[] | null;
  tipo_perfil?: string | null;
  empresario_id?: string | null;
  empresario_nome?: string | null;
  empresario_telefone?: string | null;
  empresario_email?: string | null;
  gravadora_id?: string | null;
  gravadora_nome?: string | null;
  gravadora_telefone?: string | null;
  gravadora_email?: string | null;
  gravadora_responsavel_id?: string | null;
  gravadora_responsavel_nome?: string | null;
  gravadora_responsavel_telefone?: string | null;
  gravadora_responsavel_email?: string | null;
  distribuidoras_selecionadas?: Record<string, boolean> | null;
  distribuidoras_emails?: Record<string, string> | null;
  distribuidoras_empresa_selecionadas?: Record<string, boolean> | null;
  distribuidoras_empresa_emails?: Record<string, string> | null;
  documentos_pessoais_url?: string | null;
  presskit_url?: string | null;
  notas_internas?: string | null;
  galeria_urls?: string[] | null;
  manager_nome?: string | null;
  manager_contato?: string | null;
  produtor_executivo?: string | null;
  agencia_booking?: string | null;
  label_parceira?: string | null;
  documents?: { nome: string; url: string }[] | null;
  distribuidoras_gerais?: WireDistributorEntry[] | null;
  contatos_vinculados?: WireContatoVinculado[] | null;
  contatos_equipe?: WireContatoEquipe[] | null;
  created_at?: string;
  updated_at?: string;
};

function distributorFromWire(d: WireDistributorEntry): DistributorEntry {
  return { id: d.id, email: d.email, ...(d.nomeCustom !== undefined ? { customName: d.nomeCustom } : {}) };
}
function distributorToWire(d: DistributorEntry): WireDistributorEntry {
  return { id: d.id, email: d.email, ...(d.customName !== undefined ? { nomeCustom: d.customName } : {}) };
}

function responsibleFromWire(r: WireResponsavel): ArtistResponsible {
  return { name: r.nome ?? "", phone: r.telefone ?? "", email: r.email ?? "" };
}
function responsibleToWire(r: ArtistResponsible): WireResponsavel {
  return { nome: r.name ?? "", telefone: r.phone ?? "", email: r.email ?? "" };
}

function relationshipFromWire(r: WireRelacionamento): ArtistRelationship {
  return {
    type: r.type,
    name: r.nome ?? "",
    phone: r.telefone ?? "",
    email: r.email ?? "",
    ...(r.escritorio !== undefined ? { office: r.escritorio } : {}),
    ...(r.crc !== undefined ? { crc: r.crc } : {}),
    ...(r.responsaveis ? { responsibles: r.responsaveis.map(responsibleFromWire) } : {}),
    ...(r.distribuidoras ? { distributors: r.distribuidoras.map(distributorFromWire) } : {}),
  };
}
function relationshipToWire(r: ArtistRelationship): WireRelacionamento {
  return {
    type: r.type,
    nome: r.name ?? "",
    telefone: r.phone ?? "",
    email: r.email ?? "",
    ...(r.office !== undefined ? { escritorio: r.office } : {}),
    ...(r.crc !== undefined ? { crc: r.crc } : {}),
    ...(r.responsibles ? { responsaveis: r.responsibles.map(responsibleToWire) } : {}),
    ...(r.distributors ? { distribuidoras: r.distributors.map(distributorToWire) } : {}),
  };
}

function linkedContactFromWire(c: WireContatoVinculado): ArtistLinkedContact {
  return {
    contactId: c.contactId,
    ...(c.distribuidoras ? { distributors: c.distribuidoras.map(distributorFromWire) } : {}),
  };
}
function linkedContactToWire(c: ArtistLinkedContact): WireContatoVinculado {
  return {
    contactId: c.contactId,
    ...(c.distributors ? { distribuidoras: c.distributors.map(distributorToWire) } : {}),
  };
}

function teamContactFromWire(c: WireContatoEquipe): ArtistTeamContact {
  return {
    name: c.nome ?? "",
    category: c.categoria ?? "",
    phone: c.telefone ?? "",
    email: c.email ?? "",
    distributors: Array.isArray(c.distribuidoras) ? c.distribuidoras.map(distributorFromWire) : [],
  };
}
function teamContactToWire(c: ArtistTeamContact): WireContatoEquipe {
  return {
    nome: c.name ?? "",
    categoria: c.category ?? "",
    telefone: c.phone ?? "",
    email: c.email ?? "",
    distribuidoras: Array.isArray(c.distributors) ? c.distributors.map(distributorToWire) : [],
  };
}

/** Converte um registro vindo da API (PT, contrato do backend) no modelo interno `Artist` (EN). */
export function wireToArtist(w: ArtistWireRecord): Artist {
  return {
    // Pass-through defensivo de qualquer campo do fio não mapeado abaixo
    // (ex.: `genero` — campo dinâmico não tipado no DTO/entidade).
    ...w,
    id: w.id,
    user_id: w.user_id,
    stageName: w.nome_artistico ?? "",
    legalName: w.nome_civil,
    name: w.nome,
    status: w.status,
    registrationStatus: w.status_cadastro,
    musicGenre: w.genero_musical,
    email: w.email,
    phone: w.telefone,
    taxId: w.cpf_cnpj,
    photoUrl: w.foto_url,
    notes: w.observacoes,
    contractId: w.contrato_id,
    artisticSlug: w.slug_artistico,
    musicTags: w.tags_musicais,
    careerStage: w.fase_carreira,
    relationships: w.relacionamentos ? w.relacionamentos.map(relationshipFromWire) : w.relacionamentos as null | undefined,
    spotifyUrl: w.spotify_url,
    spotifyListeners: w.spotify_ouvintes,
    youtubeUrl: w.youtube_url,
    youtubeSubscribers: w.youtube_inscritos,
    deezerUrl: w.deezer_url,
    deezerFans: w.deezer_fas,
    appleMusicUrl: w.apple_music_url,
    appleMusicAlbumsUrl: w.apple_music_albuns_url,
    soundcloudUrl: w.soundcloud_url,
    soundcloudFollowersUrl: w.soundcloud_seguidores_url,
    instagramUrl: w.instagram_url,
    instagramFollowers: w.instagram_seguidores,
    facebook: w.facebook,
    tiktokUrl: w.tiktok_url,
    tiktokFollowers: w.tiktok_seguidores,
    twitter: w.twitter,
    website: w.website,
    personType: w.tipo_pessoa,
    birthDate: w.data_nascimento,
    idDocument: w.rg,
    address: w.endereco,
    bank: w.banco,
    bankBranch: w.agencia,
    bankAccount: w.conta,
    pixKey: w.chave_pix,
    accountHolder: w.titular_conta,
    specialties: w.especialidades,
    profileType: w.tipo_perfil,
    managerId: w.empresario_id,
    managerName: w.empresario_nome,
    managerPhone: w.empresario_telefone,
    managerEmail: w.empresario_email,
    labelId: w.gravadora_id,
    labelName: w.gravadora_nome,
    labelPhone: w.gravadora_telefone,
    labelEmail: w.gravadora_email,
    labelResponsibleId: w.gravadora_responsavel_id,
    labelResponsibleName: w.gravadora_responsavel_nome,
    labelResponsiblePhone: w.gravadora_responsavel_telefone,
    labelResponsibleEmail: w.gravadora_responsavel_email,
    selectedDistributors: w.distribuidoras_selecionadas,
    distributorEmails: w.distribuidoras_emails,
    selectedCompanyDistributors: w.distribuidoras_empresa_selecionadas,
    companyDistributorEmails: w.distribuidoras_empresa_emails,
    personalDocumentsUrl: w.documentos_pessoais_url,
    pressKitUrl: w.presskit_url,
    internalNotes: w.notas_internas,
    galleryUrls: w.galeria_urls,
    managerNameLegacy: w.manager_nome,
    managerContactLegacy: w.manager_contato,
    executiveProducer: w.produtor_executivo,
    bookingAgency: w.agencia_booking,
    partnerLabel: w.label_parceira,
    documents: w.documents,
    generalDistributors: w.distribuidoras_gerais ? w.distribuidoras_gerais.map(distributorFromWire) : w.distribuidoras_gerais as null | undefined,
    linkedContacts: w.contatos_vinculados ? w.contatos_vinculados.map(linkedContactFromWire) : w.contatos_vinculados as null | undefined,
    teamContacts: w.contatos_equipe ? w.contatos_equipe.map(teamContactFromWire) : w.contatos_equipe as null | undefined,
    created_at: w.created_at,
    updated_at: w.updated_at,
  } as Artist;
}

/**
 * Converte um payload do modelo interno `Artist` (EN, parcial — create ou
 * update) para o formato aceito pela API (PT, contrato do backend).
 * Usada no ponto de saída (hooks `useArtist*`), nunca em componentes.
 */
export function artistToWirePayload(a: Partial<Artist>): Record<string, unknown> {
  const w: Record<string, unknown> = { ...a };

  const setIf = (key: keyof Artist, wireKey: string, transform?: (v: unknown) => unknown) => {
    if (key in a) {
      const v = (a as Record<string, unknown>)[key as string];
      w[wireKey] = transform ? transform(v) : v;
      if (wireKey !== (key as string)) delete w[key as string];
    }
  };

  setIf("stageName", "nome_artistico");
  setIf("legalName", "nome_civil");
  setIf("registrationStatus", "status_cadastro");
  setIf("musicGenre", "genero_musical");
  setIf("phone", "telefone");
  setIf("taxId", "cpf_cnpj");
  setIf("photoUrl", "foto_url");
  setIf("notes", "observacoes");
  setIf("contractId", "contrato_id");
  setIf("artisticSlug", "slug_artistico");
  setIf("musicTags", "tags_musicais");
  setIf("careerStage", "fase_carreira");
  setIf("relationships", "relacionamentos", (v) => (Array.isArray(v) ? (v as ArtistRelationship[]).map(relationshipToWire) : v));
  setIf("spotifyUrl", "spotify_url");
  setIf("spotifyListeners", "spotify_ouvintes");
  setIf("youtubeUrl", "youtube_url");
  setIf("youtubeSubscribers", "youtube_inscritos");
  setIf("deezerUrl", "deezer_url");
  setIf("deezerFans", "deezer_fas");
  setIf("appleMusicUrl", "apple_music_url");
  setIf("appleMusicAlbumsUrl", "apple_music_albuns_url");
  setIf("soundcloudUrl", "soundcloud_url");
  setIf("soundcloudFollowersUrl", "soundcloud_seguidores_url");
  setIf("instagramUrl", "instagram_url");
  setIf("instagramFollowers", "instagram_seguidores");
  setIf("tiktokUrl", "tiktok_url");
  setIf("tiktokFollowers", "tiktok_seguidores");
  setIf("personType", "tipo_pessoa");
  setIf("birthDate", "data_nascimento");
  setIf("idDocument", "rg");
  setIf("address", "endereco");
  setIf("bank", "banco");
  setIf("bankBranch", "agencia");
  setIf("bankAccount", "conta");
  setIf("pixKey", "chave_pix");
  setIf("accountHolder", "titular_conta");
  setIf("specialties", "especialidades");
  setIf("profileType", "tipo_perfil");
  setIf("managerId", "empresario_id");
  setIf("managerName", "empresario_nome");
  setIf("managerPhone", "empresario_telefone");
  setIf("managerEmail", "empresario_email");
  setIf("labelId", "gravadora_id");
  setIf("labelName", "gravadora_nome");
  setIf("labelPhone", "gravadora_telefone");
  setIf("labelEmail", "gravadora_email");
  setIf("labelResponsibleId", "gravadora_responsavel_id");
  setIf("labelResponsibleName", "gravadora_responsavel_nome");
  setIf("labelResponsiblePhone", "gravadora_responsavel_telefone");
  setIf("labelResponsibleEmail", "gravadora_responsavel_email");
  setIf("selectedDistributors", "distribuidoras_selecionadas");
  setIf("distributorEmails", "distribuidoras_emails");
  setIf("selectedCompanyDistributors", "distribuidoras_empresa_selecionadas");
  setIf("companyDistributorEmails", "distribuidoras_empresa_emails");
  setIf("personalDocumentsUrl", "documentos_pessoais_url");
  setIf("pressKitUrl", "presskit_url");
  setIf("internalNotes", "notas_internas");
  setIf("galleryUrls", "galeria_urls");
  setIf("managerNameLegacy", "manager_nome");
  setIf("managerContactLegacy", "manager_contato");
  setIf("executiveProducer", "produtor_executivo");
  setIf("bookingAgency", "agencia_booking");
  setIf("partnerLabel", "label_parceira");
  setIf("generalDistributors", "distribuidoras_gerais", (v) => (Array.isArray(v) ? (v as DistributorEntry[]).map(distributorToWire) : v));
  setIf("linkedContacts", "contatos_vinculados", (v) => (Array.isArray(v) ? (v as ArtistLinkedContact[]).map(linkedContactToWire) : v));
  setIf("teamContacts", "contatos_equipe", (v) => (Array.isArray(v) ? (v as ArtistTeamContact[]).map(teamContactToWire) : v));

  return w;
}

// ════════════════════════════════════════════════════════════════
// ─── Fronteira 2: Artist (EN) ↔ estado do formulário ─────────────
// ════════════════════════════════════════════════════════════════

export interface ArtistFormResponsible {
  nome: string;
  telefone: string;
  email: string;
}

export interface ArtistFormRelationship {
  type: "empresario" | "gravadora" | "editora" | "booker" | "juridico" | "financeiro" | "contador" | "assessoria";
  nome: string;
  telefone: string;
  email: string;
  escritorio: string;
  crc: string;
  responsaveis: ArtistFormResponsible[];
  distribuidoras: DistributorEntry[];
}

export interface ArtistFormFieldValues {
  nomeArtistico: string;
  slugArtistico: string;
  tagsMusicais: string[];
  faseCarreira: string;
  generoMusical: string;
  statusArtista: string;
  especialidades: string[];
  biografia: string;
  notasInternas: string;
  nome: string;
  dataNascimento: string;
  cpfCnpj: string;
  rg: string;
  endereco: string;
  telefone: string;
  email: string;
  banco: string;
  agencia: string;
  conta: string;
  chavePix: string;
  titularConta: string;
  spotify: string;
  spotifyOuvintes: string;
  instagram: string;
  instagramSeguidores: string;
  youtube: string;
  youtubeInscritos: string;
  tiktok: string;
  tiktokSeguidores: string;
  soundcloud: string;
  soundcloudSeguidores: string;
  deezer: string;
  deezerFas: string;
  appleMusic: string;
  appleMusicAlbuns: string;
  // relacionamentos comerciais (novo modelo relacional)
  relacionamentos: ArtistFormRelationship[];
  // legado — mantido para backward compat com CRM select
  tipoPerfil: "independente" | "com_empresario" | "gravadora" | "editora";
  empresarioId: string;
  empresarioNome: string;
  empresarioTelefone: string;
  empresarioEmail: string;
  gravadoraId: string;
  gravadoraNome: string;
  gravadoraTelefone: string;
  gravadoraEmail: string;
  gravadoraResponsavelId: string;
  gravadoraResponsavelNome: string;
  gravadoraResponsavelTelefone: string;
  gravadoraResponsavelEmail: string;
  distribuidorasSelecionadas: Record<string, boolean>;
  distribuidorasEmails: Record<string, string>;
  distribuidorasEmpresaSelecionadas: Record<string, boolean>;
  distribuidorasEmpresaEmails: Record<string, string>;
  fotoUrl: string;
  documentosPessoaisUrl: string;
  presskitUrl: string;
  contratoId: string;
}

function emptyRelationship(type: ArtistFormRelationship["type"]): ArtistFormRelationship {
  return { type, nome: "", telefone: "", email: "", escritorio: "", crc: "", responsaveis: [], distribuidoras: [] };
}

function relationshipToFormRelationship(r: ArtistRelationship): ArtistFormRelationship {
  return {
    type: r.type,
    nome: r.name ?? "",
    telefone: r.phone ?? "",
    email: r.email ?? "",
    escritorio: r.office ?? "",
    crc: r.crc ?? "",
    responsaveis: Array.isArray(r.responsibles)
      ? r.responsibles.map((rv) => ({ nome: rv.name ?? "", telefone: rv.phone ?? "", email: rv.email ?? "" }))
      : [],
    distribuidoras: Array.isArray(r.distributors) ? r.distributors : [],
  };
}

/** Constrói DistributorEntry[] a partir dos campos legados de distribuidoras. */
function buildLegacyDistributors(
  selected: Record<string, boolean> | null | undefined,
  emails: Record<string, string> | null | undefined,
): DistributorEntry[] {
  if (!selected) return [];
  return Object.entries(selected)
    .filter(([, isSelected]) => isSelected)
    .map(([id]) => ({ id, email: emails?.[id] ?? "" }));
}

/**
 * Migra campos legados para o novo array de relacionamentos quando o artista
 * não tem `relationships` mas tem campos manager* / label* preenchidos.
 * Também migra distribuidoras legadas e labelResponsible* legados.
 */
function migrateLegacyRelationships(artist: Artist): ArtistFormRelationship[] {
  const rels: ArtistFormRelationship[] = [];

  // Distribuidoras legadas — serão atribuídas ao primeiro manager ou label
  const legacyDists = buildLegacyDistributors(
    artist.selectedDistributors,
    artist.distributorEmails,
  );
  const legacyCompanyDists = buildLegacyDistributors(
    artist.selectedCompanyDistributors,
    artist.companyDistributorEmails,
  );

  if (artist.managerName) {
    rels.push({
      type: "empresario",
      nome: str(artist.managerName),
      telefone: str(artist.managerPhone),
      email: str(artist.managerEmail),
      escritorio: "",
      crc: "",
      responsaveis: [],
      distribuidoras: legacyDists,
    });
  }

  if (artist.labelName) {
    const tp = str(artist.profileType);
    const relType: ArtistFormRelationship["type"] = tp === "editora" ? "editora" : "gravadora";
    // Migrar o responsável único legado (labelResponsible*) para o array
    const responsibles: ArtistFormResponsible[] = [];
    if (artist.labelResponsibleName) {
      responsibles.push({
        nome: str(artist.labelResponsibleName),
        telefone: str(artist.labelResponsiblePhone),
        email: str(artist.labelResponsibleEmail),
      });
    }
    rels.push({
      type: relType,
      nome: str(artist.labelName),
      telefone: str(artist.labelPhone),
      email: str(artist.labelEmail),
      escritorio: "",
      crc: "",
      responsaveis: responsibles,
      // Se já existe manager, as legacyDists foram atribuídas a ele; caso contrário atribuir aqui
      distribuidoras: artist.managerName ? legacyCompanyDists : legacyDists,
    });
  }

  return rels;
}

/**
 * Converte um registro de artista (modelo interno `Artist`) no estado de formulário.
 * Usado no useEffect de ArtistFormModal quando open=true.
 */
export function artistToFormFields(artist: Artist | null | undefined): ArtistFormFieldValues {
  const emptyBase: ArtistFormFieldValues = {
    nomeArtistico: "",
    slugArtistico: "",
    tagsMusicais: [],
    faseCarreira: "",
    generoMusical: "",
    statusArtista: "signed",
    especialidades: [],
    biografia: "",
    notasInternas: "",
    nome: "",
    dataNascimento: "",
    cpfCnpj: "",
    rg: "",
    endereco: "",
    telefone: "",
    email: "",
    banco: "",
    agencia: "",
    conta: "",
    chavePix: "",
    titularConta: "",
    spotify: "",
    spotifyOuvintes: "",
    instagram: "",
    instagramSeguidores: "",
    youtube: "",
    youtubeInscritos: "",
    tiktok: "",
    tiktokSeguidores: "",
    soundcloud: "",
    soundcloudSeguidores: "",
    deezer: "",
    deezerFas: "",
    appleMusic: "",
    appleMusicAlbuns: "",
    relacionamentos: [],
    tipoPerfil: "independente",
    empresarioId: "",
    empresarioNome: "",
    empresarioTelefone: "",
    empresarioEmail: "",
    gravadoraId: "",
    gravadoraNome: "",
    gravadoraTelefone: "",
    gravadoraEmail: "",
    gravadoraResponsavelId: "",
    gravadoraResponsavelNome: "",
    gravadoraResponsavelTelefone: "",
    gravadoraResponsavelEmail: "",
    distribuidorasSelecionadas: {},
    distribuidorasEmails: {},
    distribuidorasEmpresaSelecionadas: {},
    distribuidorasEmpresaEmails: {},
    fotoUrl: "",
    documentosPessoaisUrl: "",
    presskitUrl: "",
    contratoId: "",
  };

  if (!artist) return emptyBase;

  // Relacionamentos: usa novo campo ou migra do legado
  let relacionamentos: ArtistFormRelationship[] = [];
  if (Array.isArray(artist.relationships) && artist.relationships.length > 0) {
    relacionamentos = artist.relationships.map(relationshipToFormRelationship);
  } else {
    relacionamentos = migrateLegacyRelationships(artist);
  }

  return {
    nomeArtistico: str(artist.stageName),
    slugArtistico: str(artist.artisticSlug),
    tagsMusicais: Array.isArray(artist.musicTags) ? artist.musicTags : [],
    faseCarreira: str(artist.careerStage),
    generoMusical: str(artist.musicGenre),
    statusArtista: str(artist.status) || "signed",
    especialidades: Array.isArray(artist.specialties) ? artist.specialties : [],
    biografia: str(artist.notes),
    notasInternas: str(artist.internalNotes),
    // Pessoal
    nome: str(artist.legalName),
    dataNascimento: str(artist.birthDate),
    cpfCnpj: str(artist.taxId),
    rg: str(artist.idDocument),
    endereco: str(artist.address),
    telefone: str(artist.phone),
    email: str(artist.email),
    // Bancário
    banco: str(artist.bank),
    agencia: str(artist.bankBranch),
    conta: str(artist.bankAccount),
    chavePix: str(artist.pixKey),
    titularConta: str(artist.accountHolder),
    // Plataformas — a URL é o dado persistido (nenhuma reconstrução a partir de ID)
    spotify: str(artist.spotifyUrl),
    spotifyOuvintes: artist.spotifyListeners != null ? String(artist.spotifyListeners) : "",
    instagram: str(artist.instagramUrl),
    instagramSeguidores: artist.instagramFollowers != null ? String(artist.instagramFollowers) : "",
    youtube: str(artist.youtubeUrl),
    youtubeInscritos: artist.youtubeSubscribers != null ? String(artist.youtubeSubscribers) : "",
    tiktok: str(artist.tiktokUrl),
    tiktokSeguidores: artist.tiktokFollowers != null ? String(artist.tiktokFollowers) : "",
    soundcloud: str(artist.soundcloudUrl),
    soundcloudSeguidores: artist.soundcloudFollowersUrl != null ? String(artist.soundcloudFollowersUrl) : "",
    deezer: str(artist.deezerUrl),
    deezerFas: artist.deezerFans != null ? String(artist.deezerFans) : "",
    appleMusic: str(artist.appleMusicUrl),
    appleMusicAlbuns: artist.appleMusicAlbumsUrl != null ? String(artist.appleMusicAlbumsUrl) : "",
    // Relacionamentos
    relacionamentos,
    // Legado
    tipoPerfil: (str(artist.profileType) || "independente") as ArtistFormFieldValues["tipoPerfil"],
    empresarioId: str(artist.managerId),
    empresarioNome: str(artist.managerName),
    empresarioTelefone: str(artist.managerPhone),
    empresarioEmail: str(artist.managerEmail),
    gravadoraId: str(artist.labelId),
    gravadoraNome: str(artist.labelName),
    gravadoraTelefone: str(artist.labelPhone),
    gravadoraEmail: str(artist.labelEmail),
    gravadoraResponsavelId: str(artist.labelResponsibleId),
    gravadoraResponsavelNome: str(artist.labelResponsibleName),
    gravadoraResponsavelTelefone: str(artist.labelResponsiblePhone),
    gravadoraResponsavelEmail: str(artist.labelResponsibleEmail),
    distribuidorasSelecionadas: (artist.selectedDistributors as Record<string, boolean> | null) ?? {},
    distribuidorasEmails: (artist.distributorEmails as Record<string, string> | null) ?? {},
    distribuidorasEmpresaSelecionadas: (artist.selectedCompanyDistributors as Record<string, boolean> | null) ?? {},
    distribuidorasEmpresaEmails: (artist.companyDistributorEmails as Record<string, string> | null) ?? {},
    // Arquivos
    fotoUrl: str(artist.photoUrl),
    documentosPessoaisUrl: str(artist.personalDocumentsUrl),
    presskitUrl: str(artist.pressKitUrl),
    contratoId: str(artist.contractId),
  };
}

export interface FormToArtistInput extends ArtistFormFieldValues {
  contratoId: string;
}

/**
 * Converte o estado do formulário em payload pronto para persistência
 * (modelo interno `Artist`, EN). Salva todos os campos — incluindo type e
 * status — garantindo que exportação e re-importação não percam dados.
 */
export function formToArtistPayload(f: FormToArtistInput): Omit<Artist, "id" | "user_id" | "created_at" | "updated_at"> {
  // Converte ArtistFormRelationship[] → ArtistRelationship[]
  const relationships: ArtistRelationship[] = f.relacionamentos
    .filter((r) => r.nome.trim() !== "")
    .map((r) => {
      const validResponsibles = (r.responsaveis ?? []).filter((rv) => rv.nome.trim() !== "");
      return {
        type: r.type,
        name: r.nome.trim(),
        phone: r.telefone.trim(),
        email: r.email.trim(),
        ...(r.escritorio.trim() ? { office: r.escritorio.trim() } : {}),
        ...(r.crc.trim() ? { crc: r.crc.trim() } : {}),
        ...(validResponsibles.length > 0
          ? { responsibles: validResponsibles.map((rv) => ({ name: rv.nome, phone: rv.telefone, email: rv.email })) }
          : {}),
        ...(r.distribuidoras.length > 0 ? { distributors: r.distribuidoras } : {}),
      };
    });

  // Deriva mapas legados de distribuidoras a partir do novo modelo relacional
  // (empresario + gravadora + editora têm distribuidoras próprias no novo modelo)
  const managerRels = f.relacionamentos.filter((r) => r.type === "empresario");
  const labelRels    = f.relacionamentos.filter((r) => r.type === "gravadora" || r.type === "editora");

  const selectedDistributors: Record<string, boolean> = {};
  const distributorEmails: Record<string, string>      = {};
  for (const rel of managerRels) {
    for (const d of rel.distribuidoras) {
      selectedDistributors[d.id] = true;
      if (d.email) distributorEmails[d.id] = d.email;
    }
  }
  // Se não há manager, usa as distribuidoras do label para o mapa legado
  if (managerRels.length === 0) {
    for (const rel of labelRels) {
      for (const d of rel.distribuidoras) {
        selectedDistributors[d.id] = true;
        if (d.email) distributorEmails[d.id] = d.email;
      }
    }
  }
  // Mapa "empresa" (distribuidoras do label quando também há manager)
  const selectedCompanyDistributors: Record<string, boolean> = {};
  const companyDistributorEmails: Record<string, string>      = {};
  if (managerRels.length > 0) {
    for (const rel of labelRels) {
      for (const d of rel.distribuidoras) {
        selectedCompanyDistributors[d.id] = true;
        if (d.email) companyDistributorEmails[d.id] = d.email;
      }
    }
  }

  // Primeiro responsável do primeiro label → campos legados
  const firstLabel = f.relacionamentos.find((r) => r.type === "gravadora" || r.type === "editora");
  const firstResp = firstLabel?.responsaveis?.[0];

  return {
    stageName: f.nomeArtistico.trim(),
    artisticSlug: strOrNull(f.slugArtistico),
    musicTags: f.tagsMusicais.length > 0 ? f.tagsMusicais : null,
    careerStage: strOrNull(f.faseCarreira),
    legalName: strOrNull(f.nome),
    status: (f.statusArtista || null) as Artist["status"],
    musicGenre: strOrNull(f.generoMusical),
    specialties: f.especialidades.length > 0 ? f.especialidades : null,
    notes: strOrNull(f.biografia),
    photoUrl: strOrNull(f.fotoUrl),
    // Pessoal
    birthDate: strOrNull(f.dataNascimento),
    idDocument: strOrNull(f.rg),
    address: strOrNull(f.endereco),
    phone: strOrNull(f.telefone),
    email: strOrNull(f.email),
    taxId: strOrNull(f.cpfCnpj),
    // Bancário
    bank: strOrNull(f.banco),
    bankBranch: strOrNull(f.agencia),
    bankAccount: strOrNull(f.conta),
    pixKey: strOrNull(f.chavePix),
    accountHolder: strOrNull(f.titularConta),
    // Plataformas — persiste a URL diretamente (contrato do backend: spotify_url/youtube_url)
    spotifyUrl: strOrNull(f.spotify),
    spotifyListeners: numOrNull(f.spotifyOuvintes),
    youtubeUrl: strOrNull(f.youtube),
    youtubeSubscribers: numOrNull(f.youtubeInscritos),
    deezerUrl: strOrNull(f.deezer),
    deezerFans: numOrNull(f.deezerFas),
    appleMusicUrl: strOrNull(f.appleMusic),
    appleMusicAlbumsUrl: numOrNull(f.appleMusicAlbuns),
    soundcloudUrl: strOrNull(f.soundcloud),
    soundcloudFollowersUrl: numOrNull(f.soundcloudSeguidores),
    instagramUrl: strOrNull(f.instagram),
    instagramFollowers: numOrNull(f.instagramSeguidores),
    tiktokUrl: strOrNull(f.tiktok),
    tiktokFollowers: numOrNull(f.tiktokSeguidores),
    // Relacionamentos (novo)
    relationships: relationships.length > 0 ? relationships : null,
    // Legado (mantido para backward compat — derivado do novo modelo relacional)
    profileType: f.tipoPerfil,
    managerId: strOrNull(f.empresarioId),
    managerName: strOrNull(f.empresarioNome),
    managerPhone: strOrNull(f.empresarioTelefone),
    managerEmail: strOrNull(f.empresarioEmail),
    labelId: strOrNull(f.gravadoraId),
    labelName: strOrNull(f.gravadoraNome),
    labelPhone: strOrNull(f.gravadoraTelefone),
    labelEmail: strOrNull(f.gravadoraEmail),
    // Responsável do label — agora derivado do primeiro responsável do primeiro relacionamento de label
    labelResponsibleId: strOrNull(f.gravadoraResponsavelId),
    labelResponsibleName: firstResp ? firstResp.nome || null : strOrNull(f.gravadoraResponsavelNome),
    labelResponsiblePhone: firstResp ? firstResp.telefone || null : strOrNull(f.gravadoraResponsavelTelefone),
    labelResponsibleEmail: firstResp ? firstResp.email || null : strOrNull(f.gravadoraResponsavelEmail),
    // Distribuidoras — derivadas do novo modelo relacional para não apagar dados legados
    selectedDistributors: Object.keys(selectedDistributors).length > 0 ? selectedDistributors : null,
    distributorEmails: Object.keys(distributorEmails).length > 0 ? distributorEmails : null,
    selectedCompanyDistributors: Object.keys(selectedCompanyDistributors).length > 0 ? selectedCompanyDistributors : null,
    companyDistributorEmails: Object.keys(companyDistributorEmails).length > 0 ? companyDistributorEmails : null,
    internalNotes: strOrNull(f.notasInternas),
    // Documentos / presskit
    personalDocumentsUrl: strOrNull(f.documentosPessoaisUrl),
    pressKitUrl: strOrNull(f.presskitUrl),
  } as Omit<Artist, "id" | "user_id" | "created_at" | "updated_at">;
}

// Re-export emptyRelationship for use in the form component
export { emptyRelationship };
