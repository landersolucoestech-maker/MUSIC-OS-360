import { describe, expect, it } from "vitest";
import { ASSET_CATEGORY_OPTIONS } from "../constants/marketing.constants";
import { ASSET_TYPE_TO_CATEGORY, assetCategoryFromApi, assetTypeFromCategory } from "./marketing-asset-wire";

/** MARKETING_ASSET_TYPES of apps/api/src/modules/marketing/dto/marketing-assets.dto.ts (duplicated on purpose: drift fails here). */
const API_ASSET_TYPES = [
  "AUDIO", "COVER", "ARTWORK", "PHOTO", "REEL", "TEASER", "VISUALIZER", "LYRIC_VIDEO", "MUSIC_VIDEO", "PRESS_KIT",
  "DOCUMENT", "INSTITUTIONAL", "AD_CREATIVE", "LOGO", "CORPORATE_MATERIAL", "OTHER",
];

describe("marketing asset wire adapter", () => {
  it("every UI category maps to an asset type the API accepts (it used to send the upper-cased Portuguese slug -> 400)", () => {
    for (const { value } of ASSET_CATEGORY_OPTIONS) expect(API_ASSET_TYPES).toContain(assetTypeFromCategory(value));
    expect(assetTypeFromCategory("capa")).toBe("COVER"); // deprecated Portuguese category read as canonical
    expect(assetTypeFromCategory("nonsense")).toBe("OTHER");
  });

  it("every API asset type reads as a canonical UI category with a label", () => {
    const categories = ASSET_CATEGORY_OPTIONS.map((o) => o.value);
    for (const type of API_ASSET_TYPES) expect(categories).toContain(ASSET_TYPE_TO_CATEGORY[type as keyof typeof ASSET_TYPE_TO_CATEGORY]);
    expect(assetCategoryFromApi(undefined, "cover")).toBe("cover");
    expect(assetCategoryFromApi("press_kit", "DOCUMENT")).toBe("press_kit"); // stored UI category wins
    expect(assetCategoryFromApi("arte_promocional", "OTHER")).toBe("promotional_art");
    expect(assetCategoryFromApi(undefined, "WHAT")).toBe("campaign_asset");
  });
});
