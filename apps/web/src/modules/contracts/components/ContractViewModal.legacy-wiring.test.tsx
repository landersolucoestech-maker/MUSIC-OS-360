// @ts-nocheck
// Wiring test: the "Tipo" field of the contract detail shows the PT-BR label of the stored category
// (legacy slug or canonical spelling) through formatCategoryLabel, never the raw slug.
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

vi.mock("@/modules/releases/hooks/useReleases", () => ({ useReleases: () => ({ releases: [], isLoading: false }) }));
vi.mock("@/modules/contracts/hooks/useDocuments", () => ({ useDocuments: () => ({ data: [] }) }));
vi.mock("@/shared/hooks/useWorkflowTransition", () => ({
  useWorkflowTransition: () => ({ transition: vi.fn(), isPending: false }),
}));
vi.mock("@/shared/hooks/useEntityDetail", () => ({ useEntityDetail: () => ({ data: undefined }) }));
vi.mock("@/modules/contracts/components/SendForSigningDialog", () => ({ SendForSigningDialog: () => null }));
vi.mock("@/modules/contracts/components/DocumentTimeline", () => ({ DocumentTimeline: () => null }));
vi.mock("@/shared/components/WorkflowTransitionPanel", () => ({ WorkflowTransitionPanel: () => null }));

import { ContractViewModal } from "@/modules/contracts/components/ContractViewModal";

const L = (...p: string[]) => p.join("");

function renderView(type: any) {
  const contract = { id: "c1", title: "Contrato X", type, status: "draft", signers: [], versions: [], documents: [] };
  return render(
    <MemoryRouter>
      <ContractViewModal open onOpenChange={() => {}} contract={contract} />
    </MemoryRouter>,
  );
}

const typeValue = () => screen.getByText("Tipo", { selector: "p" }).nextElementSibling as HTMLElement;

describe("ContractViewModal legacy wiring (type label)", () => {
  it.each([
    [L("distri", "buicao"), "Distribuição"],
    ["distribution", "Distribuição"],
    [L("grav", "acao"), "Gravação"],
    ["rights_assignment", "Cessão de Direitos"],
    [L("cessao", "_direitos"), "Cessão de Direitos"],
  ])("stored type %s renders %s", (stored, label) => {
    const { unmount } = renderView(stored);
    expect(typeValue()).toHaveTextContent(new RegExp(`^${label}$`));
    unmount();
  });

  it("negative: no type shows the placeholder", () => {
    const { unmount } = renderView(null);
    expect(typeValue()).toHaveTextContent(/^—$/);
    unmount();
  });
});
