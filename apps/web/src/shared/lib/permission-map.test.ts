import { describe, expect, it } from "vitest";
import {
  expandPermissionAliases,
  permissionKeyEquivalents,
  tenantModulePermissionKeys,
} from "./permission-map";

describe("permission-map: hr/rh dual-read", () => {
  it("module `hr` (canonical) and `rh` (deprecated alias) both resolve to the hr resource with both spellings", () => {
    for (const module of ["hr", "rh"] as never[]) {
      expect(tenantModulePermissionKeys(module, "read")).toEqual(["hr:read", "rh:read"]);
      expect(tenantModulePermissionKeys(module, "write")).toEqual(["hr:update", "rh:update", "hr:create", "rh:create"]);
    }
  });

  it("other modules are untouched", () => {
    expect(tenantModulePermissionKeys("artists", "read")).toEqual(["artist:read"]);
    expect(permissionKeyEquivalents("catalog:read")).toEqual(["catalog:read"]);
  });

  it("a grant of one spelling is exactly a grant of the other (never widened)", () => {
    const legacy = expandPermissionAliases(["rh:read", "artist:read"]);
    expect([...legacy].sort()).toEqual(["artist:read", "hr:read", "rh:read"]);
    expect(legacy.has("hr:delete")).toBe(false);
    const canonical = expandPermissionAliases(["hr:update"]);
    expect(canonical.has("rh:update")).toBe(true);
    expect(canonical.has("rh:read")).toBe(false);
  });

  it("does not treat lookalike resources as hr", () => {
    expect(permissionKeyEquivalents("rhythm:read")).toEqual(["rhythm:read"]);
    expect(permissionKeyEquivalents("hrx:read")).toEqual(["hrx:read"]);
  });
});
