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
  "lancamento_musical", "videoclipe", "audiovisual", "campanha_institucional", "campanha_promocional", "evento",
  "conteudo_corporativo", "bastidores", "reuniao", "divulgacao_produto", "divulgacao_servico", "divulgacao_saas",
  "comunicacao_interna", "comunicacao_externa", "portal_noticias", "projeto_especial",
] as const;
const UI_STATUSES = ["planejamento", "em_andamento", "pausado", "concluido", "cancelado"] as const;

describe("marketing project wire adapter", () => {
  it("every UI project type maps to a value the API accepts (IsIn MARKETING_PROJECT_TYPES)", () => {
    for (const ui of UI_TYPES) expect(API_TYPES).toContain(projectTypeToApi(ui));
    expect(projectTypeToApi("lancamento_musical")).toBe("MUSIC_PROJECT");
  });

  it("every UI project status maps to a value the API accepts (IsIn MARKETING_PROJECT_STATUSES)", () => {
    for (const ui of UI_STATUSES) expect(API_STATUSES).toContain(projectStatusToApi(ui));
    expect(projectStatusToApi("em_andamento")).toBe("active");
    expect(projectStatusToApi("planejamento")).toBe("planning");
  });

  it("passes canonical values through and never sends an unknown type/status", () => {
    expect(projectTypeToApi("MUSIC_PROJECT")).toBe("MUSIC_PROJECT");
    expect(projectTypeToApi("unknown-thing")).toBe("CUSTOM");
    expect(projectStatusToApi("archived")).toBe("archived");
    expect(projectStatusToApi("nonsense")).toBeUndefined();
  });

  it("reads back the stored UI slug, else the canonical API value", () => {
    expect(projectTypeFromApi("videoclipe", "CONTENT")).toBe("videoclipe");
    expect(projectTypeFromApi(undefined, "MUSIC_PROJECT")).toBe("lancamento_musical");
    expect(projectStatusFromApi("pausado", "paused")).toBe("pausado");
    expect(projectStatusFromApi(undefined, "completed")).toBe("concluido");
    expect(projectStatusFromApi(undefined, "weird")).toBe("planejamento");
  });
});
