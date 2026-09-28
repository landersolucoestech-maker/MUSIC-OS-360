import { exportValueLabel, valueFromExportLabel } from './value-labels.pt-br';
import { sanitizeExcelCellValue } from '../export/export-format.service';
import { canonicalImportValue } from '../import/import-value-canonicalizers';

describe('report enum values — PT-BR in the spreadsheet, canonical in the database (round-trip)', () => {
  it('export writes the PT-BR label, never the raw technical value', () => {
    expect(sanitizeExcelCellValue('revenue', { entity: 'transactions', column: 'transaction_type' })).toBe('Receita');
    expect(sanitizeExcelCellValue('credit_card', { entity: 'transactions', column: 'payment_method' })).toBe('Cartão de Crédito');
    expect(sanitizeExcelCellValue('own_account', { entity: 'transactions', column: 'counterparty_type' })).toBe('Conta Própria');
    expect(sanitizeExcelCellValue('pending', { entity: 'transactions', column: 'status' })).not.toBe('pending');
    expect(sanitizeExcelCellValue('reference', { entity: 'works', column: 'work_origin' })).toBe('Referência');
    expect(sanitizeExcelCellValue('physical', { entity: 'phonograms', column: 'media_type' })).toBe('Física');
  });

  it('free text is never relabelled', () => {
    expect(exportValueLabel('transactions', 'description', 'revenue')).toBeNull();
    expect(sanitizeExcelCellValue('revenue', { entity: 'transactions', column: 'description' })).toBe('revenue');
  });

  it('import maps every exported label back to its canonical value (trimmed, case-insensitive)', () => {
    expect(canonicalImportValue('transactions', 'type', 'Receita')).toBe('revenue');
    expect(canonicalImportValue('transactions', 'payment_method', ' cartão de crédito ')).toBe('credit_card');
    expect(canonicalImportValue('works', 'work_origin', 'Referência')).toBe('reference');
    expect(valueFromExportLabel('phonograms', 'media_type', 'Física')).toBe('physical');
    expect(valueFromExportLabel('transactions', 'type', 'Algo')).toBeNull();
  });
});
