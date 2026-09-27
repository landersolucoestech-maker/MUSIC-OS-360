export type InvoiceOperationType = "entrada" | "saida";

const INFLOW_MARKER = "[TIPO_OPERACAO:ENTRADA]";

export function parseOperationType(notes: string | null | undefined): {
  type: InvoiceOperationType;
  observacoesLimpas: string;
} {
  const raw = notes ?? "";
  const trimmed = raw.trimStart();
  if (trimmed.startsWith(INFLOW_MARKER)) {
    const rest = trimmed.slice(INFLOW_MARKER.length);
    const limpas = rest.startsWith("\n") ? rest.slice(1) : rest;
    return { type: "entrada", observacoesLimpas: limpas };
  }
  return { type: "saida", observacoesLimpas: raw };
}

export function serializeOperationType(
  type: InvoiceOperationType,
  notes: string | null | undefined,
): string {
  const texto = (notes ?? "").replace(/^\s*\[TIPO_OPERACAO:ENTRADA\]\n?/, "");
  if (type === "entrada") {
    return texto.length > 0 ? `${INFLOW_MARKER}\n${texto}` : INFLOW_MARKER;
  }
  return texto;
}
