import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/modules/accounting/hooks/useInvoicePartyName", () => ({
  useInvoicePartyName: () => "Parte",
}));

import { InvoiceViewModal } from "./InvoiceViewModal";

function paymentFieldText(paymentMethod: string | null): string {
  const { unmount } = render(
    <InvoiceViewModal open onOpenChange={() => {}} invoice={{ id: "i1", payment_method: paymentMethod, status: "issued", notes: "" }} />,
  );
  const label = screen.getByText("Forma Pagamento");
  const text = label.nextElementSibling?.textContent ?? "";
  unmount();
  return text;
}

describe("InvoiceViewModal payment method label", () => {
  it.each([
    ["cartao_credito", "Cartão de Crédito"],
    ["cartao_debito", "Cartão de Débito"],
    ["dinheiro", "Dinheiro"],
    ["cheque", "Cheque"],
    ["transferencia", "Transferência"],
    ["credit_card", "Cartão de Crédito"],
    ["bank_transfer", "Transferência"],
    ["pix", "PIX"],
  ])("renders %s as %s", (stored, label) => {
    expect(paymentFieldText(stored)).toBe(label);
  });

  it("never prints the raw legacy or canonical wire value", () => {
    for (const raw of ["cartao_credito", "credit_card", "transferencia", "bank_transfer"]) {
      expect(paymentFieldText(raw)).not.toContain("_");
      expect(paymentFieldText(raw)).not.toBe(raw);
    }
  });

  it("shows an unknown value as-is and an absent one as the empty placeholder", () => {
    expect(paymentFieldText("crypto_xyz")).toBe("crypto_xyz");
    expect(paymentFieldText(null)).toBe("—");
  });
});
