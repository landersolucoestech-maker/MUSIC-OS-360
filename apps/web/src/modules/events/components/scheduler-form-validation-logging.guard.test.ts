import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Regression: expected client-side validation (empty required field) was
 * logged via `console.error`, polluting error monitoring (Sentry
 * captures console.error) with events that are not runtime failures —
 * validation already has enough visual feedback (toast + inline FieldError).
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
