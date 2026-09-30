import type { Interaction } from "../shared/interactions";

export type { Interaction };

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

/** Legal nature of the contact — canonical `clients.person_type` values (CZ-043). */
export type PersonType = "individual" | "company";

/** Canonical `clients.status` values (DB CHECK) — PT-BR labels in ../constants. */
export type ContactStatus = "active" | "inactive" | "prospect";

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

/**
 * CRM contact (= a `clients` row). Internal camelCase model mirroring the
 * canonical `/clients` columns one-to-one (CZ-043) — every field has its own
 * column; there is no metadata/"payloadOperacional" side channel. The wire
 * mapping lives in ../services/contacts.service.ts.
 */
export type Contact = {
  id: string;
  personType: PersonType;
  /** Relationship category slug (`clients.category`, ContactType slugs). */
  category?: ContactType;
  /** Profile slug (`clients.profile`; English machine ids, PT-BR labels via profileLabel()). */
  profile?: string;
  /** Display name: individual name (individual) or trade/legal name (company). */
  name: string;
  photoUrl?: string;
  individualName?: string;
  legalName?: string;
  tradeName?: string;
  email?: string;
  phone?: string;
  /** CPF (individual) or CNPJ (company) — the only place a document travels. */
  cpfCnpj?: string;
  instagram?: string;
  jobTitle?: string;
  street?: string;
  streetNumber?: string;
  addressComplement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  /** Full formatted address (`clients.address`). */
  address?: string;
  priority?: ContactPriority;
  responsibleName?: string;
  responsibleJobTitle?: string;
  responsibleEmail?: string;
  responsiblePhone?: string;
  notes?: string;
  interactions: Interaction[];
  status: ContactStatus;
  attachments?: ContactAttachment[];
  createdAt: string;
  updatedAt: string;
};

/** Create/update input of a contact (server-owned fields excluded). */
export type ContactInput = Omit<Contact, "id" | "createdAt" | "updatedAt">;
