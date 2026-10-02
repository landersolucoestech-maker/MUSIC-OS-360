import { describe, expect, it } from "vitest";
import { AGENDA_HEADERS_PT_BR, readAgendaCell, toAgendaRow, type AgendaColumn } from "./agenda-spreadsheet";

// [legacy header exported before CZ-028, column it must still import into]
const LEGACY_HEADERS: ReadonlyArray<readonly [string, AgendaColumn]> = [
  ["tipo_evento", "type"],
  ["participantes", "participants"],
  ["horario_fim", "endTime"],
  ["capacidade", "expectedAttendance"],
  ["valor_cache", "feeAmount"],
  ["descricao", "description"],
  ["observacoes", "notes"],
];

describe("agenda spreadsheet legacy headers (import accepts, export never writes)", () => {
  it.each(LEGACY_HEADERS)("import reads legacy header %s into %s", (header, column) => {
    expect(readAgendaCell({ [header]: "valor-legado" }, column)).toBe("valor-legado");
    // the PT-BR header wins when both are present
    expect(readAgendaCell({ [header]: "valor-legado", [AGENDA_HEADERS_PT_BR[column]]: "atual" }, column)).toBe("atual");
  });

  it("export writes only the PT-BR headers, never a legacy header", () => {
    const values = Object.fromEntries((Object.keys(AGENDA_HEADERS_PT_BR) as AgendaColumn[]).map((c) => [c, c])) as Record<AgendaColumn, unknown>;
    const keys = Object.keys(toAgendaRow(values));
    for (const [header] of LEGACY_HEADERS) expect(keys).not.toContain(header);
    expect(keys).toEqual(Object.values(AGENDA_HEADERS_PT_BR));
  });
});
