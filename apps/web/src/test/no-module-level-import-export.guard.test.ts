/**
 * no-module-level-import-export.guard.test.ts  (Part 86)
 *
 * Permanent guard: data Import and Export must exist ONLY in the Reports
 * Center (modules/reports/). The modules below had their own Import/Export
 * buttons/handlers removed in this Part — confirms they don't reappear
 * (neither the button text nor a direct call to the generic client-side
 * helper shared/lib/xlsx.ts).
 *
 * Scope deliberately restricted to the files fixed in this Part, not the
 * entire repository: VariableRegistry.tsx / CategoryRegistry.tsx (contract
 * registries, with no equivalent entity in Reports), the
 * "Importar Relatório ECAD" button in RightsMonitoring.tsx (non-functional
 * stub, full dialog already implemented), the "Exportar OFX" button in
 * Accounting.tsx (bank
 * reconciliation domain, not entity data), and already-unrendered dead code
 * (Metricas.tsx `ExportDropdown`) are NOT covered by this guard — these are
 * remaining divergences documented in the Part 86 final report, not
 * silently ignored.
 *
 * AudiovisualProductionWorkspace.tsx (previously referenced here) was removed
 * in the product-completeness audit (Decision Gate item 10) — confirmed with
 * no route, no consumer; the dead-code guard was only documenting it.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC_ROOT = path.resolve(__dirname, "..");

const FIXED_MODULE_FILES = [
  "modules/projects/pages/Projects.tsx",
  "modules/catalog/pages/RegistroMusicas.tsx",
  "modules/rh/pages/RH.tsx",
  "modules/releases/pages/Releases.tsx",
  "modules/inventory/pages/Inventario.tsx",
  "modules/contracts/pages/Contracts.tsx",
  "modules/accounting/pages/ProfitAndLoss.tsx",
  // Task T (continuation): the "Exportar" button in Shares.tsx had no
  // onClick at all — clicking did nothing. Shares is already a reportable
  // entity in the Reports Center (REPORT_MODULE_REGISTRY); removed instead
  // of duplicating a local export, same policy as Part 86.
  "modules/releases/pages/Shares.tsx",
];

const BUTTON_TEXT_PATTERNS = [
  /Importar\s+XLSX/i,
  /Exportar\s+XLSX/i,
  /data-testid="button-import-/i,
  /data-testid="button-export-/i,
  /data-testid="button-export"/i,
];

describe("Permanent guard: modules fixed in Part 86 do not reintroduce their own Import/Export", () => {
  for (const rel of FIXED_MODULE_FILES) {
    const full = path.resolve(SRC_ROOT, rel);

    it(`${rel}: file exists`, () => {
      expect(fs.existsSync(full)).toBe(true);
    });

    it(`${rel}: does not import exportToXlsx/importXlsx from the generic helper`, () => {
      const content = fs.readFileSync(full, "utf8");
      expect(content).not.toMatch(/from ["']@\/shared\/lib\/xlsx["']/);
    });

    it(`${rel}: does not contain Import/Export button text/testid`, () => {
      const content = fs.readFileSync(full, "utf8");
      const hits = BUTTON_TEXT_PATTERNS.filter((p) => p.test(content)).map((p) => String(p));
      expect(hits).toEqual([]);
    });
  }
});
