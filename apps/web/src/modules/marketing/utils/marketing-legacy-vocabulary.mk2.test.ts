import { describe, expect, it } from "vitest";
import {
  LEGACY_AI_TASK_KIND_TO_CANONICAL,
  LEGACY_BRIEFING_TYPE_TO_CANONICAL,
  LEGACY_CAMPAIGN_STATUS_TO_CANONICAL,
  LEGACY_CAMPAIGN_TYPE_TO_CANONICAL,
  LEGACY_CONTENT_CHANNEL_TO_CANONICAL,
  LEGACY_MARKETING_TARGET_TO_CANONICAL,
  LEGACY_PROJECT_STATUS_TO_CANONICAL,
  LEGACY_PROJECT_TYPE_TO_CANONICAL,
  LEGACY_TASK_TYPE_TO_CANONICAL,
  canonicalAiTaskKind,
  canonicalBriefingType,
  canonicalCampaignStatus,
  canonicalCampaignType,
  canonicalContentChannel,
  canonicalContentChannels,
  canonicalMarketingTarget,
  canonicalProjectStatus,
  canonicalProjectType,
  canonicalTaskType,
} from "./marketing-legacy-vocabulary";
import {
  AI_KIND_LABEL,
} from "../components/ai-creative/aiCreative.utils";
import {
  BRIEFING_TYPE_OPTIONS,
  CAMPAIGN_TYPE_OPTIONS,
  CONTENT_CHANNEL_OPTIONS,
  MARKETING_TARGET_OPTIONS,
  PROJECT_STATUS_OPTIONS,
  PROJECT_TYPE_OPTIONS,
  TASK_TYPE_OPTIONS,
} from "../constants/marketing.constants";

const PORTUGUESE = /[ãõçáéíóúâêô]|(?:^|_)(?:projeto|musical|artista|empresa|lancamento|campanha|conteudo|bastidor|portal_noticias|reuniao|evento|planejamento|andamento|pausad|concluid|cancelad|rascunho|agendada|ativa)/;

describe("MK2 marketing machine vocabulary: legacy -> canonical (dual-read)", () => {
  const cases: Array<[string, Readonly<Record<string, string>>, (v: unknown) => unknown, string[]]> = [
    ["target", LEGACY_MARKETING_TARGET_TO_CANONICAL, canonicalMarketingTarget, MARKETING_TARGET_OPTIONS.map((o) => o.value)],
    ["project type", LEGACY_PROJECT_TYPE_TO_CANONICAL, canonicalProjectType, PROJECT_TYPE_OPTIONS.map((o) => o.value)],
    ["project status", LEGACY_PROJECT_STATUS_TO_CANONICAL, canonicalProjectStatus, PROJECT_STATUS_OPTIONS.map((o) => o.value)],
    ["campaign type", LEGACY_CAMPAIGN_TYPE_TO_CANONICAL, canonicalCampaignType, CAMPAIGN_TYPE_OPTIONS.map((o) => o.value)],
    ["briefing type", LEGACY_BRIEFING_TYPE_TO_CANONICAL, canonicalBriefingType, BRIEFING_TYPE_OPTIONS.map((o) => o.value)],
    ["content channel", LEGACY_CONTENT_CHANNEL_TO_CANONICAL, canonicalContentChannel, CONTENT_CHANNEL_OPTIONS.map((o) => o.value)],
    ["task type", LEGACY_TASK_TYPE_TO_CANONICAL, canonicalTaskType, TASK_TYPE_OPTIONS.map((o) => o.value)],
    ["ai kind", LEGACY_AI_TASK_KIND_TO_CANONICAL, canonicalAiTaskKind, Object.keys(AI_KIND_LABEL)],
  ];

  it.each(cases)("%s: every legacy value maps to a canonical option, canonical passes through, the map is injective", (_name, legacy, canonical, options) => {
    const targets = Object.values(legacy);
    expect(new Set(targets).size).toBe(targets.length);
    for (const [from, to] of Object.entries(legacy)) {
      expect(canonical(from)).toBe(to);
      expect(options).toContain(to);
      expect(canonical(to)).toBe(to);
    }
  });

  it.each(cases)("%s: no canonical option is a Portuguese machine value", (_name, _legacy, _canonical, options) => {
    for (const option of options) expect(option).not.toMatch(PORTUGUESE);
  });

  it("unknown values are never guessed", () => {
    for (const fn of [canonicalMarketingTarget, canonicalProjectType, canonicalProjectStatus, canonicalCampaignType, canonicalBriefingType, canonicalContentChannel]) {
      expect(fn("Empresa")).toBeUndefined();
      expect(fn("constructor")).toBeUndefined();
      expect(fn(undefined)).toBeUndefined();
      expect(fn(7)).toBeUndefined();
    }
    // free kinds (API-created, tenant) are returned as received
    expect(canonicalTaskType("cover_art")).toBe("cover_art");
    expect(canonicalAiTaskKind("custom_kind")).toBe("custom_kind");
  });

  it("target also accepts the upper-case campaign wire spelling", () => {
    expect(canonicalMarketingTarget("MUSIC_PROJECT")).toBe("music_project");
    expect(canonicalMarketingTarget("EMPRESA")).toBe("company");
    expect(canonicalMarketingTarget("ARTIST")).toBe("artist");
  });

  it("channel lists keep unknown entries and canonicalize the legacy ones", () => {
    expect(canonicalContentChannels(["instagram", "portal_noticias", "material_publicitario", "x_custom"]))
      .toEqual(["instagram", "news_portal", "advertising_material", "x_custom"]);
    expect(canonicalContentChannels(undefined)).toBeUndefined();
  });

  it("campaign status accepts the API upper-case enum and the legacy slugs; unknown reads as draft", () => {
    for (const [legacy, canonical] of Object.entries(LEGACY_CAMPAIGN_STATUS_TO_CANONICAL)) {
      expect(canonicalCampaignStatus(legacy)).toBe(canonical);
      expect(canonicalCampaignStatus(canonical.toUpperCase())).toBe(canonical);
    }
    expect(canonicalCampaignStatus("PENDING_REVIEW")).toBe("pending_review");
    expect(canonicalCampaignStatus(undefined)).toBe("draft");
    expect(canonicalCampaignStatus("???")).toBe("draft");
  });
});
