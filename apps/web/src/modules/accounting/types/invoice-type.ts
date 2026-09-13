export type InvoiceOperationType = "entrada" | "saida";

const ENTRADA_MARKER = "[TIPO_OPERACAO:ENTRADA]";

export function parseOperationType(observacoes: string | null | undefined): {
  type: InvoiceOperationType;
  observacoesLimpas: string;
} {
  const raw = observacoes ?? "";
  const trimmed = raw.trimStart();
  if (trimmed.startsWith(ENTRADA_MARKER)) {
    const rest = trimmed.slice(ENTRADA_MARKER.length);
    const limpas = rest.startsWith("\n") ? rest.slice(1) : rest;
    return { type: "entrada", observacoesLimpas: limpas };
  }
  return { type: "saida", observacoesLimpas: raw };
}

export function serializeOperationType(
  type: InvoiceOperationType,
  observacoes: string | null | undefined,
): string {
  const texto = (observacoes ?? "").replace(/^\s*\[TIPO_OPERACAO:ENTRADA\]\n?/, "");
  if (type === "entrada") {
    return texto.length > 0 ? `${ENTRADA_MARKER}\n${texto}` : ENTRADA_MARKER;
  }
  return texto;
}
