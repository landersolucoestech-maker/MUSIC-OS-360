import { describe, it, expect } from "vitest";
import type { Release } from "@/modules/releases/types";
import { resolveStatusFromRawStatus, resolveReleaseStatus, releaseStatusLabel } from "./release-status";

describe("release status legacy Portuguese values", () => {
  it.each([
    ["rejeitado", "rejected"],
    ["REJEITADO", "rejected"],
    ["remocao", "takedown"],
    ["take_down", "takedown"],
    ["rejected", "incomplete"], // not a backend status: only the legacy alias maps, canonical backend values do not
  ])("raw status %s resolves to %s", (raw, canonical) => {
    expect(resolveStatusFromRawStatus(raw)).toBe(canonical);
  });

  it.each([
    ["rejeitado", "Rejeitado"],
    ["remocao", "Takedown"],
  ])("a release row with legacy status %s shows the canonical label %s", (status, label) => {
    const release = { status } as unknown as Release & Record<string, unknown>;
    expect(releaseStatusLabel(resolveReleaseStatus(release))).toBe(label);
  });
});
