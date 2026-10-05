import { describe, expect, it } from "vitest";
import { companyContactTypeOptions, contactTypeOptions, individualContactTypeOptions } from "./index";
import { contactTypes } from "../types";

describe("VIDEOMAKER contact type", () => {
  it("is offered in the individual contact type select with its PT-BR label", () => {
    expect(individualContactTypeOptions).toContainEqual({ value: "VIDEOMAKER", label: "Videomaker" });
  });
  it("is offered exactly once in the merged contact type select, not as a company type", () => {
    expect(contactTypeOptions.filter((o) => o.value === "VIDEOMAKER")).toEqual([{ value: "VIDEOMAKER", label: "Videomaker" }]);
    expect(companyContactTypeOptions.some((o) => o.value === "VIDEOMAKER")).toBe(false);
  });
  it("is an accepted ContactType value (types catalogue)", () => {
    expect(contactTypes).toContain("VIDEOMAKER");
    expect(contactTypes.filter((t) => t === "VIDEOMAKER")).toHaveLength(1);
  });
  it("every offered option value is an accepted contact type (constants and types stay in sync)", () => {
    for (const o of contactTypeOptions) expect(contactTypes as readonly string[]).toContain(o.value);
  });
  it("near-miss spellings are neither offered nor accepted", () => {
    for (const near of ["VIDEO_MAKER", "videomaker", "Videomaker", "VIDEOMAKERS"]) {
      expect(contactTypeOptions.some((o) => o.value === near)).toBe(false);
      expect(contactTypes as readonly string[]).not.toContain(near);
    }
  });
});
