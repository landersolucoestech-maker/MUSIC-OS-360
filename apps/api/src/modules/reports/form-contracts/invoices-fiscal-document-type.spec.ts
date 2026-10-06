import { canonicalizeDeprecatedColumnId, contractFieldByKey, getReportFormContract } from './report-form-contracts';

/**
 * Invoices report contract: the canonical logical column id of the fiscal note kind is `fiscalDocumentType`
 * (physical column `tipo_nota`, kept by owner decision R1); the pre-rename id `tipo_nota` is a deprecated alias.
 */
describe('invoices report contract: fiscal document type column', () => {
  const contract = getReportFormContract('invoices')!;

  it('the canonical key is stored in the physical column tipo_nota', () => {
    const field = contractFieldByKey(contract).get('fiscalDocumentType');
    expect(field).toBeDefined();
    expect(field!.physical).toBe('tipo_nota');
    expect(field!.storage).toBe('column');
  });

  it('the deprecated column id tipo_nota resolves to the canonical key', () => {
    expect(canonicalizeDeprecatedColumnId('invoices', 'tipo_nota')).toBe('fiscalDocumentType');
    expect(contract.formFieldAliases?.['fiscal_document_type']).toBe('fiscalDocumentType');
  });

  it('negative: near-miss ids and other tables are not rewritten, and tipo_nota is not a contract key', () => {
    expect(canonicalizeDeprecatedColumnId('invoices', 'tipo_notas')).toBe('tipo_notas');
    expect(canonicalizeDeprecatedColumnId('invoices', 'fiscalDocumentType')).toBe('fiscalDocumentType');
    expect(canonicalizeDeprecatedColumnId('contracts', 'tipo_nota')).toBe('tipo_nota');
    expect(contractFieldByKey(contract).has('tipo_nota')).toBe(false);
  });
});
