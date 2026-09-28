import { describe, expect, it } from "vitest";
import { distributorLabel, UNKNOWN_DISTRIBUTOR_LABEL } from "./distributor-label";
import { DISTRIBUTOR_OPTIONS } from "@/modules/artist/forms/artist-form.definition";

describe("distributorLabel", () => {
  it("labels every id the artist form writes", () => {
    for (const option of DISTRIBUTOR_OPTIONS) {
      if (option.id === "outros") continue;
      expect(distributorLabel(option.id)).toBe(option.label);
    }
  });

  it("labels the legacy selected_distributors ids", () => {
    expect(distributorLabel("cdbaby")).toBe("CD Baby");
    expect(distributorLabel("tunecore")).toBe("TuneCore");
  });

  it("uses the custom name for 'outros'", () => {
    expect(distributorLabel("outros", " Minha Distro ")).toBe("Minha Distro");
    expect(distributorLabel("outros", "")).toBe("Outros");
  });

  it("never shows a raw unknown id", () => {
    expect(distributorLabel("xyz_distro")).toBe(UNKNOWN_DISTRIBUTOR_LABEL);
    expect(distributorLabel("toString")).toBe(UNKNOWN_DISTRIBUTOR_LABEL);
    expect(distributorLabel(undefined)).toBe(UNKNOWN_DISTRIBUTOR_LABEL);
  });
});
