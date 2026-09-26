/**
 * finance-category-rules-endpoint.guard.test.ts
 *
 * Permanent guard (Task T): FinanceCategoryRules.tsx called endpoints that
 * never existed in the backend (/financial-categories/rules*), making every
 * action on the page (list/create/edit/delete rules) fail with 404/400. The
 * real backend for keyword categorization rules lives at
 * /finance-category-rules (apps/api/src/modules/finance-category-rules).
 * This test fails if the page or its services point back to the
 * nonexistent endpoint.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const PAGE_SOURCE = fs.readFileSync(path.resolve(__dirname, "FinanceCategoryRules.tsx"), "utf8");
const RULES_SERVICE_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "../services/finance-category-rules.service.ts"),
  "utf8",
);
const CATEGORIES_SERVICE_SOURCE = fs.readFileSync(
  path.resolve(__dirname, "../services/financial-categories.service.ts"),
  "utf8",
);

describe("FinanceCategoryRules — no call targets the nonexistent endpoint", () => {
  it("the page neither imports nor references /financial-categories/rules", () => {
    expect(PAGE_SOURCE).not.toMatch(/financial-categories\/rules/);
    expect(PAGE_SOURCE).not.toMatch(/financeCategorizationRulesService/);
  });

  it("finance-category-rules.service.ts uses only /finance-category-rules", () => {
    expect(RULES_SERVICE_SOURCE).not.toMatch(/financial-categories\/rules/);
    expect(RULES_SERVICE_SOURCE).toMatch(/\/finance-category-rules/);
  });

  it("financial-categories.service.ts no longer exposes the fake rules methods", () => {
    expect(CATEGORIES_SERVICE_SOURCE).not.toMatch(/\/financial-categories\/rules/);
    expect(CATEGORIES_SERVICE_SOURCE).not.toMatch(/\bcreateRule\b/);
    expect(CATEGORIES_SERVICE_SOURCE).not.toMatch(/\bpreviewRules\b/);
    expect(CATEGORIES_SERVICE_SOURCE).not.toMatch(/\bexecuteRules\b/);
    expect(CATEGORIES_SERVICE_SOURCE).not.toMatch(/\bmerge\s*:/);
    expect(CATEGORIES_SERVICE_SOURCE).not.toMatch(/\bsuggest\s*:/);
  });

  it("the page uses financeCategoryRulesService (real backend)", () => {
    expect(PAGE_SOURCE).toMatch(/financeCategoryRulesService/);
  });
});
