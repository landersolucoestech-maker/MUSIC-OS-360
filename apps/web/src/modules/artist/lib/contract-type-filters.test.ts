import { describe, expect, it } from "vitest";
import { matchesContractTypeFilter } from "./contract-type-filters";

describe("artist 360 contract type filters", () => {
  it("matches canonical and legacy spellings of the same category", () => {
    expect(matchesContractTypeFilter("distribution", "distribution")).toBe(true);
    expect(matchesContractTypeFilter("distribution", "distribuicao")).toBe(true);
    expect(matchesContractTypeFilter("production", "producao")).toBe(true);
    expect(matchesContractTypeFilter("production", "production")).toBe(true);
    expect(matchesContractTypeFilter("licensing", "licenciamento")).toBe(true);
    expect(matchesContractTypeFilter("business", "gestao")).toBe(true);
    expect(matchesContractTypeFilter("business", "exclusividade")).toBe(true);
    expect(matchesContractTypeFilter("business", "nao_exclusivo")).toBe(true);
    expect(matchesContractTypeFilter("other", "outro")).toBe(true);
    expect(matchesContractTypeFilter("other", "outros")).toBe(true);
  });

  it("keeps tenant slugs and rejects other categories", () => {
    expect(matchesContractTypeFilter("partnerships", "parceria")).toBe(true);
    expect(matchesContractTypeFilter("distribution", "licensing")).toBe(false);
    expect(matchesContractTypeFilter("services", "production")).toBe(false);
  });

  it("'all' and unknown keys match everything", () => {
    expect(matchesContractTypeFilter("all", "anything")).toBe(true);
    expect(matchesContractTypeFilter("nope", null)).toBe(true);
  });
});
