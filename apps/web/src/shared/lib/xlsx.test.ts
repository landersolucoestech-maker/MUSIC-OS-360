import { describe, it, expect, vi, beforeEach } from "vitest";
import { exportToXlsx, type XlsxColumn } from "./xlsx";

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

let lastAoa: unknown[][] | null = null;
vi.mock("xlsx", () => ({
  utils: {
    aoa_to_sheet: (aoa: unknown[][]) => {
      lastAoa = aoa;
      return {};
    },
    book_new: () => ({}),
    book_append_sheet: () => undefined,
  },
  writeFile: () => undefined,
}));

const columns: XlsxColumn[] = [{ key: "nome", label: "Nome" }, { key: "valor", label: "Valor" }];

beforeEach(() => {
  lastAoa = null;
});

function capturedSheet(data: Record<string, unknown>[]): unknown[][] {
  exportToXlsx(data, columns, "teste");
  return lastAoa!;
}

describe("exportToXlsx — spreadsheet formula injection protection (OWASP)", () => {
  it("neutralizes a formula payload (=) with a single-quote prefix", () => {
    const aoa = capturedSheet([{ nome: '=HYPERLINK("http://evil.test")', valor: 1 }]);
    expect(aoa[1][0]).toBe('\'=HYPERLINK("http://evil.test")');
  });

  it("neutraliza payload iniciado por @", () => {
    const aoa = capturedSheet([{ nome: "@SUM(1+1)", valor: 1 }]);
    expect(aoa[1][0]).toBe("'@SUM(1+1)");
  });

  it("does NOT neutralize a legitimate phone number starting with +", () => {
    const aoa = capturedSheet([{ nome: "Cliente", valor: "+5511999990000" }]);
    expect(aoa[1][1]).toBe("+5511999990000");
  });

  it("does NOT neutralize a legitimate negative money value", () => {
    const aoa = capturedSheet([{ nome: "Cliente", valor: "-42.50" }]);
    expect(aoa[1][1]).toBe("-42.50");
  });

  it("neutralizes a formula disguised as subtraction (- followed by a payload, not a plain number)", () => {
    const aoa = capturedSheet([{ nome: "Cliente", valor: "-2+3+cmd|' /c calc'!A1" }]);
    expect(aoa[1][1]).toBe("'-2+3+cmd|' /c calc'!A1");
  });

  it("plain text is not changed", () => {
    const aoa = capturedSheet([{ nome: "Cliente Exemplo Ltda", valor: 100 }]);
    expect(aoa[1][0]).toBe("Cliente Exemplo Ltda");
  });
});
