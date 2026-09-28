/**
 * lead-form-mapper.ts — the only mapping between the lead form
 * (LeadFormModal's LeadFormPayload) and the Lead model / API contract.
 * Used by the Leads page and by MusicChat's "create lead from conversation".
 */
import type { Interaction, LeadFormPayload } from "../modals/LeadFormModal";
import type { Lead, LeadClientType, LeadServiceType } from "../types";
import type { LeadInput } from "../services/leads.service";
import {
  EVENT_COMBOS,
  CAMPAIGN_COMBOS,
  LEAD_TYPE_INFLUENCER,
  LEAD_TYPE_MANAGER,
  matchCombo,
} from "../constants/lead-form-options";

// ─────────────────────────────────────────────
// Mappings (form lead type / service -> CRM client type / service type)
// ─────────────────────────────────────────────
const LEAD_TYPE_TO_CLIENT: Record<string, LeadClientType> = {
  artist_or_band:   "artist",
  show_booker:      "eventProducer",
  brand_or_company: "brand",
  event_producer:   "eventProducer",
  record_label:     "label",
  artist_manager:   "agency",
  music_publisher:  "label",
  agency:           "agency",
  influencer:       "creator",
  other:            "other",
};

const SERVICE_TO_SERVICE_TYPE: Record<string, LeadServiceType> = {
  artist_management:         "artistManagement",
  music_production:          "musicProduction",
  music_editing:             "mixing",
  digital_distribution:      "digitalDistribution",
  digital_marketing:         "musicMarketing",
  influencer_marketing:      "musicMarketing",
  audiovisual_production:    "musicVideo",
  event_production:          "eventProduction",
  artist_booking:            "eventProduction",
  corporate_events:          "eventProduction",
  artist_campaigns:          "musicMarketing",
  music_licensing:           "licensing",
  image_management:          "artistManagement",
  career_strategy:           "artistManagement",
  event_promotion:           "eventProduction",
  publishing_administration: "copyrightRegistration",
  work_registration:         "copyrightRegistration",
  royalty_collection:        "copyrightRegistration",
  sync_licensing:            "licensing",
  catalog_management:        "copyrightRegistration",
  influencers:               "musicMarketing",
  commercial_partnerships:   "consulting",
  partnerships:              "consulting",
  special_projects:          "consulting",
  personalized_service:      "consulting",
  website_creation:          "websiteDevelopment",
  consulting:                "consulting",
};

// ─────────────────────────────────────────────
// leadFormToLead
// ─────────────────────────────────────────────
export function leadFormToLead(payload: LeadFormPayload): LeadInput {
  const clientType = LEAD_TYPE_TO_CLIENT[payload.leadType]   ?? "other";
  const serviceType = SERVICE_TO_SERVICE_TYPE[payload.service] ?? "consulting";

  // The conditional block that applies (event/campaign/influencer/manager) is
  // stored flat inside servicePayload.
  const conditional =
    payload.event      ??
    payload.campaign   ??
    payload.influencer ??
    payload.manager    ??
    {};

  return {
    fullName: payload.name,
    stageName:
      payload.event?.artistName    ??
      payload.campaign?.artistName ??
      payload.manager?.artistName  ??
      "",
    company:   payload.company,
    email:     payload.email,
    whatsapp:  payload.phone,
    instagram: payload.instagram,
    city:      payload.city,
    state:     payload.state,
    country:   "BR",
    status:    payload.leadStatus,
    clientType,
    serviceType,
    servicePayload: {
      leadType:          payload.leadType,
      service:           payload.service,
      serviceArtistName: payload.serviceArtistName,
      description:       payload.description,
      jobTitle:          payload.jobTitle,
      website:           payload.website,
      address:           payload.address,
      entryDate:         payload.entryDate,
      responsiblePerson: payload.responsiblePerson,
      interactions:      payload.interactions,
      ...conditional,
    },
    crmInternalData: {
      priority:          payload.priority,
      leadSource:        payload.leadSource,
      responsiblePerson: payload.responsiblePerson,
      marketingCampaign: payload.marketingCampaign,
      nextFollowUpAt:    payload.nextFollowUpAt || undefined,
      estimatedValue:    payload.estimatedValue ? Number(payload.estimatedValue) : undefined,
      temperature:       payload.temperature || undefined,
    },
    uploads: payload.uploads ?? [],
  };
}

// ─────────────────────────────────────────────
// leadToFormInitial
// ─────────────────────────────────────────────
export function leadToFormInitial(lead: Lead): Partial<LeadFormPayload> {
  const ps  = (lead.servicePayload  ?? {}) as Record<string, unknown>;
  const crm = lead.crmInternalData ?? {};

  const str = (k: string): string =>
    typeof ps[k] === "string" ? (ps[k] as string) : "";

  const leadType = str("leadType");
  const service  = str("service");

  const isEvent      = matchCombo(EVENT_COMBOS,    leadType, service);
  const isCampaign   = matchCombo(CAMPAIGN_COMBOS, leadType, service);
  const isInfluencer = leadType === LEAD_TYPE_INFLUENCER && !isEvent;
  const isManager    = leadType === LEAD_TYPE_MANAGER    && !isEvent;

  return {
    name:              lead.fullName,
    company:           lead.company   ?? "",
    email:             lead.email     ?? "",
    phone:             lead.whatsapp  ?? "",
    instagram:         lead.instagram ?? "",
    city:              lead.city      ?? "",
    state:             lead.state     ?? "",
    jobTitle:          str("jobTitle"),
    website:           str("website"),
    address:           str("address"),
    entryDate:         str("entryDate"),
    responsiblePerson: str("responsiblePerson"),
    leadType:          leadType as LeadFormPayload["leadType"],
    service,
    serviceArtistName: str("serviceArtistName"),
    description:       str("description"),
    leadSource:        crm.leadSource        ?? "",
    leadStatus:        lead.status           ?? "new",
    priority:          crm.priority          ?? "medium",
    marketingCampaign: crm.marketingCampaign ?? "",
    nextFollowUpAt:    crm.nextFollowUpAt    ?? "",
    estimatedValue:    crm.estimatedValue != null ? String(crm.estimatedValue) : "",
    temperature:       crm.temperature       ?? "",
    interactions: Array.isArray(ps.interactions)
      ? (ps.interactions as Interaction[])
      : [],
    uploads: lead.uploads ?? [],
    event: isEvent ? {
      eventName:        str("eventName"),
      eventType:        str("eventType"),
      eventDate:        str("eventDate"),
      eventVenue:       str("eventVenue"),
      city:             str("city"),
      state:            str("state"),
      audienceCapacity: str("audienceCapacity"),
      artistName:       str("artistName"),
      additionalNeeds:  str("additionalNeeds"),
    } : undefined,
    campaign: isCampaign ? {
      campaignName:    str("campaignName"),
      campaignType:    str("campaignType"),
      start_date:      str("start_date"),
      end_date:        str("end_date"),
      city:            str("city"),
      state:           str("state"),
      artistName:      str("artistName"),
      additionalNeeds: str("additionalNeeds"),
    } : undefined,
    influencer: isInfluencer ? {
      campaignName:     str("campaignName"),
      campaignType:     str("campaignType"),
      campaignLocation: str("campaignLocation"),
      date:             str("date"),
      city:             str("city"),
      state:            str("state"),
      additionalNeeds:  str("additionalNeeds"),
    } : undefined,
    manager: isManager ? {
      artistName:      str("artistName"),
      additionalNeeds: str("additionalNeeds"),
    } : undefined,
  };
}
