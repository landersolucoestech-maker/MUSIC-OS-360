import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const store = vi.hoisted(() => ({ rules: [] as unknown[] }));
const listCategories = vi.hoisted(() => vi.fn());

vi.mock("./useFinancialCategoryRulesStore", () => ({ useFinancialCategoryRulesStore: () => store }));
vi.mock("../services/financial-categories.service", () => ({
  financialCategoriesService: { list: listCategories },
}));

import { useTransactionCategoryFilterOptions } from "./useTransactionCategoryFilterOptions";

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function ruleWithCategory(category: string, active = true) {
  return { id: category, transaction_type: "Despesa", counterparty_type: "Empresa", category, subcategory: null, links: null, active, sort_order: 0, created_at: "", updated_at: "" };
}

async function options(): Promise<{ value: string; label: string }[]> {
  const { result } = renderHook(() => useTransactionCategoryFilterOptions(), { wrapper });
  await waitFor(() => expect(result.current.isLoadingFinancialCategories).toBe(false));
  return result.current.options;
}

beforeEach(() => {
  vi.clearAllMocks();
  listCategories.mockResolvedValue([{ name: "Categoria do Tenant" }]);
  store.rules = [];
});

describe("useTransactionCategoryFilterOptions: legacy rule categories are canonicalized into {value,label} options", () => {
  it("returns {value,label} objects (never the raw category strings)", async () => {
    store.rules = [ruleWithCategory("Serviços")];
    const result = await options();
    expect(result.length).toBeGreaterThan(5);
    for (const option of result) {
      expect(typeof option.value).toBe("string");
      expect(typeof option.label).toBe("string");
    }
  });

  it("a legacy slug in the rule store and its canonical id collapse into ONE option with the PT-BR label", async () => {
    store.rules = [ruleWithCategory("caches"), ruleWithCategory("performance_fees")];
    const result = await options();
    const fees = result.filter((option) => option.value === "performance_fees");
    expect(fees).toEqual([{ value: "performance_fees", label: "Cachês" }]);
  });

  it("negative: the legacy slug itself is never an option value", async () => {
    store.rules = [ruleWithCategory("caches"), ruleWithCategory("servicos"), ruleWithCategory("tecnologia")];
    const result = await options();
    const values = result.map((option) => option.value);
    for (const legacy of ["caches", "servicos", "tecnologia"]) expect(values).not.toContain(legacy);
    expect(values).toEqual(expect.arrayContaining(["performance_fees", "services", "technology"]));
    expect(new Set(values).size).toBe(values.length);
  });

  it("keeps free-text rule and tenant category names as their own option", async () => {
    store.rules = [ruleWithCategory("Minha Regra Livre")];
    const result = await options();
    expect(result).toContainEqual({ value: "Minha Regra Livre", label: "Minha Regra Livre" });
    expect(result).toContainEqual({ value: "Categoria do Tenant", label: "Categoria do Tenant" });
  });

  it("ignores inactive rules (their category only appears if the taxonomy has it)", async () => {
    store.rules = [ruleWithCategory("Categoria Inativa Exclusiva", false)];
    const result = await options();
    expect(result.map((option) => option.value)).not.toContain("Categoria Inativa Exclusiva");
  });
});
