import { parseOperationType } from "@/modules/accounting/types/invoice-type";

/**
 * Canonical operation type of an invoice (inflow = incoming invoice, outflow = outgoing invoice).
 * Until the `operation_type` column exists (later migration), the value is carried by the
 * machine marker `[TIPO_OPERACAO:ENTRADA]` (a persisted legacy marker) in the notes (see invoice-type.ts). Every reader
 * goes through readInvoiceOperationType so the storage can change in one place.
 */
export const INVOICE_OPERATION_TYPES = ["inflow", "outflow"] as const;
export type InvoiceOperationType = (typeof INVOICE_OPERATION_TYPES)[number];

export const INVOICE_OPERATION_TYPE_LABELS_PT_BR: Record<InvoiceOperationType, string> = {
  inflow: "Entrada",
  outflow: "Saída",
};

export function invoiceOperationTypeLabel(type: InvoiceOperationType): string {
  return INVOICE_OPERATION_TYPE_LABELS_PT_BR[type];
}

export function readInvoiceOperationType(
  invoice: { notes?: string | null } | null | undefined,
): { type: InvoiceOperationType; cleanedNotes: string } {
  return parseOperationType(invoice?.notes);
}
