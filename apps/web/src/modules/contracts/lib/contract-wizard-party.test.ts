import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARTY,
  LEGACY_MARITAL_STATUSES,
  LEGACY_PARTY_FIELD_KEYS,
  LEGACY_PARTY_ORIGINS,
  LEGACY_PARTY_TYPES,
  LEGACY_SIGNER_FIELD_KEYS,
  MARITAL_STATUSES,
  MARITAL_STATUS_LABELS_PT_BR,
  isWizardSignerRecord,
  maritalStatusDocumentText,
  normalizeSavedParty,
  normalizeWizardSignerRecord,
} from "./contract-wizard-party";

describe("normalizeSavedParty", () => {
  it("reads a draft saved with the deprecated keys and values through the legacy maps", () => {
    const legacy: Record<string, string> = { type: "", origin: "" };
    const expected: Record<string, string> = {};
    for (const [legacyKey, key] of Object.entries(LEGACY_PARTY_FIELD_KEYS)) {
      legacy[legacyKey] = `value of ${key}`;
      expected[key] = `value of ${key}`;
    }
    const [[legacyCompany]] = Object.entries(LEGACY_PARTY_TYPES).filter(([, canonical]) => canonical === "company");
    const [[legacyArtists]] = Object.entries(LEGACY_PARTY_ORIGINS);
    legacy.type = legacyCompany;
    legacy.origin = legacyArtists;
    expect(normalizeSavedParty(legacy)).toEqual({ ...expected, type: "company", origin: "artists" });
  });

  it("maps every legacy party type, origin and marital status", () => {
    for (const [legacy, canonical] of Object.entries(LEGACY_PARTY_TYPES)) {
      expect(normalizeSavedParty({ type: legacy, origin: "manual" }).type).toBe(canonical);
    }
    for (const [legacy, canonical] of Object.entries(LEGACY_PARTY_ORIGINS)) {
      expect(normalizeSavedParty({ type: "individual", origin: legacy }).origin).toBe(canonical);
    }
    const [maritalKey] = Object.entries(LEGACY_PARTY_FIELD_KEYS).find(([, key]) => key === "marital_status") as [string, string];
    for (const [legacy, canonical] of Object.entries(LEGACY_MARITAL_STATUSES)) {
      expect(normalizeSavedParty({ type: "individual", origin: "manual", [maritalKey]: legacy }).marital_status).toBe(canonical);
    }
  });

  it("keeps a canonical record unchanged and lets the canonical key win over a legacy one", () => {
    const canonical = { type: "artist", origin: "artists", stage_name: "Nova", full_name: "Civil" } as const;
    expect(normalizeSavedParty(canonical)).toEqual(canonical);
    const [legacyNameKey] = Object.entries(LEGACY_PARTY_FIELD_KEYS).find(([, key]) => key === "name") as [string, string];
    expect(normalizeSavedParty({ type: "individual", origin: "manual", name: "New", [legacyNameKey]: "Old" }).name).toBe("New");
  });

  it("falls back to the empty-party defaults for an unknown type/origin or a non-object", () => {
    expect(normalizeSavedParty({ type: "martian", origin: "elsewhere" })).toEqual(DEFAULT_PARTY);
    expect(normalizeSavedParty(null)).toEqual(DEFAULT_PARTY);
    expect(normalizeSavedParty("x")).toEqual(DEFAULT_PARTY);
  });

  it("drops unknown keys and non-string values", () => {
    const [legacyNameKey] = Object.entries(LEGACY_PARTY_FIELD_KEYS).find(([, key]) => key === "name") as [string, string];
    const party = normalizeSavedParty({ type: "individual", origin: "manual", injected: "x", [legacyNameKey]: 42 });
    expect(party).toEqual({ type: "individual", origin: "manual" });
  });
});

describe("normalizeWizardSignerRecord / isWizardSignerRecord", () => {
  it("reads the deprecated signer keys and the canonical ones", () => {
    const legacy = LEGACY_SIGNER_FIELD_KEYS;
    expect(normalizeWizardSignerRecord({ [legacy.name]: "A", email: "a@x.com", role: "ARTISTA", [legacy.required]: false, [legacy.order]: 3, provider: "autentique" }, 0)).toEqual({
      name: "A", email: "a@x.com", role: "ARTISTA", required: false, order: 3, provider: "autentique",
    });
    expect(normalizeWizardSignerRecord({ name: "B", email: "b@x.com", role: "LABEL", required: true, order: 2, provider: "" }, 0)).toEqual({
      name: "B", email: "b@x.com", role: "LABEL", required: true, order: 2, provider: "",
    });
  });

  it("defaults required=true, order=index+1 and role OUTRO when absent", () => {
    expect(normalizeWizardSignerRecord({}, 4)).toEqual({ name: "", email: "", role: "OUTRO", required: true, order: 5, provider: "" });
  });

  it("recognizes wizard signers (either key) and not plain form signers", () => {
    expect(isWizardSignerRecord({ required: true })).toBe(true);
    expect(isWizardSignerRecord({ [LEGACY_SIGNER_FIELD_KEYS.required]: true })).toBe(true);
    expect(isWizardSignerRecord({ name: "A", email: "a@x.com", role: "label" })).toBe(false);
  });
});

describe("marital status vocabulary", () => {
  it("has a PT-BR label for every canonical id and writes document text, never the raw id", () => {
    for (const status of MARITAL_STATUSES) {
      expect(MARITAL_STATUS_LABELS_PT_BR[status]).toBeTruthy();
      expect(maritalStatusDocumentText(status)).not.toContain("_");
    }
    expect(maritalStatusDocumentText("single")).toMatch(/^solteiro$/);
    expect(maritalStatusDocumentText("widowed")).toBe("viúvo");
    expect(maritalStatusDocumentText("stable_union")).toBe("união estável");
    expect(maritalStatusDocumentText("free text")).toBe("free text");
    expect(maritalStatusDocumentText(undefined)).toBe("");
  });
});

describe("normalizeSavedParty: pinned legacy values (literals, independent of the maps under test)", () => {
  it.each([
    ["pf", "individual"],
    ["pj", "company"],
    ["artista", "artist"],
  ])("a draft saved with the deprecated party type %s is read as %s", (legacy, canonical) => {
    expect(normalizeSavedParty({ type: legacy, origin: "crm" }).type).toBe(canonical);
  });

  it("a draft saved with the deprecated origin artistas is read as artists", () => {
    expect(normalizeSavedParty({ type: "individual", origin: "artistas" }).origin).toBe("artists");
  });

  it.each([
    ["solteiro", "single"],
    ["casado", "married"],
    ["divorciado", "divorced"],
    ["viuvo", "widowed"],
    ["uniao_estavel", "stable_union"],
  ])("a deprecated marital status %s is read as %s on both marital fields", (legacy, canonical) => {
    const out = normalizeSavedParty({
      type: "individual",
      origin: "manual",
      estado_civil: legacy,
      estado_civil_representante: legacy,
    });
    expect(out.marital_status).toBe(canonical);
    expect(out.legal_representative_marital_status).toBe(canonical);
  });

  it("the deprecated value tables are exactly the pinned lists", () => {
    expect(Object.entries(LEGACY_PARTY_TYPES).sort()).toEqual([["artista", "artist"], ["pf", "individual"], ["pj", "company"]]);
    expect(Object.entries(LEGACY_PARTY_ORIGINS)).toEqual([["artistas", "artists"]]);
    expect(Object.entries(LEGACY_MARITAL_STATUSES).sort()).toEqual(
      [["casado", "married"], ["divorciado", "divorced"], ["solteiro", "single"], ["uniao_estavel", "stable_union"], ["viuvo", "widowed"]],
    );
  });
});

describe("normalizeSavedParty: pinned legacy key table (literal keys, independent of the map under test)", () => {
  const PINNED: ReadonlyArray<readonly [string, string]> = [
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

  it.each(PINNED)("a draft saved with the deprecated key %s is read as %s", (legacyKey, canonicalKey) => {
    const out = normalizeSavedParty({ type: "individual", origin: "manual", [legacyKey]: "stored value" }) as Record<string, unknown>;
    expect(out[canonicalKey]).toBe("stored value");
    expect(out).not.toHaveProperty(legacyKey);
  });

  it("the canonical key wins when a draft carries both spellings", () => {
    const out = normalizeSavedParty({ type: "individual", origin: "manual", estado_civil: "legacy", marital_status: "canonical" }) as Record<string, unknown>;
    expect(out["marital_status"]).toBe("canonical");
  });

  it("the table of deprecated keys is exactly the pinned list (a renamed or dropped key fails here)", () => {
    expect(Object.entries(LEGACY_PARTY_FIELD_KEYS).sort()).toEqual([...PINNED].map(([a, b]) => [a, b]).sort());
  });
});
