import { describe, expect, it } from "vitest";
import { artistToFormFields } from "./artist.mapper";
import type { Artist } from "../types/artist.types";

function legacyArtist(extra: Record<string, unknown>): Artist {
  return { id: "a1", stageName: "Legacy", ...extra } as unknown as Artist;
}

describe("legacy distributor selection migrates to the canonical distributor id", () => {
  it("agent: selection {outros:true} maps to id 'other' keeping its e-mail; other ids stay untouched", () => {
    const form = artistToFormFields(
      legacyArtist({
        agentName: "Agent",
        selectedDistributors: { outros: true, onerpm: true, tunecore: false },
        distributorEmails: { outros: "o@x.com", onerpm: "d@x.com" },
      }),
    );
    expect(form.relationships).toHaveLength(1);
    const dists = form.relationships[0].distributors;
    expect(dists).toEqual([
      { id: "other", email: "o@x.com" },
      { id: "onerpm", email: "d@x.com" },
    ]);
    expect(dists.some((d) => d.id === "outros")).toBe(false);
  });

  it("label: company selection {outros:true} maps to 'other' on the label relationship", () => {
    const form = artistToFormFields(
      legacyArtist({
        agentName: "Agent",
        recordLabelName: "Label",
        selectedDistributors: {},
        companySelectedDistributors: { outros: true },
        companyDistributorEmails: {},
      }),
    );
    const label = form.relationships.find((r) => r.type === "record_label")!;
    expect(label.distributors).toEqual([{ id: "other", email: "" }]);
  });
});
