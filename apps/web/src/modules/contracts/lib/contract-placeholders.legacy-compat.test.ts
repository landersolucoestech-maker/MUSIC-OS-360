import { describe, expect, it } from "vitest";
import {
  canonicalPlaceholderField,
  parsePlaceholders,
  partyKeyForPlaceholderField,
} from "./contract-placeholders";

// [authored legacy token, canonical field id, PartyData key]
const LEGACY_FIELD_TOKENS: ReadonlyArray<readonly [string, string, string]> = [
  ["CPF_REPRESENTANTE", "LEGAL_REPRESENTATIVE_CPF", "legal_representative_cpf"],
  ["NACIONALIDADE", "NATIONALITY", "nationality"],
  ["PROFISSAO", "OCCUPATION", "occupation"],
];

describe("contract placeholder legacy field tokens (authored in, canonical out)", () => {
  it.each(LEGACY_FIELD_TOKENS)("%s resolves to %s / %s", (token, canonicalField, partyKey) => {
    expect(canonicalPlaceholderField(token)).toBe(canonicalField);
    expect(partyKeyForPlaceholderField(token)).toBe(partyKey);
    // the canonical id resolves to the very same party key
    expect(partyKeyForPlaceholderField(canonicalField)).toBe(partyKey);

    const raw = `{{CONTRATANTE.${token}}}`;
    const [parsed] = parsePlaceholders(`texto ${raw} fim`);
    // the authored token is preserved verbatim (only form ever persisted); processing uses the canonical id
    expect(parsed.raw).toBe(raw);
    expect(parsed.field).toBe(token);
    expect(parsed.canonicalField).toBe(canonicalField);
  });

  it("an unknown token is not guessed: it stays as authored with no party key", () => {
    expect(canonicalPlaceholderField("CAMPO_INEXISTENTE")).toBe("CAMPO_INEXISTENTE");
    expect(partyKeyForPlaceholderField("CAMPO_INEXISTENTE")).toBeUndefined();
  });
});
