// @ts-nocheck
// Wiring test: the Type column of the contracts list shows the PT-BR label of the stored category
// (legacy slug or canonical spelling) through formatCategoryLabel, never the raw slug.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { state } = vi.hoisted(() => ({ state: { items: [] as any[] } }));

vi.mock("@/modules/contracts/hooks/useContracts", () => ({
  useContracts: () => ({ contracts: [], isLoading: false, deleteContract: { mutate: vi.fn(), mutateAsync: vi.fn() }, addContract: { mutateAsync: vi.fn() } }),
}));
vi.mock("@/modules/contracts/hooks/useContractsPaginated", () => {
  const empty = { total: 0, byGroup: {}, sumByGroup: {} };
  return {
    useContractsPaginated: () => ({ contracts: state.items, total: state.items.length, isLoading: false, error: null, refetch: vi.fn() }),
    useContractsStats: () => ({ stats: empty, isLoading: false, error: null }),
    useContractTypeFacets: () => ({ facets: empty, isLoading: false, error: null }),
  };
});
vi.mock("@/modules/contracts/hooks/useContractServiceTypes", () => ({
  useContractServiceTypes: () => ({ serviceTypes: [], allServiceTypes: [], isLoading: false }),
}));
vi.mock("@/modules/contracts/hooks/useCategoryRegistry", () => ({ useCategoryRegistry: () => ({ categories: [] }) }));
vi.mock("@/shared/hooks/useEditQueryParam", () => ({ useEditQueryParam: () => undefined }));
vi.mock("@/modules/contracts/components/ContractWizard", () => ({ ContractWizard: () => null }));
vi.mock("@/modules/contracts/components/ContractViewModal", () => ({ ContractViewModal: () => null }));
vi.mock("@/modules/contracts/components/ContractFormModal", () => ({ ContractFormModal: () => null }));
vi.mock("@/shared/components/MainLayout", () => ({
  MainLayout: ({ actions, children }: any) => <div>{actions}{children}</div>,
}));
vi.mock("@/shared/components/RequirePermission", () => ({ RequirePermission: ({ children }: any) => <>{children}</> }));
vi.mock("@/shared/ui/select", () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children }: any) => <div role="option" data-value={value}>{children}</div>,
}));

import Contracts from "@/modules/contracts/pages/Contracts";

const L = (...p: string[]) => p.join("");
const contract = (id: string, type: any) => ({ id, title: `Contrato ${id}`, type, status: "draft", signers: [], start_date: null, end_date: null });

const typeCell = (id: string) => within(screen.getByTestId(`row-contract-${id}`)).getAllByRole("cell")[3];

describe("Contracts page legacy wiring (type column)", () => {
  it("legacy and canonical category slugs render their PT-BR label", () => {
    state.items = [
      contract("a", L("distri", "buicao")),
      contract("b", "distribution"),
      contract("c", L("grav", "acao")),
      contract("d", "rights_assignment"),
    ];
    render(<MemoryRouter><Contracts /></MemoryRouter>);
    expect(typeCell("a")).toHaveTextContent(/^Distribuição$/);
    expect(typeCell("b")).toHaveTextContent(/^Distribuição$/);
    expect(typeCell("c")).toHaveTextContent(/^Gravação$/);
    expect(typeCell("d")).toHaveTextContent(/^Cessão de Direitos$/);
  });

  it("negative: a contract without type shows the placeholder, and an underscore slug is never shown raw", () => {
    state.items = [contract("e", null), contract("f", "cessao_direitos")];
    render(<MemoryRouter><Contracts /></MemoryRouter>);
    expect(typeCell("e")).toHaveTextContent(/^—$/);
    expect(typeCell("f")).not.toHaveTextContent("_");
    expect(typeCell("f")).toHaveTextContent(/^Cessão de Direitos$/);
  });
});
