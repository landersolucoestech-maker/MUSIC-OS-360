import { describe, expect, it } from "vitest";
import { activationPlanPeriodSuffix, normalizeActivationPlanPeriod } from "./activation-plans.service";

describe("activation plan period vocabulary", () => {
  it("keeps canonical English values", () => {
    expect(normalizeActivationPlanPeriod("monthly")).toBe("monthly");
    expect(normalizeActivationPlanPeriod("yearly")).toBe("yearly");
    expect(normalizeActivationPlanPeriod("trial")).toBe("trial");
  });
  it("reads legacy Portuguese and billing-interval spellings", () => {
    expect(normalizeActivationPlanPeriod("mensal")).toBe("monthly");
    expect(normalizeActivationPlanPeriod("anual")).toBe("yearly");
    expect(normalizeActivationPlanPeriod("month")).toBe("monthly");
    expect(normalizeActivationPlanPeriod("year")).toBe("yearly");
  });
  it("returns null for unknown values", () => {
    expect(normalizeActivationPlanPeriod("weekly")).toBeNull();
    expect(normalizeActivationPlanPeriod(undefined)).toBeNull();
  });
  it("renders the PT-BR price suffix", () => {
    expect(activationPlanPeriodSuffix("monthly")).toBe("/mês");
    expect(activationPlanPeriodSuffix("anual")).toBe("/ano");
    expect(activationPlanPeriodSuffix("trial")).toBe("");
  });
});
