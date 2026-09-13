/**
 * finance-category-rules-endpoint.guard.test.ts
 *
 * Guarda permanente (Task T): FinanceCategoryRules.tsx chamava endpoints que
 * nunca existiram no backend (/financial-categories/rules*), fazendo toda
 * ação da página (listar/criar/editar/excluir regras) falhar com 404/400. O
 * backend real para regras de categorização por palavra-chave vive em
 * /finance-category-rules (apps/api/src/modules/finance-category-rules).
 * Este teste falha se a página ou seus serviços voltarem a apontar para o
 * endpoint inexistente.
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

describe("FinanceCategoryRules — nenhuma chamada aponta para o endpoint inexistente", () => {
  it("a página não importa nem referencia /financial-categories/rules", () => {
    expect(PAGE_SOURCE).not.toMatch(/financial-categories\/rules/);
    expect(PAGE_SOURCE).not.toMatch(/financeCategorizationRulesService/);
  });

  it("finance-category-rules.service.ts usa apenas /finance-category-rules", () => {
    expect(RULES_SERVICE_SOURCE).not.toMatch(/financial-categories\/rules/);
    expect(RULES_SERVICE_SOURCE).toMatch(/\/finance-category-rules/);
  });

  it("financial-categories.service.ts não expõe mais os métodos falsos de regras", () => {
    expect(CATEGORIES_SERVICE_SOURCE).not.toMatch(/\/financial-categories\/rules/);
    expect(CATEGORIES_SERVICE_SOURCE).not.toMatch(/\bcreateRule\b/);
    expect(CATEGORIES_SERVICE_SOURCE).not.toMatch(/\bpreviewRules\b/);
    expect(CATEGORIES_SERVICE_SOURCE).not.toMatch(/\bexecuteRules\b/);
    expect(CATEGORIES_SERVICE_SOURCE).not.toMatch(/\bmerge\s*:/);
    expect(CATEGORIES_SERVICE_SOURCE).not.toMatch(/\bsuggest\s*:/);
  });

  it("a página usa financeCategoryRulesService (backend real)", () => {
    expect(PAGE_SOURCE).toMatch(/financeCategoryRulesService/);
  });
});
