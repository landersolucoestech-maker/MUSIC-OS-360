import { describe, expect, it } from "vitest";
import { DEFAULT_FEATURE_FLAGS, PLAN_FLAGS, canonicalFeatureKeys } from "./feature-flags";

describe("feature flag keys", () => {
  it("uses the canonical English moduleHr flag", () => {
    expect(DEFAULT_FEATURE_FLAGS).toHaveProperty("moduleHr", true);
    expect(DEFAULT_FEATURE_FLAGS).not.toHaveProperty("moduleRh");
    expect(PLAN_FLAGS.starter).toHaveProperty("moduleHr", false);
  });

  it("canonicalFeatureKeys reads the legacy moduleRh key (canonical wins, other keys preserved)", () => {
    expect(canonicalFeatureKeys({ moduleRh: true, moduleCrm: false })).toEqual({ moduleHr: true, moduleCrm: false });
    expect(canonicalFeatureKeys({ moduleRh: true, moduleHr: false })).toEqual({ moduleHr: false });
    expect(canonicalFeatureKeys(null)).toEqual({});
  });
});
