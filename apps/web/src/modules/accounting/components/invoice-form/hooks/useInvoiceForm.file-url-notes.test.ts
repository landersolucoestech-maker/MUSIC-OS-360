/**
 * Behavior: edit mode reads the document url through invoiceFileUrl (canonical first, legacy
 * fallback) and submit serializes the operation type into the notes sent to the API.
 */
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const addMutate = vi.hoisted(() => vi.fn());
vi.mock("@/modules/accounting/hooks/useInvoices", () => ({
  useInvoices: () => ({
    addInvoice: { isPending: false, mutate: addMutate, mutateAsync: vi.fn() },
    updateInvoice: { isPending: false, mutate: vi.fn(), mutateAsync: vi.fn() },
  }),
}));
vi.mock("@/modules/settings/hooks/useCompanySettings", () => ({
  useCompanySettings: () => ({ companySettings: null }),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { useInvoiceForm } from "./useInvoiceForm";

function editFileUrl(extra: Record<string, unknown>): unknown {
  const invoice = { id: "i1", service_amount: 10, ...extra };
  const onClose = () => {};
  const { result } = renderHook(() => useInvoiceForm({ open: true, mode: "edit", invoice, onClose }));
  return result.current.formData.file_url;
}

describe("useInvoiceForm edit: document url", () => {
  it("reads the canonical file_url", () => {
    expect(editFileUrl({ file_url: "https://files.example/canonical.pdf" })).toBe("https://files.example/canonical.pdf");
  });
  it("falls back to url_pdf of a legacy row", () => {
    expect(editFileUrl({ url_pdf: "https://files.example/legacy.pdf" })).toBe("https://files.example/legacy.pdf");
  });
  it("prefers file_url when both differ", () => {
    expect(editFileUrl({ file_url: "https://files.example/canonical.pdf", url_pdf: "https://files.example/legacy.pdf" })).toBe(
      "https://files.example/canonical.pdf",
    );
  });
  it("negative: no url yields an empty string", () => {
    expect(editFileUrl({})).toBe("");
  });
});

async function submitNotes(operationType: "inflow" | "outflow", notes: string | null): Promise<unknown> {
  addMutate.mockClear();
  const onClose = () => {};
  const { result } = renderHook(() =>
    useInvoiceForm({ open: true, mode: "create", invoice: null, defaultOperationType: operationType, onClose }),
  );
  act(() => {
    result.current.updateField("invoice_number", "1");
    result.current.updateField("tomador_legal_name", "Customer LTDA");
    result.current.updateField("tomador_cnpj", "11.444.777/0001-61");
    result.current.updateItem(0, "description", "Show");
    result.current.updateItem(0, "unit_price", 100);
    result.current.updateField("fiscal_document_type", "nfe");
    if (notes !== null) result.current.updateField("notes", notes);
  });
  await act(async () => {
    await result.current.handleSubmit({ preventDefault: () => {} } as never);
  });
  expect(addMutate).toHaveBeenCalledTimes(1);
  return (addMutate.mock.calls[0][0] as Record<string, unknown>).notes;
}

describe("useInvoiceForm submit: operation type marker in notes", () => {
  beforeEach(() => addMutate.mockClear());

  it("inflow with user notes prefixes the marker line and trims the notes", async () => {
    expect(await submitNotes("inflow", "  paid in cash  ")).toBe("[TIPO_OPERACAO:ENTRADA]\npaid in cash");
  });
  it("inflow without notes sends the bare marker", async () => {
    expect(await submitNotes("inflow", "")).toBe("[TIPO_OPERACAO:ENTRADA]");
  });
  it("outflow with notes sends them unmarked", async () => {
    expect(await submitNotes("outflow", "  plain note ")).toBe("plain note");
  });
  it("outflow without notes sends null", async () => {
    expect(await submitNotes("outflow", "")).toBeNull();
  });
  it("outflow strips a stale inflow marker typed into the notes", async () => {
    expect(await submitNotes("outflow", "[TIPO_OPERACAO:ENTRADA]\nold")).toBe("old");
  });
});
