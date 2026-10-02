import { describe, expect, it } from "vitest";
import {
  LEGACY_BRIEFING_TYPE_TO_CANONICAL,
  LEGACY_CAMPAIGN_TYPE_TO_CANONICAL,
  canonicalBriefingType,
  canonicalCampaignType,
} from "./marketing-legacy-vocabulary";

describe("legacy `conteudo` spelling", () => {
  it("campaign type conteudo is read as content", () => {
    expect(LEGACY_CAMPAIGN_TYPE_TO_CANONICAL.conteudo).toBe("content");
    expect(canonicalCampaignType("conteudo")).toBe("content");
    expect(canonicalCampaignType("content")).toBe("content");
  });

  it("briefing type conteudo is read as content", () => {
    expect(LEGACY_BRIEFING_TYPE_TO_CANONICAL.conteudo).toBe("content");
    expect(canonicalBriefingType("conteudo")).toBe("content");
  });
});
