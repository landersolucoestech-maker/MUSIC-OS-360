import { describe, expect, it } from "vitest";
import {
  projectStatusFromApi,
  projectStatusToApi,
  projectTypeFromApi,
  projectTypeToApi,
} from "./marketing-project-wire";

const API_TYPES = ["MUSIC_PROJECT", "ARTIST", "COMPANY", "LABEL", "PUBLISHER", "STUDIO", "EVENT", "CONTENT", "CAMPAIGN", "BRANDING", "CORPORATE", "PRODUCT", "CUSTOM"];
const API_STATUSES = ["draft", "planning", "active", "paused", "completed", "cancelled", "archived"];
const UI_TYPES = [
  "music_release", "music_video", "audiovisual", "institutional_campaign", "promotional_campaign", "event",
  "corporate_content", "behind_the_scenes", "meeting", "product_promotion", "service_promotion", "saas_promotion",
  "internal_communication", "external_communication", "news_portal", "special_project",
] as const;
const UI_STATUSES = ["planning", "active", "paused", "completed", "cancelled"] as const;
/** Deprecated Portuguese UI slugs (rows persisted before migration 20260930000026) -> canonical. */
const LEGACY_TYPES: Record<string, string> = {
  lancamento_musical: "music_release", videoclipe: "music_video", audiovisual: "audiovisual", campanha_institucional: "institutional_campaign",
  campanha_promocional: "promotional_campaign", evento: "event", conteudo_corporativo: "corporate_content", bastidores: "behind_the_scenes",
  reuniao: "meeting", divulgacao_produto: "product_promotion", divulgacao_servico: "service_promotion", divulgacao_saas: "saas_promotion",
  comunicacao_interna: "internal_communication", comunicacao_externa: "external_communication", portal_noticias: "news_portal", projeto_especial: "special_project",
};
const LEGACY_STATUSES: Record<string, string> = { planejamento: "planning", em_andamento: "active", pausado: "paused", concluido: "completed", cancelado: "cancelled" };

describe("marketing project wire adapter", () => {
  it("every UI project type maps to a value the API accepts (IsIn MARKETING_PROJECT_TYPES)", () => {
    for (const ui of UI_TYPES) expect(API_TYPES).toContain(projectTypeToApi(ui));
    expect(projectTypeToApi("music_release")).toBe("MUSIC_PROJECT");
  });

  it("every UI project status maps to a value the API accepts (IsIn MARKETING_PROJECT_STATUSES)", () => {
    for (const ui of UI_STATUSES) expect(API_STATUSES).toContain(projectStatusToApi(ui));
    expect(projectStatusToApi("active")).toBe("active");
    expect(projectStatusToApi("planning")).toBe("planning");
  });

  it("passes canonical values through and never sends an unknown type/status", () => {
    expect(projectTypeToApi("MUSIC_PROJECT")).toBe("MUSIC_PROJECT");
    expect(projectTypeToApi("unknown-thing")).toBe("CUSTOM");
    expect(projectStatusToApi("archived")).toBe("archived");
    expect(projectStatusToApi("nonsense")).toBeUndefined();
  });

  it("reads back the stored UI slug, else the canonical API value", () => {
    expect(projectTypeFromApi("music_video", "CONTENT")).toBe("music_video");
    expect(projectTypeFromApi(undefined, "MUSIC_PROJECT")).toBe("music_release");
    expect(projectStatusFromApi("paused", "paused")).toBe("paused");
    expect(projectStatusFromApi(undefined, "completed")).toBe("completed");
    expect(projectStatusFromApi(undefined, "weird")).toBe("planning");
  });

  it("dual-read: a stored Portuguese UI slug reads as the canonical value, and is never written back", () => {
    for (const [legacy, canonical] of Object.entries(LEGACY_TYPES)) {
      expect(projectTypeFromApi(legacy, "CUSTOM")).toBe(canonical);
      expect(projectTypeToApi(legacy)).toBe(projectTypeToApi(canonical));
    }
    for (const [legacy, canonical] of Object.entries(LEGACY_STATUSES)) {
      expect(projectStatusFromApi(legacy, "draft")).toBe(canonical);
      expect(projectStatusToApi(legacy)).toBe(projectStatusToApi(canonical));
    }
  });
});
