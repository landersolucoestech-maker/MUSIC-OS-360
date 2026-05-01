export type TipoOperacaoNF = "entrada" | "saida";

const ENTRADA_MARKER = "[TIPO_OPERACAO:ENTRADA]";

export function parseTipoOperacao(observacoes: string | null | undefined): {
  tipo: TipoOperacaoNF;
  observacoesLimpas: string;
} {
  const raw = observacoes ?? "";
  const trimmed = raw.trimStart();
  if (trimmed.startsWith(ENTRADA_MARKER)) {
    const rest = trimmed.slice(ENTRADA_MARKER.length);
    const limpas = rest.startsWith("\n") ? rest.slice(1) : rest;
    return { tipo: "entrada", observacoesLimpas: limpas };
  }
  return { tipo: "saida", observacoesLimpas: raw };
}

export function serializeTipoOperacao(
  tipo: TipoOperacaoNF,
  observacoes: string | null | undefined,
): string {
  const texto = (observacoes ?? "").replace(/^\s*\[TIPO_OPERACAO:ENTRADA\]\n?/, "");
  if (tipo === "entrada") {
    return texto.length > 0 ? `${ENTRADA_MARKER}\n${texto}` : ENTRADA_MARKER;
  }
  return texto;
}
