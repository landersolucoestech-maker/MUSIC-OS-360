import { describe, expect, it } from "vitest";
import { normalizeFormStatus, tallyProjectStatuses, toProductStatus } from "./project-status";

describe("normalizeFormStatus", () => {
  it.each(["planning", "in_progress", "completed", "cancelled"])("keeps the product status %s", (status) => {
    expect(normalizeFormStatus(status)).toBe(status);
  });

  it("keeps the internal review state, so editing a project in review never moves it", () => {
    expect(normalizeFormStatus("review")).toBe("review");
    expect(normalizeFormStatus("  REVIEW ")).toBe("review");
  });

  it.each([undefined, null, "", "unknown", "draft"])("falls back to planning for %s", (value) => {
    expect(normalizeFormStatus(value as string | null | undefined)).toBe("planning");
  });
});

describe("toProductStatus", () => {
  it("presents the internal review state as in progress and leaves the others alone", () => {
    expect(toProductStatus("review")).toBe("in_progress");
    expect(toProductStatus("planning")).toBe("planning");
    expect(toProductStatus("completed")).toBe("completed");
    expect(toProductStatus("cancelled")).toBe("cancelled");
  });
});

describe("tallyProjectStatuses", () => {
  it("counts a project in review among the active ones", () => {
    expect(tallyProjectStatuses({ planning: 2, in_progress: 3, review: 4, completed: 5, cancelled: 6 }))
      .toEqual({ active: 7, completed: 5, drafts: 2 });
  });

  it("ignores cancelled and unknown buckets in the three dashboard figures", () => {
    expect(tallyProjectStatuses({ cancelled: 9, something_else: 1 })).toEqual({ active: 0, completed: 0, drafts: 0 });
  });

  it("is zero for no data", () => {
    expect(tallyProjectStatuses({})).toEqual({ active: 0, completed: 0, drafts: 0 });
  });
});
