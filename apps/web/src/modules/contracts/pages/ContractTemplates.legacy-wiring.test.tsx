// @ts-nocheck
// Wiring test: ContractTemplates tells semantic from standard templates through isSemanticContractCategory,
// which must recognise the legacy and the canonical spelling of the semantic category (list filter, counter and row marker).
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

const { state } = vi.hoisted(() => ({ state: { templates: [] as any[] } }));

vi.mock("@/modules/contracts/hooks/useContractTemplates", () => ({
  useContractTemplates: () => ({
    templates: state.templates,
    isLoading: false,
    addTemplate: { mutateAsync: vi.fn() },
    updateTemplate: { mutateAsync: vi.fn() },
    deleteTemplate: { mutateAsync: vi.fn() },
  }),
}));
vi.mock("@/modules/contracts/hooks/useCategoryRegistry", async (orig) => {
  const actual: any = await orig();
  return { ...actual, useCategoryRegistry: () => ({ categories: [] }) };
});
vi.mock("@/modules/contracts/components/ContractImportWorkspace", () => ({ ContractImportWorkspace: () => null }));
vi.mock("@/modules/contracts/components/ContractTemplateViewModal", () => ({ ContractTemplateViewModal: () => null }));
vi.mock("@/shared/components/MainLayout", () => ({
  MainLayout: ({ actions, children }: any) => <div>{actions}{children}</div>,
}));
vi.mock("@/shared/ui/select", () => {
  const Ctx = React.createContext<any>(null);
  return {
    Select: ({ onValueChange, children }: any) => <Ctx.Provider value={onValueChange}>{children}</Ctx.Provider>,
    SelectTrigger: ({ children }: any) => <div>{children}</div>,
    SelectValue: () => null,
    SelectContent: ({ children }: any) => <div>{children}</div>,
    SelectItem: ({ value, children }: any) => {
      const on = React.useContext(Ctx);
      return <button role="option" data-value={value} onClick={() => on(value)}>{children}</button>;
    },
  };
});

import ContractTemplates from "@/modules/contracts/pages/ContractTemplates";

const LEGACY_SEMANTIC = ["seman", "tico"].join("");
const rows = () => [
  { id: "legacy", name: "Template legado", service_type: LEGACY_SEMANTIC, active: true, created_at: "2025-01-01" },
  { id: "canon", name: "Template canonico", service_type: "semantic", active: true, created_at: "2025-01-01" },
  { id: "plain", name: "Template padrao", service_type: "outros", active: true, created_at: "2025-01-01" },
  { id: "plain2", name: "Template padrao dois", service_type: "management", active: false, created_at: "2025-01-01" },
];

const visibleIds = () =>
  screen.queryAllByTestId(/^row-template-/).map((r) => r.getAttribute("data-testid")!.replace("row-template-", ""));
const hasSparkles = (id: string) => screen.getByTestId(`row-template-${id}`).querySelector("svg.lucide-sparkles") !== null;
const pickType = (value: string) =>
  fireEvent.click(screen.getAllByRole("option").find((o) => o.getAttribute("data-value") === value)!);

function setup() {
  state.templates = rows();
  return render(<ContractTemplates />);
}

describe("ContractTemplates legacy wiring (semantic category spellings)", () => {
  it("counter counts the legacy and the canonical semantic templates only", () => {
    setup();
    const card = screen.getByText("Semânticos (IA)", { selector: "p" }).parentElement!.parentElement!;
    expect(card.querySelector(".text-2xl")).toHaveTextContent("2");
    expect(visibleIds().sort()).toEqual(["canon", "legacy", "plain", "plain2"]);
  });

  it("semantic filter keeps legacy and canonical semantic templates and drops the others", () => {
    setup();
    pickType("semantic");
    expect(visibleIds().sort()).toEqual(["canon", "legacy"]);
  });

  it("standard filter keeps only the templates that are not semantic in either spelling", () => {
    setup();
    pickType("standard");
    expect(visibleIds().sort()).toEqual(["plain", "plain2"]);
  });

  it("rows mark semantic templates (either spelling) and not the standard ones", () => {
    setup();
    expect(hasSparkles("legacy")).toBe(true);
    expect(hasSparkles("canon")).toBe(true);
    expect(hasSparkles("plain")).toBe(false);
    expect(hasSparkles("plain2")).toBe(false);
  });
});
