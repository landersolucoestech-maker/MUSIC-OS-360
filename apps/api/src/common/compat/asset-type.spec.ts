import { canonicalAssetType, LEGACY_ASSET_TYPES } from './asset-type';

describe('canonicalAssetType', () => {
  it('maps exactly the three legacy Portuguese values', () => {
    expect(LEGACY_ASSET_TYPES).toEqual({ guia: 'guide_track', videoclipe: 'music_video', contrato: 'contract' });
    expect(canonicalAssetType('guia')).toBe('guide_track');
    expect(canonicalAssetType('videoclipe')).toBe('music_video');
    expect(canonicalAssetType('contrato')).toBe('contract');
  });
  it.each(['guide_track', 'wav', 'cover_art', 'unknown', 'Guia', ' guia', 'constructor', ''])('leaves %j untouched', (v) => {
    expect(canonicalAssetType(v)).toBe(v);
  });
  it('passes non-strings through', () => {
    expect(canonicalAssetType(null)).toBeNull();
    expect(canonicalAssetType(undefined)).toBeUndefined();
  });
});
