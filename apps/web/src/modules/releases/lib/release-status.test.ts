import { describe, it, expect } from "vitest";
import { ReleaseStatus } from "@music-os-360/types";
import {
  RELEASE_DISPLAY_TO_BACKEND_STATUSES,
  RELEASE_STATUS_OPTIONS,
  resolveStatusFromRawStatus,
} from "./release-status";

/**
 * UI review H1: the status filter used to send the Portuguese display group
 * (e.g. "pendente") as ?status=, which the API (ReleaseStatus enum) rejects
 * with 400 on every option. Each filterable group must map to real backend
 * statuses, and every backend status must belong to exactly one group.
 */
describe("release-status — display groups ↔ backend statuses", () => {
  it("every filter option maps to at least one real ReleaseStatus", () => {
    const backend = Object.values(ReleaseStatus) as string[];
    for (const option of RELEASE_STATUS_OPTIONS) {
      const statuses = RELEASE_DISPLAY_TO_BACKEND_STATUSES[option.value] ?? [];
      expect(statuses.length).toBeGreaterThan(0);
      for (const status of statuses) expect(backend).toContain(status);
    }
  });

  it("every backend status is classified into a display group consistently", () => {
    for (const status of Object.values(ReleaseStatus)) {
      const group = resolveStatusFromRawStatus(status);
      expect(RELEASE_DISPLAY_TO_BACKEND_STATUSES[group]).toContain(status);
    }
  });

  it("filter options use English values and PT-BR labels", () => {
    for (const option of RELEASE_STATUS_OPTIONS) {
      expect(option.value).toMatch(/^[a-z_]+$/);
      expect(option.label).not.toBe(option.value);
    }
    expect(resolveStatusFromRawStatus("review")).toBe("pending");
    expect(resolveStatusFromRawStatus("draft")).toBe("incomplete");
  });
});
