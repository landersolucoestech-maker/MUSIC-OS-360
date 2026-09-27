/**
 * modules/artist/forms/artist-form.definition.ts
 * ─────────────────────────────────────────────────────────────────
 * SINGLE SOURCE OF TRUTH for the artist form structure (Create/Edit modal).
 * For each field it defines: id, label, type, section, order (position in the
 * array) and requiredness.
 *
 * Mandatory consumers of this definition:
 *   1. Rendering   — ArtistFormModal iterates ARTIST_FORM_SECTIONS.
 *   2. Validation  — artistSchema is GENERATED from here (buildArtistSchema).
 *   3. Export      — artistToExportRowFromForm iterates the sections/fields.
 *   4. Import      — parseArtistImportRow iterates the sections/fields.
 *
 * Rule: do NOT create parallel column lists, export mappers, export DTOs or
 * headers. A new field added here automatically appears in the form, the
 * validation, the export and the import.
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

// ─── Form values (react-hook-form) ───────────────────────────────

export interface ArtistLinkedContactValue {
  contactId: string;
  distributors: DistributorEntry[];
}

/** Fields controlled by react-hook-form (validated by the generated schema). */
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

/** File (upload) fields — shown in the form, outside react-hook-form. */
export interface ArtistFormFileValues {
  fotoUrl: string;
  documentosPessoaisUrl: string;
  presskitUrl: string;
}

/** Every field shown in the Create modal (form + uploads). */
export type ArtistFormAllValues = ArtistFormValues & ArtistFormFileValues;

// ─── Definition types ────────────────────────────────────────────

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
  /** field id — key in ArtistFormAllValues. */
  id: keyof ArtistFormAllValues;
  /** Label shown in the form = header of the exported column. */
  label: string;
  type: ArtistFieldType;
  /** Single requiredness: the label asterisk AND the schema validation. */
  required?: boolean;
  placeholder?: string;
  testId?: string;
  /** Spans the full grid row (default: half width). */
  fullWidth?: boolean;
  /** Options for type="select". */
  options?: ReadonlyArray<{ value: string; label: string }>;
  /** Options for type="multicheck". */
  checkOptions?: ReadonlyArray<{ value: string; label: string }>;
  /** String validations of the generated schema. */
  maxLength?: { value: number; message: string };
  requiredMessage?: string;
  /** Visual validator for type="url". */
  urlValidator?: (url: string) => UrlValidationState;
  /** Props for type="file". */
  file?: { folder: string; accept: string; maxSize: number; circular?: boolean };
}

export interface ArtistFormSection {
  id: string;
  title: string;
  /** Conditional section — the same rule used by rendering. */
  visibleWhen?: (values: ArtistFormValues) => boolean;
  fields: ArtistFormField[];
}

// ─── Options ─────────────────────────────────────────────────────

const MUSIC_GENRE_OPTIONS = MUSICAL_GENRE_LABELS.map((g) => ({ value: g, label: g }));

const BANCOS_OPTIONS = [
  "Banco do Brasil", "Bradesco", "Caixa Econômica", "Itaú", "Santander",
  "Nubank", "Inter", "C6 Bank", "PicPay", "Mercado Pago", "Outro",
].map((b) => ({ value: b, label: b }));

export const PROFILE_TYPE_OPTIONS = [
  { value: "independente",   label: "Independente" },
  { value: "com_empresario", label: "Com empresário" },
  { value: "gravadora",      label: "Com gravadora" },
  { value: "editora",        label: "Com editora" },
] as const;

/** Profiles that show the Distributors / Aggregators section. */
export const PROFILES_WITH_DISTRIBUTOR = ["com_empresario", "gravadora", "editora"];

export const DISTRIBUTOR_OPTIONS = [
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

// ─── THE DEFINITION ──────────────────────────────────────────────
// The array order (sections and fields) is the form's VISUAL order and
// therefore the column order of the exported file.

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
        options: MUSIC_GENRE_OPTIONS, placeholder: "Selecione o gênero", testId: "select-genero",
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
        options: PROFILE_TYPE_OPTIONS, placeholder: "Selecione o perfil", testId: "select-type-perfil",
      },
      { id: "contatosVinculados", label: "Equipe / Contatos (CRM)", type: "contatos-crm", fullWidth: true },
    ],
  },
  {
    id: "distribuidoras",
    title: "Distribuidoras / Agregadoras",
    visibleWhen: (v) => PROFILES_WITH_DISTRIBUTOR.includes(v.tipoPerfil),
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

/** Every form field, in visual order (sections walked in sequence). */
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

// ─── Validation (Zod schema GENERATED from the definition) ───────

const distributorEntrySchema = z.object({
  id: z.string(),
  email: z.string(),
  nomeCustom: z.string().optional(),
});

const linkedContactSchema = z.object({
  contactId: z.string(),
  distributors: z.array(distributorEntrySchema),
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
 * Generates the validation schema from the form definition.
 * required/maxLength come exclusively from ARTIST_FORM_SECTIONS.
 */
export function buildArtistSchema() {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of allArtistFormFields()) {
    switch (field.type) {
      case "file":
        // Uploads are validated by the widget (the definition's accept/maxSize);
        // they are not part of the react-hook-form schema.
        break;
      case "multicheck":
        shape[field.id] = z.array(z.string()).optional();
        break;
      case "contatos-crm":
        shape[field.id] = z.array(linkedContactSchema).optional();
        break;
      case "distribuidoras":
        shape[field.id] = z.array(distributorEntrySchema).optional();
        break;
      case "select":
        if (field.id === "tipoPerfil") {
          shape[field.id] = z
            .enum(PROFILE_TYPE_OPTIONS.map((o) => o.value) as [string, ...string[]])
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

// ─── Hydration (Artist → form values) ────────────────────────────
// The SAME function opens the edit modal and exports: it guarantees the
// exported cell is exactly the value the form would show.

export function artistToFormValues(artist: Artist | null | undefined): ArtistFormAllValues {
  const f = artistToFormFields(artist ?? null);

  const rawLinked = artist?.linkedContacts;
  const linkedContacts: ArtistLinkedContactValue[] = Array.isArray(rawLinked)
    ? rawLinked
        .filter((v) => typeof v?.contactId === "string" && v.contactId)
        .map((v) => ({
          contactId: v.contactId,
          distributors: Array.isArray(v.distributors) ? v.distributors : [],
        }))
    : [];

  const rawDists = artist?.generalDistributors;
  const generalDistributors: DistributorEntry[] = Array.isArray(rawDists) ? rawDists : [];

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
    distribuidorasGerais: generalDistributors,
    contatosVinculados: linkedContacts,
    fotoUrl: f.fotoUrl,
    documentosPessoaisUrl: f.documentosPessoaisUrl,
    presskitUrl: f.presskitUrl,
  };
}

// ─── Persistence (form values → Artist payload) ──────────────────

/**
 * Fields preserved in the edit round-trip that are NOT shown in the form
 * (platform metrics, legacy model, contract etc.).
 * CREATE and IMPORT use these defaults.
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
 * Extracts from an existing artist the fields preserved in the edit
 * round-trip (not shown in the form). Uses the SAME canonical hydration.
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
 * Converts the form values into the persistence payload.
 * The SAME function serves the modal submit and the import.
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

// ─── Cell codecs (per field TYPE, not per flow) ──────────────────

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

/** Exported cell value for a field — derived from the form value. */
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

/** Form value from an imported cell. */
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

// ─── Export ──────────────────────────────────────────────────────

/**
 * Export row: iterates the sections/fields IN THE FORM'S VISUAL ORDER.
 * 1 form field = exactly 1 column, with the label as the header.
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

// ─── Import ──────────────────────────────────────────────────────

/**
 * Headers accepted per field on import: the canonical label, the field id and
 * compatibility aliases for spreadsheets exported by older versions.
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
 * Converts a spreadsheet row into form values, iterating the SAME definition
 * used to render and export. Returns null when the row has no Nome Artístico
 * (invalid record).
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
