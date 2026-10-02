// @ts-nocheck
// Template/contract category slugs stored before the vocabulary rename (and the deprecated
// CST service-type slugs) must still select the right service type in the contract form:
// the form maps every stored template slug through normalizeToCst before filtering types.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const { state } = vi.hoisted(() => ({ state: { templates: [] as any[] } }));

const CST_SLUGS = [
  "empresariamento", "suporte_financeiro", "gestao", "agenciamento", "edicao",
  "distribuicao", "marketing", "producao_musical", "producao_audiovisual",
  "licenciamento", "publicidade", "parceria", "shows", "outros",
];

vi.mock("@/modules/contracts/hooks/useContractServiceTypes", () => {
  const all = [
    "empresariamento", "suporte_financeiro", "gestao", "agenciamento", "edicao",
    "distribuicao", "marketing", "producao_musical", "producao_audiovisual",
    "licenciamento", "publicidade", "parceria", "shows", "outros",
  ].map((slug) => ({ id: slug, slug, name: `Tipo ${slug}`, allow_installments: false }));
  const value = { serviceTypes: all, allServiceTypes: all, isLoading: false };
  return { useContractServiceTypes: () => value };
});
vi.mock("@/modules/contracts/hooks/useContractTemplates", () => ({
  useContractTemplates: () => ({ templates: state.templates, isLoading: false }),
}));
vi.mock("@/modules/contracts/hooks/useCategoryRegistry", () => {
  const value = { categories: [] };
  return { useCategoryRegistry: () => value };
});
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
// Radix Select needs pointer APIs jsdom lacks; render every item inline so the options the form offers are observable.
vi.mock("@/shared/ui/select", () => ({
  Select: ({ children }: any) => <div>{children}</div>,
  SelectTrigger: ({ children }: any) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <div>{children}</div>,
  SelectItem: ({ value, children }: any) => <div role="option" data-value={value}>{children}</div>,
}));

import { ContractFormModal } from "@/modules/contracts/components/ContractFormModal";

// [template service_type as stored, CST service-type slug the form must offer]
const STORED_TEMPLATE_SLUGS: ReadonlyArray<readonly [string, string]> = [
  // already-valid CST slugs pass through
  ["empresariamento", "empresariamento"],
  ["suporte_financeiro", "suporte_financeiro"],
  ["gestao", "gestao"],
  ["edicao", "edicao"],
  ["distribuicao", "distribuicao"],
  ["producao_audiovisual", "producao_audiovisual"],
  ["parceria", "parceria"],
  ["agenciamento", "agenciamento"],
  ["licenciamento", "licenciamento"],
  ["outros", "outros"],
  ["producao_musical", "producao_musical"],
  ["publicidade", "publicidade"],
  // legacy contract category slugs map onto a CST slug
  ["exclusividade", "agenciamento"],
  ["gravacao", "producao_musical"],
  ["cessao_direitos", "licenciamento"],
  ["producao", "producao_musical"],
  ["publicitario", "publicidade"],
  ["semantico", "outros"],
  // canonical spellings written by the API
  ["exclusivity", "agenciamento"],
  ["recording", "producao_musical"],
  ["rights_assignment", "licenciamento"],
  ["advertising", "publicidade"],
  ["semantic", "outros"],
  // registry slug with numeric suffix
  ["empresariamento_360", "empresariamento"],
];

function offeredServiceTypes(): string[] {
  return screen
    .getAllByRole("option")
    .map((el) => el.getAttribute("data-value") as string)
    .filter((v) => CST_SLUGS.includes(v));
}

function renderForm(templateSlug: string) {
  state.templates = [{ id: "t1", service_type: templateSlug, name: "Template" }];
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ContractFormModal open onOpenChange={() => {}} mode="create" />
    </QueryClientProvider>,
  );
}

describe("ContractFormModal template category slugs (legacy in, canonical service type out)", () => {
  it.each(STORED_TEMPLATE_SLUGS)("template slug %s offers service type %s only", (stored, expected) => {
    const { unmount } = renderForm(stored);
    expect(offeredServiceTypes()).toEqual([expected]);
    expect(within(screen.getByRole("dialog")).getByText(`Tipo ${expected}`)).toBeInTheDocument();
    unmount();
  });

  it("an unrecognised template slug falls back to the catch-all type, not to a guessed one", () => {
    const { unmount } = renderForm("slug_sem_correspondencia");
    expect(offeredServiceTypes()).toEqual(["outros"]);
    unmount();
  });
});
