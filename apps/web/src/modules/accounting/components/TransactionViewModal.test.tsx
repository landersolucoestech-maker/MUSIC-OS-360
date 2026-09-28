import { render, screen, waitFor, within } from "@testing-library/react";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/modules/accounting/services/accounting.service", () => ({
  accountingService: { getTransaction: vi.fn() },
}));

import { accountingService } from "@/modules/accounting/services/accounting.service";
import { TransactionViewModal } from "./TransactionViewModal";

const originalTz = process.env.TZ;
beforeAll(() => { process.env.TZ = "America/Sao_Paulo"; });
afterAll(() => { process.env.TZ = originalTz; });

const UUID = "3f2b9c1e-8a7d-4e21-9b3c-5d6e7f8a9b0c";

const detail = {
  id: UUID,
  type: "expense",
  status: "paid",
  amount: "150.00",
  description: "Aluguel do estúdio",
  transactionDate: "2026-09-01T00:00:00.000Z",
  firstInstallmentDate: "2026-10-05",
  dueDate: "2026-11-01T00:00:00.000Z",
  paidAt: "2026-12-01",
  counterpartyType: "company",
  installments: 3,
  installmentInterval: "monthly",
  createdBy: { name: "Ana" },
  created_at: "2026-09-01T15:00:00.000Z",
};

async function open(data: Record<string, unknown>) {
  vi.mocked(accountingService.getTransaction).mockResolvedValue(data as never);
  render(<TransactionViewModal open onOpenChange={() => {}} transactionId="t1" />);
  await waitFor(() => expect(screen.getByTestId("text-transacao-descricao")).toBeInTheDocument());
  return screen.getByTestId("modal-transacao-view");
}

beforeEach(() => vi.clearAllMocks());

describe("TransactionViewModal", () => {
  it("formats calendar-day fields without a local-timezone shift", async () => {
    const modal = await open(detail);
    const text = modal.textContent ?? "";
    expect(text).toContain("01/09/2026");
    expect(text).not.toContain("31/08/2026");
    expect(text).toContain("05/10/2026");
    expect(text).not.toContain("04/10/2026");
    expect(text).toContain("01/11/2026");
    expect(text).toContain("01/12/2026");
  });

  it("uses the form wording for the counterparty and never shows the UUID", async () => {
    const modal = await open(detail);
    expect(within(modal).getByText("Pagar para")).toBeInTheDocument();
    expect(within(modal).queryByText("Tipo de cliente")).toBeNull();
    expect(modal.textContent).not.toContain(UUID);
  });

  it("uses 'Receber de' for revenue", async () => {
    const modal = await open({ ...detail, type: "revenue" });
    expect(within(modal).getByText("Receber de")).toBeInTheDocument();
  });

  it("labels an unknown counterparty value as 'Tipo não reconhecido' (not 'Não informado', never raw)", async () => {
    const modal = await open({ ...detail, counterpartyType: "alien_value" });
    expect(within(modal).getByText("Tipo não reconhecido")).toBeInTheDocument();
    expect(modal.textContent).not.toContain("alien_value");
  });

  it("renders the audit rows only once (Auditoria section)", async () => {
    const modal = await open(detail);
    expect(within(modal).getAllByText("Criado por")).toHaveLength(1);
    expect(within(modal).getAllByText("Criado em")).toHaveLength(1);
  });

  it("shows 'Data inválida' for a malformed calendar date, never 'Invalid Date'", async () => {
    const modal = await open({ ...detail, dueDate: "31-31-2026" });
    expect(modal.textContent).toContain("Data inválida");
    expect(modal.textContent).not.toContain("Invalid Date");
  });

  it("does not relabel an unknown status as 'Pendente'", async () => {
    const modal = await open({ ...detail, status: "mystery_status" });
    expect(within(modal).getAllByText("Status não reconhecido").length).toBeGreaterThan(0);
    expect(within(modal).queryByText("Pendente")).toBeNull();
  });
});
