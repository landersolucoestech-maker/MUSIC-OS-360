import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  REPORT_FORM_CONTRACTS,
  contractExportableColumns,
} from './form-contracts/report-form-contracts';
import { tryGetFieldLabelPtBr } from './i18n/field-labels.pt-br';

const REPORTS_ROOT = join(__dirname);
const SELF = 'single-sheet.guard.spec.ts';
const FORBIDDEN_EXECUTABLE_TOKENS = [
  'childSheets',
  'ChildSheet',
  'child-sheet',
  'toXlsxMultiSheet',
  'serializeWithChildSheets',
] as const;
const FORBIDDEN_ACTIVE_LABELS = new Set([
  'Projeto ID de referência',
  'Músicas do Projeto',
]);

function isOperationalSource(entry: string): boolean {
  return /\.ts$/.test(entry) &&
    entry !== SELF &&
    !/\.(spec|test|e2e-spec)\.ts$/.test(entry);
}

function sourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    const absolute = join(directory, entry);
    const stats = statSync(absolute);
    if (stats.isDirectory()) files.push(...sourceFiles(absolute));
    else if (isOperationalSource(entry)) files.push(absolute);
  }
  return files;
}

/**
 * Historical comments may document the migration from auxiliary sheets to
 * repeating groups. The guard must analyze executable code, not documentation.
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

describe('Reports Center — single-sheet XLSX architecture', () => {
  it('contains no executable APIs from the old multi-sheet architecture', () => {
    const violations: string[] = [];
    for (const file of sourceFiles(REPORTS_ROOT)) {
      const content = stripComments(readFileSync(file, 'utf8'));
      for (const token of FORBIDDEN_EXECUTABLE_TOKENS) {
        if (content.includes(token)) {
          violations.push(`${relative(REPORTS_ROOT, file)}: ${token}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('no active contract exports a technical ID or auxiliary-sheet label', () => {
    const violations: string[] = [];
    for (const [table, contract] of Object.entries(REPORT_FORM_CONTRACTS)) {
      const columns = contractExportableColumns(contract);
      if (columns.includes('projetoRef')) violations.push(`${table}.projetoRef`);

      for (const column of columns) {
        const label = tryGetFieldLabelPtBr(column);
        if (label && FORBIDDEN_ACTIVE_LABELS.has(label)) {
          violations.push(`${table}.${column}: ${label}`);
        }
      }

      if (contract.repeatingGroup && /sheet|aba/i.test(contract.repeatingGroup.key)) {
        violations.push(`${table}.${contract.repeatingGroup.key}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it("keeps 'Contatos' and 'Leads' without the CRM prefix in the Reports Center", () => {
    const registry = readFileSync(join(REPORTS_ROOT, 'report-module-registry.ts'), 'utf8');
    expect(registry).toContain("label: 'Contatos'");
    expect(registry).toContain("label: 'Leads'");
    expect(registry).not.toContain('CRM — Contatos');
    expect(registry).not.toContain('CRM — Leads');
  });
});
