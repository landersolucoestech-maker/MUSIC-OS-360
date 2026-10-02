import {
  LEGACY_CONTRACT_SERVICE_TYPE_CLIENT_TYPES,
  LEGACY_CONTRACT_SERVICE_TYPE_FINANCIAL_MODELS,
  LEGACY_CONTRACT_SERVICE_TYPE_PAYMENT_FREQUENCIES,
  canonicalContractServiceTypeClientTypes,
  canonicalContractServiceTypeFinancialModel,
  canonicalContractServiceTypePaymentFrequency,
} from './contract-service-type.vocabulary';

// Deprecated service type input is accepted and converted to the canonical vocabulary.
describe('contract service type vocabulary legacy values (legacy in, canonical out)', () => {
  it.each([
    ['unico', 'one_time'],
    ['mensal', 'monthly'],
    ['trimestral', 'quarterly'],
    ['anual', 'yearly'],
  ])('payment frequency %s -> %s', (legacy, canonical) => {
    expect(canonicalContractServiceTypePaymentFrequency({ value: legacy })).toBe(canonical);
    expect(LEGACY_CONTRACT_SERVICE_TYPE_PAYMENT_FREQUENCIES[legacy]).toBe(canonical);
    expect(canonicalContractServiceTypePaymentFrequency({ value: canonical })).toBe(canonical);
  });

  it.each([
    ['valor_fixo', 'fixed_value'],
    ['misto', 'mixed'],
    ['recorrente', 'recurring'],
    ['recebimentos externos de direitos', 'external_rights_receipts'],
  ])('financial model %s -> %s', (legacy, canonical) => {
    expect(canonicalContractServiceTypeFinancialModel({ value: legacy })).toBe(canonical);
    expect(LEGACY_CONTRACT_SERVICE_TYPE_FINANCIAL_MODELS[legacy]).toBe(canonical);
  });

  it('client types: legacy members map, duplicates collapse, unknown/non-array pass through for validation to reject', () => {
    expect(canonicalContractServiceTypeClientTypes({ value: ['artista', 'pessoa_fisica', 'pessoa_juridica'] })).toEqual(['artist', 'individual', 'company']);
    expect(canonicalContractServiceTypeClientTypes({ value: ['artista', 'artist'] })).toEqual(['artist']);
    expect(canonicalContractServiceTypeClientTypes({ value: ['bogus'] })).toEqual(['bogus']);
    expect(canonicalContractServiceTypeClientTypes({ value: 'artista' })).toBe('artista');
    expect(LEGACY_CONTRACT_SERVICE_TYPE_CLIENT_TYPES['artista']).toBe('artist');
  });

  it('values that are not legacy spellings are never rewritten', () => {
    expect(canonicalContractServiceTypePaymentFrequency({ value: 'royalties' })).toBe('royalties');
    expect(canonicalContractServiceTypeFinancialModel({ value: 42 })).toBe(42);
  });
});
