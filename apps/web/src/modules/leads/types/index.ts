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
  "musicProduction",
  "mixing",
  "mastering",
  "digitalDistribution",
  "musicMarketing",
  "musicVideo",
  "photography",
  "show",
  "eventProduction",
  "artistManagement",
  "copyrightRegistration",
  "licensing",
  "graphicDesign",
  "websiteDevelopment",
  "paidTraffic",
  "consulting",
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
  responsiblePerson?: string;
  priority?: string;
  temperature?: string;
  leadSource?: string;
  estimatedValue?: number;
  closeProbability?: number;
  nextFollowUpAt?: string;
  internalNotes?: string;
  /** Marketing campaign the lead originated from (persisted by the form). */
  marketingCampaign?: string;
};

/** Lead as the web models it (API contract: canonical English fields, CZ-033). */
export type Lead = {
  id: string;
  fullName: string;
  stageName?: string;
  company?: string;
  email?: string;
  whatsapp?: string;
  instagram?: string;
  city?: string;
  state?: string;
  country?: string;
  /** LeadStatus (workflow-managed `status` column). */
  status: string;
  clientType: LeadClientType;
  serviceType: LeadServiceType;
  servicePayload: Record<string, unknown>;
  crmInternalData: LeadInternalCRMData;
  uploads: LeadUpload[];
  createdAt: string;
  updatedAt: string;
};

export type LeadFiltersState = {
  search: string;
  serviceType: "all" | LeadServiceType;
  status: "all" | string;
  responsiblePerson: "all" | string;
  leadSource: "all" | string;
  temperature: "all" | string;
};
