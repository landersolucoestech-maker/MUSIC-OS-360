import { describe, it, expect } from "vitest";
import {
  LEGACY_OPERATIONAL_SLUGS,
  canonicalAllowedServiceSlugs,
  canonicalOperationalSlug,
  legacyOperationalSlugs,
  migrateLegacyDefaultItem,
} from "./operational-vocabulary";
import { DEFAULT_OPERATIONAL_LISTS } from "@/modules/settings/hooks/useOperationalSettings";

describe("operational vocabulary (legacy reader)", () => {
  it("every legacy slug maps to an existing default of the same kind, and is never itself canonical", () => {
    for (const [kind, map] of Object.entries(LEGACY_OPERATIONAL_SLUGS)) {
      const canonical = DEFAULT_OPERATIONAL_LISTS.filter((d) => d.kind === kind).map((d) => d.slug);
      for (const [legacy, target] of Object.entries(map)) {
        expect(canonical).toContain(target);
        expect(canonical).not.toContain(legacy);
      }
    }
  });

  it("maps legacy slugs, keeps canonical and tenant slugs, and never touches the deferred marketing kinds", () => {
    expect(canonicalOperationalSlug("lead_status", "novo_lead")).toBe("new");
    expect(canonicalOperationalSlug("lead_status", "new")).toBe("new");
    expect(canonicalOperationalSlug("lead_type", "custom_slug")).toBe("custom_slug");
    expect(canonicalOperationalSlug("marketing_sector", "Comunicação")).toBe("Comunicação");
    expect(legacyOperationalSlugs("event_type", "meetings")).toEqual(["reunioes"]);
  });

  it("migrates only an EXACT (kind, slug, name) legacy default", () => {
    const exact = { kind: "event_type", slug: "reunioes", name: "Reuniões" };
    expect(migrateLegacyDefaultItem(exact, DEFAULT_OPERATIONAL_LISTS).slug).toBe("meetings");
    const renamed = { kind: "event_type", slug: "reunioes", name: "Reunião de pauta" };
    expect(migrateLegacyDefaultItem(renamed, DEFAULT_OPERATIONAL_LISTS)).toBe(renamed);
    const otherKind = { kind: "service_interest", slug: "reunioes", name: "Reuniões" };
    expect(migrateLegacyDefaultItem(otherKind, DEFAULT_OPERATIONAL_LISTS)).toBe(otherKind);
    const apiSeed = { kind: "lead_status", slug: "proposta_enviada", name: "Proposta enviada" };
    expect(migrateLegacyDefaultItem(apiSeed, DEFAULT_OPERATIONAL_LISTS).slug).toBe("proposal");
  });

  it("canonicalises legacy service slugs listed in lead_type metadata", () => {
    expect(canonicalAllowedServiceSlugs({ allowed_service_slugs: ["gestao_artistica", "show_booking", "x"] })).toEqual(["artist_management", "show_booking", "x"]);
    expect(canonicalAllowedServiceSlugs({})).toBeUndefined();
  });
});
