import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/accounting/services/accounting.service", () => ({
  accountingService: { getTransaction: vi.fn() },
}));

import { accountingService } from "@/modules/accounting/services/accounting.service";
import { TransactionViewModal } from "./TransactionViewModal";

const base = {
  id: "3f2b9c1e-8a7d-4e21-9b3c-5d6e7f8a9b0c",
  type: "expense",
  status: "paid",
  amount: "150.00",
  description: "Cachê do show",
  transactionDate: "2026-09-01T00:00:00.000Z",
  counterpartyType: "artist",
};

async function rowValue(label: string, data: Record<string, unknown>): Promise<string | null> {
  vi.mocked(accountingService.getTransaction).mockResolvedValue({ ...base, ...data } as never);
  render(<TransactionViewModal open onOpenChange={() => {}} transactionId="t1" />);
  await waitFor(() => expect(screen.getByTestId("text-transaction-description")).toBeInTheDocument());
  const row = screen.queryAllByText(label)[0];
  const value = row?.nextElementSibling?.textContent ?? null;
  cleanup();
  return value;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe("TransactionViewModal: stored legacy category slugs show their PT-BR label", () => {
  it.each([
    ["caches", "Cachês"],
    ["performance_fees", "Cachês"],
    ["servicos", "Serviços"],
    ["receitas-musicais", "Receitas Musicais"],
    ["tecnologia", "Tecnologia"],
  ])("category %s renders %s (never the raw slug)", async (stored, label) => {
    const value = await rowValue("Categoria", { category: stored });
    expect(value).toBe(label);
  });

  it.each([
    ["show-evento", "Show / Evento"],
    ["show_event", "Show / Evento"],
    ["direitos-conexos", "Direitos Conexos"],
    ["gravacao-estudio", "Gravação em Estúdio"],
  ])("subcategory %s renders %s", async (stored, label) => {
    const value = await rowValue("Subcategoria", { category: "servicos", subcategory: stored });
    expect(value).toBe(label);
  });

  it("negative: legacy and canonical spellings never leak a hyphen or underscore slug", async () => {
    for (const stored of ["caches", "performance_fees", "show-evento", "gravacao-estudio"]) {
      const category = await rowValue("Categoria", { category: stored });
      const subcategory = await rowValue("Subcategoria", { category: "servicos", subcategory: stored });
      expect(category).not.toBe(stored);
      expect(subcategory).not.toBe(stored);
      expect(category ?? "").not.toMatch(/[-_]/);
      expect(subcategory ?? "").not.toMatch(/[-_]/);
    }
  });

  it("negative: free-text category written by the rule store is shown as stored", async () => {
    expect(await rowValue("Categoria", { category: "Receitas Musicais" })).toBe("Receitas Musicais");
    expect(await rowValue("Categoria", { category: "Minha categoria" })).toBe("Minha categoria");
  });

  it("negative: no category means no category row", async () => {
    expect(await rowValue("Categoria", { category: null })).toBeNull();
  });
});
