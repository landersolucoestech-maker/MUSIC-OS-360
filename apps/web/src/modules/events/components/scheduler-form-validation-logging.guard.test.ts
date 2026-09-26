import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regressão: validação client-side esperada (campo obrigatório vazio) era
 * logada via `console.error`, poluindo o monitoramento de erros (Sentry
 * captura console.error) com eventos que não são falhas de runtime — a
 * validação já tem feedback visual suficiente (toast + FieldError inline).
 */
const SOURCE = fs.readFileSync(path.resolve(__dirname, "SchedulerFormModal.tsx"), "utf8");

describe("SchedulerFormModal — validation logging does not use console.error", () => {
  it("does not call console.error for expected validation errors", () => {
    expect(SOURCE).not.toMatch(/console\.error\(["']SchedulerFormModal validation errors/);
  });

  it("uses console.warn (or a non-error equivalent) for the debug detail", () => {
    expect(SOURCE).toMatch(/console\.warn\(["']SchedulerFormModal validation errors/);
  });

  it("still notifies the user via toast when validation fails", () => {
    expect(SOURCE).toMatch(/toast\.error\(/);
  });
});
