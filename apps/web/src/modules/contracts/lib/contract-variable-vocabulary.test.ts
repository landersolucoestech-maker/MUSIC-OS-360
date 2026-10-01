import { describe, expect, it } from "vitest";
import {
  canonicalDistributionType,
  canonicalEntityType,
  canonicalizeStoredMusicWork,
  canonicalizeStoredParticipants,
  canonicalizeStoredVariables,
  canonicalVariableCategory,
} from "./contract-variable-vocabulary";
import { CATEGORY_LABELS, generateParticipantVariables, resolveAllVariables } from "../utils/contract-variables";
import type { ContractVariable, MusicWork, Participant } from "../types/contracts.types";

const variable = (category: string): ContractVariable =>
  ({ id: "x", key: "X", label: "X", type: "text", source: "custom", category, required: false, example: "" }) as ContractVariable;

describe("contract variable vocabulary (R3-04)", () => {
  it("maps every legacy variable category and keeps canonical / unknown values", () => {
    const legacy = ["participantes", "financeiro", "obra_musical", "vigencia", "assinatura", "sistema", "personalizada"];
    expect(legacy.map(canonicalVariableCategory)).toEqual(["participants", "financial", "musical_work", "term", "signature", "system", "custom"]);
    expect(canonicalVariableCategory("financial")).toBe("financial");
    expect(canonicalVariableCategory("toString")).toBe("toString");
    expect(canonicalVariableCategory(undefined)).toBeUndefined();
  });

  it("maps entity types and distribution types", () => {
    expect(canonicalEntityType("pessoa_fisica")).toBe("individual");
    expect(canonicalEntityType("pessoa_juridica")).toBe("company");
    expect(canonicalEntityType("company")).toBe("company");
    expect(canonicalDistributionType("exclusiva")).toBe("exclusive");
    expect(canonicalDistributionType("nao_exclusiva")).toBe("non_exclusive");
    expect(canonicalDistributionType("licenca")).toBe("license");
    expect(canonicalDistributionType("")).toBe("");
  });

  it("canonicalizes persisted jsonb without touching anything else", () => {
    expect(canonicalizeStoredVariables([variable("financeiro"), variable("custom")]).map((v) => v.category)).toEqual(["financial", "custom"]);
    const parts = canonicalizeStoredParticipants([
      { id: "1", role: "ARTISTA", entityType: "pessoa_fisica", variables: [variable("participantes")] } as unknown as Participant,
    ]);
    expect(parts[0].entityType).toBe("individual");
    expect(parts[0].variables[0].category).toBe("participants");
    expect(canonicalizeStoredMusicWork({ title: "t", distributionType: "licenca" } as unknown as MusicWork)?.distributionType).toBe("license");
    expect(canonicalizeStoredMusicWork(null)).toBeNull();
    expect(canonicalizeStoredVariables(null as never)).toBeNull();
  });

  it("generates canonical variables, accepts a legacy entity type and keeps the template keys", () => {
    const individual = generateParticipantVariables("ARTISTA", "individual");
    const legacy = generateParticipantVariables("ARTISTA", "pessoa_fisica" as never);
    expect(legacy).toEqual(individual);
    expect(individual.every((v) => v.category === "participants")).toBe(true);
    expect(individual.some((v) => v.key === "ARTISTA_NOME_COMPLETO")).toBe(true);
    expect(generateParticipantVariables("EMPRESA", "company").some((v) => v.key === "EMPRESA_CNPJ")).toBe(true);
  });

  it("orders by canonical category and labels every canonical category in PT-BR", () => {
    const all = resolveAllVariables([{ id: "p", role: "ARTISTA", entityType: "individual", variables: [] }]);
    expect(all[0].category).toBe("participants");
    expect(all.at(-1)?.category).toBe("system");
    for (const key of ["participants", "financial", "musical_work", "term", "signature", "system", "custom"]) {
      expect(CATEGORY_LABELS[key]).toBeTruthy();
    }
  });
});
