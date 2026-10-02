import { describe, expect, it } from "vitest";
import { canonicalFilterContractType, matchesContractTypeFilter } from "./contract-type-filters";

describe("legacy contract type spellings (read compatibility)", () => {
  it.each([
    ["exclusivo", "exclusivity"],
    ["nao_exclusivo", "non_exclusive"],
    ["representacao", "representation"],
    ["Representacao", "representation"],
    ["servicos", "services"],
  ])("maps %j to %s", (legacy, canonical) => {
    expect(canonicalFilterContractType(legacy)).toBe(canonical);
  });

  it("a stored legacy representacao contract still matches the business filter", () => {
    expect(matchesContractTypeFilter("business", "representacao")).toBe(true);
    expect(matchesContractTypeFilter("services", "representacao")).toBe(false);
  });
});
