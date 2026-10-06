/**
 * Behavior: each invoice row shows a document action only when invoiceFileUrl resolves a url
 * (file_url canonical, url_pdf legacy) and the action opens exactly that url.
 */
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const rows = vi.hoisted(() => ({ current: [] as Record<string, unknown>[] }));
const openStoredFile = vi.hoisted(() => vi.fn());

vi.mock("@/shared/lib/stored-file", () => ({ openStoredFile }));
vi.mock("@/modules/accounting/hooks/useInvoices", () => ({
  useInvoices: () => ({
    invoices: rows.current,
    isLoading: false,
    deleteInvoice: { mutate: vi.fn(), mutateAsync: vi.fn() },
  }),
}));
vi.mock("@/modules/accounting/hooks/useInvoicePartyName", () => ({
  useInvoicePartyName: () => "Party",
  invoiceRecipientName: () => "Party",
}));
vi.mock("@/shared/hooks/useEditQueryParam", () => ({ useEditQueryParam: () => {} }));
vi.mock("@/shared/components/MainLayout", () => ({
  MainLayout: ({ actions, children }: { actions?: React.ReactNode; children?: React.ReactNode }) => <div>{actions}{children}</div>,
}));
vi.mock("@/shared/components/FeatureGate", () => ({ FeatureGate: ({ children }: { children?: React.ReactNode }) => <>{children}</> }));
vi.mock("@/shared/components/RequirePermission", () => ({ RequirePermission: ({ children }: { children?: React.ReactNode }) => <>{children}</> }));
vi.mock("@/modules/accounting/components/invoice-form/InvoiceFormModal", () => ({ InvoiceFormModal: () => null }));
vi.mock("@/modules/accounting/components/InvoiceViewModal", () => ({ InvoiceViewModal: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import Invoices from "./Invoices";

function invoice(id: string, extra: Record<string, unknown>) {
  return { id, invoice_number: `N${id}`, status: "issued", notes: "", issued_at: "2026-09-01", service_amount: 10, ...extra };
}

function fileCell(id: string): HTMLElement {
  const tr = screen.getByTestId(`row-invoice-${id}`);
  const cells = within(tr).getAllByRole("cell");
  // The document cell is the one right before the actions cell.
  return cells[cells.length - 2];
}

describe("Invoices list: document action per row", () => {
  beforeEach(() => {
    openStoredFile.mockReset();
    openStoredFile.mockResolvedValue(undefined);
    rows.current = [
      invoice("canon", { file_url: "https://files.example/canonical.pdf" }),
      invoice("legacy", { url_pdf: "https://files.example/legacy.pdf" }),
      invoice("both", { file_url: "https://files.example/both-canonical.pdf", url_pdf: "https://files.example/both-legacy.pdf" }),
      invoice("none", {}),
    ];
    render(<MemoryRouter><Invoices /></MemoryRouter>);
  });

  it.each([
    ["canon", "https://files.example/canonical.pdf"],
    ["legacy", "https://files.example/legacy.pdf"],
    ["both", "https://files.example/both-canonical.pdf"],
  ])("row %s shows an action that opens %s", (id, url) => {
    const buttons = within(fileCell(id)).getAllByRole("button");
    expect(buttons).toHaveLength(1);
    fireEvent.click(buttons[0]);
    expect(openStoredFile).toHaveBeenCalledTimes(1);
    expect(openStoredFile).toHaveBeenCalledWith(url);
  });

  it("negative: a row without any url shows the placeholder and no action", () => {
    const cell = fileCell("none");
    expect(within(cell).queryByRole("button")).toBeNull();
    expect(cell.textContent).toBe("-");
    expect(openStoredFile).not.toHaveBeenCalled();
  });
});
