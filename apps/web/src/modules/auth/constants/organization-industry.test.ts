import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  LEGACY_ORGANIZATION_INDUSTRIES,
  ONBOARDING_INDUSTRY_VALUES,
  ORGANIZATION_INDUSTRIES,
  ORGANIZATION_INDUSTRY_LABELS_PT_BR,
  REGISTER_INDUSTRY_OPTIONS,
  REGISTER_INDUSTRY_VALUES,
  normalizeOrganizationIndustry,
  organizationIndustryLabel,
} from "./organization-industry";

const quoted = (source: string): string[] => [...source.matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);

describe("organization industry vocabulary (web mirror of the API)", () => {
  const api = readFileSync(resolve(__dirname, "../../../../../api/src/modules/auth/organization-industry.ts"), "utf8");

  it("canonical ids equal the API vocabulary (set equality)", () => {
    const block = /ORGANIZATION_INDUSTRIES = \[([^\]]*)\]/.exec(api)![1];
    expect([...ORGANIZATION_INDUSTRIES].sort()).toEqual(quoted(block).sort());
  });

  it("the deprecated map equals the API map", () => {
    const block = /LEGACY_ORGANIZATION_INDUSTRIES[^=]*= \{([^}]*)\}/.exec(api)![1];
    const pairs = [...block.matchAll(/(\w+): '([a-z_]+)'/g)].map((m) => [m[1], m[2]]);
    expect(Object.entries(LEGACY_ORGANIZATION_INDUSTRIES).sort()).toEqual(pairs.sort());
  });

  it("every id has a PT-BR label and the forms only offer canonical ids", () => {
    expect(Object.keys(ORGANIZATION_INDUSTRY_LABELS_PT_BR).sort()).toEqual([...ORGANIZATION_INDUSTRIES].sort());
    for (const v of [...REGISTER_INDUSTRY_VALUES, ...ONBOARDING_INDUSTRY_VALUES]) {
      expect(ORGANIZATION_INDUSTRIES as readonly string[]).toContain(v);
    }
    expect(REGISTER_INDUSTRY_OPTIONS.map((o) => o.label)).toEqual(["Gravadora", "Editora Musical", "Produtora Musical", "Escritório Artístico"]);
  });

  it("legacy values map onto canonical ids and never shadow a canonical id", () => {
    for (const [legacy, canonical] of Object.entries(LEGACY_ORGANIZATION_INDUSTRIES)) {
      expect(ORGANIZATION_INDUSTRIES as readonly string[]).toContain(canonical);
      expect(ORGANIZATION_INDUSTRIES as readonly string[]).not.toContain(legacy);
    }
  });

  it("reads legacy rows as canonical (canonical wins) and labels them in PT-BR", () => {
    expect(normalizeOrganizationIndustry("gravadora")).toBe("record_label");
    expect(normalizeOrganizationIndustry("publisher")).toBe("publisher");
    expect(normalizeOrganizationIndustry("record_label")).toBe("record_label");
    expect(normalizeOrganizationIndustry("escritorio")).toBe("artist_management");
    expect(normalizeOrganizationIndustry("???")).toBe("other");
    expect(organizationIndustryLabel("editora")).toBe("Editora Musical");
  });

  it("the Register form schema sends values the API accepts (the list the API test parses)", () => {
    const source = readFileSync(resolve(__dirname, "./organization-industry.ts"), "utf8");
    expect(/REGISTER_INDUSTRY_VALUES = \[([^\]]*)\]/.exec(source)![1].match(/"[a-z_]+"/g)).toHaveLength(REGISTER_INDUSTRY_VALUES.length);
  });
});
