import { describe, expect, it } from "vitest";
import { generatePlanningDraft } from "./generatePlanning";
import { planningLabel } from "./planningVocabulary";

describe("planning vocabulary", () => {
  it("emits English machine tokens", () => {
    const plan = generatePlanningDraft({ objective: "", platform: "", period: "30" });
    expect(plan.platform).toBe("multichannel");
    expect(plan.items.map((i) => i.type)).toEqual(["planning", "planning", "execution", "execution", "execution", "execution", "execution"]);
    expect(plan.items.map((i) => i.priority)).toEqual(["high", "high", "high", "medium", "medium", "medium", "medium"]);
    expect(plan.items.every((i) => i.channel === "multichannel")).toBe(true);
  });

  it("renders PT-BR labels and keeps typed platform names", () => {
    expect(planningLabel("multichannel")).toBe("multicanal");
    expect(planningLabel("planning")).toBe("planejamento");
    expect(planningLabel("execution")).toBe("execução");
    expect(planningLabel("high")).toBe("alta");
    expect(planningLabel("medium")).toBe("média");
    expect(planningLabel("Instagram")).toBe("Instagram");
  });
});
