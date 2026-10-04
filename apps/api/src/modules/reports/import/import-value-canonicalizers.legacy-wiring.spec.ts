import { canonicalImportValue } from './import-value-canonicalizers';

/**
 * Legacy wiring: each licenses cell routes through canonicalLicenseValue(<field>, cell). The first argument is the
 * field-name literal, so a bypassed call would replace every imported cell with the field name itself.
 */
describe('canonicalImportValue("licenses", ...) legacy wiring', () => {
  it.each([
    ['status', 'negociacao', 'negotiation'],
    ['status', 'proposta', 'proposal'],
    ['status', 'expirada', 'expired'],
    ['status', 'pendente', 'pending'],
    ['type', 'mecanica', 'mechanical'],
    ['type', 'mecânica', 'mechanical'],
    ['type', 'sync_publicidade', 'sync_advertising'],
    ['target_media', 'tv_aberta', 'free_tv'],
    ['target_media', 'tv_fechada', 'pay_tv'],
    ['target_media', 'redes_sociais', 'social_media'],
    ['target_media', 'publicidade_digital', 'digital_advertising'],
  ])('licenses.%s: legacy %p -> canonical %p', (column, legacy, canonical) => {
    expect(canonicalImportValue('licenses', column, legacy)).toBe(canonical);
  });

  it.each([
    ['status', 'negotiation'],
    ['type', 'mechanical'],
    ['target_media', 'free_tv'],
  ])('licenses.%s: an already canonical value %p is kept (and is never replaced by the field name)', (column, value) => {
    expect(canonicalImportValue('licenses', column, value)).toBe(value);
    expect(canonicalImportValue('licenses', column, value)).not.toBe(column);
  });

  it.each(['status', 'type', 'target_media'])('licenses.%s: free text and non-strings pass through unchanged', (column) => {
    expect(canonicalImportValue('licenses', column, 'texto livre')).toBe('texto livre');
    expect(canonicalImportValue('licenses', column, null)).toBeNull();
    expect(canonicalImportValue('licenses', column, 7)).toBe(7);
  });
});
