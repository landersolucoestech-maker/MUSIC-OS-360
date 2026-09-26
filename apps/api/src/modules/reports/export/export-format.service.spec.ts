import * as XLSX from 'xlsx';
import {
  ExportFormatService, sanitizeExcelCellValue, EXCEL_CELL_MAX_CHARS,
  neutralizeFormulaInjection,
} from './export-format.service';

describe('ExportFormatService — XLSX serialization', () => {
  const svc = new ExportFormatService();

  function readFirstSheetRows(buf: Buffer): unknown[][] {
    const wb = XLSX.read(buf, { type: 'buffer' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });
  }

  it('headers use pt-BR label, never the technical key', () => {
    const buf = svc.toXlsx('artists', 'Artistas', ['nome_artistico'], [{ nome_artistico: 'Ana' }]);
    const rows = readFirstSheetRows(buf);
    expect(rows[0]).toContain('Nome artístico');
    expect(rows[0]).not.toContain('nome_artistico');
  });

  it('text field exceeding the Excel cell limit is truncated (never breaks the export)', () => {
    const huge = 'A'.repeat(40000);
    const buf = svc.toXlsx('contract_templates', 'Contratos', ['conteudo'], [{ conteudo: huge }]);
    const rows = readFirstSheetRows(buf);
    const cell = String(rows[1][0]);
    expect(cell.length).toBeLessThanOrEqual(32767);
    expect(cell).toContain('truncado');
  });

  it('value within the limit is not altered', () => {
    const normal = 'Texto normal de observação.';
    const buf = svc.toXlsx('artists', 'Artistas', ['notes'], [{ notes: normal }]);
    const rows = readFirstSheetRows(buf);
    expect(rows[1][0]).toBe(normal);
  });

  describe('sanitizeExcelCellValue — last barrier before Excel (all entities)', () => {
    it('null/undefined become an empty cell', () => {
      expect(sanitizeExcelCellValue(null, { entity: 'artists', column: 'x' })).toBe('');
      expect(sanitizeExcelCellValue(undefined, { entity: 'artists', column: 'x' })).toBe('');
    });

    it('raw object/array NEVER becomes a cell (defense in depth, even though it should already have been excluded earlier)', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      expect(sanitizeExcelCellValue({ a: 1 }, { entity: 'artists', column: 'metadata' })).toBe('');
      expect(sanitizeExcelCellValue([1, 2, 3], { entity: 'artists', column: 'tags' })).toBe('');
      expect(warn).toHaveBeenCalled();
      warn.mockRestore();
    });

    it('logs entity, column and size when truncating (traceable in production)', () => {
      const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
      const huge = 'X'.repeat(50000);
      sanitizeExcelCellValue(huge, { entity: 'contract_templates', column: 'conteudo' });
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('contract_templates.conteudo'));
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('50000'));
      warn.mockRestore();
    });

    it('ensures the result never exceeds EXCEL_CELL_MAX_CHARS even for absurdly large inputs', () => {
      const absurd = 'Z'.repeat(200000);
      const out = sanitizeExcelCellValue(absurd, { entity: 'briefings', column: 'descricao' });
      expect(out.length).toBeLessThanOrEqual(EXCEL_CELL_MAX_CHARS);
    });

    describe('spreadsheet formula injection (OWASP) — no cell can become a formula when opened in Excel/LibreOffice', () => {
      it('neutralizes classic formula-injection payloads', () => {
        expect(sanitizeExcelCellValue('=HYPERLINK("http://evil.test","clique")', { entity: 'clients', column: 'nome' })).toBe(
          "'=HYPERLINK(\"http://evil.test\",\"clique\")",
        );
        expect(sanitizeExcelCellValue('@SUM(1+1)', { entity: 'clients', column: 'nome' })).toBe("'@SUM(1+1)");
        expect(sanitizeExcelCellValue('+cmd|\'/c calc\'!A1', { entity: 'clients', column: 'nome' })).toBe(
          "'+cmd|'/c calc'!A1",
        );
        expect(sanitizeExcelCellValue('-2+3+cmd|\' /c calc\'!A1', { entity: 'clients', column: 'nome' })).toBe(
          "'-2+3+cmd|' /c calc'!A1",
        );
      });

      it('neutralizes tab/CR as the first character (less common injection vectors)', () => {
        expect(sanitizeExcelCellValue('\t=1+1', { entity: 'clients', column: 'nome' })).toBe("'\t=1+1");
      });

      it('does NOT neutralize a legitimate phone number starting with "+" (real and common data in this application)', () => {
        expect(sanitizeExcelCellValue('+5511999990000', { entity: 'clients', column: 'telefone' })).toBe(
          '+5511999990000',
        );
      });

      it('does NOT neutralize a legitimate negative monetary value starting with "-"', () => {
        expect(sanitizeExcelCellValue('-42.50', { entity: 'transactions', column: 'valor' })).toBe('-42.50');
        expect(sanitizeExcelCellValue('-1234,56', { entity: 'transactions', column: 'valor' })).toBe('-1234,56');
      });

      it('plain text without a dangerous prefix is not altered', () => {
        expect(neutralizeFormulaInjection('Cliente Exemplo Ltda')).toBe('Cliente Exemplo Ltda');
      });
    });
  });
});
