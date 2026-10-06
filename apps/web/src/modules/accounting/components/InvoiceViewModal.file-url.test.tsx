/**
 * Behavior: the invoice view modal shows the document card and opens the document taken from
 * invoiceFileUrl (file_url canonical, url_pdf legacy fallback).
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const openStoredFile = vi.hoisted(() => vi.fn());
vi.mock("@/shared/lib/stored-file", () => ({ openStoredFile }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/modules/accounting/hooks/useInvoicePartyName", () => ({
  useInvoicePartyName: () => "Party",
}));

import { InvoiceViewModal } from "./InvoiceViewModal";

function renderModal(invoice: Record<string, unknown>) {
  return render(
    <InvoiceViewModal open onOpenChange={() => {}} invoice={{ id: "i1", status: "issued", notes: "", ...invoice } as never} />,
  );
}

describe("InvoiceViewModal document action", () => {
  beforeEach(() => {
    openStoredFile.mockReset();
    openStoredFile.mockResolvedValue(undefined);
  });

  it("opens the canonical file_url", () => {
    renderModal({ file_url: "https://files.example/canonical.pdf" });
    expect(screen.getByText("PDF da Nota Fiscal")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Abrir/ }));
    expect(openStoredFile).toHaveBeenCalledTimes(1);
    expect(openStoredFile).toHaveBeenCalledWith("https://files.example/canonical.pdf");
  });

  it("legacy row with only url_pdf still shows the card and opens that url", () => {
    renderModal({ url_pdf: "https://files.example/legacy.pdf" });
    expect(screen.getByText("PDF da Nota Fiscal")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Abrir/ }));
    expect(openStoredFile).toHaveBeenCalledWith("https://files.example/legacy.pdf");
  });

  it("canonical file_url wins over a different url_pdf", () => {
    renderModal({ file_url: "https://files.example/canonical.pdf", url_pdf: "https://files.example/legacy.pdf" });
    fireEvent.click(screen.getByRole("button", { name: /Abrir/ }));
    expect(openStoredFile).toHaveBeenCalledTimes(1);
    expect(openStoredFile).toHaveBeenCalledWith("https://files.example/canonical.pdf");
  });

  it("negative: no document url renders no document card and no open action", () => {
    renderModal({});
    expect(screen.queryByText("PDF da Nota Fiscal")).toBeNull();
    expect(screen.queryByRole("button", { name: /Abrir/ })).toBeNull();
    expect(openStoredFile).not.toHaveBeenCalled();
  });

  it("negative: empty-string urls count as no document", () => {
    renderModal({ file_url: "", url_pdf: "" });
    expect(screen.queryByText("PDF da Nota Fiscal")).toBeNull();
  });
});

describe("InvoiceViewModal fiscal document type badge (fiscal_document_type canonical, tipo_nota legacy)", () => {
  it("shows the label of the canonical fiscal_document_type", () => {
    renderModal({ fiscal_document_type: "nfe" });
    expect(screen.getByText("NF-e (Produto)")).toBeTruthy();
  });

  it("legacy row with only tipo_nota still shows its label", () => {
    renderModal({ tipo_nota: "nfce" });
    expect(screen.getByText("NFC-e (Consumidor)")).toBeTruthy();
  });

  it("canonical fiscal_document_type wins over a different tipo_nota", () => {
    renderModal({ fiscal_document_type: "nfe", tipo_nota: "nfse" });
    expect(screen.getByText("NF-e (Produto)")).toBeTruthy();
    expect(screen.queryByText("NFS-e (Serviço)")).toBeNull();
  });

  it("negative: no type falls back to the NFS-e default label", () => {
    renderModal({});
    expect(screen.getByText("NFS-e")).toBeTruthy();
  });

  it("negative: an unknown type is shown as stored, not mapped to a known label", () => {
    renderModal({ fiscal_document_type: "other_kind" });
    expect(screen.getByText("other_kind")).toBeTruthy();
  });
});
