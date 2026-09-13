/**
 * agenda-calendar-date-field.guard.test.ts
 *
 * Guarda permanente (Task S): o calendário da Agenda montava cada evento
 * lendo `evento.start_date`/`evento.horario_inicio`/`evento.horario_fim` —
 * campos que nunca existiram no backend (a coluna real é `data`/`end_date`,
 * timestamp completo). Como `start_date` era sempre `undefined`, TODO
 * evento caía no fallback "agora" e aparecia sempre na data errada, para
 * qualquer tenant. Este teste falha se a leitura do cálculo do calendário
 * (schedulerEvents) voltar a usar esses campos inexistentes.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const FILE_PATH = path.resolve(__dirname, "Agenda.tsx");
const SOURCE = fs.readFileSync(FILE_PATH, "utf8");

function schedulerEventsBody(): string {
  const start = SOURCE.indexOf("const schedulerEvents = useMemo(");
  expect(start).toBeGreaterThan(-1);
  const end = SOURCE.indexOf("const isoFromDate", start);
  expect(end).toBeGreaterThan(start);
  return SOURCE.slice(start, end);
}

describe("Agenda — cálculo do calendário usa os campos reais de data", () => {
  it("não lê event.start_date/horario_inicio/horario_fim (nunca existiram no backend)", () => {
    const body = schedulerEventsBody();
    expect(body).not.toMatch(/event\.start_date/);
    expect(body).not.toMatch(/event\.horario_inicio/);
    expect(body).not.toMatch(/event\.horario_fim/);
    expect(body).not.toMatch(/event\.tipo_evento/);
  });

  it("lê event.data/event.end_date (colunas reais, timestamp completo)", () => {
    const body = schedulerEventsBody();
    expect(body).toMatch(/event\.data\s*\?/);
    expect(body).toMatch(/event\.end_date/);
  });
});
