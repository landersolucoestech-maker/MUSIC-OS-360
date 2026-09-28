import { describe, it, expect } from "vitest";
import { leadFormToLead, leadToFormInitial } from "./lead-form-mapper";
import type { LeadFormPayload } from "../modals/LeadFormModal";
import type { Lead } from "../types";

const FORM: LeadFormPayload = {
  name: "Fulano",
  company: "Produtora X",
  jobTitle: "Diretor",
  email: "f@example.test",
  phone: "(11) 99999-0000",
  instagram: "@fulano",
  website: "https://x.test",
  address: "Rua A",
  city: "São Paulo",
  state: "SP",
  leadType: "show_booker",
  service: "artist_booking",
  serviceArtistName: "Banda Y",
  description: "Show de aniversário",
  leadSource: "referral",
  marketingCampaign: "Verão",
  entryDate: "2026-09-01",
  leadStatus: "qualified",
  priority: "high",
  responsiblePerson: "Ana",
  nextFollowUpAt: "2026-09-10",
  estimatedValue: "5000",
  temperature: "hot",
  event: {
    eventName: "Festa", eventType: "birthday", eventDate: "2026-10-01", eventVenue: "Clube",
    city: "Campinas", state: "SP", audienceCapacity: "300", artistName: "Banda Y", additionalNeeds: "Palco",
  },
  interactions: [{ id: "i1", type: "call", date: "2026-09-02", time: "10:00", description: "Primeiro contato" }],
  uploads: [],
};

describe("lead-form-mapper (CZ-033 canonical vocabulary)", () => {
  it("maps the form to the canonical Lead / API contract", () => {
    const lead = leadFormToLead(FORM);
    expect(lead).toMatchObject({
      fullName: "Fulano", stageName: "Banda Y", company: "Produtora X", whatsapp: "(11) 99999-0000",
      status: "qualified", clientType: "eventProducer", serviceType: "eventProduction",
    });
    expect(lead.servicePayload).toMatchObject({
      leadType: "show_booker", service: "artist_booking", eventName: "Festa", eventType: "birthday",
      interactions: FORM.interactions,
    });
    expect(lead.crmInternalData).toEqual({
      priority: "high", leadSource: "referral", responsiblePerson: "Ana", marketingCampaign: "Verão",
      nextFollowUpAt: "2026-09-10", estimatedValue: 5000, temperature: "hot",
    });
  });

  it("round-trips a saved lead back into the form (event block restored)", () => {
    const input = leadFormToLead(FORM);
    const lead: Lead = { ...input, id: "l1", createdAt: "2026-09-01", updatedAt: "2026-09-01" };
    const initial = leadToFormInitial(lead);
    expect(initial).toMatchObject({
      name: "Fulano", leadType: "show_booker", service: "artist_booking", leadStatus: "qualified",
      priority: "high", estimatedValue: "5000", temperature: "hot", event: FORM.event,
    });
    expect(initial.campaign).toBeUndefined();
  });

  it("unknown lead type / service fall back to canonical defaults", () => {
    const lead = leadFormToLead({ ...FORM, leadType: "", service: "texto livre", event: undefined });
    expect(lead.clientType).toBe("other");
    expect(lead.serviceType).toBe("consulting");
  });
});
