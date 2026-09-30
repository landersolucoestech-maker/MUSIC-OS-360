import { describe, expect, it } from "vitest";
import { getContractLifecycleState } from "./ContractStatusBadge";

const inDays = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();

describe("getContractLifecycleState", () => {
  it("is no_contract without contracts", () => {
    expect(getContractLifecycleState(undefined)).toBe("no_contract");
    expect(getContractLifecycleState(null)).toBe("no_contract");
    expect(getContractLifecycleState([])).toBe("no_contract");
  });

  it("is active for an in-force contract ending beyond 30 days", () => {
    expect(getContractLifecycleState([{ id: "1", status: "in_force", end_date: inDays(200) }])).toBe("active");
  });

  it("is expiring for an `expiring` status or an active contract ending within 30 days", () => {
    expect(getContractLifecycleState([{ id: "1", status: "expiring" }])).toBe("expiring");
    expect(getContractLifecycleState([{ id: "1", status: "active", end_date: inDays(10) }])).toBe("expiring");
  });

  it("is negotiating for draft/under_review only, and active wins over negotiating", () => {
    expect(getContractLifecycleState([{ id: "1", status: "draft" }])).toBe("negotiating");
    expect(getContractLifecycleState([{ id: "1", status: "under_review" }])).toBe("negotiating");
    expect(getContractLifecycleState([{ id: "1", status: "draft" }, { id: "2", status: "signed", end_date: inDays(300) }])).toBe("active");
  });

  it("does not treat terminated/expired/cancelled contracts as a lifecycle state", () => {
    expect(getContractLifecycleState([{ id: "1", status: "terminated" }, { id: "2", status: "cancelled" }, { id: "3", status: "expired" }])).toBe("no_contract");
  });
});
