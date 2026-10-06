import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canonicalDistributorId, isOtherDistributorId, OTHER_DISTRIBUTOR_ID } from "./distributor-id";
import { DISTRIBUTOR_OPTIONS } from "@/modules/artist/forms/artist-form.definition";
import { wireToArtist, artistToWirePayload, type ArtistWireRecord } from "@/modules/artist/services/artist.mapper";

describe("distributor id dual-read (legacy `outros` -> canonical `other`)", () => {
  it("maps the exact legacy id only", () => {
    expect(canonicalDistributorId("outros")).toBe("other");
    expect(canonicalDistributorId("other")).toBe("other");
    expect(canonicalDistributorId("onerpm")).toBe("onerpm");
    expect(canonicalDistributorId(undefined)).toBeUndefined();
    expect(isOtherDistributorId("outros")).toBe(true);
    expect(isOtherDistributorId("other")).toBe(true);
    expect(isOtherDistributorId("onerpm")).toBe(false);
  });

  it("the form option list offers `other` and never `outros`", () => {
    const ids = DISTRIBUTOR_OPTIONS.map((o) => o.id as string);
    expect(ids).toContain(OTHER_DISTRIBUTOR_ID);
    expect(ids).not.toContain("outros");
  });

  it("the mapper reads legacy rows as `other` in every distributor list and writes `other`", () => {
    const legacy = { id: "outros", email: "", customName: "Minha" };
    const wire = {
      id: "a1",
      stage_name: "A",
      general_distributors: [legacy],
      relationships: [{ type: "agent", name: "X", phone: "", email: "", office: "", crc: "", responsibles: [], distributors: [legacy] }],
      linked_contacts: [{ contactId: "c1", distributors: [legacy] }],
      team_contacts: [{ name: "Y", category: "legal", phone: "", email: "", distributors: [legacy] }],
      selected_distributors: { outros: true },
    } as unknown as ArtistWireRecord;
    const artist = wireToArtist(wire);
    const expected = [{ id: "other", email: "", customName: "Minha" }];
    expect(artist.generalDistributors).toEqual(expected);
    expect(artist.relationships?.[0].distributors).toEqual(expected);
    expect(artist.linkedContacts?.[0].distributors).toEqual(expected);
    expect(artist.teamContacts?.[0].distributors).toEqual(expected);
    const stale = { generalDistributors: [legacy], teamContacts: [{ name: "Y", category: "legal", phone: "", email: "", distributors: [legacy] }] };
    const back = artistToWirePayload(stale as never);
    expect(JSON.stringify(back)).not.toContain("outros");
    expect(back.general_distributors).toEqual(expected);
  });

  it("no web component hardcodes the legacy id", () => {
    for (const file of ["components/ArtistFormModal.tsx", "components/TeamContactsCrm.tsx", "forms/artist-form.definition.ts"]) {
      expect(readFileSync(join(__dirname, "..", file), "utf8")).not.toMatch(/["']outros["']/);
    }
  });
});
