import { describe, expect, it } from "vitest";
import { createDefaultCampaignState, toMarketingCampaignInput } from "./campaign-builder.helpers";
import { canonicalBudgetStrategy, canonicalCampaignPhase, canonicalCreativeType, parseCampaignBuilderNotes } from "../../utils/marketing-legacy-vocabulary";
import type { MarketingCampaign } from "../../types/marketing.types";

describe("campaign builder state vocabulary (AP3 R3-02)", () => {
  it("new state and the persisted notes are canonical English", () => {
    const input = toMarketingCampaignInput(createDefaultCampaignState());
    const notes = JSON.parse(input.notes as string);
    expect(notes.phase).toBe("launch");
    expect(notes.budget.strategy).toBe("lowest_cost");
    expect(JSON.parse(input.segmentation as string).gender).toBe("all");
  });

  it("reads legacy Portuguese phase / strategy / creative type, canonical wins", () => {
    expect(canonicalCampaignPhase("pre_lancamento")).toBe("pre_launch");
    expect(canonicalCampaignPhase("sustain")).toBe("sustain");
    expect(canonicalCampaignPhase("Meu")).toBeUndefined();
    expect(canonicalCreativeType("carrossel")).toBe("carousel");
    expect(canonicalBudgetStrategy("custo_alvo")).toBe("target_cost");
    const legacy = JSON.stringify({ phase: "catalogo", description: "d", creatives: [{ type: "imagem" }], budget: { strategy: "limite_custo" } });
    expect(parseCampaignBuilderNotes(legacy)).toEqual({ phase: "catalog", description: "d", creatives: [{ type: "image" }], budget: { strategy: "cost_cap" } });
    expect(parseCampaignBuilderNotes("free text lancamento")).toBeNull();
    expect(parseCampaignBuilderNotes("{bad")).toBeNull();
  });

  it("reopening a campaign restores phase/strategy/description from legacy notes without leaking the JSON into the description", () => {
    const campaign = { notes: JSON.stringify({ phase: "pre_lancamento", description: "minha nota", budget: { strategy: "custo_alvo" } }) } as MarketingCampaign;
    const state = createDefaultCampaignState(campaign);
    expect(state.phase).toBe("pre_launch");
    expect(state.budget.strategy).toBe("target_cost");
    expect(state.internalDescription).toBe("minha nota");
    expect(createDefaultCampaignState({ notes: "texto livre" } as MarketingCampaign).internalDescription).toBe("texto livre");
  });
});
