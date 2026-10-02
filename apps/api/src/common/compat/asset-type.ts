/**
 * Canonical values of the central `assets.asset_type` classification (and the
 * mirrored `assets.metadata.classification.assetType`).
 *
 * Three heuristic values were Portuguese: guia, videoclipe, contrato. Canonical
 * English ids: guide_track, music_video, contract.
 *
 * Expand/contract (migration 20260930000025): writes are canonical; reads and
 * the manual-review input keep accepting the legacy values until the backfill
 * has run everywhere. Removal condition: the census queries in
 * docs/runbooks/staging-to-production.md#residue-census-20260930000025 return 0 for one release window.
 */
export const LEGACY_ASSET_TYPES: Readonly<Record<string, string>> = {
  guia: 'guide_track',
  videoclipe: 'music_video',
  contrato: 'contract',
};

/** Canonical asset type; exact-match legacy values are mapped, every other value is returned untouched (user-supplied types are never guessed). */
export function canonicalAssetType<T>(value: T): T | string {
  if (typeof value !== 'string') return value;
  return Object.prototype.hasOwnProperty.call(LEGACY_ASSET_TYPES, value) ? LEGACY_ASSET_TYPES[value] : value;
}
