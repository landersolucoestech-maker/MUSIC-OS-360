/**
 * Compat wiring: the P&L folds a category stored under its legacy slug and under its canonical id into ONE
 * bucket (canonicalTransactionCategory) and prints its PT-BR label (transactionCategoryLabel), also for search.
 */
import { fireEvent, render, screen, within, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";

const txs = vi.hoisted(() => ({ current: [] as Record<string, unknown>[] }));

vi.mock("@/modules/accounting/hooks/useAllTransactions", () => ({
  useAllTransactions: () => ({ transactions: txs.current, isLoading: false, error: null, truncated: false, total: txs.current.length, refetch: vi.fn() }),
  truncatedTransactionsNotice: () => "",
}));
vi.mock("@/shared/lib/exportAll", () => ({ fetchAllPages: vi.fn().mockResolvedValue({ items: [] }) }));
vi.mock("@/shared/components/MainLayout", () => ({
  MainLayout: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/shared/components/FeatureGate", () => ({ FeatureGate: ({ children }: { children?: React.ReactNode }) => <>{children}</> }));

import ProfitAndLoss from "./ProfitAndLoss";

function tx(id: string, type: "revenue" | "expense", category: string | null, amount: string) {
  return { id, type, category, amount, description: `Item ${id}`, transaction_date: "2026-09-01" };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><ProfitAndLoss /></QueryClientProvider>);
}

/** [label, amount text] of every category row of the company P&L (first table). */
function plRows(): [string, string][] {
  const table = screen.getAllByRole("table")[0];
  return within(table).getAllByRole("row")
    .map((tr) => Array.from(tr.querySelectorAll("td")).map((td) => td.textContent ?? ""))
    .filter((cells) => cells.length === 3 && cells[0].length > 0 && !/^(Total|Lucro)/.test(cells[0]))
    .map((cells) => [cells[0], cells[1]]);
}

afterEach(() => cleanup());

describe("ProfitAndLoss: legacy and canonical category spellings are one bucket", () => {
  it("sums 'caches' + 'performance_fees' (revenue) and 'tecnologia' + 'technology' (expense) into one row each, PT-BR labelled", () => {
    txs.current = [
      tx("1", "revenue", "caches", "100.00"),
      tx("2", "revenue", "performance_fees", "50.00"),
      tx("3", "expense", "tecnologia", "30.00"),
      tx("4", "expense", "technology", "20.00"),
    ];
    renderPage();
    const rows = plRows();
    expect(rows).toHaveLength(2);
    const [revenue, expense] = rows;
    expect(revenue[0]).toBe("Cachês");
    expect(revenue[1]).toMatch(/150,00/);
    expect(expense[0]).toBe("Tecnologia");
    expect(expense[1]).toMatch(/50,00/);
  });

  it("negative: distinct categories stay distinct, free text is shown as stored, never a raw slug", () => {
    txs.current = [
      tx("1", "revenue", "caches", "100.00"),
      tx("2", "revenue", "servicos", "40.00"),
      tx("3", "revenue", "Receitas Musicais", "10.00"),
    ];
    renderPage();
    const labels = plRows().map(([label]) => label);
    expect([...labels].sort()).toEqual(["Cachês", "Receitas Musicais", "Serviços"].sort());
    for (const label of labels) expect(label).not.toMatch(/[-_]|caches|servicos/);
  });

  it("an uncategorized row (null) is one bucket with the canonical placeholder label", () => {
    txs.current = [tx("1", "revenue", null, "10.00"), tx("2", "revenue", "other", "5.00"), tx("3", "revenue", "outros", "5.00")];
    renderPage();
    const rows = plRows();
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe("Outros");
    expect(rows[0][1]).toMatch(/20,00/);
  });

  it("the search box matches a legacy-slug row by its PT-BR label", () => {
    txs.current = [tx("1", "revenue", "caches", "100.00"), tx("2", "revenue", "servicos", "40.00")];
    renderPage();
    fireEvent.change(screen.getByTestId("input-search-accounting"), { target: { value: "cachês" } });
    const rows = plRows();
    expect(rows).toHaveLength(1);
    expect(rows[0][0]).toBe("Cachês");
    expect(rows[0][1]).toMatch(/100,00/);
  });
});
