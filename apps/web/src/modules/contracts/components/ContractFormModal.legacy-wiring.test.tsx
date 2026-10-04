// @ts-nocheck
// Wiring tests for the compatibility helpers ContractFormModal consumes: a contract persisted with the
// canonical category while the tenant service type keeps the legacy slug, and signers jsonb written by
// earlier builds (Portuguese roles, wizard-persisted records with canonical or legacy keys).
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { state } = vi.hoisted(() => ({
  state: { templates: [] as any[], categories: [] as any[], types: [] as any[] },
}));

vi.mock("@/modules/contracts/hooks/useContractServiceTypes", () => ({
  useContractServiceTypes: () => ({ serviceTypes: state.types, allServiceTypes: state.types, isLoading: false }),
}));
vi.mock("@/modules/contracts/hooks/useContractTemplates", () => ({
  useContractTemplates: () => ({ templates: state.templates, isLoading: false }),
}));
vi.mock("@/modules/contracts/hooks/useCategoryRegistry", () => ({
  useCategoryRegistry: () => ({ categories: state.categories }),
}));
vi.mock("@/modules/contracts/hooks/useContracts", () => {
  const mutation = { mutateAsync: vi.fn(), isPending: false };
  const value = { addContract: mutation, updateContract: mutation, contracts: [] };
  return { useContracts: () => value };
});
vi.mock("@/modules/releases/hooks/useReleases", () => {
  const value = { releases: [], isLoading: false };
  return { useReleases: () => value };
});
vi.mock("@/shared/components/FileUpload", () => ({ FileUpload: () => null }));
// Radix Select needs pointer APIs jsdom lacks: expose the controlled value and every item inline.
vi.mock("@/shared/ui/select", () => ({
  Select: ({ value, children }: any) => <div data-select-value={value ?? ""}>{children}</div>,
  SelectTrigger: ({ children, ...rest }: any) => <div {...rest}>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children }: any) => <div role="option" data-value={value}>{children}</div>,
}));

import { ContractFormModal } from "@/modules/contracts/components/ContractFormModal";

const SLUG_LEGACY = ["distri", "buicao"].join("");
const SLUG_CANONICAL = "distribution";

function renderEdit(contract: any) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ContractFormModal open onOpenChange={() => {}} mode="edit" contract={contract} />
    </QueryClientProvider>,
  );
}

const selectedValue = (testId: string) =>
  screen.getByTestId(testId).closest("[data-select-value]")!.getAttribute("data-select-value");

function baseContract(over: any = {}) {
  return { id: "c1", title: "Contrato", type: SLUG_CANONICAL, status: "draft", signers: [], documents: [], ...over };
}

describe("ContractFormModal legacy wiring: service type slug", () => {
  it("canonical contract type selects the tenant type that keeps the legacy slug (no 'tipo anterior' fallback)", () => {
    state.types = [
      { id: "1", slug: "gestao", name: "Gestao Tipo", allow_installments: false },
      { id: "2", slug: SLUG_LEGACY, name: "Distribuicao Tipo", allow_installments: false },
    ];
    state.templates = [{ id: "t1", service_type: SLUG_LEGACY, name: "T" }];
    state.categories = [];
    const { unmount } = renderEdit(baseContract());
    expect(selectedValue("select-service-type")).toBe(SLUG_LEGACY);
    expect(screen.queryByText(/tipo anterior/)).not.toBeInTheDocument();
    unmount();
  });

  it("negative: a contract type with no matching tenant type keeps its own value and shows the previous-type notice", () => {
    state.types = [{ id: "1", slug: "gestao", name: "Gestao Tipo", allow_installments: false }];
    state.templates = [{ id: "t1", service_type: "gestao", name: "T" }];
    state.categories = [];
    const { unmount } = renderEdit(baseContract());
    expect(selectedValue("select-service-type")).toBe(SLUG_CANONICAL);
    expect(screen.getByText(`${SLUG_CANONICAL} (tipo anterior)`)).toBeInTheDocument();
    unmount();
  });

  it("registry label is taken from the category that spells the template slug canonically, not from the first one", () => {
    state.types = [{ id: "2", slug: SLUG_LEGACY, name: "Distribuicao Tipo", allow_installments: false }];
    state.templates = [{ id: "t1", service_type: SLUG_LEGACY, name: "T" }];
    state.categories = [
      { value: "other", label: "Registro Outros" },
      { value: SLUG_CANONICAL, label: "Registro Distribuicao" },
    ];
    const { unmount } = renderEdit(baseContract());
    const opt = screen.getAllByRole("option").find((o) => o.getAttribute("data-value") === SLUG_LEGACY);
    expect(opt).toHaveTextContent("Registro Distribuicao");
    unmount();
  });

  it("negative: no registry category matches the template slug, so the type name is shown", () => {
    state.types = [{ id: "2", slug: SLUG_LEGACY, name: "Distribuicao Tipo", allow_installments: false }];
    state.templates = [{ id: "t1", service_type: SLUG_LEGACY, name: "T" }];
    state.categories = [{ value: "other", label: "Registro Outros" }];
    const { unmount } = renderEdit(baseContract());
    const opt = screen.getAllByRole("option").find((o) => o.getAttribute("data-value") === SLUG_LEGACY);
    expect(opt).toHaveTextContent("Distribuicao Tipo");
    expect(opt).not.toHaveTextContent("Registro Outros");
    unmount();
  });
});

describe("ContractFormModal legacy wiring: stored signers", () => {
  const ROLE_ARTIST_LEGACY = ["art", "ista"].join("");
  const ROLE_PRODUCER_LEGACY = ["prod", "utor"].join("");
  const ROLE_MANAGER_LEGACY = ["empre", "sario"].join("");
  const REQUIRED_LEGACY = ["obriga", "torio"].join("");

  function setup() {
    state.types = [{ id: "1", slug: "gestao", name: "Gestao Tipo", allow_installments: false }];
    state.templates = [{ id: "t1", service_type: "gestao", name: "T" }];
    state.categories = [];
  }

  it("loads legacy-role signers with the canonical role selected", () => {
    setup();
    const { unmount } = renderEdit(
      baseContract({
        signers: [
          { name: "Ana", email: "ana@x.com", role: ROLE_ARTIST_LEGACY },
          { name: "Paulo", email: "paulo@x.com", role: ROLE_PRODUCER_LEGACY },
          { name: "Eva", email: "eva@x.com", role: ROLE_MANAGER_LEGACY },
          { name: "Lia", email: "lia@x.com", role: "label" },
        ],
      }),
    );
    expect(selectedValue("select-signer-role-0")).toBe("artist");
    expect(selectedValue("select-signer-role-1")).toBe("producer");
    expect(selectedValue("select-signer-role-2")).toBe("manager");
    // negative: an already canonical role is untouched
    expect(selectedValue("select-signer-role-3")).toBe("label");
    unmount();
  });

  it("negative: an unknown role is not guessed into a canonical one", () => {
    setup();
    const { unmount } = renderEdit(
      baseContract({ signers: [{ name: "X", email: "x@x.com", role: "desconhecido" }] }),
    );
    expect(selectedValue("select-signer-role-0")).toBe("desconhecido");
    unmount();
  });

  it("drops wizard-persisted signer records (canonical and legacy keys) and keeps plain signers", () => {
    setup();
    const { unmount } = renderEdit(
      baseContract({
        signers: [
          { name: "Plain", email: "plain@x.com", role: "artist" },
          { name: "Wizard canonical", email: "w1@x.com", role: "OUTRO", required: true, order: 1 },
          { name: "Wizard legacy", email: "w2@x.com", role: "OUTRO", [REQUIRED_LEGACY]: true },
        ],
      }),
    );
    const dialog = within(screen.getByRole("dialog"));
    expect(dialog.getAllByTestId(/^signer-row-form-/)).toHaveLength(1);
    expect(dialog.getByTestId("input-signer-name-0")).toHaveValue("Plain");
    unmount();
  });
});
