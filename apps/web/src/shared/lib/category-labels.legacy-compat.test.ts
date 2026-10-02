import { describe, it, expect } from "vitest";
import { formatCategoryLabel } from "./category-labels";

describe("category labels legacy slugs", () => {
  it.each([
    ["publicitario", "Publicitário"],
    ["semantico", "Semântico (IA)"],
    ["administrativo", "Administrativo"],
    ["empresariamento", "Empresariamento"],
    ["exclusividade", "Exclusividade"],
    ["influenciadores", "Influenciadores"],
    ["operacional", "Operacional"],
    ["outro", "Outro"],
    ["outros", "Outros"],
    ["parceria", "Parceria"],
    ["producao_audiovisual", "Produção Audiovisual"],
    ["publicidade", "Publicidade"],
    ["PUBLICITARIO", "Publicitário"],
  ])("slug %s displays as %s and never leaks an underscore", (slug, label) => {
    expect(formatCategoryLabel(slug)).toBe(label);
    expect(formatCategoryLabel(slug)).not.toContain("_");
  });

  it("legacy slugs display the same as their canonical English ids", () => {
    expect(formatCategoryLabel("publicitario")).toBe(formatCategoryLabel("advertising"));
    expect(formatCategoryLabel("semantico")).toBe(formatCategoryLabel("semantic"));
    expect(formatCategoryLabel("exclusividade")).toBe(formatCategoryLabel("exclusivity"));
  });
});
