import { z } from "zod";
import type { ContactType } from "../types";

export type ContactSchemaKey =
  | "supplier"
  | "partner"
  | "serviceProvider"
  | "company"
  | "agency"
  | "media"
  | "press"
  | "influencer"
  | "venue"
  | "event"
  | "brand"
  | "sponsor"
  | "technician"
  | "videomaker"
  | "photographer"
  | "designer"
  | "corporateClient"
  | "other";

export type ContactDynamicFieldType = "text" | "number" | "date" | "textarea" | "select" | "url";

export type ContactDynamicFieldSchema = {
  name: string;
  type: ContactDynamicFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  validation?: z.ZodTypeAny;
  masks?: "phone" | "document" | "url";
  visibility?: "always" | "conditional";
};

export type ContactTypeSchema = {
  sections: string[];
  fields: ContactDynamicFieldSchema[];
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

const text = z.string().trim().optional();
const number = z.coerce.number().min(0).optional();
const url = z.string().url("URL inválida").optional().or(z.literal(""));

function createContactTypeSchema(
  fields: ContactDynamicFieldSchema[],
  required: string[] = [],
): ContactTypeSchema {
  const shape = fields.reduce<Record<string, z.ZodTypeAny>>((acc, field) => {
    const base = field.validation ?? (field.type === "number" ? number : field.type === "url" ? url : text);
    acc[field.name] = required.includes(field.name)
      ? base.refine((value) => value !== undefined && value !== "", "Obrigatório")
      : base;
    return acc;
  }, {});

  return {
    sections: ["classificacao", "operacional", "relacionamento"],
    fields,
    validation: z.object(shape),
    required,
    conditionalRules: [],
    masks: Object.fromEntries(fields.flatMap((field) => (field.masks ? [[field.name, field.masks]] : []))),
    uploadRules: {
      maxFiles: 20,
      allowedTypes: ["application/pdf", "image/png", "image/jpeg", "image/webp", "video/mp4", "video/quicktime"],
    },
    visibility: Object.fromEntries(fields.map((field) => [field.name, true])),
    labels: Object.fromEntries(fields.map((field) => [field.name, field.label])),
    placeholders: Object.fromEntries(fields.map((field) => [field.name, field.placeholder ?? ""])),
  };
}

export const contactTypeSchemas: Record<ContactSchemaKey, ContactTypeSchema> = {
  supplier: createContactTypeSchema([
    { name: "category", type: "text", label: "Categoria", placeholder: "Backline, transporte, alimentação" },
    { name: "paymentTerms", type: "textarea", label: "Condições comerciais" },
  ]),
  partner: createContactTypeSchema([
    { name: "partnershipScope", type: "textarea", label: "Escopo da parceria", required: true },
    { name: "strategicValue", type: "textarea", label: "Valor estratégico" },
  ], ["partnershipScope"]),
  serviceProvider: createContactTypeSchema([
    { name: "serviceArea", type: "text", label: "Área de serviço", required: true },
    { name: "availability", type: "text", label: "Disponibilidade" },
  ], ["serviceArea"]),
  company: createContactTypeSchema([
    { name: "industry", type: "text", label: "Segmento" },
    { name: "companySize", type: "text", label: "Porte" },
  ]),
  agency: createContactTypeSchema([
    { name: "specialty", type: "text", label: "Especialidade" },
    { name: "portfolioUrl", type: "url", label: "Portfólio", masks: "url" },
  ]),
  media: createContactTypeSchema([
    { name: "mediaChannel", type: "text", label: "Canal" },
    { name: "audienceReach", type: "number", label: "Alcance estimado" },
  ]),
  press: createContactTypeSchema([
    { name: "editorialBeat", type: "text", label: "Editoria" },
    { name: "deadlinePreference", type: "text", label: "Preferência de prazo" },
  ]),
  influencer: createContactTypeSchema([
    { name: "audience", type: "number", label: "Audiência" },
    { name: "mainPlatform", type: "select", label: "Plataforma principal", options: [
      { value: "instagram", label: "Instagram" },
      { value: "tiktok", label: "TikTok" },
      { value: "youtube", label: "YouTube" },
    ] },
  ]),
  venue: createContactTypeSchema([
    { name: "capacity", type: "number", label: "Capacidade" },
    { name: "technicalSpecs", type: "textarea", label: "Especificações técnicas" },
  ]),
  event: createContactTypeSchema([
    { name: "eventFormat", type: "text", label: "Formato do evento" },
    { name: "recurrence", type: "text", label: "Recorrência" },
  ]),
  brand: createContactTypeSchema([
    { name: "brandCategory", type: "text", label: "Categoria da marca" },
    { name: "activationInterest", type: "textarea", label: "Interesse de ativação" },
  ]),
  sponsor: createContactTypeSchema([
    { name: "sponsorshipTier", type: "text", label: "Cota potencial" },
    { name: "budgetRange", type: "text", label: "Faixa de investimento" },
  ]),
  technician: createContactTypeSchema([
    { name: "technicalRole", type: "text", label: "Função técnica", required: true },
    { name: "certifications", type: "textarea", label: "Certificações" },
  ], ["technicalRole"]),
  videomaker: createContactTypeSchema([
    { name: "portfolio", type: "url", label: "Portfólio", masks: "url" },
    { name: "equipment", type: "textarea", label: "Equipamentos" },
  ]),
  photographer: createContactTypeSchema([
    { name: "portfolio", type: "url", label: "Portfólio", masks: "url" },
    { name: "coverageStyle", type: "text", label: "Estilo de cobertura" },
  ]),
  designer: createContactTypeSchema([
    { name: "designFocus", type: "text", label: "Foco de design" },
    { name: "portfolio", type: "url", label: "Portfólio", masks: "url" },
  ]),
  corporateClient: createContactTypeSchema([
    { name: "decisionMaker", type: "text", label: "Decisor" },
    { name: "buyingProcess", type: "textarea", label: "Processo de compra" },
  ]),
  other: createContactTypeSchema([
    { name: "description", type: "textarea", label: "Descrição operacional", required: true },
  ], ["description"]),
};

export function schemaKey(type: ContactType): ContactSchemaKey {
  // Only the core relationship types have a dedicated operational schema; the
  // extended role catalogue (specialists, technicians, etc.) falls back to "other".
  const keys: Partial<Record<ContactType, ContactSchemaKey>> = {
    SUPPLIER: "supplier",
    PARTNER: "partner",
    SERVICE_PROVIDER: "serviceProvider",
    COMPANY: "company",
    AGENCY: "agency",
    MEDIA: "media",
    PRESS: "press",
    INFLUENCER: "influencer",
    VENUE: "venue",
    EVENT: "event",
    BRAND: "brand",
    SPONSOR: "sponsor",
    TECHNICIAN: "technician",
    VIDEOMAKER: "videomaker",
    PHOTOGRAPHER: "photographer",
    DESIGNER: "designer",
    CORPORATE_CLIENT: "corporateClient",
    OTHER: "other",
  };
  return keys[type] ?? "other";
}

export const contactValidationSchema = z.object({
  name: z.string().trim().min(2, "Informe o nome"),
  companyName: z.string().optional(),
  contactType: z.string().min(1),
  documentType: z.string().optional(),
  documentNumber: z.string().optional(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  email: z.string().email("E-mail inválido").optional().or(z.literal("")),
  instagram: z.string().optional(),
  website: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  zipCode: z.string().optional(),
  responsible: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()),
  status: z.string(),
  priority: z.string(),
  linkedArtistId: z.string().optional(),
  payloadOperacional: z.record(z.unknown()),
});

