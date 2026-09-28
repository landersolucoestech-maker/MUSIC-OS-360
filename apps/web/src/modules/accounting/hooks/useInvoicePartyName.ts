import { useEntityById } from "@/shared/hooks/useEntityLookup";

export const CLIENT_NOT_FOUND_LABEL = "Cliente não encontrado";
export const CLIENT_LOADING_LABEL = "Carregando…";

interface InvoicePartyFields {
  tomador_legal_name?: unknown;
  tomador_name?: unknown;
  client_id?: unknown;
}

function nonEmpty(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Recipient name stored on the invoice itself (the invoices API embeds no client). */
export function invoiceRecipientName(invoice: InvoicePartyFields | null | undefined): string | null {
  if (!invoice) return null;
  return nonEmpty(invoice.tomador_legal_name) ?? nonEmpty(invoice.tomador_name);
}

/**
 * Party label of an invoice: the stored recipient name; otherwise the linked
 * client's `name` resolved by `client_id` (GET /clients/:id, cached); a linked
 * id that does not resolve shows "Cliente não encontrado" — never the raw id.
 * `null` only when the invoice has neither a recipient name nor a client.
 */
export function useInvoicePartyName(invoice: InvoicePartyFields | null | undefined): string | null {
  const stored = invoiceRecipientName(invoice);
  const clientId = !stored ? nonEmpty(invoice?.client_id) : null;
  const { entity, isLoading } = useEntityById<{ name?: string | null }>("clients", clientId);
  if (stored) return stored;
  if (!clientId) return null;
  if (isLoading) return CLIENT_LOADING_LABEL;
  return nonEmpty(entity?.name) ?? CLIENT_NOT_FOUND_LABEL;
}
