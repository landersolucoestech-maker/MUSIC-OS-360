import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const toastError = vi.hoisted(() => vi.fn());
const addMutate = vi.hoisted(() => vi.fn());
const noop = vi.hoisted(() => vi.fn());
const ruleStore = vi.hoisted(() => ({ rules: [] as unknown[] }));
const validationApi = vi.hoisted(() => ({
  errors: {},
  validate: () => true,
  clearFieldError: () => {},
  clearFieldErrors: () => {},
  clearAllErrors: () => {},
}));
const transactionsApi = vi.hoisted(() => ({
  addTransaction: { mutateAsync: (...args: unknown[]) => addMutate(...args) },
  updateTransaction: { mutateAsync: () => Promise.resolve() },
}));
const artistEvents = vi.hoisted(() => ({ events: [], isLoading: false, error: null, truncated: false, refetch: () => Promise.resolve() }));

vi.mock("sonner", () => ({ toast: { error: toastError, success: noop } }));
vi.mock("@/modules/accounting/hooks/useTransactions", () => ({ useTransactions: () => transactionsApi }));
vi.mock("@/modules/accounting/hooks/useFinancialCategoryRulesStore", () => ({
  useFinancialCategoryRulesStore: () => ruleStore,
}));
vi.mock("@/modules/events/hooks/useArtistEvents", () => ({ useArtistEvents: () => artistEvents }));
vi.mock("./useFinancialValidation", () => ({ useFinancialValidation: () => validationApi }));

import { useTransactionFormController } from "./useTransactionFormController";
import type { FinancialCategoryRuleEntity } from "@/modules/accounting/types/financial-category-rules.types";
import type { TransactionFormData } from "@/modules/accounting/constants/transaction-constants";

function rule(partial: Partial<FinancialCategoryRuleEntity> & Pick<FinancialCategoryRuleEntity, "transaction_type" | "counterparty_type" | "category">): FinancialCategoryRuleEntity {
  return { id: "r", subcategory: null, links: null, active: true, sort_order: 0, created_at: "", updated_at: "", ...partial };
}

// Rule store keyed by PT-BR labels (the persisted shape).
const RULES: FinancialCategoryRuleEntity[] = [
  rule({ id: "1", transaction_type: "Despesa", counterparty_type: "Empresa", category: "Serviços", subcategory: "Consultoria", links: ["Contrato"] }),
  rule({ id: "2", transaction_type: "Despesa", counterparty_type: "Pessoa", category: "Reembolso" }),
];

type Fill = Partial<Record<keyof TransactionFormData, string>>;

async function submitWith(fill: Fill) {
  const onClose = vi.fn();
  const { result } = renderHook(() => useTransactionFormController({ open: true, mode: "create", onClose }));
  // Same order as the user: each field resets its dependents, so the link is chosen last.
  const order: (keyof TransactionFormData)[] = ["transactionType", "counterpartyType", "category", "subcategory", "linkType", "contractId"];
  for (const field of order) {
    const value = fill[field];
    if (value !== undefined) act(() => result.current.updateField(field, value));
  }
  await act(async () => {
    await result.current.handleSubmit({ preventDefault: () => {} } as never);
  });
  return { onClose };
}

const toastMessages = () => toastError.mock.calls.map((call) => String(call[0]));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  ruleStore.rules = RULES;
  addMutate.mockResolvedValue(undefined);
});

describe("useTransactionFormController submit guard with a PT-BR label rule store", () => {
  it("submits a valid combination whose final rule links are satisfied", async () => {
    const { onClose } = await submitWith({
      transactionType: "expense", counterpartyType: "company", category: "Serviços", subcategory: "Consultoria",
      linkType: "contract", contractId: "c1",
    });
    expect(toastMessages()).toEqual([]);
    expect(addMutate).toHaveBeenCalledTimes(1);
    expect(addMutate.mock.calls[0][0]).toMatchObject({ transactionType: "expense", counterpartyType: "company", contractId: "c1" });
    expect(onClose).toHaveBeenCalled();
  });

  it("submits a valid combination whose rule has no links without asking for a link", async () => {
    await submitWith({ transactionType: "expense", counterpartyType: "individual", category: "Reembolso" });
    expect(toastMessages()).toEqual([]);
    expect(addMutate).toHaveBeenCalledTimes(1);
  });

  it("blocks a combination that matches no rule", async () => {
    await submitWith({ transactionType: "expense", counterpartyType: "company", category: "Inexistente" });
    expect(toastMessages()).toEqual(["Selecione uma combinação financeira válida"]);
    expect(addMutate).not.toHaveBeenCalled();
  });

  it("blocks a combination with a missing required subcategory", async () => {
    await submitWith({ transactionType: "expense", counterpartyType: "company", category: "Serviços" });
    expect(toastMessages()).toEqual(["Selecione uma combinação financeira válida"]);
    expect(addMutate).not.toHaveBeenCalled();
  });

  it("blocks a PT-BR label used where a canonical type/counterparty value is expected", async () => {
    await submitWith({ transactionType: "Despesa", counterpartyType: "Empresa", category: "Serviços", subcategory: "Consultoria" });
    expect(toastMessages()).toEqual(["Selecione uma combinação financeira válida"]);
    expect(addMutate).not.toHaveBeenCalled();
  });

  it("blocks when the final rule requires a link and none is chosen", async () => {
    await submitWith({ transactionType: "expense", counterpartyType: "company", category: "Serviços", subcategory: "Consultoria" });
    expect(toastMessages()).toEqual(["Selecione uma vinculação válida para esta categoria"]);
    expect(addMutate).not.toHaveBeenCalled();
  });

  it.each(["Contrato", "bogus", "contrato"])("blocks a non-canonical linkType %s", async (linkType) => {
    await submitWith({
      transactionType: "expense", counterpartyType: "company", category: "Serviços", subcategory: "Consultoria",
      linkType, contractId: "c1",
    });
    expect(toastMessages()).toEqual(["Selecione uma vinculação válida para esta categoria"]);
    expect(addMutate).not.toHaveBeenCalled();
  });

  it("blocks a canonical linkType whose value field is empty", async () => {
    await submitWith({
      transactionType: "expense", counterpartyType: "company", category: "Serviços", subcategory: "Consultoria",
      linkType: "contract",
    });
    expect(toastMessages()).toEqual(["Preencha o campo da vinculação selecionada"]);
    expect(addMutate).not.toHaveBeenCalled();
  });

  it("blocks everything when the rule store is empty", async () => {
    ruleStore.rules = [];
    await submitWith({ transactionType: "expense", counterpartyType: "individual", category: "Reembolso" });
    expect(toastMessages()).toEqual(["Selecione uma combinação financeira válida"]);
    expect(addMutate).not.toHaveBeenCalled();
  });
});
