import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Regression: `periodLabel` in Schedule.tsx called `date-fns#format` without
 * `{ locale: ptBR }`, so the month name came out in English by date-fns default
 * ("24 — 30 de August, 2026" / "August de 2026") even with the rest
 * of the screen in Portuguese. This test proves the mechanism (format with/without locale
 * produces different month names) and ensures Schedule.tsx always passes
 * `{ locale: ptBR }` in the four calls that build the period label.
 */
describe("date-fns format — locale pt-BR", () => {
  const someAugustDate = new Date(2026, 7, 24); // 2026-08-24

  it("without a locale, the month name renders in English (reproduces the bug)", () => {
    expect(format(someAugustDate, "MMMM")).toBe("August");
  });

  it("with { locale: ptBR }, the month name renders in Portuguese", () => {
    expect(format(someAugustDate, "MMMM", { locale: ptBR })).toBe("agosto");
  });

  it("reproduces the exact label reported in the bug and proves the fix", () => {
    const buggy = `${format(someAugustDate, "d")} — ${format(someAugustDate, "d 'de' MMMM, yyyy")}`;
    expect(buggy).toContain("August");

    const fixed = `${format(someAugustDate, "d", { locale: ptBR })} — ${format(someAugustDate, "d 'de' MMMM, yyyy", { locale: ptBR })}`;
    expect(fixed).toContain("agosto");
    expect(fixed).not.toContain("August");
  });
});

describe("Schedule.tsx — guard against a locale regression", () => {
  const SOURCE = fs.readFileSync(path.resolve(__dirname, "Schedule.tsx"), "utf8");

  it('imports ptBR from "date-fns/locale"', () => {
    expect(SOURCE).toMatch(/import\s*\{\s*ptBR\s*\}\s*from\s*"date-fns\/locale"/);
  });

  it("every format(...) call inside periodLabel passes { locale: ptBR }", () => {
    const periodLabelBlock = SOURCE.match(/const periodLabel = useMemo\(\(\) => \{[\s\S]*?\}, \[currentDate, viewMode\]\);/);
    expect(periodLabelBlock).not.toBeNull();
    const block = periodLabelBlock![0];
    const formatCalls = block.match(/format\([^)]*\)/g) ?? [];
    expect(formatCalls.length).toBeGreaterThan(0);
    for (const call of formatCalls) {
      expect(call).toContain("{ locale: ptBR }");
    }
  });
});
