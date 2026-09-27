import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { SkillRunPanel } from "./SkillRunPanel";

const parsed = {
  auditSummary: "Auditoria concluída com pendências.",
  isDraft: true,
  coveragePercentage: 75.5,
  gaps: [{ gap: "Evento de compra sem rastreamento", severity: "high" }],
  checks: [{ check: "UTM presente", source: "static_analysis" }],
};

describe("SkillRunPanel renders skill output in PT-BR only", () => {
  it("labels keys and enum values; hides provider/model ids", () => {
    const { container } = render(
      <SkillRunPanel
        label="Auditar"
        isRunning={false}
        error={null}
        onRun={() => undefined}
        result={{ parsed, provider: "openai", model: "gpt-4o-mini", generatedAt: "2026-01-01T00:00:00Z", fromCache: true, skillRunId: "r1" }}
      />,
    );
    const text = container.textContent ?? "";
    expect(screen.getByText("Lacunas")).toBeTruthy();
    expect(text).toContain("Rascunho: Sim");
    expect(text).toContain("Cobertura (%): 75,5");
    expect(text).toContain("Gravidade:");
    expect(text).toContain("Alta");
    expect(text).toContain("Análise estática");
    expect(text).toContain("OpenAI");
    for (const technical of ["isDraft", "Is Draft", "coveragePercentage", "Severity", "high", "static_analysis", "true", "gpt-4o-mini", "openai/", "(cache)"]) {
      expect(text).not.toContain(technical);
    }
  });
});
