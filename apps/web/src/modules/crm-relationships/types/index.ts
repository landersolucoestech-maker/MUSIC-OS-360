// Source of truth for contact roles. Kept in sync with the option lists in
// ../constants/index.ts (individual + company role catalogues). Widened from the
// original 18-value stub to the full role catalogue actually referenced by the
// constants — the previous narrow union was the root cause of ~90 TS2322 errors.
export const contactTypes = [
  "A_AND_R",
  "ADVERTISING_AGENCY",
  "AGENCY",
  "ANNOUNCER",
  "ARRANGER",
  "ARTISTIC_COACH",
  "ARTIST_AGENT",
  "ARTIST_BAND",
  "ARTIST_MANAGEMENT",
  "ARTIST_MANAGER",
  "ART_COLLECTIVE",
  "ART_CONSULTANT",
  "ART_DIRECTOR",
  "ART_PRODUCER",
  "AUDIOVISUAL_PRODUCER",
  "AUDIOVISUAL_PRODUCTION_COMPANY",
  "AUDIO_ENGINEER",
  "AUDIO_TECHNICIAN",
  "BEATMAKER",
  "BLOG_PORTAL",
  "BOOKING_AGENCY",
  "BRANDING_SPECIALIST",
  "BRAND",
  "BRAND_COMPANY",
  "BRAND_CONSULTANT",
  "CHOREOGRAPHER",
  "COLLECTIVE_MANAGEMENT_ORGANIZATION",
  "COMMERCIAL_AGENT",
  "COMMERCIAL_EXECUTIVE",
  "COMPANY",
  "CONTRACTOR",
  "COPYRIGHT_SPECIALIST",
  "CORPORATE_CLIENT",
  "CULTURAL_PRODUCER",
  "DESIGNER",
  "DEVELOPER",
  "DIGITAL_DISTRIBUTOR",
  "DIGITAL_PLATFORM",
  "DIGITAL_STRATEGIST",
  "DIRECTOR_OF_PHOTOGRAPHY",
  "DISTRIBUTION_SPECIALIST",
  "DRONE_OPERATOR",
  "EQUIPMENT_RENTAL",
  "EVENT",
  "EVENT_FESTIVAL",
  "EVENT_PLANNER",
  "EVENT_PRODUCER",
  "EXECUTIVE_DIRECTOR",
  "EXECUTIVE_PRODUCER",
  "FAN_CLUB",
  "FOUNDER",
  "GROWTH_SPECIALIST",
  "HAIRSTYLIST",
  "INFLUENCER",
  "INFLUENCER_AGENCY",
  "INVESTOR",
  "JOURNALIST",
  "LABEL_RECORD",
  "LAWYER",
  "LED_TECHNICIAN",
  "LICENSING_AGENT",
  "LICENSING_SYNC_SPECIALIST",
  "LIGHTING_TECHNICIAN",
  "MARKETING_AGENCY",
  "MARKETING_DIRECTOR",
  "MEDIA",
  "MEDIA_BUYER",
  "MEDIA_PLANNER",
  "MENTOR",
  "METADATA_SPECIALIST",
  "MIX_MASTER_ENGINEER",
  "MODEL_AGENCY",
  "MONITOR_TECHNICIAN",
  "MUSIC_MARKETING_SPECIALIST",
  "MUSIC_PRODUCER",
  "MUSIC_PUBLISHER",
  "MUSIC_SUPERVISOR",
  "OTHER",
  "PAID_TRAFFIC_SPECIALIST",
  "PARTNER",
  "PA_TECHNICIAN",
  "PHOTOGRAPHER",
  "PITCHING_SPECIALIST",
  "PLAYLIST_CURATOR",
  "PODCAST",
  "PRESS_OFFICE",
  "PRESS",
  "PR_AGENCY",
  "PUBLIC_RELATIONS",
  "RADIO_TV",
  "SCREENWRITER",
  "SERVICE_PROVIDER",
  "SOCIAL_MEDIA",
  "SONGWRITER",
  "SPONSOR",
  "STAGE_DIRECTOR",
  "STAGE_TECHNICIAN",
  "STREAMING_TECHNICIAN",
  "STYLIST",
  "SUPPLIER",
  "SYNC_AGENCY",
  "TECHNICIAN",
  "TOUR_AGENT",
  "VENUE",
  "VIDEOMAKER",
  "VIDEO_DIRECTOR",
  "VIDEO_EDITOR",
  "YOUTUBE_SPECIALIST",
] as const;

export type ContactType = (typeof contactTypes)[number];

/** Pessoa Física (INDIVIDUAL) vs Pessoa Jurídica (COMPANY). */
export type ContactEntityType = "INDIVIDUAL" | "COMPANY";

export type ContactStatus =
  | "active"
  | "inactive"
  | "negotiating"
  | "blocked"
  | "favorite"
  | "blacklisted";

export type ContactPriority = "low" | "medium" | "high" | "strategic";

export type ContactAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  extension: string;
  url?: string;
  createdAt: string;
};

export type ContactTimelineItem = {
  id: string;
  type: "meeting" | "email" | "whatsapp" | "followUp" | "contract" | "note" | "proposal" | "incident" | "event";
  summary: string;
  occurredAt: string;
  payload?: Record<string, unknown>;
};

export type Contact = {
  id: string;
  name: string;
  companyName?: string;
  contactType: ContactType;
  documentType?: string;
  documentNumber?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  instagram?: string;
  website?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  responsible?: string;
  notes?: string;
  tags: string[];
  status: ContactStatus;
  priority: ContactPriority;
  linkedArtistId?: string;
  payloadOperacional: Record<string, unknown>;
  attachments?: ContactAttachment[];
  timeline?: ContactTimelineItem[];
  createdAt: string;
  updatedAt: string;
};

export type ContactFiltersState = {
  search: string;
  contactType: "all" | ContactType;
  status: "all" | ContactStatus;
  priority: "all" | ContactPriority;
  city: "all" | string;
  tag: "all" | string;
};

export type Cliente = {
  id: string;
  nome: string;
  razao_social?: string | null;
  email?: string | null;
  telefone?: string | null;
  empresa?: string | null;
  cidade?: string | null;
  estado?: string | null;
  endereco?: string | null;
  endereco_completo?: string | null;
  cep?: string | null;
  status?: string | null;
  cpf?: string | null;
  cnpj?: string | null;
  cpf_cnpj?: string | null;
  tipo_pessoa?: "fisica" | "juridica" | "pessoa_fisica" | "pessoa_juridica" | string | null;
  responsavel?: string | null;
  observacoes?: string | null;
  type?: string | null;
  segmento?: string | null;
};

export type ClienteInsert = Omit<Cliente, "id">;
export type ClienteUpdate = Partial<ClienteInsert>;
export type ClientSegment = string;

