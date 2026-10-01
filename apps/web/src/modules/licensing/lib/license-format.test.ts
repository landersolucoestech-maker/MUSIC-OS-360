import { describe, it, expect } from "vitest";
import { LicenseStatus } from "@music-os-360/types";
import type { Work } from "@/modules/catalog/types/catalog.types";
import { formatRemuneration, workArtistLabel, licenseStatusLabel, mediaLabel, territoryLabel, typeLabel } from "./license-format";

describe("license-format (CZ-035 canonical vocabulary)", () => {
  it("labels every LicenseStatus in PT-BR, never the raw value", () => {
    for (const status of Object.values(LicenseStatus)) {
      expect(licenseStatusLabel(status)).not.toBe(status);
    }
    expect(licenseStatusLabel("unknown_value")).toBe("Status não reconhecido");
  });

  it("labels the canonical type, media and territory codes and hides unknown raw values", () => {
    expect(typeLabel("sync_advertising")).toBe("Sync Publicidade");
    expect(typeLabel("mechanical")).toBe("Mecânica");
    expect(mediaLabel("free_tv")).toBe("TV Aberta");
    expect(territoryLabel("latin_america")).toBe("América Latina");
    expect(territoryLabel("unknown_code")).toBe("Valor não reconhecido");
    expect(mediaLabel(null)).toBe("—");
  });

  it("formats the structured remuneration from amount/percentage only", () => {
    expect(formatRemuneration({ remuneration_type: "PERCENTAGE", currency: "BRL", amount: null, percentage: 15 })).toBe("15%");
    expect(formatRemuneration({ remuneration_type: "FIXED", currency: "USD", amount: 1000, percentage: null })).toContain("US$");
  });

  it("derives the work artist from the linked artist, then the composers; the dropped `interpretes` column is not read", () => {
    const base = { composer_names: ["Compositor"] } as unknown as Work;
    expect(workArtistLabel({ ...base, artist: { stage_name: "Linked" } } as unknown as Work)).toBe("Linked");
    expect(workArtistLabel({ ...base, interpretes: "Old Performer" } as unknown as Work)).toBe("Compositor");
    expect(workArtistLabel(null)).toBe("");
  });
});
