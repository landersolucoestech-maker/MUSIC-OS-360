import { describe, expect, it } from "vitest";
import {
  INVOICE_OPERATION_TYPES,
  invoiceOperationTypeLabel,
  readInvoiceOperationType,
} from "@/modules/accounting/types/invoice-operation-type";
import { invoiceFileUrl, serializeOperationType } from "@/modules/accounting/types/invoice-type";

describe("invoice operation type helper (marker in notes until the column exists)", () => {
  it("exposes the canonical values and PT-BR labels", () => {
    expect([...INVOICE_OPERATION_TYPES]).toEqual(["inflow", "outflow"]);
    expect(invoiceOperationTypeLabel("inflow")).toBe("Entrada");
    expect(invoiceOperationTypeLabel("outflow")).toBe("Saída");
  });

  it("reads inflow from the marker and strips it from the notes", () => {
    const notes = serializeOperationType("inflow", "obs");
    expect(notes).toContain("[TIPO_OPERACAO:ENTRADA]");
    expect(readInvoiceOperationType({ notes })).toEqual({ type: "inflow", cleanedNotes: "obs" });
  });

  it("defaults to outflow without a marker, null or missing invoice", () => {
    expect(readInvoiceOperationType({ notes: "plain" })).toEqual({ type: "outflow", cleanedNotes: "plain" });
    expect(readInvoiceOperationType({ notes: null }).type).toBe("outflow");
    expect(readInvoiceOperationType(null).type).toBe("outflow");
  });
});

describe("invoiceFileUrl (file_url ?? url_pdf)", () => {
  it("prefers file_url, falls back to url_pdf, else null", () => {
    expect(invoiceFileUrl({ file_url: "a", url_pdf: "b" })).toBe("a");
    expect(invoiceFileUrl({ file_url: null, url_pdf: "b" })).toBe("b");
    expect(invoiceFileUrl({})).toBeNull();
    expect(invoiceFileUrl(null)).toBeNull();
  });
});
