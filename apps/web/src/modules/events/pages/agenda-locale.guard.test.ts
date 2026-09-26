import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

/**
 * Regressão: `periodLabel` em Agenda.tsx chamava `date-fns#format` sem
 * `{ locale: ptBR }`, então o nome do mês saía em inglês por padrão do
 * date-fns ("24 — 30 de August, 2026" / "August de 2026") mesmo com o resto
 * da tela em português. Este teste prova o mecanismo (format com/sem locale
 * produz nomes de mês diferentes) e garante que Agenda.tsx sempre passa
 * `{ locale: ptBR }` nas quatro chamadas que constroem o rótulo de período.
 */
describe("date-fns format — locale pt-BR", () => {
  const someAugustDate = new Date(2026, 7, 24); // 24 de agosto de 2026

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

describe("Agenda.tsx — guard against a locale regression", () => {
  const SOURCE = fs.readFileSync(path.resolve(__dirname, "Agenda.tsx"), "utf8");

  it('importa ptBR de "date-fns/locale"', () => {
    expect(SOURCE).toMatch(/import\s*\{\s*ptBR\s*\}\s*from\s*"date-fns\/locale"/);
  });

  it("toda chamada format(...) dentro de periodLabel passa { locale: ptBR }", () => {
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
