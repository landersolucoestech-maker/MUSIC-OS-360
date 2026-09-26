/**
 * find-9e7bc94e — guard: the Financial Automations page must not suggest a
 * financial effect that does not exist. The only effect of a triggered rule
 * is a notification with the calculated value; no transaction entry is created.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const PAGE = fs.readFileSync(path.resolve(__dirname, "FinancialRules.tsx"), "utf8");

describe("FinancialRules — does not suggest a nonexistent financial effect", () => {
  it("declares 'nenhum lançamento financeiro é criado automaticamente'", () => {
    expect(PAGE).toMatch(/nenhum lançamento financeiro é criado automaticamente/);
  });
  it("no longer uses the old description that suggested an automatic consequence", () => {
    expect(PAGE).not.toMatch(/"Regras que disparam automaticamente ao assinar contratos/);
  });
});
