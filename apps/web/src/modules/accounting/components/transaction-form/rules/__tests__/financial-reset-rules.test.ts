import { describe, it, expect } from "vitest";
import { applyResets } from "../financial-reset-rules";

// ── transactionType resets ───────────────────────────────────────────────────
describe("applyResets — transactionType", () => {
  it("always resets category and downstream fields", () => {
    const result = applyResets("transactionType", "expense");
    expect(result.category).toBe("");
    expect(result.subcategory).toBe("");
    expect(result.investmentItem).toBe("");
    expect(result.artistId).toBe("");
    expect(result.projectId).toBe("");
    expect(result.contractId).toBe("");
    expect(result.eventId).toBe("");
    expect(result.travelReason).toBe("");
    expect(result.advertisingName).toBe("");
    expect(result.taxAuthority).toBe("");
  });

  it("resets counterpartyType when new value is 'tax'", () => {
    const result = applyResets("transactionType", "tax");
    expect(result.counterpartyType).toBe("");
  });

  it("resets counterpartyType when new value is 'transfer'", () => {
    const result = applyResets("transactionType", "transfer");
    expect(result.counterpartyType).toBe("");
  });

  it("resets counterpartyType when new value is 'investment'", () => {
    const result = applyResets("transactionType", "investment");
    expect(result.counterpartyType).toBe("");
  });

  it("does NOT reset counterpartyType when new value is 'expense'", () => {
    const result = applyResets("transactionType", "expense");
    expect(result.counterpartyType).toBeUndefined();
  });

  it("does NOT reset counterpartyType when new value is 'revenue'", () => {
    const result = applyResets("transactionType", "revenue");
    expect(result.counterpartyType).toBeUndefined();
  });
});

// ── counterpartyType resets ─────────────────────────────────────────────────────
describe("applyResets — counterpartyType", () => {
  it("resets all dependent fields when counterpartyType changes", () => {
    const result = applyResets("counterpartyType", "company");
    expect(result.category).toBe("");
    expect(result.subcategory).toBe("");
    expect(result.artistId).toBe("");
    expect(result.projectId).toBe("");
    expect(result.contractId).toBe("");
    expect(result.eventId).toBe("");
    expect(result.travelReason).toBe("");
    expect(result.advertisingName).toBe("");
  });

  it("does not reset investmentItem or taxAuthority (not in counterpartyType map)", () => {
    const result = applyResets("counterpartyType", "artist");
    expect(result.investmentItem).toBeUndefined();
    expect(result.taxAuthority).toBeUndefined();
  });

  it("does not reset transactionType", () => {
    const result = applyResets("counterpartyType", "individual");
    expect(result.transactionType).toBeUndefined();
  });
});

// ── category resets ────────────────────────────────────────────────────────
describe("applyResets — category", () => {
  it("resets subcategory and all downstream fields", () => {
    const result = applyResets("category", "services");
    expect(result.subcategory).toBe("");
    expect(result.investmentItem).toBe("");
    expect(result.artistId).toBe("");
    expect(result.projectId).toBe("");
    expect(result.contractId).toBe("");
    expect(result.eventId).toBe("");
    expect(result.travelReason).toBe("");
    expect(result.advertisingName).toBe("");
  });

  it("does not reset transactionType or counterpartyType", () => {
    const result = applyResets("category", "marketing");
    expect(result.transactionType).toBeUndefined();
    expect(result.counterpartyType).toBeUndefined();
  });
});

// ── artistId resets ────────────────────────────────────────────────
describe("applyResets — artistId", () => {
  it("resets projectId, eventId, contractId", () => {
    const result = applyResets("artistId", "artist-1");
    expect(result.projectId).toBe("");
    expect(result.eventId).toBe("");
    expect(result.contractId).toBe("");
  });

  it("does not reset unrelated fields", () => {
    const result = applyResets("artistId", "artist-1");
    expect(result.transactionType).toBeUndefined();
    expect(result.category).toBeUndefined();
    expect(result.subcategory).toBeUndefined();
  });
});

// ── paymentType resets ───────────────────────────────────────────────────
describe("applyResets — paymentType", () => {
  it("resets parcelas fields when switching to 'upfront'", () => {
    const result = applyResets("paymentType", "upfront");
    expect(result.installmentCount).toBe("");
    expect(result.installmentInterval).toBe("monthly");
    expect(result.firstInstallmentDate).toBe("");
  });

  it("does NOT reset parcelas fields when switching to 'installments'", () => {
    const result = applyResets("paymentType", "installments");
    expect(result.installmentCount).toBeUndefined();
    expect(result.installmentInterval).toBeUndefined();
    expect(result.firstInstallmentDate).toBeUndefined();
  });

  it("keeps installmentInterval default value ('monthly') when resetting to upfront", () => {
    const result = applyResets("paymentType", "upfront");
    expect(result.installmentInterval).toBe("monthly");
  });
});

// ── fields with no reset entries ───────────────────────────────────────────
describe("applyResets — fields not in RESET_MAP", () => {
  it("resets dependent linkage fields for subcategory", () => {
    const result = applyResets("subcategory", "graphic_design");
    expect(result).toMatchObject({
      artistId: "",
      projectId: "",
      contractId: "",
      eventId: "",
      counterpartyName: "",
      taxAuthority: "",
      linkType: "",
      costCenter: "",
      referenceMonth: "",
      sourceBankAccount: "",
      destinationBankAccount: "",
    });
  });

  it("returns empty object for description (no entry)", () => {
    const result = applyResets("description", "anything");
    expect(result).toEqual({});
  });

  it("returns empty object for amount (no entry)", () => {
    const result = applyResets("amount", "500");
    expect(result).toEqual({});
  });
});
