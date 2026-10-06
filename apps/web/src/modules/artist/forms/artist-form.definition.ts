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
import type { Artist, ArtistProfileType, DistributorEntry } from "@/modules/artist/types/artist.types";
import {
  artistToFormFields,
  formToArtistPayload,
  SPECIALTY_LABELS,
  PROFILE_TYPE_LABELS,
  GENDER_LABELS,
  normalizeSpecialty,
  normalizeProfileType,
  normalizeGender,
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
  stageName: string;
  musicGenre: string;
  specialties: string[];
  biography: string;
  internalNotes: string;
  fullName: string;
  birthDate: string;
  taxId: string;
  rg: string;
  gender: string;
  address: string;
  phone: string;
  email: string;
  bankName: string;
  bankBranch: string;
  bankAccount: string;
  pixKey: string;
  accountHolder: string;
  spotify: string;
  instagram: string;
  youtube: string;
  tiktok: string;
  soundcloud: string;
  deezer: string;
  appleMusic: string;
  profileType: ArtistProfileType;
  generalDistributors: DistributorEntry[];
  linkedContacts: ArtistLinkedContactValue[];
}

/** File (upload) fields — shown in the form, outside react-hook-form. */
export interface ArtistFormFileValues {
  photoUrl: string;
  personalDocumentsUrl: string;
  pressKitUrl: string;
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
  | "crm-contacts"
  | "distributors";

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

const BANK_OPTIONS = [
  "Banco do Brasil", "Bradesco", "Caixa Econômica", "Itaú", "Santander",
  "Nubank", "Inter", "C6 Bank", "PicPay", "Mercado Pago", "Outro",
].map((b) => ({ value: b, label: b }));

/** Canonical values with PT-BR labels (label map: PROFILE_TYPE_LABELS). */
export const PROFILE_TYPE_OPTIONS = (Object.entries(PROFILE_TYPE_LABELS) as Array<[ArtistProfileType, string]>).map(
  ([value, label]) => ({ value, label }),
);

const GENDER_OPTIONS = Object.entries(GENDER_LABELS).map(([value, label]) => ({ value, label }));

/** Profiles that show the Distributors / Aggregators section. */
export const PROFILES_WITH_DISTRIBUTOR: readonly ArtistProfileType[] = ["managed", "record_label", "publisher"];

export const DISTRIBUTOR_OPTIONS = [
  { id: "onerpm",    label: "ONErpm" },
  { id: "distrokid", label: "DistroKid" },
  { id: "30por1",    label: "30 Por 1" },
  { id: "symphonic", label: "Symphonic" },
  { id: "musicpro",  label: "MusicPro" },
  { id: "somvibe",   label: "Somvibe" },
  { id: "other",     label: "Outros" },
] as const;

const SPECIALTY_OPTIONS = Object.entries(SPECIALTY_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const URL_MAX = { value: 300, message: "URL inválida" };

// ─── THE DEFINITION ──────────────────────────────────────────────
// The array order (sections and fields) is the form's VISUAL order and
// therefore the column order of the exported file.

export const ARTIST_FORM_SECTIONS: ArtistFormSection[] = [
  {
    id: "basic-info",
    title: "Informações Básicas",
    fields: [
      {
        id: "photoUrl", label: "Imagem do Artista", type: "file", fullWidth: true,
        file: { folder: "artists/photos", accept: "image/*", maxSize: 5, circular: true },
      },
      {
        id: "stageName", label: "Nome Artístico", type: "text", required: true,
        requiredMessage: "Nome artístico é obrigatório",
        maxLength: { value: 150, message: "Nome artístico deve ter no máximo 150 caracteres" },
        placeholder: "Nome usado profissionalmente", testId: "input-stage-name",
      },
      {
        id: "musicGenre", label: "Gênero Musical", type: "select",
        options: MUSIC_GENRE_OPTIONS, placeholder: "Selecione o gênero", testId: "select-genre",
      },
      {
        id: "specialties", label: "Especialidade / Função", type: "multicheck", fullWidth: true,
        checkOptions: SPECIALTY_OPTIONS,
      },
      {
        id: "personalDocumentsUrl", label: "Documentos Pessoais (PDF)", type: "file", fullWidth: true,
        file: { folder: "artists/documents", accept: "application/pdf", maxSize: 5 },
      },
      {
        id: "pressKitUrl", label: "Presskit / Media Kit", type: "file", fullWidth: true,
        file: { folder: "artists/presskit", accept: "application/pdf,.zip", maxSize: 10 },
      },
      {
        id: "biography", label: "Biografia", type: "textarea", fullWidth: true,
        maxLength: { value: 5000, message: "Biografia deve ter no máximo 5000 caracteres" },
        placeholder: "Trajetória, conquistas e estilo musical…", testId: "textarea-biography",
      },
    ],
  },
  {
    id: "personal-data",
    title: "Dados Pessoais",
    fields: [
      {
        id: "fullName", label: "Nome Completo", type: "text", required: true,
        requiredMessage: "Nome completo é obrigatório",
        maxLength: { value: 150, message: "Nome completo deve ter no máximo 150 caracteres" },
        placeholder: "Nome conforme documento", testId: "input-legal-name",
      },
      { id: "birthDate", label: "Data de Nascimento", type: "date", testId: "datepicker-birth-date" },
      {
        id: "taxId", label: "CPF", type: "text",
        maxLength: { value: 20, message: "CPF/CNPJ inválido" },
        placeholder: "000.000.000-00", testId: "input-cpf-cnpj",
      },
      {
        id: "rg", label: "RG", type: "text",
        maxLength: { value: 20, message: "RG inválido" },
        placeholder: "00.000.000-0", testId: "input-rg",
      },
      {
        id: "gender", label: "Gênero", type: "select", testId: "select-person-gender",
        options: GENDER_OPTIONS,
        placeholder: "Selecione o gênero",
      },
      {
        id: "address", label: "Endereço Completo", type: "text",
        maxLength: { value: 300, message: "Endereço deve ter no máximo 300 caracteres" },
        placeholder: "Rua, número, bairro, cidade, CEP", testId: "input-address",
      },
      {
        id: "phone", label: "Telefone", type: "tel",
        maxLength: { value: 20, message: "Telefone inválido" },
        placeholder: "(11) 99999-9999", testId: "input-phone",
      },
      {
        id: "email", label: "E-mail", type: "email",
        maxLength: { value: 100, message: "Email deve ter no máximo 100 caracteres" },
        placeholder: "email@exemplo.com", testId: "input-email",
      },
    ],
  },
  {
    id: "bank-details",
    title: "Dados Bancários",
    fields: [
      { id: "bankName", label: "Banco", type: "select", options: BANK_OPTIONS, placeholder: "Selecione o banco" },
      { id: "bankBranch", label: "Agência", type: "text", placeholder: "0000" },
      { id: "bankAccount", label: "Conta com Dígito", type: "text", placeholder: "00000-0" },
      {
        id: "pixKey", label: "Chave Pix", type: "text",
        maxLength: { value: 150, message: "Chave PIX inválida" },
        placeholder: "CPF, e-mail, telefone ou chave aleatória",
      },
      {
        id: "accountHolder", label: "Titular da Conta", type: "text",
        maxLength: { value: 150, message: "Nome do titular inválido" },
        placeholder: "Nome completo do titular",
      },
    ],
  },
  {
    id: "social-profiles",
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
    id: "profile-type",
    title: "Tipo de Perfil",
    fields: [
      {
        id: "profileType", label: "Perfil Comercial", type: "select", fullWidth: true,
        options: PROFILE_TYPE_OPTIONS, placeholder: "Selecione o perfil", testId: "select-profile-type",
      },
      { id: "linkedContacts", label: "Equipe / Contatos (CRM)", type: "crm-contacts", fullWidth: true },
    ],
  },
  {
    id: "distributors",
    title: "Distribuidoras / Agregadoras",
    visibleWhen: (v) => PROFILES_WITH_DISTRIBUTOR.includes(v.profileType),
    fields: [
      { id: "generalDistributors", label: "Distribuidoras / Agregadoras", type: "distributors", fullWidth: true },
    ],
  },
  {
    id: "notes",
    title: "Observações",
    fields: [
      {
        id: "internalNotes", label: "Notas Internas", type: "textarea", fullWidth: true,
        maxLength: { value: 5000, message: "Notas devem ter no máximo 5000 caracteres" },
        placeholder: "Notas internas, rider técnico, preferências, informações adicionais…",
        testId: "textarea-notes",
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
    stageName: "", musicGenre: "", specialties: [], biography: "", internalNotes: "",
    fullName: "", birthDate: "", taxId: "", rg: "", gender: "", address: "", phone: "", email: "",
    bankName: "", bankBranch: "", bankAccount: "", pixKey: "", accountHolder: "",
    spotify: "", instagram: "", youtube: "", tiktok: "", soundcloud: "", deezer: "", appleMusic: "",
    profileType: "independent", generalDistributors: [], linkedContacts: [],
  };
}

// ─── Validation (Zod schema GENERATED from the definition) ───────

const distributorEntrySchema = z.object({
  id: z.string(),
  email: z.string(),
  customName: z.string().optional(),
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
      case "crm-contacts":
        shape[field.id] = z.array(linkedContactSchema).optional();
        break;
      case "distributors":
        shape[field.id] = z.array(distributorEntrySchema).optional();
        break;
      case "select":
        if (field.id === "profileType") {
          shape[field.id] = z
            .enum(PROFILE_TYPE_OPTIONS.map((o) => o.value) as [string, ...string[]])
            .default("independent");
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
    stageName: f.stageName,
    musicGenre: f.musicGenre,
    specialties: f.specialties,
    biography: f.biography,
    internalNotes: f.internalNotes,
    fullName: f.fullName,
    birthDate: f.birthDate,
    taxId: f.taxId,
    rg: f.rg,
    gender: typeof artist?.gender === "string" ? artist.gender : "",
    address: f.address,
    phone: f.phone,
    email: f.email,
    bankName: f.bankName,
    bankBranch: f.bankBranch,
    bankAccount: f.bankAccount,
    pixKey: f.pixKey,
    accountHolder: f.accountHolder,
    spotify: f.spotify,
    instagram: f.instagram,
    youtube: f.youtube,
    tiktok: f.tiktok,
    soundcloud: f.soundcloud,
    deezer: f.deezer,
    appleMusic: f.appleMusic,
    profileType: f.profileType,
    generalDistributors,
    linkedContacts,
    photoUrl: f.photoUrl,
    personalDocumentsUrl: f.personalDocumentsUrl,
    pressKitUrl: f.pressKitUrl,
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
    artistSlug: "", musicTags: [], careerStage: "",
    artistStatus: "signed",
    spotifyListeners: "", instagramFollowers: "", youtubeSubscribers: "",
    tiktokFollowers: "", soundcloudFollowers: "", deezerFans: "", appleMusicAlbums: "",
    relationships: [],
    agentId: "", agentName: "", agentPhone: "", agentEmail: "",
    recordLabelId: "", recordLabelName: "", recordLabelPhone: "", recordLabelEmail: "",
    recordLabelContactId: "", recordLabelContactName: "",
    recordLabelContactPhone: "", recordLabelContactEmail: "",
    selectedDistributors: {}, distributorEmails: {},
    companySelectedDistributors: {}, companyDistributorEmails: {},
    contractId: "",
  };
}

/**
 * Extracts from an existing artist the fields preserved in the edit
 * round-trip (not shown in the form). Uses the SAME canonical hydration.
 */
export function artistToPreservedInput(artist: Artist | null | undefined): ArtistPreservedInput {
  const f = artistToFormFields(artist ?? null);
  return {
    artistSlug: f.artistSlug,
    musicTags: f.musicTags,
    careerStage: f.careerStage,
    artistStatus: f.artistStatus,
    spotifyListeners: f.spotifyListeners,
    instagramFollowers: f.instagramFollowers,
    youtubeSubscribers: f.youtubeSubscribers,
    tiktokFollowers: f.tiktokFollowers,
    soundcloudFollowers: f.soundcloudFollowers,
    deezerFans: f.deezerFans,
    appleMusicAlbums: f.appleMusicAlbums,
    relationships: f.relationships,
    agentId: f.agentId,
    agentName: f.agentName,
    agentPhone: f.agentPhone,
    agentEmail: f.agentEmail,
    recordLabelId: f.recordLabelId,
    recordLabelName: f.recordLabelName,
    recordLabelPhone: f.recordLabelPhone,
    recordLabelEmail: f.recordLabelEmail,
    recordLabelContactId: f.recordLabelContactId,
    recordLabelContactName: f.recordLabelContactName,
    recordLabelContactPhone: f.recordLabelContactPhone,
    recordLabelContactEmail: f.recordLabelContactEmail,
    selectedDistributors: f.selectedDistributors,
    distributorEmails: f.distributorEmails,
    companySelectedDistributors: f.companySelectedDistributors,
    companyDistributorEmails: f.companyDistributorEmails,
    contractId: f.contractId,
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
    stageName: values.stageName,
    musicGenre: values.musicGenre,
    specialties: values.specialties,
    biography: values.biography,
    internalNotes: values.internalNotes,
    fullName: values.fullName,
    birthDate: values.birthDate,
    taxId: values.taxId,
    rg: values.rg,
    address: values.address,
    phone: values.phone,
    email: values.email,
    bankName: values.bankName,
    bankBranch: values.bankBranch,
    bankAccount: values.bankAccount,
    pixKey: values.pixKey,
    accountHolder: values.accountHolder,
    spotify: values.spotify,
    instagram: values.instagram,
    youtube: values.youtube,
    tiktok: values.tiktok,
    soundcloud: values.soundcloud,
    deezer: values.deezer,
    appleMusic: values.appleMusic,
    profileType: values.profileType,
    photoUrl: values.photoUrl,
    personalDocumentsUrl: values.personalDocumentsUrl,
    pressKitUrl: values.pressKitUrl,
  };

  return {
    ...formToArtistPayload(input),
    gender: values.gender || null,
    linkedContacts: values.linkedContacts.length > 0 ? values.linkedContacts : null,
    generalDistributors: values.generalDistributors.length > 0 ? values.generalDistributors : null,
  };
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
      // Export PT-BR labels (import maps them back); an unknown stored value is
      // dropped instead of leaking a raw identifier into the user's file.
      const arr = Array.isArray(v) ? (v as string[]) : [];
      return arr
        .filter((e): e is keyof typeof SPECIALTY_LABELS => Object.prototype.hasOwnProperty.call(SPECIALTY_LABELS, e))
        .map((e) => SPECIALTY_LABELS[e])
        .join(", ");
    }
    case "select": {
      // Enum-valued selects export the PT-BR option label, never the raw value.
      const s = v == null ? "" : String(v);
      return field.options?.find((o) => o.value === s)?.label ?? s;
    }
    case "crm-contacts":
    case "distributors":
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
    case "crm-contacts":
      return parseJsonArray<ArtistLinkedContactValue>(
        s,
        (item) => typeof (item as { contactId?: unknown })?.contactId === "string",
      );
    case "distributors":
      return parseJsonArray<DistributorEntry>(
        s,
        (item) => typeof (item as { id?: unknown })?.id === "string",
      );
    case "select":
      if (field.id === "profileType") return normalizeProfileType(s);
      if (field.id === "gender") return normalizeGender(s);
      return field.options?.find((o) => o.label === s)?.value ?? s;
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
 * compatibility aliases for spreadsheets exported by older versions (user
 * files, not the API wire).
 */
const IMPORT_HEADER_ALIASES: Partial<Record<keyof ArtistFormAllValues, string[]>> = {
  photoUrl:             ["Foto URL"],
  stageName:            ["Nome", "nome_artistico"],
  musicGenre:           ["Genero Musical", "genero_musical"],
  specialties:          ["Função", "Funcao", "Especialidades"],
  personalDocumentsUrl: ["documentos_pessoais_url"],
  pressKitUrl:          ["Presskit / Media Kit (PDF)", "presskit_url"],
  biography:            ["observacoes"],
  fullName:             ["Nome Civil", "nome_civil"],
  birthDate:            ["data_nascimento"],
  taxId:                ["CPF/CNPJ", "cpf_cnpj"],
  address:              ["Endereço completo", "Endereco"],
  email:                ["Email"],
  spotify:              ["Spotify URL"],
  instagram:            ["Instagram URL"],
  youtube:              ["YouTube URL"],
  tiktok:               ["TikTok URL"],
  soundcloud:           ["SoundCloud URL", "soundcloud_url"],
  appleMusic:           ["Apple Music URL", "apple_music_url"],
  deezer:               ["Deezer URL", "deezer_url"],
  profileType:          ["Tipo de Perfil", "tipo_perfil", "Perfil"],
  internalNotes:        ["Observações", "Observacoes", "notas_internas"],
};

/**
 * Converts a spreadsheet row into form values, iterating the SAME definition
 * used to render and export. Returns null when the row has no Nome Artístico
 * (invalid record).
 */
export function parseArtistImportRow(row: Record<string, unknown>): ArtistFormAllValues | null {
  const values: ArtistFormAllValues = { ...emptyArtistFormValues(), photoUrl: "", personalDocumentsUrl: "", pressKitUrl: "" };

  for (const field of allArtistFormFields()) {
    const headers = [field.label, field.id, ...(IMPORT_HEADER_ALIASES[field.id] ?? [])];
    const raw = pickRow(row, ...headers);
    if (raw === undefined) continue;
    (values as unknown as Record<string, unknown>)[field.id] = deserializeArtistFieldValue(field, raw);
  }

  if (!values.stageName.trim()) return null;
  return values;
}
