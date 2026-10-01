import { describe, expect, it } from "vitest";
import {
  EXTERNAL_RIGHTS_RECEIPTS_CATEGORY, LEGACY_EXTERNAL_RIGHTS_RECEIPTS_CATEGORY,
  artistRevenueCategories, canonicalTransactionCategory, transactionCategoryLabel,
} from "./transaction-constants";
import { transactionToFormFields } from "../services/entity-to-form.mapper";

describe("external_rights_receipts (CT1)", () => {
  it("the artist revenue option writes the canonical id with the PT-BR label", () => {
    const option = artistRevenueCategories.find((c) => c.value === EXTERNAL_RIGHTS_RECEIPTS_CATEGORY);
    expect(option?.label).toBe("Recebimentos externos de direitos");
    expect(artistRevenueCategories.some((c) => c.value === LEGACY_EXTERNAL_RIGHTS_RECEIPTS_CATEGORY)).toBe(false);
  });

  it("dual-reads the legacy phrase: label and edit-form hydration", () => {
    expect(canonicalTransactionCategory(LEGACY_EXTERNAL_RIGHTS_RECEIPTS_CATEGORY)).toBe("external_rights_receipts");
    expect(canonicalTransactionCategory("marketing")).toBe("marketing");
    expect(transactionCategoryLabel(LEGACY_EXTERNAL_RIGHTS_RECEIPTS_CATEGORY)).toBe("Recebimentos externos de direitos");
    expect(transactionCategoryLabel("external_rights_receipts")).toBe("Recebimentos externos de direitos");
    expect(transactionToFormFields({ category: LEGACY_EXTERNAL_RIGHTS_RECEIPTS_CATEGORY }).category).toBe("external_rights_receipts");
    expect(transactionToFormFields({ category: "external_rights_receipts" }).category).toBe("external_rights_receipts");
  });
});
