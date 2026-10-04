import { describe, it, expect } from "vitest";
import { createDefaultCampaignState } from "./campaign-builder.helpers";
import type { MarketingCampaign } from "../../types/marketing.types";

// A saved builder campaign keeps its state as JSON in `notes`; older rows carry Portuguese phase / strategy values.
const savedCampaign = (phase: unknown, strategy: unknown): MarketingCampaign =>
  ({
    id: "c1",
    name: "Saved",
    objective: "REACH",
    budget: 700,
    notes: JSON.stringify({ phase, budget: { strategy } }),
  }) as unknown as MarketingCampaign;

describe("createDefaultCampaignState hydration of saved phase and budget strategy", () => {
  it.each([
    ["pre_lancamento", "pre_launch"],
    ["lancamento", "launch"],
    ["sustentacao", "sustain"],
    ["catalogo", "catalog"],
    ["pre_launch", "pre_launch"],
    ["catalog", "catalog"],
  ])("saved phase %s hydrates as %s", (saved, canonical) => {
    expect(createDefaultCampaignState(savedCampaign(saved, "lowest_cost")).phase).toBe(canonical);
  });

  it.each([
    ["menor_custo", "lowest_cost"],
    ["limite_custo", "cost_cap"],
    ["custo_alvo", "target_cost"],
    ["cost_cap", "cost_cap"],
  ])("saved strategy %s hydrates as %s", (saved, canonical) => {
    expect(createDefaultCampaignState(savedCampaign("launch", saved)).budget.strategy).toBe(canonical);
  });

  it("an unrecognised phase or strategy falls back to the defaults instead of leaking the raw value", () => {
    const state = createDefaultCampaignState(savedCampaign("not_a_phase", "not_a_strategy"));
    expect(state.phase).toBe("launch");
    expect(state.budget.strategy).toBe("lowest_cost");
  });

  it("a campaign whose notes are free text keeps the defaults", () => {
    const state = createDefaultCampaignState({ id: "c2", name: "Free", objective: "REACH", budget: 700, notes: "just a note" } as unknown as MarketingCampaign);
    expect(state.phase).toBe("launch");
    expect(state.budget.strategy).toBe("lowest_cost");
    expect(state.internalDescription).toBe("just a note");
  });
});
