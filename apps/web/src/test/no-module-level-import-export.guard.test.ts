/**
 * no-module-level-import-export.guard.test.ts  (Parte 86)
 *
 * Guarda permanente: Importação e Exportação de dados devem existir SOMENTE
 * na Central de Relatórios (modules/reports/). Os módulos abaixo tiveram seus
 * botões/handlers próprios de Importar/Exportar removidos nesta Parte —
 * confirma que não reaparecem (nem o texto do botão, nem uma chamada direta
 * ao helper client-side genérico shared/lib/xlsx.ts).
 *
 * Escopo deliberadamente restrito aos arquivos corrigidos nesta Parte, não ao
 * repositório inteiro: VariableRegistry.tsx / CategoryRegistry.tsx (registros
 * de contrato, sem entidade equivalente em Relatórios), o botão "Importar
 * Relatório ECAD" em RightsMonitoring.tsx (stub não funcional, dialog
 * completo já implementado), o "Exportar OFX" de Accounting.tsx (domínio de
 * conciliação bancária, não dado de entidade) e código morto já
 * não-renderizado (Metricas.tsx `ExportDropdown`) NÃO estão cobertos por
 * este guard — são divergências remanescentes documentadas no relatório
 * final da Parte 86, não silenciosamente ignoradas.
 *
 * AudiovisualProductionWorkspace.tsx (citado aqui anteriormente) foi removido
 * no audit de completude do produto (Decision Gate item 10) — confirmado sem
 * rota, sem consumidor, guarda de dead-code só documentava.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.resolve(__dirname, "..");

const FIXED_MODULE_FILES = [
  "modules/projects/pages/Projects.tsx",
  "modules/catalog/pages/RegistroMusicas.tsx",
  "modules/rh/pages/RH.tsx",
  "modules/releases/pages/Lancamentos.tsx",
  "modules/inventory/pages/Inventario.tsx",
  "modules/contracts/pages/Contracts.tsx",
  "modules/accounting/pages/ProfitAndLoss.tsx",
  // Task T (continuidade): botão "Exportar" em GestaoShares.tsx não tinha
  // onClick algum — clicar não fazia nada. Shares já é entidade reportável
  // na Central de Relatórios (REPORT_MODULE_REGISTRY); removido em vez de
  // duplicar export local, mesma política da Parte 86.
  "modules/releases/pages/GestaoShares.tsx",
];

const BUTTON_TEXT_PATTERNS = [
  /Importar\s+XLSX/i,
  /Exportar\s+XLSX/i,
  /data-testid="button-import-/i,
  /data-testid="button-export-/i,
  /data-testid="button-export"/i,
];

describe("Guarda permanente: módulos corrigidos na Parte 86 não reintroduzem Importar/Exportar próprio", () => {
  for (const rel of FIXED_MODULE_FILES) {
    const full = path.resolve(SRC_ROOT, rel);

    it(`${rel}: arquivo existe`, () => {
      expect(fs.existsSync(full)).toBe(true);
    });

    it(`${rel}: não importa exportToXlsx/importXlsx do helper genérico`, () => {
      const content = fs.readFileSync(full, "utf8");
      expect(content).not.toMatch(/from ["']@\/shared\/lib\/xlsx["']/);
    });

    it(`${rel}: não contém texto/testid de botão Importar/Exportar`, () => {
      const content = fs.readFileSync(full, "utf8");
      const hits = BUTTON_TEXT_PATTERNS.filter((p) => p.test(content)).map((p) => String(p));
      expect(hits).toEqual([]);
    });
  }
});
