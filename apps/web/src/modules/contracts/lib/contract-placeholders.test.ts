import { describe, expect, it } from "vitest";
import {
  canonicalPlaceholderField, canonicalPlaceholderGroup, isNonPartyGroup, isPartyEntityField,
  parsePlaceholders, partyKeyForPlaceholderField,
} from "./contract-placeholders";

describe("contract placeholder boundary", () => {
  it("parses user-authored tokens and exposes canonical English ids next to the raw token", () => {
    const content = "{{CONTRATANTE.TELEFONE}} {{CONTRATANTE.NOME_COMPLETO}} {{VIGENCIA.INICIO}} {{SIGNATURE.CONTRATANTE}}";
    const parsed = parsePlaceholders(content);
    expect(parsed.map((p) => p.raw)).toEqual([
      "{{CONTRATANTE.TELEFONE}}", "{{CONTRATANTE.NOME_COMPLETO}}", "{{VIGENCIA.INICIO}}", "{{SIGNATURE.CONTRATANTE}}",
    ]);
    expect(parsed[0]).toMatchObject({ group: "CONTRATANTE", field: "TELEFONE", canonicalGroup: "CONTRATANTE", canonicalField: "PHONE" });
    expect(parsed[1].canonicalField).toBe("NOME_COMPLETO"); // unknown authored field: kept as authored
    expect(parsed[2]).toMatchObject({ canonicalGroup: "TERM", canonicalField: "INICIO" });
    expect(parsed[3].canonicalGroup).toBe("SIGNATURE");
  });

  it("never rewrites the stored content: parsing is read-only and raw tokens round-trip", () => {
    const content = "Texto {{ARTISTA.NOME_ARTISTICO}} e {{ARTISTA.ENDERECO}}";
    const before = content;
    const parsed = parsePlaceholders(content);
    expect(content).toBe(before);
    expect(parsed.map((p) => p.raw).every((raw) => content.includes(raw))).toBe(true);
    expect(parsed.map((p) => p.canonicalField)).toEqual(["STAGE_NAME", "ADDRESS"]);
  });

  it("maps authored (PT) and English field tokens to the same canonical id and PartyData key", () => {
    for (const [token, canonical, key] of [
      ["NOME", "NAME", "name"], ["TELEFONE", "PHONE", "phone"], ["CELULAR", "PHONE", "phone"], ["PHONE", "PHONE", "phone"],
      ["ESTADO_CIVIL", "MARITAL_STATUS", "marital_status"], ["REPRESENTANTE_LEGAL", "LEGAL_REPRESENTATIVE", "legal_representative"],
      ["REPRESENTATIVE_NAME", "LEGAL_REPRESENTATIVE", "legal_representative"], ["RG_REPRESENTANTE", "LEGAL_REPRESENTATIVE_RG", "legal_representative_rg"],
      ["RAZAO_SOCIAL", "LEGAL_NAME", "legal_name"], ["NOME_CIVIL", "FULL_NAME", "full_name"],
    ] as const) {
      expect(canonicalPlaceholderField(token)).toBe(canonical);
      expect(partyKeyForPlaceholderField(token)).toBe(key);
      expect(isPartyEntityField(token)).toBe(true);
    }
    expect(partyKeyForPlaceholderField("NOME_COMPLETO")).toBeUndefined();
    expect(isPartyEntityField("toString")).toBe(false);
  });

  it("classifies non-party groups by authored token; party roles keep their token", () => {
    for (const g of ["VIGENCIA", "OBRA", "OBRA_MUSICAL", "DATA", "PRAZO", "FINANCIAL", "SIGNATURE"]) expect(isNonPartyGroup(g)).toBe(true);
    expect(canonicalPlaceholderGroup("OBRA_MUSICAL")).toBe("WORK");
    expect(isNonPartyGroup("CONTRATANTE")).toBe(false);
    expect(canonicalPlaceholderGroup("CONTRATANTE")).toBe("CONTRATANTE");
    expect(isNonPartyGroup("constructor")).toBe(false);
  });
});
