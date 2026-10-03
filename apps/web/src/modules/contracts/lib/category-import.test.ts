import { describe, expect, it } from "vitest";
import { parseCategoryImportRow } from "./category-import";

describe("parseCategoryImportRow: spreadsheet input headers of the category import", () => {
  it("reads the template headers (Nome, Slug, Descrição)", () => {
    expect(parseCategoryImportRow({ Nome: " Cat ", Slug: " cat-1 ", "Descrição": " d " })).toEqual({ label: "Cat", rawSlug: "cat-1", description: "d" });
  });
  it("accepts the lower-case and unaccented spellings users type by hand", () => {
    expect(parseCategoryImportRow({ nome: "A", slug: "a", descricao: "x" })).toEqual({ label: "A", rawSlug: "a", description: "x" });
    expect(parseCategoryImportRow({ Nome: "A", Descricao: "y" }).description).toBe("y");
  });
  it("the template header wins over the spellings typed by hand", () => {
    expect(parseCategoryImportRow({ Nome: "Template", nome: "Hand" }).label).toBe("Template");
    expect(parseCategoryImportRow({ "Descrição": "Template", descricao: "Hand" }).description).toBe("Template");
  });
  it("blank or missing cells yield an empty label (row skipped by the caller) and no description", () => {
    expect(parseCategoryImportRow({})).toEqual({ label: "", rawSlug: "", description: undefined });
    expect(parseCategoryImportRow({ Nome: "  ", "Descrição": "  " })).toEqual({ label: "", rawSlug: "", description: undefined });
    expect(parseCategoryImportRow({ Nome: null }).label).toBe("");
  });
});
