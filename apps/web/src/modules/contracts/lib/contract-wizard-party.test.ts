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
