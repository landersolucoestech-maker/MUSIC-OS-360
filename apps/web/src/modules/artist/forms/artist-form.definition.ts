/**
 * modules/artist/forms/artist-form.definition.ts
 * ─────────────────────────────────────────────────────────────────
 * FONTE ÚNICA DE VERDADE da estrutura do formulário de artista
 * (Modal Criar/Editar). Define, para cada campo: id, label, type,
 * seção, ordem (posição no array) e obrigatoriedade.
 *
 * Consumidores obrigatórios desta definição:
 *   1. Renderização  — ArtistFormModal itera ARTIST_FORM_SECTIONS.
 *   2. Validação     — artistSchema é GERADO daqui (buildArtistSchema).
 *   3. Exportação    — artistToExportRowFromForm itera as seções/campos.
 *   4. Importação    — parseArtistImportRow itera as seções/campos.
 *
 * Regra: NÃO criar listas de colunas, mappers de exportação, DTOs de
 * exportação ou headers paralelos. Um campo novo adicionado aqui aparece
 * automaticamente no formulário, na validação, no export e no import.
 * ─────────────────────────────────────────────────────────────────
 */

import { z } from "zod";
import { MUSICAL_GENRE_LABELS } from "@/constants/musicalGenres";
import type { Artist, DistributorEntry } from "@/modules/artist/types/artist.types";
import {
  artistToFormFields,
  formToArtistPayload,
  SPECIALTY_LABELS,
  normalizeSpecialty,
  normalizeProfileType,
  pickRow,
  validateSpotifyUrl,
  validateYoutubeUrl,
  validateInstagramUrl,
  validateTiktokUrl,
  validateSoundcloudUrl,
  validateDeezerUrl,
  validateAppleMusicUrl,
  type FormToArtistInput,
  type UrlValidationState,
} from "@/modules/artist/services/artist.mapper";

// ─── Valores do formulário (react-hook-form) ─────────────────────

export interface ArtistLinkedContactValue {
  contactId: string;
  distributors: DistributorEntry[];
}

/** Campos controlados pelo react-hook-form (validados pelo schema gerado). */
export interface ArtistFormValues {
  nomeArtistico: string;
  generoMusical: string;
  especialidades: string[];
  biografia: string;
  notasInternas: string;
  nome: string;
  dataNascimento: string;
  cpfCnpj: string;
  rg: string;
  genero: string;
  endereco: string;
  telefone: string;
  email: string;
  banco: string;
  agencia: string;
  conta: string;
  chavePix: string;
  titularConta: string;
  spotify: string;
  instagram: string;
  youtube: string;
  tiktok: string;
  soundcloud: string;
  deezer: string;
  appleMusic: string;
  tipoPerfil: "independente" | "com_empresario" | "gravadora" | "editora";
  distribuidorasGerais: DistributorEntry[];
  contatosVinculados: ArtistLinkedContactValue[];
}

/** Campos de arquivo (upload) — exibidos no formulário, fora do react-hook-form. */
export interface ArtistFormFileValues {
  fotoUrl: string;
  documentosPessoaisUrl: string;
  presskitUrl: string;
}

/** Todos os campos exibidos no Modal Criar (form + uploads). */
export type ArtistFormAllValues = ArtistFormValues & ArtistFormFileValues;

// ─── Tipos da definição ──────────────────────────────────────────

export type ArtistFieldType =
  | "text"
  | "email"
  | "tel"
  | "date"
  | "textarea"
  | "select"
  | "multicheck"
  | "url"
  | "file"
  | "contatos-crm"
  | "distribuidoras";

export interface ArtistFormField {
  /** id do campo — chave em ArtistFormAllValues. */
  id: keyof ArtistFormAllValues;
  /** Label exibido no formulário = header da coluna exportada. */
  label: string;
  type: ArtistFieldType;
  /** Obrigatoriedade única: asterisco no label E validação do schema. */
  required?: boolean;
  placeholder?: string;
  testId?: string;
  /** Ocupa a linha inteira do grid (default: meia largura). */
  fullWidth?: boolean;
  /** Opções para type="select". */
  options?: ReadonlyArray<{ value: string; label: string }>;
  /** Opções para type="multicheck". */
  checkOptions?: ReadonlyArray<{ value: string; label: string }>;
  /** Validações string do schema gerado. */
  maxLength?: { value: number; message: string };
  requiredMessage?: string;
  /** Validador visual para type="url". */
  urlValidator?: (url: string) => UrlValidationState;
  /** Props para type="file". */
  file?: { folder: string; accept: string; maxSize: number; circular?: boolean };
}

export interface ArtistFormSection {
  id: string;
  title: string;
  /** Seção condicional — mesma regra usada na renderização. */
  visibleWhen?: (values: ArtistFormValues) => boolean;
  fields: ArtistFormField[];
}

// ─── Opções ──────────────────────────────────────────────────────

const GENEROS_MUSICAIS_OPTIONS = MUSICAL_GENRE_LABELS.map((g) => ({ value: g, label: g }));

const BANCOS_OPTIONS = [
  "Banco do Brasil", "Bradesco", "Caixa Econômica", "Itaú", "Santander",
  "Nubank", "Inter", "C6 Bank", "PicPay", "Mercado Pago", "Outro",
].map((b) => ({ value: b, label: b }));

export const TIPO_PERFIL_OPTIONS = [
  { value: "independente",   label: "Independente" },
  { value: "com_empresario", label: "Com empresário" },
  { value: "gravadora",      label: "Com gravadora" },
  { value: "editora",        label: "Com editora" },
] as const;

/** Perfis que exibem a seção Distribuidoras / Agregadoras. */
export const PERFIS_COM_DISTRIBUIDORA = ["com_empresario", "gravadora", "editora"];

export const DISTRIBUIDORAS_OPTIONS = [
  { id: "onerpm",    label: "ONErpm" },
  { id: "distrokid", label: "DistroKid" },
  { id: "30por1",    label: "30 Por 1" },
  { id: "symphonic", label: "Symphonic" },
  { id: "musicpro",  label: "MusicPro" },
  { id: "somvibe",   label: "Somvibe" },
  { id: "outros",    label: "Outros" },
] as const;

const ESPECIALIDADES_OPTIONS = Object.entries(SPECIALTY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const URL_MAX = { value: 300, message: "URL inválida" };

// ─── A DEFINIÇÃO ─────────────────────────────────────────────────
// A ordem dos arrays (seções e campos) é a ordem VISUAL do formulário
// e, portanto, a ordem das colunas do arquivo exportado.

export const ARTIST_FORM_SECTIONS: ArtistFormSection[] = [
  {
    id: "informacoes-basicas",
    title: "Informações Básicas",
    fields: [
      {
        id: "fotoUrl", label: "Imagem do Artista", type: "file", fullWidth: true,
        file: { folder: "artistas/fotos", accept: "image/*", maxSize: 5, circular: true },
      },
      {
        id: "nomeArtistico", label: "Nome Artístico", type: "text", required: true,
        requiredMessage: "Nome artístico é obrigatório",
        maxLength: { value: 150, message: "Nome artístico deve ter no máximo 150 caracteres" },
        placeholder: "Nome usado profissionalmente", testId: "input-nome-artistico",
      },
      {
        id: "generoMusical", label: "Gênero Musical", type: "select",
        options: GENEROS_MUSICAIS_OPTIONS, placeholder: "Selecione o gênero", testId: "select-genero",
      },
      {
        id: "especialidades", label: "Especialidade / Função", type: "multicheck", fullWidth: true,
        checkOptions: ESPECIALIDADES_OPTIONS,
      },
      {
        id: "documentosPessoaisUrl", label: "Documentos Pessoais (PDF)", type: "file", fullWidth: true,
        file: { folder: "artistas/documents", accept: "application/pdf", maxSize: 5 },
      },
      {
        id: "presskitUrl", label: "Presskit / Media Kit", type: "file", fullWidth: true,
        file: { folder: "artistas/presskit", accept: "application/pdf,.zip", maxSize: 10 },
      },
      {
        id: "biografia", label: "Biografia", type: "textarea", fullWidth: true,
        maxLength: { value: 5000, message: "Biografia deve ter no máximo 5000 caracteres" },
        placeholder: "Trajetória, conquistas e estilo musical…", testId: "textarea-biografia",
      },
    ],
  },
  {
    id: "dados-pessoais",
    title: "Dados Pessoais",
    fields: [
      {
        id: "nome", label: "Nome Completo", type: "text", required: true,
        requiredMessage: "Nome completo é obrigatório",
        maxLength: { value: 150, message: "Nome completo deve ter no máximo 150 caracteres" },
        placeholder: "Nome conforme documento", testId: "input-nome-civil",
      },
      { id: "dataNascimento", label: "Data de Nascimento", type: "date", testId: "datepicker-data-nascimento" },
      {
        id: "cpfCnpj", label: "CPF", type: "text",
        maxLength: { value: 20, message: "CPF/CNPJ inválido" },
        placeholder: "000.000.000-00", testId: "input-cpf-cnpj",
      },
      {
        id: "rg", label: "RG", type: "text",
        maxLength: { value: 20, message: "RG inválido" },
        placeholder: "00.000.000-0", testId: "input-rg",
      },
      {
        id: "genero", label: "Gênero", type: "select", testId: "select-genero-pessoa",
        options: [
          { value: "Masculino", label: "Masculino" },
          { value: "Feminino", label: "Feminino" },
        ],
        placeholder: "Selecione o gênero",
      },
      {
        id: "endereco", label: "Endereço Completo", type: "text",
        maxLength: { value: 300, message: "Endereço deve ter no máximo 300 caracteres" },
        placeholder: "Rua, número, bairro, cidade, CEP", testId: "input-endereco",
      },
      {
        id: "telefone", label: "Telefone", type: "tel",
        maxLength: { value: 20, message: "Telefone inválido" },
        placeholder: "(11) 99999-9999", testId: "input-telefone",
      },
      {
        id: "email", label: "E-mail", type: "email",
        maxLength: { value: 100, message: "Email deve ter no máximo 100 caracteres" },
        placeholder: "email@exemplo.com", testId: "input-email",
      },
    ],
  },
  {
    id: "dados-bancarios",
    title: "Dados Bancários",
    fields: [
      { id: "banco", label: "Banco", type: "select", options: BANCOS_OPTIONS, placeholder: "Selecione o banco" },
      { id: "agencia", label: "Agência", type: "text", placeholder: "0000" },
      { id: "conta", label: "Conta com Dígito", type: "text", placeholder: "00000-0" },
      {
        id: "chavePix", label: "Chave Pix", type: "text",
        maxLength: { value: 150, message: "Chave PIX inválida" },
        placeholder: "CPF, e-mail, telefone ou chave aleatória",
      },
      {
        id: "titularConta", label: "Titular da Conta", type: "text",
        maxLength: { value: 150, message: "Nome do titular inválido" },
        placeholder: "Nome completo do titular",
      },
    ],
  },
  {
    id: "perfis-redes",
    title: "Perfis e Redes Sociais",
    fields: [
      { id: "spotify",    label: "Spotify",     type: "url", maxLength: URL_MAX, urlValidator: validateSpotifyUrl,    placeholder: "https://open.spotify.com/artist/…", testId: "input-spotify-url" },
      { id: "instagram",  label: "Instagram",   type: "url", maxLength: URL_MAX, urlValidator: validateInstagramUrl,  placeholder: "https://instagram.com/perfil", testId: "input-instagram-url" },
      { id: "youtube",    label: "YouTube",     type: "url", maxLength: URL_MAX, urlValidator: validateYoutubeUrl,    placeholder: "https://youtube.com/channel/UC…", testId: "input-youtube-url" },
      { id: "tiktok",     label: "TikTok",      type: "url", maxLength: URL_MAX, urlValidator: validateTiktokUrl,     placeholder: "https://tiktok.com/@perfil", testId: "input-tiktok-url" },
      { id: "soundcloud", label: "SoundCloud",  type: "url", maxLength: URL_MAX, urlValidator: validateSoundcloudUrl, placeholder: "https://soundcloud.com/perfil", testId: "input-soundcloud-url" },
      { id: "appleMusic", label: "Apple Music", type: "url", maxLength: URL_MAX, urlValidator: validateAppleMusicUrl, placeholder: "https://music.apple.com/artist/…", testId: "input-apple-music-url" },
      { id: "deezer",     label: "Deezer",      type: "url", maxLength: URL_MAX, urlValidator: validateDeezerUrl,     placeholder: "https://deezer.com/artist/…", testId: "input-deezer-url" },
    ],
  },
  {
    id: "type-perfil",
    title: "Tipo de Perfil",
    fields: [
      {
        id: "tipoPerfil", label: "Perfil Comercial", type: "select", fullWidth: true,
        options: TIPO_PERFIL_OPTIONS, placeholder: "Selecione o perfil", testId: "select-type-perfil",
      },
      { id: "contatosVinculados", label: "Equipe / Contatos (CRM)", type: "contatos-crm", fullWidth: true },
    ],
  },
  {
    id: "distribuidoras",
    title: "Distribuidoras / Agregadoras",
    visibleWhen: (v) => PERFIS_COM_DISTRIBUIDORA.includes(v.tipoPerfil),
    fields: [
      { id: "distribuidorasGerais", label: "Distribuidoras / Agregadoras", type: "distribuidoras", fullWidth: true },
    ],
  },
  {
    id: "observacoes",
    title: "Observações",
    fields: [
      {
        id: "notasInternas", label: "Notas Internas", type: "textarea", fullWidth: true,
        maxLength: { value: 5000, message: "Notas devem ter no máximo 5000 caracteres" },
        placeholder: "Notas internas, rider técnico, preferências, informações adicionais…",
        testId: "textarea-observacoes",
      },
    ],
  },
];

/** Todos os campos do formulário, na ordem visual (seções percorridas em sequência). */
export function allArtistFormFields(): ArtistFormField[] {
  return ARTIST_FORM_SECTIONS.flatMap((s) => s.fields);
}

// ─── Defaults ────────────────────────────────────────────────────

export function emptyArtistFormValues(): ArtistFormValues {
  return {
    nomeArtistico: "", generoMusical: "", especialidades: [], biografia: "", notasInternas: "",
    nome: "", dataNascimento: "", cpfCnpj: "", rg: "", genero: "", endereco: "", telefone: "", email: "",
    banco: "", agencia: "", conta: "", chavePix: "", titularConta: "",
    spotify: "", instagram: "", youtube: "", tiktok: "", soundcloud: "", deezer: "", appleMusic: "",
    tipoPerfil: "independente", distribuidorasGerais: [], contatosVinculados: [],
  };
}

// ─── Validação (schema Zod GERADO da definição) ──────────────────

const distribuidoraEntrySchema = z.object({
  id: z.string(),
  email: z.string(),
  nomeCustom: z.string().optional(),
});

const contatoVinculadoSchema = z.object({
  contactId: z.string(),
  distributors: z.array(distribuidoraEntrySchema),
});

function stringFieldSchema(field: ArtistFormField): z.ZodTypeAny {
  let base = z.string();
  if (field.type === "email") base = base.email("Email inválido");
  if (field.maxLength) base = base.max(field.maxLength.value, field.maxLength.message);
  if (field.required) {
    return base.min(1, field.requiredMessage ?? `${field.label} é obrigatório`).trim();
  }
  return base.optional().or(z.literal(""));
}

/**
 * Gera o schema de validação a partir da definição do formulário.
 * required/maxLength vêm exclusivamente de ARTIST_FORM_SECTIONS.
 */
export function buildArtistSchema() {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of allArtistFormFields()) {
    switch (field.type) {
      case "file":
        // Uploads são validados pelo widget (accept/maxSize da definição);
        // não participam do schema do react-hook-form.
        break;
      case "multicheck":
        shape[field.id] = z.array(z.string()).optional();
        break;
      case "contatos-crm":
        shape[field.id] = z.array(contatoVinculadoSchema).optional();
        break;
      case "distribuidoras":
        shape[field.id] = z.array(distribuidoraEntrySchema).optional();
        break;
      case "select":
        if (field.id === "tipoPerfil") {
          shape[field.id] = z
            .enum(TIPO_PERFIL_OPTIONS.map((o) => o.value) as [string, ...string[]])
            .default("independente");
        } else {
          shape[field.id] = stringFieldSchema(field);
        }
        break;
      default:
        shape[field.id] = stringFieldSchema(field);
    }
  }
  return z.object(shape);
}

export const artistSchema = buildArtistSchema() as unknown as z.ZodType<ArtistFormValues>;

// ─── Hidratação (Artist → valores do formulário) ─────────────────
// MESMA função para abrir o modal de edição e para exportar: garante
// que a célula exportada é exatamente o valor que o formulário exibiria.

export function artistToFormValues(artist: Artist | null | undefined): ArtistFormAllValues {
  const f = artistToFormFields(artist ?? null);

  const rawLinked = artist?.linkedContacts;
  const contatosVinculados: ArtistLinkedContactValue[] = Array.isArray(rawLinked)
    ? rawLinked
        .filter((v) => typeof v?.contactId === "string" && v.contactId)
        .map((v) => ({
          contactId: v.contactId,
          distributors: Array.isArray(v.distributors) ? v.distributors : [],
        }))
    : [];

  const rawDists = artist?.generalDistributors;
  const distribuidorasGerais: DistributorEntry[] = Array.isArray(rawDists) ? rawDists : [];

  return {
    ...emptyArtistFormValues(),
    nomeArtistico: f.nomeArtistico,
    generoMusical: f.generoMusical,
    especialidades: f.especialidades,
    biografia: f.biografia,
    notasInternas: f.notasInternas,
    nome: f.nome,
    dataNascimento: f.dataNascimento,
    cpfCnpj: f.cpfCnpj,
    rg: f.rg,
    genero: typeof (artist as unknown as Record<string, unknown> | null | undefined)?.genero === "string"
      ? ((artist as unknown as Record<string, unknown>).genero as string)
      : "",
    endereco: f.endereco,
    telefone: f.telefone,
    email: f.email,
    banco: f.banco,
    agencia: f.agencia,
    conta: f.conta,
    chavePix: f.chavePix,
    titularConta: f.titularConta,
    spotify: f.spotify,
    instagram: f.instagram,
    youtube: f.youtube,
    tiktok: f.tiktok,
    soundcloud: f.soundcloud,
    deezer: f.deezer,
    appleMusic: f.appleMusic,
    tipoPerfil: (f.tipoPerfil || "independente") as ArtistFormValues["tipoPerfil"],
    distribuidorasGerais,
    contatosVinculados,
    fotoUrl: f.fotoUrl,
    documentosPessoaisUrl: f.documentosPessoaisUrl,
    presskitUrl: f.presskitUrl,
  };
}

// ─── Persistência (valores do formulário → payload Artist) ───────

/**
 * Campos preservados em round-trip de edição que NÃO são exibidos no
 * formulário (métricas de plataforma, modelo legado, contrato etc.).
 * No CREATE e na IMPORTAÇÃO valem estes defaults.
 */
export type ArtistPreservedInput = Omit<FormToArtistInput, keyof ArtistFormAllValues>;

export function emptyPreservedInput(): ArtistPreservedInput {
  return {
    slugArtistico: "", tagsMusicais: [], faseCarreira: "",
    statusArtista: "signed",
    spotifyOuvintes: "", instagramSeguidores: "", youtubeInscritos: "",
    tiktokSeguidores: "", soundcloudSeguidores: "", deezerFas: "", appleMusicAlbuns: "",
    relacionamentos: [],
    empresarioId: "", empresarioNome: "", empresarioTelefone: "", empresarioEmail: "",
    gravadoraId: "", gravadoraNome: "", gravadoraTelefone: "", gravadoraEmail: "",
    gravadoraResponsavelId: "", gravadoraResponsavelNome: "",
    gravadoraResponsavelTelefone: "", gravadoraResponsavelEmail: "",
    distribuidorasSelecionadas: {}, distribuidorasEmails: {},
    distribuidorasEmpresaSelecionadas: {}, distribuidorasEmpresaEmails: {},
    contratoId: "",
  };
}

/**
 * Extrai de um artista existente os campos preservados em round-trip de
 * edição (não exibidos no formulário). Usa a MESMA hidratação canônica.
 */
export function artistToPreservedInput(artist: Artist | null | undefined): ArtistPreservedInput {
  const f = artistToFormFields(artist ?? null);
  return {
    slugArtistico: f.slugArtistico,
    tagsMusicais: f.tagsMusicais,
    faseCarreira: f.faseCarreira,
    statusArtista: f.statusArtista,
    spotifyOuvintes: f.spotifyOuvintes,
    instagramSeguidores: f.instagramSeguidores,
    youtubeInscritos: f.youtubeInscritos,
    tiktokSeguidores: f.tiktokSeguidores,
    soundcloudSeguidores: f.soundcloudSeguidores,
    deezerFas: f.deezerFas,
    appleMusicAlbuns: f.appleMusicAlbuns,
    relacionamentos: f.relacionamentos,
    empresarioId: f.empresarioId,
    empresarioNome: f.empresarioNome,
    empresarioTelefone: f.empresarioTelefone,
    empresarioEmail: f.empresarioEmail,
    gravadoraId: f.gravadoraId,
    gravadoraNome: f.gravadoraNome,
    gravadoraTelefone: f.gravadoraTelefone,
    gravadoraEmail: f.gravadoraEmail,
    gravadoraResponsavelId: f.gravadoraResponsavelId,
    gravadoraResponsavelNome: f.gravadoraResponsavelNome,
    gravadoraResponsavelTelefone: f.gravadoraResponsavelTelefone,
    gravadoraResponsavelEmail: f.gravadoraResponsavelEmail,
    distribuidorasSelecionadas: f.distribuidorasSelecionadas,
    distribuidorasEmails: f.distribuidorasEmails,
    distribuidorasEmpresaSelecionadas: f.distribuidorasEmpresaSelecionadas,
    distribuidorasEmpresaEmails: f.distribuidorasEmpresaEmails,
    contratoId: f.contratoId,
  };
}

/**
 * Converte os valores do formulário no payload de persistência.
 * MESMA função para o submit do modal e para a importação.
 */
export function formValuesToArtistPayload(
  values: ArtistFormAllValues,
  preserved: ArtistPreservedInput = emptyPreservedInput(),
): Omit<Artist, "id" | "user_id" | "created_at" | "updated_at"> {
  const input: FormToArtistInput = {
    ...preserved,
    nomeArtistico: values.nomeArtistico,
    generoMusical: values.generoMusical,
    especialidades: values.especialidades,
    biografia: values.biografia,
    notasInternas: values.notasInternas,
    nome: values.nome,
    dataNascimento: values.dataNascimento,
    cpfCnpj: values.cpfCnpj,
    rg: values.rg,
    endereco: values.endereco,
    telefone: values.telefone,
    email: values.email,
    banco: values.banco,
    agencia: values.agencia,
    conta: values.conta,
    chavePix: values.chavePix,
    titularConta: values.titularConta,
    spotify: values.spotify,
    instagram: values.instagram,
    youtube: values.youtube,
    tiktok: values.tiktok,
    soundcloud: values.soundcloud,
    deezer: values.deezer,
    appleMusic: values.appleMusic,
    tipoPerfil: values.tipoPerfil,
    fotoUrl: values.fotoUrl,
    documentosPessoaisUrl: values.documentosPessoaisUrl,
    presskitUrl: values.presskitUrl,
  };

  const payload = formToArtistPayload(input);
  return {
    ...payload,
    genero: values.genero || null,
    linkedContacts: values.contatosVinculados.length > 0 ? values.contatosVinculados : null,
    generalDistributors: values.distribuidorasGerais.length > 0 ? values.distribuidorasGerais : null,
  } as Omit<Artist, "id" | "user_id" | "created_at" | "updated_at">;
}

// ─── Codecs de célula (por TIPO de campo, não por fluxo) ─────────

function serializeJsonArray(value: unknown[]): string {
  return value.length > 0 ? JSON.stringify(value) : "";
}

function parseJsonArray<T>(raw: unknown, isValid: (item: unknown) => boolean): T[] {
  const s = raw == null ? "" : String(raw).trim();
  if (!s) return [];
  try {
    const parsed = JSON.parse(s) as unknown;
    return Array.isArray(parsed) ? (parsed.filter(isValid) as T[]) : [];
  } catch {
    return [];
  }
}

/** Valor de célula exportada para um campo — derivado do valor do formulário. */
export function serializeArtistFieldValue(field: ArtistFormField, values: ArtistFormAllValues): string {
  const v = values[field.id];
  switch (field.type) {
    case "multicheck": {
      const arr = Array.isArray(v) ? (v as string[]) : [];
      return arr.map((e) => SPECIALTY_LABELS[e] ?? e).join(", ");
    }
    case "contatos-crm":
    case "distribuidoras":
      return serializeJsonArray(Array.isArray(v) ? (v as unknown[]) : []);
    default:
      return v == null ? "" : String(v);
  }
}

/** Valor de formulário a partir de uma célula importada. */
function deserializeArtistFieldValue(
  field: ArtistFormField,
  raw: unknown,
): ArtistFormAllValues[keyof ArtistFormAllValues] {
  const s = raw == null ? "" : String(raw).trim();
  switch (field.type) {
    case "multicheck":
      return s ? s.split(",").map((x) => normalizeSpecialty(x.trim())).filter(Boolean) : [];
    case "contatos-crm":
      return parseJsonArray<ArtistLinkedContactValue>(
        s,
        (item) => typeof (item as { contactId?: unknown })?.contactId === "string",
      );
    case "distribuidoras":
      return parseJsonArray<DistributorEntry>(
        s,
        (item) => typeof (item as { id?: unknown })?.id === "string",
      );
    case "select":
      if (field.id === "tipoPerfil") return normalizeProfileType(s);
      return s;
    default:
      return s;
  }
}

// ─── Exportação ──────────────────────────────────────────────────

/**
 * Linha de exportação: itera as seções/campos NA ORDEM VISUAL do formulário.
 * 1 campo do formulário = exatamente 1 coluna, com o label como header.
 */
export function artistToExportRowFromForm(artist: Artist): Record<string, string> {
  const values = artistToFormValues(artist);
  const row: Record<string, string> = {};
  for (const section of ARTIST_FORM_SECTIONS) {
    for (const field of section.fields) {
      row[field.label] = serializeArtistFieldValue(field, values);
    }
  }
  return row;
}

// ─── Importação ──────────────────────────────────────────────────

/**
 * Headers aceitos por campo no import: label canônico, id do campo e
 * aliases de compatibilidade com planilhas exportadas por versões antigas.
 */
const IMPORT_HEADER_ALIASES: Partial<Record<keyof ArtistFormAllValues, string[]>> = {
  fotoUrl:               ["Foto URL"],
  nomeArtistico:         ["Nome", "nome_artistico"],
  generoMusical:         ["Genero Musical", "genero_musical"],
  especialidades:        ["Função", "Funcao", "Especialidades"],
  documentosPessoaisUrl: ["documentos_pessoais_url"],
  presskitUrl:           ["Presskit / Media Kit (PDF)", "presskit_url"],
  biografia:             ["observacoes"],
  nome:                  ["Nome Civil", "nome_civil"],
  dataNascimento:        ["data_nascimento"],
  cpfCnpj:               ["CPF/CNPJ", "cpf_cnpj"],
  endereco:              ["Endereço completo", "Endereco"],
  email:                 ["Email"],
  spotify:               ["Spotify URL"],
  instagram:             ["Instagram URL"],
  youtube:               ["YouTube URL"],
  tiktok:                ["TikTok URL"],
  soundcloud:            ["SoundCloud URL", "soundcloud_url"],
  appleMusic:            ["Apple Music URL", "apple_music_url"],
  deezer:                ["Deezer URL", "deezer_url"],
  tipoPerfil:            ["Tipo de Perfil", "tipo_perfil", "Perfil"],
  notasInternas:         ["Observações", "Observacoes", "notas_internas"],
};

/**
 * Converte uma linha de planilha em valores de formulário, iterando a
 * MESMA definição usada para renderizar e exportar. Retorna null quando
 * a linha não tem Nome Artístico (registro inválido).
 */
export function parseArtistImportRow(row: Record<string, unknown>): ArtistFormAllValues | null {
  const values: ArtistFormAllValues = { ...emptyArtistFormValues(), fotoUrl: "", documentosPessoaisUrl: "", presskitUrl: "" };

  for (const field of allArtistFormFields()) {
    const headers = [field.label, field.id, ...(IMPORT_HEADER_ALIASES[field.id] ?? [])];
    const raw = pickRow(row, ...headers);
    if (raw === undefined) continue;
    (values as unknown as Record<string, unknown>)[field.id] = deserializeArtistFieldValue(field, raw);
  }

  if (!values.nomeArtistico.trim()) return null;
  return values;
}
