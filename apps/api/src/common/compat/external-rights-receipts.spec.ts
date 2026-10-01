import {
  EXTERNAL_RIGHTS_RECEIPTS, LEGACY_EXTERNAL_RIGHTS_RECEIPTS_PHRASE,
  canonicalExternalRightsReceipts, externalRightsReceiptsVariants,
} from './external-rights-receipts';

describe('external_rights_receipts canonical id', () => {
  it('maps only the exact legacy phrase', () => {
    expect(canonicalExternalRightsReceipts(LEGACY_EXTERNAL_RIGHTS_RECEIPTS_PHRASE)).toBe(EXTERNAL_RIGHTS_RECEIPTS);
    expect(canonicalExternalRightsReceipts(EXTERNAL_RIGHTS_RECEIPTS)).toBe(EXTERNAL_RIGHTS_RECEIPTS);
    expect(canonicalExternalRightsReceipts('Recebimentos externos de direitos')).toBe('Recebimentos externos de direitos');
    expect(canonicalExternalRightsReceipts('royalties')).toBe('royalties');
    expect(canonicalExternalRightsReceipts(undefined)).toBeUndefined();
    expect(canonicalExternalRightsReceipts(null)).toBeNull();
  });

  it('filters match both spellings, canonical first', () => {
    const both = [EXTERNAL_RIGHTS_RECEIPTS, LEGACY_EXTERNAL_RIGHTS_RECEIPTS_PHRASE];
    expect(externalRightsReceiptsVariants(EXTERNAL_RIGHTS_RECEIPTS)).toEqual(both);
    expect(externalRightsReceiptsVariants(LEGACY_EXTERNAL_RIGHTS_RECEIPTS_PHRASE)).toEqual(both);
    expect(externalRightsReceiptsVariants('outros')).toEqual(['outros']);
  });
});
