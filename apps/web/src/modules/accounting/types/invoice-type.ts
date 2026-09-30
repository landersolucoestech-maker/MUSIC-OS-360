export type InvoiceOperationType = "inflow" | "outflow";

const INFLOW_MARKER = "[TIPO_OPERACAO:ENTRADA]";

export function parseOperationType(notes: string | null | undefined): {
  type: InvoiceOperationType;
  cleanedNotes: string;
} {
  const raw = notes ?? "";
  const trimmed = raw.trimStart();
  if (trimmed.startsWith(INFLOW_MARKER)) {
    const rest = trimmed.slice(INFLOW_MARKER.length);
    const cleaned = rest.startsWith("\n") ? rest.slice(1) : rest;
    return { type: "inflow", cleanedNotes: cleaned };
  }
  return { type: "outflow", cleanedNotes: raw };
}

export function serializeOperationType(
  type: InvoiceOperationType,
  notes: string | null | undefined,
): string {
  const text = (notes ?? "").replace(/^\s*\[TIPO_OPERACAO:ENTRADA\]\n?/, "");
  if (type === "inflow") {
    return text.length > 0 ? `${INFLOW_MARKER}\n${text}` : INFLOW_MARKER;
  }
  return text;
}
