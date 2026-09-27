import { describe, expect, it } from "vitest";
import {
  UNKNOWN_PROFILE_LABEL,
  ensureProfileOption,
  getProfiles,
  profileLabel,
} from "./contact-classification";

describe("profileLabel", () => {
  it("returns the label from the current type + category list", () => {
    expect(profileLabel("contratante_show", "pessoa_fisica", "CORPORATE_CLIENT")).toBe("Contratante de Show");
  });

  it("finds a legacy profile saved under another category by its real label", () => {
    // parceiro_comercial exists under PARTNER, not under SUPPLIER
    expect(profileLabel("parceiro_comercial", "pessoa_fisica", "SUPPLIER")).toBe("Parceiro Comercial");
  });

  it("never returns the raw slug for an unknown profile", () => {
    expect(profileLabel("slug_removido_do_catalogo", "pessoa_fisica", "CORPORATE_CLIENT")).toBe(UNKNOWN_PROFILE_LABEL);
  });

  it("returns an empty string when no profile is saved", () => {
    expect(profileLabel("", "pessoa_fisica", "CORPORATE_CLIENT")).toBe("");
  });
});

describe("ensureProfileOption", () => {
  it("keeps a legacy value selectable with a PT-BR label, not the slug", () => {
    const list = ensureProfileOption(getProfiles("pessoa_fisica", "SUPPLIER"), "slug_removido_do_catalogo");
    expect(list.at(-1)).toEqual({ value: "slug_removido_do_catalogo", label: UNKNOWN_PROFILE_LABEL });
  });

  it("does not duplicate a value already in the list", () => {
    const base = getProfiles("pessoa_fisica", "PARTNER");
    expect(ensureProfileOption(base, "influenciador")).toBe(base);
  });
});
