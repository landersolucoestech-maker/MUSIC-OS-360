import { describe, expect, it } from "vitest";
import { parseArtistImportRow, type ArtistFormAllValues } from "./artist-form.definition";

// [legacy snake_case header of spreadsheets exported by older builds, canonical form field id, cell value, parsed value]
const LEGACY_IMPORT_HEADERS: ReadonlyArray<readonly [string, keyof ArtistFormAllValues, string, string]> = [
  ["nome_artistico", "stageName", "Artista Legado", "Artista Legado"],
  ["genero_musical", "musicGenre", "Rock", "Rock"],
  ["documentos_pessoais_url", "personalDocumentsUrl", "https://files.example.test/doc.pdf", "https://files.example.test/doc.pdf"],
  ["observacoes", "biography", "biografia legada", "biografia legada"],
  ["nome_civil", "fullName", "Nome Civil Legado", "Nome Civil Legado"],
  ["data_nascimento", "birthDate", "1990-05-17", "1990-05-17"],
  ["tipo_perfil", "profileType", "Artista", "independent"],
  ["notas_internas", "internalNotes", "nota legada", "nota legada"],
];

describe("artist spreadsheet import legacy headers (legacy in, canonical field out)", () => {
  it.each(LEGACY_IMPORT_HEADERS)("header %s fills field %s", (header, field, cell, parsedValue) => {
    // stageName is required for a valid row, so the other cases carry it under the canonical "Nome" label
    const row: Record<string, unknown> = field === "stageName" ? { [header]: cell } : { Nome: "Base", [header]: cell };
    const parsed = parseArtistImportRow(row);
    expect(parsed).not.toBeNull();
    expect((parsed as unknown as Record<string, unknown>)[field]).toBe(parsedValue);
    // the result is keyed by canonical field ids only
    expect(Object.keys(parsed as object)).not.toContain(header);
  });

  it("the canonical label wins over the legacy header when both are present", () => {
    expect(parseArtistImportRow({ Nome: "Canonico", nome_artistico: "Legado" })?.stageName).toBe("Canonico");
  });

  it("a row with no artist name under any accepted header is rejected", () => {
    expect(parseArtistImportRow({ genero_musical: "Rock" })).toBeNull();
  });
});
