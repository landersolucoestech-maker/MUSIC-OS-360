import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

// The selects/comboboxes are replaced by probes that print the exact options the section computed.
vi.mock("@/modules/accounting/components/transaction-form/components/FormSelectField", () => ({
  FormSelectField: (props: { label: string; value: string; options: { value: string; label: string }[] }) => (
    <div data-testid={`select:${props.label}`} data-value={props.value}>{JSON.stringify(props.options)}</div>
  ),
}));
vi.mock("@/shared/components/AsyncEntityCombobox", () => ({
  AsyncEntityCombobox: (props: Record<string, unknown>) => <div data-testid={String(props["data-testid"])} />,
}));

import { TransactionTypeSection } from "./TransactionTypeSection";
import { initialFormData, type TransactionFormData } from "@/modules/accounting/constants/transaction-constants";
import type { FinancialCategoryRuleEntity } from "@/modules/accounting/types/financial-category-rules.types";
import type { FinancialRulesResult } from "@/modules/accounting/components/transaction-form/hooks/useFinancialRules";

// Rule store keyed by PT-BR labels (the persisted shape); the form works with canonical values.
function rule(partial: Partial<FinancialCategoryRuleEntity> & Pick<FinancialCategoryRuleEntity, "transaction_type" | "counterparty_type" | "category">): FinancialCategoryRuleEntity {
  return { id: "r", subcategory: null, links: null, active: true, sort_order: 0, created_at: "", updated_at: "", ...partial };
}

const RULES: FinancialCategoryRuleEntity[] = [
  rule({ id: "1", transaction_type: "Despesa", counterparty_type: "Empresa", category: "Serviços", subcategory: "Design gráfico", links: ["Artista", "Projeto"] }),
  rule({ id: "2", transaction_type: "Despesa", counterparty_type: "Empresa", category: "Serviços", subcategory: "Consultoria", links: ["Contrato"] }),
  rule({ id: "3", transaction_type: "Despesa", counterparty_type: "Pessoa", category: "Reembolso" }),
  rule({ id: "4", transaction_type: "Receita", counterparty_type: "Artista", category: "Cachê", links: ["Evento", "Centro de custo"] }),
  rule({ id: "5", transaction_type: "Receita", counterparty_type: "Governo", category: "Inativa", active: false }),
];

function renderSection(overrides: Partial<TransactionFormData>, rules: FinancialCategoryRuleEntity[] = RULES) {
  const formData = { ...initialFormData, ...overrides };
  return render(
    <TransactionTypeSection
      formData={formData}
      rules={{} as FinancialRulesResult}
      categoryRules={rules}
      errors={{}}
      disabled={false}
      updateField={() => {}}
      filteredEvents={[]}
    />,
  );
}

const options = (label: string): unknown => {
  const el = screen.queryByTestId(`select:${label}`);
  return el ? JSON.parse(el.textContent ?? "null") : null;
};

afterEach(() => cleanup());

describe("TransactionTypeSection: rule-store labels are translated to canonical option values", () => {
  it("lists the transaction types as canonical value + PT-BR label, only for active rules", () => {
    renderSection({});
    expect(options("Tipo de Transação")).toEqual([
      { value: "expense", label: "Despesa" },
      { value: "revenue", label: "Receita" },
    ]);
  });

  it("lists the counterparties of the selected type with canonical values", () => {
    renderSection({ transactionType: "expense" });
    expect(options("Pagar para")).toEqual([
      { value: "company", label: "Empresa" },
      { value: "individual", label: "Pessoa" },
    ]);
    cleanup();
    renderSection({ transactionType: "revenue" });
    expect(options("Receber de")).toEqual([{ value: "artist", label: "Artista" }]);
  });

  it("negative: no counterparty select for an empty or unknown (non-canonical) transaction type", () => {
    renderSection({ transactionType: "" });
    expect(screen.queryByTestId("select:Pagar para")).toBeNull();
    cleanup();
    renderSection({ transactionType: "Despesa" });
    expect(screen.queryByTestId("select:Pagar para")).toBeNull();
    expect(screen.queryByTestId("select:Receber de")).toBeNull();
  });

  it("lists the categories of the type/counterparty pair", () => {
    renderSection({ transactionType: "expense", counterpartyType: "company" });
    expect(options("Categoria")).toEqual([{ value: "Serviços", label: "Serviços" }]);
    cleanup();
    renderSection({ transactionType: "expense", counterpartyType: "individual" });
    expect(options("Categoria")).toEqual([{ value: "Reembolso", label: "Reembolso" }]);
  });

  it("negative: no category select for a counterparty label (non-canonical) or an inactive-only pair", () => {
    renderSection({ transactionType: "expense", counterpartyType: "Empresa" });
    expect(screen.queryByTestId("select:Categoria")).toBeNull();
    cleanup();
    renderSection({ transactionType: "revenue", counterpartyType: "government" });
    expect(screen.queryByTestId("select:Categoria")).toBeNull();
  });

  it("lists the subcategories of the category", () => {
    renderSection({ transactionType: "expense", counterpartyType: "company", category: "Serviços" });
    expect(options("Subcategoria")).toEqual([
      { value: "Consultoria", label: "Consultoria" },
      { value: "Design gráfico", label: "Design gráfico" },
    ]);
  });

  it("negative: no subcategory select for a category without subcategories or an unknown one", () => {
    renderSection({ transactionType: "revenue", counterpartyType: "artist", category: "Cachê" });
    expect(screen.queryByTestId("select:Subcategoria")).toBeNull();
    cleanup();
    renderSection({ transactionType: "expense", counterpartyType: "company", category: "Inexistente" });
    expect(screen.queryByTestId("select:Subcategoria")).toBeNull();
  });

  it("offers the links of the final rule as canonical values with PT-BR labels", () => {
    renderSection({ transactionType: "expense", counterpartyType: "company", category: "Serviços", subcategory: "Design gráfico" });
    expect(options("Vinculações")).toEqual([
      { value: "artist", label: "Artista" },
      { value: "project", label: "Projeto" },
    ]);
    cleanup();
    renderSection({ transactionType: "revenue", counterpartyType: "artist", category: "Cachê" });
    expect(options("Vinculações")).toEqual([
      { value: "event", label: "Evento" },
      { value: "cost_center", label: "Centro de custo" },
    ]);
  });

  it("negative: no link select without a final rule, or when the rule has no links", () => {
    // subcategory missing while the category has subcategories -> no final rule
    renderSection({ transactionType: "expense", counterpartyType: "company", category: "Serviços", subcategory: "" });
    expect(screen.queryByTestId("select:Vinculações")).toBeNull();
    cleanup();
    // final rule exists but declares no links
    renderSection({ transactionType: "expense", counterpartyType: "individual", category: "Reembolso" });
    expect(screen.queryByTestId("select:Vinculações")).toBeNull();
    cleanup();
    // unknown subcategory -> no final rule
    renderSection({ transactionType: "expense", counterpartyType: "company", category: "Serviços", subcategory: "Nada" });
    expect(screen.queryByTestId("select:Vinculações")).toBeNull();
  });

  it("negative: inactive rules never feed any option", () => {
    renderSection({ transactionType: "revenue" });
    expect(options("Receber de")).toEqual([{ value: "artist", label: "Artista" }]);
  });

  describe("the selected canonical linkType decides which link input is shown", () => {
    const FINAL = { transactionType: "expense", counterpartyType: "company", category: "Serviços", subcategory: "Design gráfico" } as const;

    it("artist -> artist combobox only", () => {
      renderSection({ ...FINAL, linkType: "artist" });
      expect(screen.getByTestId("combobox-linked-artist")).toBeInTheDocument();
      expect(screen.queryByTestId("combobox-linked-project")).toBeNull();
    });

    it("project -> project combobox only", () => {
      renderSection({ ...FINAL, linkType: "project" });
      expect(screen.getByTestId("combobox-linked-project")).toBeInTheDocument();
      expect(screen.queryByTestId("combobox-linked-artist")).toBeNull();
    });

    it("contract -> contract input", () => {
      renderSection({ ...FINAL, linkType: "contract" });
      expect(screen.getByText("Contrato Vinculado")).toBeInTheDocument();
    });

    it("negative: a PT-BR label or unknown value as linkType shows no link input", () => {
      for (const linkType of ["Artista", "Projeto", "Contrato", "bogus", ""]) {
        renderSection({ ...FINAL, linkType });
        expect(screen.queryByTestId("combobox-linked-artist")).toBeNull();
        expect(screen.queryByTestId("combobox-linked-project")).toBeNull();
        expect(screen.queryByText("Contrato Vinculado")).toBeNull();
        cleanup();
      }
    });
  });
});
