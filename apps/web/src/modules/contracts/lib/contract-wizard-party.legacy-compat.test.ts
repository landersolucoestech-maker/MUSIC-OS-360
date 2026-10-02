import { describe, expect, it } from "vitest";
import {
  isWizardSignerRecord,
  normalizeSavedParty,
  normalizeWizardSignerRecord,
} from "./contract-wizard-party";

// Each legacy stored-draft key and the canonical key it must be read as.
const LEGACY_PARTY_KEYS: ReadonlyArray<readonly [string, string]> = [
  ["nome", "name"],
  ["nome_artistico", "stage_name"],
  ["nome_civil", "full_name"],
  ["telefone", "phone"],
  ["endereco", "address"],
  ["nacionalidade", "nationality"],
  ["profissao", "occupation"],
  ["estado_civil", "marital_status"],
  ["razao_social", "legal_name"],
  ["representante_legal", "legal_representative"],
  ["cpf_representante", "legal_representative_cpf"],
  ["rg_representante", "legal_representative_rg"],
  ["nacionalidade_representante", "legal_representative_nationality"],
  ["estado_civil_representante", "legal_representative_marital_status"],
  ["profissao_representante", "legal_representative_occupation"],
  ["endereco_representante", "legal_representative_address"],
];

const LEGACY_MARITAL: ReadonlyArray<readonly [string, string]> = [
  ["casado", "married"],
  ["divorciado", "divorced"],
  ["viuvo", "widowed"],
  ["uniao_estavel", "stable_union"],
  ["solteiro", "single"],
];

describe("contract wizard stored-draft legacy keys (legacy in, canonical out)", () => {
  it.each(LEGACY_PARTY_KEYS)("party key %s is read as %s and never kept", (legacy, canonical) => {
    const party = normalizeSavedParty({ [legacy]: "valor" }) as unknown as Record<string, unknown>;
    expect(party[canonical]).toBe("valor");
    expect(legacy in party).toBe(false);
  });

  it("the canonical key wins when both spellings are stored", () => {
    expect(normalizeSavedParty({ nome: "legado", name: "canonico" }).name).toBe("canonico");
  });

  it.each(LEGACY_MARITAL)("marital status %s is read as %s (party and representative)", (legacy, canonical) => {
    const party = normalizeSavedParty({ estado_civil: legacy, estado_civil_representante: legacy });
    expect(party.marital_status).toBe(canonical);
    expect(party.legal_representative_marital_status).toBe(canonical);
  });

  it.each([
    ["pf", "individual"],
    ["pj", "company"],
    ["artista", "artist"],
  ])("party type %s is read as %s", (legacy, canonical) => {
    expect(normalizeSavedParty({ type: legacy }).type).toBe(canonical);
  });

  it("party origin artistas is read as artists; unknown origin falls back to manual", () => {
    expect(normalizeSavedParty({ origin: "artistas" }).origin).toBe("artists");
    expect(normalizeSavedParty({ origin: "desconhecida" }).origin).toBe("manual");
  });

  it("signer legacy keys nome/obrigatorio/ordem are read as name/required/order", () => {
    const legacy = { nome: "Ana", obrigatorio: false, ordem: 3, email: "a@x.test" };
    expect(isWizardSignerRecord(legacy)).toBe(true);
    expect(normalizeWizardSignerRecord(legacy, 0)).toMatchObject({ name: "Ana", required: false, order: 3, email: "a@x.test" });
    // canonical key wins over the legacy one
    expect(normalizeWizardSignerRecord({ name: "Canon", nome: "Legado" }, 1)).toMatchObject({ name: "Canon", required: true, order: 2 });
    // the canonical record never carries the legacy keys
    const out = normalizeWizardSignerRecord(legacy, 0) as unknown as Record<string, unknown>;
    expect("nome" in out || "obrigatorio" in out || "ordem" in out).toBe(false);
  });
});
