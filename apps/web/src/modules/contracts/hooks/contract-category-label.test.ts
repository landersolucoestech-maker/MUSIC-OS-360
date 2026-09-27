import { describe, expect, it } from "vitest";
import { DEFAULT_CATEGORY_LABEL, UNKNOWN_CATEGORY_LABEL, contractCategoryLabel } from "./useCategoryRegistry";

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
