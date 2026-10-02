import { describe, expect, it } from "vitest";
import {
  LEGACY_TRANSACTION_CATEGORY_SLUGS,
  UNCHANGED_TRANSACTION_CATEGORY_SLUGS,
  canonicalTransactionSlug,
  sameTransactionSlug,
} from "./transaction-category-slugs";

// [stored value, canonical id]. Statutory acronyms keep their spelling (no alias row);
// the legacy kebab-case spelling of `pro_labore` is read as the canonical id.
const STORED_TO_CANONICAL: ReadonlyArray<readonly [string, string]> = [
  ["das", "das"],
  ["icms", "icms"],
  ["iptu", "iptu"],
  ["ipva", "ipva"],
  ["irrf", "irrf"],
  ["pro-labore", "pro_labore"],
  ["pro_labore", "pro_labore"],
];

describe("transaction category slug read-compat (legacy in, canonical out)", () => {
  it.each(STORED_TO_CANONICAL)("reads %s as %s", (stored, canonical) => {
    expect(canonicalTransactionSlug(stored)).toBe(canonical);
    expect(sameTransactionSlug(stored, canonical)).toBe(true);
  });

  it("keeps the statutory acronyms out of the alias map and in the unchanged list", () => {
    for (const acronym of ["das", "icms", "iptu", "ipva", "irrf"]) {
      expect(Object.prototype.hasOwnProperty.call(LEGACY_TRANSACTION_CATEGORY_SLUGS, acronym)).toBe(false);
      expect(UNCHANGED_TRANSACTION_CATEGORY_SLUGS).toContain(acronym);
    }
  });

  it("never writes a legacy spelling for pro_labore: the alias map targets only the canonical id", () => {
    expect(LEGACY_TRANSACTION_CATEGORY_SLUGS["pro-labore"]).toBe("pro_labore");
    expect(Object.values(LEGACY_TRANSACTION_CATEGORY_SLUGS)).not.toContain("pro-labore");
    expect(canonicalTransactionSlug("pro-labore")).not.toBe("pro-labore");
  });

  it("does not guess: unknown and case-variant values pass through untouched", () => {
    expect(canonicalTransactionSlug("PRO-LABORE")).toBe("PRO-LABORE");
    expect(canonicalTransactionSlug("Pro Labore")).toBe("Pro Labore");
    expect(sameTransactionSlug("pro-labore", "salary")).toBe(false);
  });
});
