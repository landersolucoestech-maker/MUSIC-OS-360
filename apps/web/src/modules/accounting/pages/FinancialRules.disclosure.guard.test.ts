/**
 * find-9e7bc94e — guarda: a página de Automações Financeiras não pode sugerir
 * efeito financeiro que não existe. O único efeito de uma regra disparada é
 * uma notificação com o valor calculado; nenhum lançamento é criado.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const PAGE = fs.readFileSync(path.resolve(__dirname, "FinancialRules.tsx"), "utf8");

describe("FinancialRules — sem sugerir efeito financeiro inexistente", () => {
  it("declara que nenhum lançamento financeiro é criado automaticamente", () => {
    expect(PAGE).toMatch(/nenhum lançamento financeiro é criado automaticamente/);
  });
  it("não usa mais a descrição antiga que sugeria consequência automática", () => {
    expect(PAGE).not.toMatch(/"Regras que disparam automaticamente ao assinar contratos/);
  });
});
