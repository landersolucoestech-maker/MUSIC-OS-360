/**
 * Adapter between the marketing asset UI category (`AssetCategory`, canonical
 * English slugs) and the API wire vocabulary (MARKETING_ASSET_TYPES in
 * apps/api/src/modules/marketing/dto/marketing-assets.dto.ts, upper-case English).
 *
 * The API validates `assetType` against its own list, so the request must carry one
 * of those values (the web used to send `String(category).toUpperCase()`, e.g. the
 * Portuguese `CAPA`, which the API rejects). The exact UI category travels in
 * `metadata.category` so nothing is lost on read-back; assets that carry none
 * (created by other clients or by the approval pipeline) are mapped from the API
 * type.
 */
import type { AssetCategory } from "../types/marketing.types";
import { canonicalAssetCategory } from "../utils/marketing-legacy-vocabulary";

export type MarketingAssetApiType =
  | "AUDIO" | "COVER" | "ARTWORK" | "PHOTO" | "REEL" | "TEASER" | "VISUALIZER" | "LYRIC_VIDEO" | "MUSIC_VIDEO"
  | "PRESS_KIT" | "DOCUMENT" | "INSTITUTIONAL" | "AD_CREATIVE" | "LOGO" | "CORPORATE_MATERIAL" | "OTHER";

export const ASSET_TYPE_TO_CATEGORY: Readonly<Record<MarketingAssetApiType, AssetCategory>> = {
  AUDIO: "campaign_asset",
  COVER: "cover",
  ARTWORK: "promotional_art",
  PHOTO: "photography",
  REEL: "reels",
  TEASER: "teaser",
  VISUALIZER: "video",
  LYRIC_VIDEO: "video",
  MUSIC_VIDEO: "video",
  PRESS_KIT: "press_kit",
  DOCUMENT: "strategic_document",
  INSTITUTIONAL: "institutional_material",
  AD_CREATIVE: "campaign_asset",
  LOGO: "logo",
  CORPORATE_MATERIAL: "commercial_material",
  OTHER: "campaign_asset",
};

export const CATEGORY_TO_ASSET_TYPE: Readonly<Record<AssetCategory, MarketingAssetApiType>> = {
  cover: "COVER",
  promotional_art: "ARTWORK",
  banner: "AD_CREATIVE",
  logo: "LOGO",
  visual_identity: "CORPORATE_MATERIAL",
  photography: "PHOTO",
  reels: "REEL",
  video: "MUSIC_VIDEO",
  teaser: "TEASER",
  shorts: "REEL",
  press_kit: "PRESS_KIT",
  template: "DOCUMENT",
  strategic_document: "DOCUMENT",
  institutional_material: "INSTITUTIONAL",
  commercial_material: "CORPORATE_MATERIAL",
  behind_the_scenes_material: "OTHER",
  meeting_material: "DOCUMENT",
  portal_file: "OTHER",
  campaign_asset: "AD_CREATIVE",
};

const has = (map: object, key: unknown): boolean => typeof key === "string" && Object.prototype.hasOwnProperty.call(map, key);

/** API asset type for a UI category (a legacy Portuguese category is read as canonical first). */
export function assetTypeFromCategory(category: unknown): MarketingAssetApiType {
  const canonical = canonicalAssetCategory(category);
  return canonical ? CATEGORY_TO_ASSET_TYPE[canonical] : "OTHER";
}

/** UI category: the stored `metadata.category`, else mapped from the API type (accepted in any case). */
export function assetCategoryFromApi(storedCategory: unknown, apiType: unknown): AssetCategory {
  const stored = canonicalAssetCategory(storedCategory);
  if (stored) return stored;
  const upper = typeof apiType === "string" ? apiType.toUpperCase() : "";
  return has(ASSET_TYPE_TO_CATEGORY, upper) ? ASSET_TYPE_TO_CATEGORY[upper as MarketingAssetApiType] : "campaign_asset";
}
