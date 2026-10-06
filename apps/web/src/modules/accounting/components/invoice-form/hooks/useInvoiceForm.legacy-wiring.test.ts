import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

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

function editFormPaymentMethod(paymentMethod: unknown): unknown {
  // Stable reference: the hook's effect depends on the invoice identity.
  const invoice = { id: "i1", payment_method: paymentMethod, service_amount: 10 };
  const onClose = () => {};
  const { result } = renderHook(() => useInvoiceForm({ open: true, mode: "edit", invoice, onClose }));
  return result.current.formData.payment_method;
}

describe("useInvoiceForm edit: legacy payment_method is read as its canonical value", () => {
  it.each([
    ["cartao_credito", "credit_card"],
    ["cartao_debito", "debit_card"],
    ["dinheiro", "cash"],
    ["cheque", "check"],
    ["transferencia", "bank_transfer"],
  ])("maps legacy %s to %s", (legacy, canonical) => {
    expect(editFormPaymentMethod(legacy)).toBe(canonical);
  });

  it("keeps canonical values unchanged", () => {
    expect(editFormPaymentMethod("credit_card")).toBe("credit_card");
    expect(editFormPaymentMethod("bank_transfer")).toBe("bank_transfer");
  });

  it("normalizes case and surrounding whitespace of a stored value", () => {
    expect(editFormPaymentMethod("  PIX ")).toBe("pix");
    expect(editFormPaymentMethod(" Cartao_Credito")).toBe("credit_card");
  });

  it("leaves an absent payment method untouched", () => {
    expect(editFormPaymentMethod(null)).toBeNull();
    expect(editFormPaymentMethod(undefined)).toBeUndefined();
  });
});

describe("useInvoiceForm: fiscal document kind uses the canonical fiscal_document_type", () => {
  const editKind = (invoice: Record<string, unknown>) => {
    const onClose = () => {};
    const { result } = renderHook(() => useInvoiceForm({ open: true, mode: "edit", invoice: invoice as never, onClose }));
    return result.current.formData.fiscal_document_type;
  };

  it("reads fiscal_document_type first and tipo_nota only for a response of an old API", () => {
    expect(editKind({ id: "i1", fiscal_document_type: "nfe", tipo_nota: "nfse" })).toBe("nfe");
    expect(editKind({ id: "i2", tipo_nota: "nfce" })).toBe("nfce");
  });

  it("create submit sends fiscal_document_type and never tipo_nota", async () => {
    addMutate.mockClear();
    const onClose = () => {};
    const { result } = renderHook(() => useInvoiceForm({ open: true, mode: "create", invoice: null, onClose }));
    act(() => {
      result.current.updateField("invoice_number", "1");
      result.current.updateField("tomador_legal_name", "Cliente LTDA");
      result.current.updateField("tomador_cnpj", "11.444.777/0001-61");
      result.current.updateItem(0, "description", "Show");
      result.current.updateItem(0, "unit_price", 100);
      result.current.updateField("fiscal_document_type", "nfe");
    });
    await act(async () => {
      await result.current.handleSubmit({ preventDefault: () => {} } as never);
    });
    expect(addMutate).toHaveBeenCalledTimes(1);
    const payload = addMutate.mock.calls[0][0] as Record<string, unknown>;
    expect(payload.fiscal_document_type).toBe("nfe");
    expect(payload).not.toHaveProperty("tipo_nota");
  });
});
