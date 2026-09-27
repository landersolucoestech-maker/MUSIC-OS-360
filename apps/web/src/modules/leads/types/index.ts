export const leadClientTypes = [
  "artist",
  "label",
  "company",
  "agency",
  "eventProducer",
  "venue",
  "brand",
  "creator",
  "other",
] as const;

export type LeadClientType = (typeof leadClientTypes)[number];

export const leadServiceTypes = [
  "producaoMusical",
  "mixagem",
  "masterizacao",
  "distribuicaoDigital",
  "marketingMusical",
  "videoclipe",
  "fotografia",
  "show",
  "producaoEvento",
  "gestaoArtistica",
  "registroAutoral",
  "licenciamento",
  "designGrafico",
  "desenvolvimentoSite",
  "trafegoPago",
  "consultoria",
] as const;

export type LeadServiceType = (typeof leadServiceTypes)[number];

export type LeadUpload = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  extension: string;
  url?: string;
  uploadedAt: string;
};

export type LeadInteraction = {
  id: string;
  type: "meeting" | "email" | "whatsapp" | "followUp" | "proposal" | "contract" | "note";
  description: string;
  occurredAt: string;
  actor?: string;
};

export type LeadInternalCRMData = {
  statusLead: string;
  responsavel?: string;
  prioridade?: string;
  temperatura?: string;
  origemLead?: string;
  valorEstimado?: number;
  probabilidadeFechamento?: number;
  proximoFollowUp?: string;
  observacoesInternas?: string;
  /** Marketing campaign the lead originated from (persisted by the form). */
  campanha_marketing?: string;
};

export type Lead = {
  id: string;
  nomeCompleto: string;
  nomeArtistico?: string;
  empresa?: string;
  email?: string;
  whatsapp?: string;
  instagram?: string;
  city?: string;
  state?: string;
  country?: string;
  clientType: LeadClientType;
  serviceType: LeadServiceType;
  payloadServico: Record<string, unknown>;
  dadosInternosCRM: LeadInternalCRMData;
  uploads: LeadUpload[];
  historicoInteracoes: LeadInteraction[];
  createdAt: string;
  updatedAt: string;
};

export type LeadFiltersState = {
  search: string;
  serviceType: "all" | LeadServiceType;
  statusLead: "all" | string;
  responsavel: "all" | string;
  origemLead: "all" | string;
  temperatura: "all" | string;
};
