import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/accounting/hooks/useInvoices", () => ({
  useInvoices: () => ({
    addInvoice: { isPending: false, mutateAsync: vi.fn() },
    updateInvoice: { isPending: false, mutateAsync: vi.fn() },
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
