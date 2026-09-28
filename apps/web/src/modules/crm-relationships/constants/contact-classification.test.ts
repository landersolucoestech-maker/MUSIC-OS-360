import { describe, expect, it } from "vitest";
import {
  UNKNOWN_PROFILE_LABEL,
  ensureProfileOption,
  getProfiles,
  personTypeLabel,
  profileLabel,
  UNKNOWN_PERSON_TYPE_LABEL,
} from "./contact-classification";

describe("personTypeLabel", () => {
  it("maps the canonical person_type values to PT-BR labels", () => {
    expect(personTypeLabel("individual")).toBe("Pessoa Física");
    expect(personTypeLabel("company")).toBe("Pessoa Jurídica");
  });

  it("never returns a raw/legacy value", () => {
    expect(personTypeLabel("pessoa_juridica")).toBe(UNKNOWN_PERSON_TYPE_LABEL);
  });
});

describe("profileLabel", () => {
  it("returns the label from the current type + category list", () => {
    expect(profileLabel("contratante_show", "individual", "CORPORATE_CLIENT")).toBe("Contratante de Show");
  });

  it("finds a legacy profile saved under another category by its real label", () => {
    // parceiro_comercial exists under PARTNER, not under SUPPLIER
    expect(profileLabel("parceiro_comercial", "individual", "SUPPLIER")).toBe("Parceiro Comercial");
  });

  it("never returns the raw slug for an unknown profile", () => {
    expect(profileLabel("slug_removido_do_catalogo", "individual", "CORPORATE_CLIENT")).toBe(UNKNOWN_PROFILE_LABEL);
  });

  it("returns an empty string when no profile is saved", () => {
    expect(profileLabel("", "individual", "CORPORATE_CLIENT")).toBe("");
  });
});

describe("ensureProfileOption", () => {
  it("keeps a legacy value selectable with a PT-BR label, not the slug", () => {
    const list = ensureProfileOption(getProfiles("individual", "SUPPLIER"), "slug_removido_do_catalogo");
    expect(list.at(-1)).toEqual({ value: "slug_removido_do_catalogo", label: UNKNOWN_PROFILE_LABEL });
  });

  it("does not duplicate a value already in the list", () => {
    const base = getProfiles("individual", "PARTNER");
    expect(ensureProfileOption(base, "influenciador")).toBe(base);
  });
});
