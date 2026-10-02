import { describe, it, expect } from "vitest";
import { createDefaultCampaignState } from "./campaign-builder.helpers";
import type { MarketingCampaign } from "../../types/marketing.types";

// Legacy Portuguese objective values persisted by older campaigns are read as canonical objectives.
describe("campaign objective legacy dual-read", () => {
  it.each([
    ["alcance", "REACH"],
    ["visualizacao_video", "REACH"],
    ["visualizacoes", "REACH"],
    ["engajamento", "ENGAGEMENT"],
    ["trafego", "TRAFFIC"],
    ["seguidores", "ENGAGEMENT"],
    ["crescimento_seguidores", "ENGAGEMENT"],
    ["conversao", "CONVERSIONS"],
    ["conversoes", "CONVERSIONS"],
    ["captacao_leads", "CONVERSIONS"],
    ["REACH", "REACH"],
    ["unknown_value", "TRAFFIC"],
  ])("objective %s reads as %s", (legacy, canonical) => {
    const state = createDefaultCampaignState({ objective: legacy } as unknown as MarketingCampaign);
    expect(state.objective).toBe(canonical);
  });
});
