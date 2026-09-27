/**
 * Agenda spreadsheet contract (XLSX export/import of the Schedule page).
 *
 * The file is read by people, so its headers are PT-BR labels. Import also
 * accepts the snake_case header keys that exports produced before CZ-028,
 * so previously exported spreadsheets keep importing.
 */
export type AgendaColumn =
  | "title" | "type" | "status" | "participants" | "startDate" | "startTime"
  | "endDate" | "endTime" | "venue" | "expectedAttendance" | "feeAmount" | "description" | "notes";

/** PT-BR header written by the export and accepted first by the import. */
export const AGENDA_HEADERS_PT_BR: Readonly<Record<AgendaColumn, string>> = {
  title: "Título",
  type: "Tipo",
  status: "Status",
  participants: "Participantes",
  startDate: "Data de início",
  startTime: "Horário de início",
  endDate: "Data de fim",
  endTime: "Horário de fim",
  venue: "Local",
  expectedAttendance: "Público esperado",
  feeAmount: "Cachê",
  description: "Descrição",
  notes: "Observações",
};

/** Headers of spreadsheets exported before CZ-028 (and hand-written variants), still accepted on import. */
export const LEGACY_AGENDA_HEADERS: Readonly<Record<AgendaColumn, readonly string[]>> = {
  title: ["title", "Title", "TITULO"],
  type: ["type", "tipo_evento"],
  status: ["status"],
  participants: ["participantes"],
  startDate: ["start_date", "data", "Data"],
  startTime: ["horario_inicio", "horario", "Horario"],
  endDate: ["end_date", "Data Fim"],
  endTime: ["horario_fim", "Horário Fim"],
  venue: ["local"],
  expectedAttendance: ["publico_esperado", "Público Esperado", "capacidade", "Capacidade"],
  feeAmount: ["valor_cache", "Valor Cachê"],
  description: ["descricao"],
  notes: ["observacoes"],
};

/** Value of a column in an imported row: the PT-BR header first, then the legacy headers. */
export function readAgendaCell(row: Record<string, unknown>, column: AgendaColumn): unknown {
  for (const header of [AGENDA_HEADERS_PT_BR[column], ...LEGACY_AGENDA_HEADERS[column]]) {
    const value = row[header];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return undefined;
}

/** Builds an export row keyed by the PT-BR headers, in column order. */
export function toAgendaRow(values: Readonly<Record<AgendaColumn, unknown>>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const column of Object.keys(AGENDA_HEADERS_PT_BR) as AgendaColumn[]) {
    out[AGENDA_HEADERS_PT_BR[column]] = values[column] ?? "";
  }
  return out;
}
