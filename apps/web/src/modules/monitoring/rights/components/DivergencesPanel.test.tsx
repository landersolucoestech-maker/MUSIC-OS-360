import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DivergencesPanel, divergenceTypeLabel, type Divergence } from "./DivergencesPanel";

const base: Omit<Divergence, "id" | "type" | "date"> = {
  description: "d", severity: "medium", risk_score: 45, status: "open",
};

describe("DivergencesPanel type codes", () => {
  it("maps machine codes to the same PT-BR text shown before", () => {
    expect(divergenceTypeLabel("work_without_ecad_code")).toBe("Obra sem código ECAD");
    expect(divergenceTypeLabel("detection_without_work")).toBe("Detecção sem obra vinculada");
  });

  it("renders the PT-BR label (never the code) and sorts by the date field", () => {
    const rows: Divergence[] = [
      { ...base, id: "a", type: "work_without_ecad_code", date: "2024-01-01" },
      { ...base, id: "b", type: "detection_without_work", date: "2024-02-01" },
    ];
    render(<DivergencesPanel divergences={rows} />);
    expect(screen.getByText("Obra sem código ECAD")).toBeInTheDocument();
    expect(screen.getByText("Detecção sem obra vinculada")).toBeInTheDocument();
    expect(screen.queryByText("work_without_ecad_code")).toBeNull();
    const trs = screen.getAllByRole("row").slice(1);
    expect(trs[0]).toHaveAttribute("data-testid", "row-divergence-b");
  });
});
