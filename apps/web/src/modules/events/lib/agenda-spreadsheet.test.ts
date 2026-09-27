import { describe, it, expect } from "vitest";
import { AGENDA_HEADERS_PT_BR, readAgendaCell, toAgendaRow } from "./agenda-spreadsheet";

describe("agenda spreadsheet contract", () => {
  it("exports PT-BR headers only, never technical keys", () => {
    const row = toAgendaRow({
      title: "Show", type: "Show", status: "Agendado", participants: "Ana", startDate: "2026-10-01",
      startTime: "20:00", endDate: "", endTime: "", venue: "Teatro", expectedAttendance: 300,
      feeAmount: 1500, description: "", notes: "",
    });
    expect(Object.keys(row)).toEqual(Object.values(AGENDA_HEADERS_PT_BR));
    for (const header of Object.keys(row)) expect(header).not.toMatch(/_/);
  });

  it("imports its own export (round trip)", () => {
    const row = { "Título": "Show", "Local": "Teatro", "Público esperado": 300 };
    expect(readAgendaCell(row, "title")).toBe("Show");
    expect(readAgendaCell(row, "venue")).toBe("Teatro");
    expect(readAgendaCell(row, "expectedAttendance")).toBe(300);
  });

  it("still imports a spreadsheet exported before the header change", () => {
    const legacy = { title: "Show", local: "Teatro", publico_esperado: 300, horario_inicio: "20:00" };
    expect(readAgendaCell(legacy, "venue")).toBe("Teatro");
    expect(readAgendaCell(legacy, "expectedAttendance")).toBe(300);
    expect(readAgendaCell(legacy, "startTime")).toBe("20:00");
  });
});
