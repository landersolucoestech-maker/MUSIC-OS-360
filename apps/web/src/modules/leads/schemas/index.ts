import { z } from "zod";
import type { LeadServiceType } from "../types";

export type DynamicFieldType = "text" | "number" | "date" | "textarea" | "select" | "money" | "url";

export type LeadBaseFieldName =
  | "nomeCompleto"
  | "nomeArtistico"
  | "empresa"
  | "email"
  | "whatsapp"
  | "instagram"
  | "cidade"
  | "estado"
  | "pais"
  | "tipoCliente";

export type DynamicFieldSchema = {
  name: string;
  type: DynamicFieldType;
  label: string;
  section: string;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  validation?: z.ZodTypeAny;
  masks?: "currency" | "phone" | "date";
  visibility?: "always" | "conditional";
};

export type ServiceLeadSchema = {
  sections: string[];
  baseFields: LeadBaseFieldName[];
  fields: DynamicFieldSchema[];
  validation: z.ZodObject<Record<string, z.ZodTypeAny>>;
  required: string[];
  conditionalRules: Array<{ field: string; when: string; show: string[] }>;
  masks: Record<string, string>;
  uploadRules: {
    required?: boolean;
    maxFiles: number;
    allowedTypes: string[];
  };
  visibility: Record<string, boolean>;
  labels: Record<string, string>;
  placeholders: Record<string, string>;
};

const universalBaseFields: LeadBaseFieldName[] = ["nomeCompleto", "email", "whatsapp", "instagram", "pais", "tipoCliente"];
const artisticBaseFields: LeadBaseFieldName[] = [...universalBaseFields, "nomeArtistico", "cidade", "estado"];
const companyBaseFields: LeadBaseFieldName[] = [...universalBaseFields, "empresa", "cidade", "estado"];
const eventBaseFields: LeadBaseFieldName[] = [...universalBaseFields, "nomeArtistico", "empresa", "cidade", "estado"];

const optionalText = z.string().trim().optional();
const optionalDate = z.string().optional();
const optionalNumber = z.coerce.number().min(0).optional();
const optionalUrl = z.string().trim().url("Informe uma URL válida").optional().or(z.literal(""));

const sectionLabels = {
  briefing: "Briefing",
  escopo: "Escopo",
  comercial: "Comercial",
  evento: "Evento",
  contratante: "Contratante",
  digital: "Digital",
  entrega: "Entrega",
};

function requiredMessage(field: DynamicFieldSchema) {
  return `${field.label} e obrigatorio`;
}

function schema(config: {
  baseFields: LeadBaseFieldName[];
  fields: DynamicFieldSchema[];
  required?: string[];
  sections?: string[];
}): ServiceLeadSchema {
  const required = config.required ?? config.fields.filter((field) => field.required).map((field) => field.name);
  const sections = config.sections ?? Array.from(new Set(config.fields.map((field) => field.section)));

  const shape = config.fields.reduce<Record<string, z.ZodTypeAny>>((acc, field) => {
    const fallback =
      field.type === "number" || field.type === "money"
        ? optionalNumber
        : field.type === "date"
          ? optionalDate
          : field.type === "url"
            ? optionalUrl
            : optionalText;

    const base = field.validation ?? fallback;
    acc[field.name] = required.includes(field.name)
      ? base.refine((value) => value !== undefined && value !== null && value !== "", requiredMessage(field))
      : base;
    return acc;
  }, {});

  return {
    sections,
    baseFields: config.baseFields,
    fields: config.fields,
    validation: z.object(shape),
    required,
    conditionalRules: [],
    masks: Object.fromEntries(config.fields.flatMap((field) => (field.masks ? [[field.name, field.masks]] : []))),
    uploadRules: { maxFiles: 12, allowedTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp", "video/mp4"] },
    visibility: Object.fromEntries(config.fields.map((field) => [field.name, true])),
    labels: Object.fromEntries(config.fields.map((field) => [field.name, field.label])),
    placeholders: Object.fromEntries(config.fields.map((field) => [field.name, field.placeholder ?? ""])),
  };
}

function field(name: string, type: DynamicFieldType, label: string, section: string, options: Partial<DynamicFieldSchema> = {}): DynamicFieldSchema {
  return { name, type, label, section, ...options };
}

const musicProjectFields = [
  field("objetivo", "textarea", "Objetivo do projeto", "briefing", { required: true, placeholder: "Descreva o resultado musical esperado" }),
  field("referencias", "textarea", "Referências", "briefing", { placeholder: "Links, artistas, sonoridades ou campanhas de referência" }),
  field("prazoDesejado", "date", "Prazo desejado", "comercial"),
  field("orcamento", "money", "Orcamento estimado", "comercial", { masks: "currency" }),
] satisfies DynamicFieldSchema[];

const digitalProjectFields = [
  field("objetivoProjeto", "textarea", "Objetivo do projeto", "briefing", { required: true, placeholder: "Meta comercial, lançamento ou comunicação" }),
  field("redesSociais", "textarea", "Redes sociais", "digital", { placeholder: "Instagram, TikTok, YouTube, Spotify ou outros links" }),
  field("website", "url", "Website", "digital", { placeholder: "https://..." }),
  field("prazoProjeto", "date", "Prazo do projeto", "entrega"),
  field("orcamento", "money", "Orcamento", "comercial", { masks: "currency" }),
] satisfies DynamicFieldSchema[];

const eventFields = [
  field("artistaInteressado", "text", "Artista interessado", "evento", { required: true, placeholder: "Artista, banda ou projeto desejado" }),
  field("dataEvento", "date", "Data do evento", "evento", { required: true }),
  field("cidadeEvento", "text", "Cidade", "evento", { placeholder: "Cidade do evento" }),
  field("estadoEvento", "text", "Estado", "evento", { placeholder: "UF" }),
  field("localEvento", "text", "Local do evento", "evento", { placeholder: "Casa, festival, teatro, corporativo..." }),
  field("orcamento", "money", "Orcamento", "comercial", { masks: "currency" }),
  field("capacidadePublico", "number", "Capacidade de público", "evento"),
  field("informacoesContratante", "textarea", "Informações do contratante", "contratante", { placeholder: "Empresa, responsável, contexto e decisores" }),
] satisfies DynamicFieldSchema[];

export function sectionLabel(section: string) {
  return sectionLabels[section as keyof typeof sectionLabels] ?? section;
}

export const serviceLeadSchemas: Record<LeadServiceType, ServiceLeadSchema> = {
  producaoMusical: schema({
    baseFields: artisticBaseFields,
    fields: [
      ...musicProjectFields,
      field("formatoLancamento", "select", "Formato", "escopo", {
        options: [{ value: "single", label: "Single" }, { value: "ep", label: "EP" }, { value: "album", label: "Album" }],
      }),
      field("quantidadeFaixas", "number", "Quantidade de faixas", "escopo"),
    ],
  }),
  mixagem: schema({
    baseFields: artisticBaseFields,
    fields: [...musicProjectFields, field("quantidadeFaixas", "number", "Quantidade de faixas", "escopo", { required: true })],
  }),
  masterizacao: schema({
    baseFields: artisticBaseFields,
    fields: [...musicProjectFields, field("quantidadeFaixas", "number", "Quantidade de masters", "escopo", { required: true })],
  }),
  distribuicaoDigital: schema({
    baseFields: artisticBaseFields,
    fields: [...musicProjectFields, field("dataLancamento", "date", "Data de lançamento", "escopo")],
  }),
  marketingMusical: schema({
    baseFields: companyBaseFields,
    fields: [
      ...digitalProjectFields,
      field("canalPrioritario", "select", "Canal prioritario", "digital", {
        options: [{ value: "instagram", label: "Instagram" }, { value: "tiktok", label: "TikTok" }, { value: "youtube", label: "YouTube" }, { value: "spotify", label: "Spotify" }],
      }),
    ],
  }),
  videoclipe: schema({
    baseFields: artisticBaseFields,
    fields: [...musicProjectFields, field("locacao", "text", "Locação prevista", "escopo"), field("diarias", "number", "Diarias", "comercial")],
  }),
  fotografia: schema({
    baseFields: eventBaseFields,
    fields: [...musicProjectFields, field("tipoEnsaio", "text", "Tipo de ensaio", "escopo"), field("localSessao", "text", "Local da sessão", "escopo")],
  }),
  show: schema({
    baseFields: eventBaseFields,
    fields: eventFields,
  }),
  producaoEvento: schema({
    baseFields: eventBaseFields,
    fields: [
      ...eventFields.filter((item) => item.name !== "artistaInteressado"),
      field("tipoEvento", "text", "Tipo de evento", "evento", { required: true }),
    ],
  }),
  gestaoArtistica: schema({
    baseFields: artisticBaseFields,
    fields: [
      field("artistaInteressado", "text", "Artista interessado", "briefing", { required: true }),
      field("faseCarreira", "text", "Fase da carreira", "briefing"),
      field("objetivoGestao", "textarea", "Objetivo da gestão", "escopo", { required: true }),
      field("prazoDesejado", "date", "Prazo desejado", "comercial"),
      field("orcamento", "money", "Orcamento", "comercial", { masks: "currency" }),
    ],
  }),
  registroAutoral: schema({
    baseFields: artisticBaseFields,
    fields: [...musicProjectFields, field("quantidadeObras", "number", "Quantidade de obras", "escopo")],
  }),
  licenciamento: schema({
    baseFields: companyBaseFields,
    fields: [...musicProjectFields, field("territorio", "text", "Territorio", "escopo"), field("prazoUso", "text", "Prazo de uso", "comercial")],
  }),
  designGrafico: schema({
    baseFields: companyBaseFields,
    fields: [...digitalProjectFields, field("pecas", "textarea", "Pecas necessarias", "escopo")],
  }),
  desenvolvimentoSite: schema({
    baseFields: companyBaseFields,
    fields: [...digitalProjectFields, field("tipoSite", "text", "Tipo de site", "escopo")],
  }),
  trafegoPago: schema({
    baseFields: companyBaseFields,
    fields: [...digitalProjectFields, field("verbaMidia", "money", "Verba de mídia", "comercial", { masks: "currency" })],
  }),
  consultoria: schema({
    baseFields: companyBaseFields,
    fields: [...digitalProjectFields, field("temaConsultoria", "text", "Tema da consultoria", "briefing", { required: true })],
  }),
};

// register(..., { valueAsNumber: true }) produz NaN quando o campo numérico é
// limpo no DOM — trata como "não informado" em vez de erro de validação.
const nanAsUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => (typeof value === "number" && Number.isNaN(value) ? undefined : value), schema);

const leadBaseValidationSchema = z.object({
  nomeCompleto: z.string().trim().min(2, "Informe o nome completo"),
  nomeArtistico: z.string().trim().optional(),
  empresa: z.string().trim().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  whatsapp: z.string().trim().optional(),
  instagram: z.string().trim().optional(),
  cidade: z.string().trim().optional(),
  estado: z.string().trim().optional(),
  pais: z.string().trim().optional(),
  tipoCliente: z.string().min(1, "Selecione o tipo de cliente"),
  tipoServico: z.string().min(1, "Selecione o tipo de serviço"),
  payloadServico: z.record(z.unknown()),
  dadosInternosCRM: z
    .object({
      statusLead: z.string().min(1),
      responsavel: z.string().optional(),
      prioridade: z.string().optional(),
      temperatura: z.string().optional(),
      origemLead: z.string().optional(),
      valorEstimado: nanAsUndefined(z.coerce.number().min(0).optional()),
      probabilidadeFechamento: nanAsUndefined(z.coerce.number().min(0).max(100).optional()),
      proximoFollowUp: z.string().optional(),
      observacoesInternas: z.string().optional(),
    })
    .strict(),
}).strict();

export const leadValidationSchema = leadBaseValidationSchema.superRefine((values, context) => {
  const serviceSchema = serviceLeadSchemas[values.tipoServico as LeadServiceType];
  if (!serviceSchema) return;

  const result = serviceSchema.validation.safeParse(values.payloadServico ?? {});
  if (!result.success) {
    result.error.issues.forEach((issue) => {
      context.addIssue({
        ...issue,
        path: ["payloadServico", ...issue.path],
      });
    });
  }
});

