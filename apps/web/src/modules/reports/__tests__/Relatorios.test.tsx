// @ts-nocheck
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

const entities = [
  {
    entityName: "ArtistEntity",
    tableName: "artists",
    label: "Artistas",
    category: "REPORTABLE",
    reportable: true,
    columns: [{ name: "name", label: "Nome" }],
    risks: [],
  },
  {
    entityName: "ContractEntity",
    tableName: "contracts",
    label: "Contratos",
    category: "REPORTABLE",
    reportable: true,
    columns: [{ name: "title", label: "Titulo" }],
    risks: [],
  },
  {
    entityName: "AuditEntity",
    tableName: "audit_logs",
    label: null,
    category: "SECURITY",
    reportable: false,
    columns: [],
    risks: ["sensitive"],
  },
  {
    entityName: "ContentDetectionEntity",
    tableName: "monitoring_pending",
    label: "Monitoramento (Pendente)",
    category: "REPORTABLE",
    reportable: true,
    columns: [{ name: "plataforma", label: "Plataforma" }],
    risks: [],
  },
];

const definitions = [
  {
    tableName: "artists",
    supportsExport: true,
    supportsImport: true,
    exportableColumns: ["name"],
    importableColumns: ["name"],
  },
  {
    tableName: "contracts",
    supportsExport: true,
    supportsImport: false,
    exportableColumns: ["title"],
    importableColumns: [],
  },
];

const { exportMutate } = vi.hoisted(() => ({ exportMutate: vi.fn() }));

vi.mock("../hooks/useReports", () => ({
  useReportEntities: () => ({
    data: { entities },
    isLoading: false,
    isError: false,
  }),
  useReportDefinitions: () => ({
    data: definitions,
    isLoading: false,
    isError: false,
  }),
  useReportExport: () => ({ mutate: exportMutate, isPending: false }),
}));

vi.mock("../components/ImportDialog", () => ({
  ImportDialog: ({ open, definition }) =>
    open ? <div data-testid="import-dialog">{definition?.tableName}</div> : null,
}));

vi.mock("@/shared/components/MainLayout", () => ({
  MainLayout: ({ children }) => <div>{children}</div>,
}));

import Relatorios from "../pages/Relatorios";

describe("Relatorios - API-driven contract", () => {
  it("renders only reportable entities returned by the API", () => {
    render(<Relatorios />);

    expect(screen.getByTestId("entity-row-artists")).toBeTruthy();
    expect(screen.getByTestId("entity-row-contracts")).toBeTruthy();
    expect(screen.queryByTestId("entity-row-audit_logs")).toBeNull();
  });

  it("exports immediately on click, without an intermediate modal", () => {
    render(<Relatorios />);

    fireEvent.click(screen.getByTestId("btn-export-contracts"));
    expect(screen.queryByTestId("export-dialog")).toBeNull();
    expect(exportMutate).toHaveBeenCalledWith(
      { entity: "contracts", params: expect.objectContaining({ format: "xlsx" }) },
      expect.anything(),
    );
  });

  it("opens the import dialog for the selected entity", () => {
    render(<Relatorios />);

    fireEvent.click(screen.getByTestId("btn-import-artists"));
    expect(screen.getByTestId("import-dialog").textContent).toBe("artists");
  });

  it("disables import when the definition does not support it", () => {
    render(<Relatorios />);

    expect(screen.getByTestId("btn-import-contracts")).toBeDisabled();
  });

  it("shows 'Temporariamente indisponivel' and disables import/export when a reportable entity has no contract yet", () => {
    render(<Relatorios />);

    expect(screen.getByTestId("entity-row-monitoring_pending")).toBeTruthy();
    expect(screen.getByTestId("unavailable-monitoring_pending")).toBeTruthy();
    expect(screen.getByTestId("btn-import-monitoring_pending")).toBeDisabled();
    expect(screen.getByTestId("btn-export-monitoring_pending")).toBeDisabled();
  });
});
