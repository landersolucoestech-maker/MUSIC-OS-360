import { describe, it, expect } from "vitest";
import { EcadReportStatus } from "@music-os-360/types";
import { ecadReportStatusLabel, ecadReportStatusVariant, ecadReportTypeLabel } from "./ecad-labels";

describe("ecad-labels", () => {
  it("labels every canonical status in PT-BR", () => {
    expect(ecadReportStatusLabel(EcadReportStatus.COMPLETED)).toBe("Concluído");
    expect(ecadReportStatusLabel(EcadReportStatus.PENDING)).toBe("Pendente");
    expect(ecadReportStatusVariant(EcadReportStatus.ERROR)).toBe("danger");
  });

  it("never renders an unknown or legacy technical value raw", () => {
    expect(ecadReportStatusLabel("done")).toBe("Status desconhecido");
    expect(ecadReportStatusVariant("whatever")).toBe("neutral");
    expect(ecadReportTypeLabel("some_type")).toBe("Relatório ECAD");
  });
});
