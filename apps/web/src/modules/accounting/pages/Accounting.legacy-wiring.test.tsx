/**
 * Compat wiring: the transactions table prints the PT-BR label of the stored category through
 * transactionCategoryLabel (legacy slug and canonical id share one label; never the raw slug).
 */
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const rows = vi.hoisted(() => ({ current: [] as Record<string, unknown>[] }));

vi.mock("@/modules/accounting/hooks/useTransactions", () => ({
  useTransactions: () => ({ deleteTransaction: { mutate: vi.fn(), mutateAsync: vi.fn() }, addTransaction: { mutateAsync: vi.fn() } }),
}));
vi.mock("@/modules/accounting/hooks/useTransactionsPaginated", () => ({
  useTransactionsPaginated: () => ({ transactions: rows.current, total: rows.current.length, isLoading: false, error: null, refetch: vi.fn() }),
  useFinanceStats: () => ({
    kpis: { revenuePaid: 0, expensesPaid: 0, netProfit: 0, margin: 0, receivables: 0, payables: 0, pendingRevenue: 0, pendingExpenses: 0, total: rows.current.length },
  }),
}));
vi.mock("@/modules/accounting/hooks/useTransactionCategoryFilterOptions", () => ({
  useTransactionCategoryFilterOptions: () => ({ options: [], isLoadingFinancialCategories: false }),
}));
vi.mock("@/shared/hooks/useEditQueryParam", () => ({ useEditQueryParam: () => {} }));
vi.mock("@/shared/components/MainLayout", () => ({
  MainLayout: ({ actions, children }: { actions?: React.ReactNode; children?: React.ReactNode }) => <div>{actions}{children}</div>,
}));
vi.mock("@/shared/components/FeatureGate", () => ({ FeatureGate: ({ children }: { children?: React.ReactNode }) => <>{children}</> }));
vi.mock("@/shared/components/RequirePermission", () => ({ RequirePermission: ({ children }: { children?: React.ReactNode }) => <>{children}</> }));
vi.mock("@/modules/accounting/components/transaction-form/TransactionFormModal", () => ({ TransactionFormModal: () => null }));
vi.mock("@/modules/accounting/components/TransactionViewModal", () => ({ TransactionViewModal: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import Accounting from "./Accounting";

function row(id: string, category: string | null) {
  return { id, type: "revenue", status: "paid", description: `Lançamento ${id}`, category, transaction_date: "2026-09-01", amount: "10.00" };
}

function categoryCell(id: string): string {
  const tr = screen.getByTestId(`row-transaction-${id}`);
  return within(tr).getAllByRole("cell")[3].textContent ?? "";
}

describe("Accounting transactions table: category column", () => {
  it("shows the same PT-BR label for the legacy slug and the canonical id", () => {
    rows.current = [row("a", "caches"), row("b", "performance_fees"), row("c", "servicos"), row("d", "tecnologia")];
    render(<MemoryRouter><Accounting /></MemoryRouter>);
    expect(categoryCell("a")).toBe("Cachês");
    expect(categoryCell("b")).toBe("Cachês");
    expect(categoryCell("c")).toBe("Serviços");
    expect(categoryCell("d")).toBe("Tecnologia");
  });

  it("negative: never prints a raw slug, shows free text as stored and a placeholder for no category", () => {
    rows.current = [row("a", "caches"), row("b", "Receitas Musicais"), row("c", null), row("d", "performance_fees")];
    render(<MemoryRouter><Accounting /></MemoryRouter>);
    expect(categoryCell("a")).not.toMatch(/[-_]|caches/);
    expect(categoryCell("d")).not.toContain("_");
    expect(categoryCell("b")).toBe("Receitas Musicais");
    expect(categoryCell("c")).toBe("Sem categoria");
  });
});
