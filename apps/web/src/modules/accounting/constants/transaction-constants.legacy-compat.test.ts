import { describe, expect, it } from "vitest";
import {
  canonicalTransactionCategory,
  getSubcategoriesForCategory,
  individualCompensationTypes,
} from "./transaction-constants";

// [legacy or canonical category as stored, stored subcategory, canonical subcategory]
const COMPENSATION_CASES: ReadonlyArray<readonly [string, string, string]> = [
  ["remuneracao", "pro-labore", "pro_labore"],
  ["compensation", "pro-labore", "pro_labore"],
  ["compensation", "pro_labore", "pro_labore"],
];

describe("transaction-constants legacy compat (pro_labore)", () => {
  it.each(COMPENSATION_CASES)("category %s + stored sub %s resolves to canonical %s", (category, storedSub, canonicalSub) => {
    const options = getSubcategoriesForCategory("expense", "individual", category);
    expect(options).toBe(individualCompensationTypes);
    const values = options.map((o) => o.value);
    expect(values).toContain(canonicalSub);
    expect(canonicalTransactionCategory(storedSub)).toBe(canonicalSub);
    // the stored value maps onto exactly one selectable option (no legacy-spelled option exists)
    expect(values.filter((v) => v === canonicalTransactionCategory(storedSub))).toHaveLength(1);
    expect(values).not.toContain("pro-labore");
  });

  it("a legacy category that is not a known slug yields no compensation options (no guessing)", () => {
    expect(getSubcategoriesForCategory("expense", "individual", "Remuneracao")).toEqual([]);
  });
});
