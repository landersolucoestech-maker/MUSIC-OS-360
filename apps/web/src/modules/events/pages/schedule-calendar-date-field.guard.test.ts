/**
 * schedule-calendar-date-field.guard.test.ts
 *
 * Permanent guard (Task S): the Agenda calendar built each event
 * reading `evento.start_date`/`evento.horario_inicio`/`evento.horario_fim` —
 * fields that never existed in the backend (the real column is `data`/`end_date`,
 * a full timestamp). Since `start_date` was always `undefined`, EVERY
 * event fell into the "now" fallback and always showed on the wrong date, for
 * any tenant. This test fails if the calendar computation read
 * (schedulerEvents) goes back to using those nonexistent fields.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const FILE_PATH = path.resolve(__dirname, "Schedule.tsx");
const SOURCE = fs.readFileSync(FILE_PATH, "utf8");

function schedulerEventsBody(): string {
  const start = SOURCE.indexOf("const schedulerEvents = useMemo(");
  expect(start).toBeGreaterThan(-1);
  const end = SOURCE.indexOf("const isoFromDate", start);
  expect(end).toBeGreaterThan(start);
  return SOURCE.slice(start, end);
}

describe("Agenda — the calendar calculation uses the real date fields", () => {
  it("does not read event.start_date/horario_inicio/horario_fim (they never existed in the backend)", () => {
    const body = schedulerEventsBody();
    expect(body).not.toMatch(/event\.start_date/);
    expect(body).not.toMatch(/event\.horario_inicio/);
    expect(body).not.toMatch(/event\.horario_fim/);
    expect(body).not.toMatch(/event\.tipo_evento/);
  });

  it("reads event.data/event.end_date (real columns, full timestamp)", () => {
    const body = schedulerEventsBody();
    expect(body).toMatch(/event\.data\s*\?/);
    expect(body).toMatch(/event\.end_date/);
  });
});
