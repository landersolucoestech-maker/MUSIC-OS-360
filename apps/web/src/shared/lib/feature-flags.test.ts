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

  it("canonical wins in BOTH key orders: a stale legacy flag listed after the canonical one must not override it", () => {
    const legacy = "moduleRh";
    const canonical = "moduleHr";
    expect(canonicalFeatureKeys({ [canonical]: false, [legacy]: true })).toEqual({ [canonical]: false });
    expect(canonicalFeatureKeys({ [legacy]: true, [canonical]: false })).toEqual({ [canonical]: false });
    expect(canonicalFeatureKeys({ [canonical]: true, [legacy]: false, moduleCrm: true })).toEqual({ [canonical]: true, moduleCrm: true });
  });

  it("legacy-only maps to canonical and drops the legacy key", () => {
    const out = canonicalFeatureKeys({ ["moduleRh"]: false });
    expect(out).toEqual({ moduleHr: false });
    expect(Object.keys(out)).toEqual(["moduleHr"]);
  });
});

describe("canonicalFeatureKeys: prototype guard", () => {
  it("a __proto__ key from a parsed response is dropped: the result keeps the plain Object prototype and no flag is inherited", () => {
    const hostile = JSON.parse('{"__proto__":{"moduleBilling":true},"moduleHr":true}') as Record<string, unknown>;
    const out = canonicalFeatureKeys(hostile);
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect((out as { moduleBilling?: unknown }).moduleBilling).toBeUndefined();
    expect(Object.keys(out)).toEqual(["moduleHr"]);
  });
});
