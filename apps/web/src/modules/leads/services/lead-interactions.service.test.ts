import { describe, expect, it } from "vitest";
import { fromApi } from "./lead-interactions.service";

const base = { id: "i1", lead_id: "l1", type: "call", notes: null, created_by: "u1" };

describe("lead interaction reader", () => {
  it("reads the canonical occurred_at field", () => {
    expect(fromApi({ ...base, occurred_at: "2026-10-03T10:00:00Z" }).occurredAt).toBe("2026-10-03T10:00:00Z");
  });

  it("falls back to the legacy `data` field of an API deployed before the column rename", () => {
    expect(fromApi({ ...base, data: "2026-09-01T09:00:00Z" }).occurredAt).toBe("2026-09-01T09:00:00Z");
  });

  it("the canonical field wins over the legacy one", () => {
    expect(fromApi({ ...base, occurred_at: "2026-10-03T10:00:00Z", data: "2026-09-01T09:00:00Z" }).occurredAt).toBe("2026-10-03T10:00:00Z");
  });

  it("an interaction without any timestamp maps to an empty string, never to undefined", () => {
    expect(fromApi({ ...base }).occurredAt).toBe("");
  });
});
