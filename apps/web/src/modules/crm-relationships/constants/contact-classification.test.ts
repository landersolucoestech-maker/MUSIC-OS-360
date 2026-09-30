import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CONTACT_PROFILES,
  DEFAULT_CONTACT_PROFILE,
  LEGACY_CONTACT_PROFILES,
  canonicalContactProfile,
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
    expect(profileLabel("show_booker", "individual", "CORPORATE_CLIENT")).toBe("Contratante de Show");
  });

  it("finds a legacy profile saved under another category by its real label", () => {
    // business_partner exists under PARTNER, not under SUPPLIER
    expect(profileLabel("business_partner", "individual", "SUPPLIER")).toBe("Parceiro Comercial");
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
    expect(ensureProfileOption(base, "influencer")).toBe(base);
  });
});

describe("contact profile vocabulary (English ids, PT-BR labels, legacy reader)", () => {
  const catalog = Object.values(CONTACT_PROFILES).flatMap((byCategory) => Object.values(byCategory).flat());
  const ids = [...new Set(catalog.map((o) => o.value))];
  const api = readFileSync(resolve(__dirname, "../../../../../api/src/modules/clients/client-profile-vocabulary.ts"), "utf8");
  const quoted = (source: string) => [...source.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

  it("catalog values are English snake_case and the same id always has the same label", () => {
    expect(ids).toHaveLength(60);
    for (const id of ids) expect(id).toMatch(/^[a-z][a-z0-9_]*$/);
    const byId = new Map<string, string>();
    for (const o of catalog) expect(byId.get(o.value) ?? o.label).toBe((byId.set(o.value, byId.get(o.value) ?? o.label), o.label));
    expect(DEFAULT_CONTACT_PROFILE).toBe("other");
    expect(ids).toContain(DEFAULT_CONTACT_PROFILE);
  });

  it("catalog ids equal the API CLIENT_PROFILES and the legacy map equals the API map (set equality)", () => {
    expect([...ids].sort()).toEqual(quoted(/CLIENT_PROFILES = \[([^\]]*)\]/.exec(api)![1]).sort());
    const block = /LEGACY_CLIENT_PROFILES[^=]*= \{([^}]*)\}/.exec(api)![1];
    const pairs = [...block.matchAll(/(\w+): '([a-z_]+)'/g)].map((m) => [m[1], m[2]]);
    expect(Object.entries(LEGACY_CONTACT_PROFILES).sort()).toEqual(pairs.sort());
  });

  it("maps all 50 deprecated slugs onto catalog ids, never shadowing a canonical id", () => {
    expect(Object.keys(LEGACY_CONTACT_PROFILES)).toHaveLength(50);
    for (const [legacy, canonical] of Object.entries(LEGACY_CONTACT_PROFILES)) {
      expect(ids).toContain(canonical);
      expect(ids).not.toContain(legacy);
    }
    expect(Object.values(LEGACY_CONTACT_PROFILES)).toHaveLength(new Set(Object.values(LEGACY_CONTACT_PROFILES)).size);
  });

  it("reads legacy rows as canonical, keeps canonical (canonical wins) and unknown values", () => {
    expect(canonicalContactProfile("gravadora_selo")).toBe("record_label");
    expect(canonicalContactProfile("outros")).toBe("other");
    expect(canonicalContactProfile("ecad")).toBe("ecad");
    expect(canonicalContactProfile("manager")).toBe("manager");
    expect(canonicalContactProfile("cartorio")).toBe("notary_office");
    expect(canonicalContactProfile("produtora")).toBe("produtora");
  });

  it("displays legacy rows with their PT-BR label and keeps them selectable as the canonical option", () => {
    expect(profileLabel("gravadora_selo", "company", "PARTNER")).toBe("Gravadora/Selo");
    expect(profileLabel("outros")).toBe("Outros");
    expect(ensureProfileOption(getProfiles("company", "PARTNER"), "gravadora_selo")).toBe(getProfiles("company", "PARTNER"));
  });
});
