import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORY_LABEL, UNKNOWN_CATEGORY_LABEL, canonicalizeStoredCategories, contractCategoryLabel } from "./useCategoryRegistry";

const categories = [
  { value: "cessao_direitos", label: "Cessão de Direitos" },
  { value: "semantico", label: "Semântico (IA)" },
];

describe("contractCategoryLabel", () => {
  it("renders the registered PT-BR label", () => {
    expect(contractCategoryLabel(categories, "cessao_direitos")).toBe("Cessão de Direitos");
    expect(contractCategoryLabel(categories, "semantico")).toBe("Semântico (IA)");
  });

  it("never echoes or prettifies a technical slug", () => {
    expect(contractCategoryLabel(categories, "empresariamento_360")).toBe(UNKNOWN_CATEGORY_LABEL);
    expect(contractCategoryLabel(categories, "empresariamento_360")).not.toMatch(/empresariamento|Empresariamento/);
  });

  it("uses the accented default label when there is no category", () => {
    expect(contractCategoryLabel(categories, null)).toBe(DEFAULT_CATEGORY_LABEL);
    expect(DEFAULT_CATEGORY_LABEL).toBe("Padrão");
  });
});

describe("canonicalizeStoredCategories (legacy registry reader)", () => {
  const mk = (value: string, id = value) => ({ id, label: value, value, createdAt: "2026-01-01" });

  it("rewrites platform-seeded Portuguese slugs to the canonical English slug", () => {
    const out = canonicalizeStoredCategories([mk("gravacao"), mk("distribuicao"), mk("outros"), mk("gestao")]);
    expect(out.map((c) => c.value)).toEqual(["recording", "distribution", "other", "management"]);
  });

  it("keeps tenant-created slugs, shows and canonical values untouched", () => {
    const out = canonicalizeStoredCategories([mk("empresariamento_360"), mk("shows"), mk("recording")]);
    expect(out.map((c) => c.value)).toEqual(["empresariamento_360", "shows", "recording"]);
  });

  it("drops a duplicate when both spellings are stored and ignores malformed entries", () => {
    const out = canonicalizeStoredCategories([mk("producao", "a"), mk("production", "b"), null as never, {} as never]);
    expect(out.map((c) => c.id)).toEqual(["a"]);
  });

  it("matches a canonical contract type to a legacy registry value", () => {
    expect(contractCategoryLabel([{ value: "distribuicao", label: "Distribuição" }], "distribution")).toBe("Distribuição");
  });
});
