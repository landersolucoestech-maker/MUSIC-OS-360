/**
 * Guard: normalizeFormStatus (lib/project-status.ts, used by ProjectFormModal) no longer special-cases Portuguese status words
 * (projects.status carries chk_projects_status, English-only, since 20260910000022).
 * A leftover Portuguese word falls to the neutral default ("planning").
 */
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SOURCE = fs.readFileSync(path.resolve(__dirname, "../lib/project-status.ts"), "utf8");
const FN = SOURCE.slice(SOURCE.indexOf("export function normalizeFormStatus"), SOURCE.indexOf("/** The product status"));
const FORM = fs.readFileSync(path.resolve(__dirname, "ProjectFormModal.tsx"), "utf8");

describe("normalizeFormStatus", () => {
  it.each(["andamento", "em_andamento", "concluido", "cancelado"])("does not special-case %s", (word) => {
    expect(FN).not.toContain(`"${word}"`);
  });

  it("keeps the canonical English statuses and the planning default", () => {
    expect(FN.length).toBeGreaterThan(100);
    for (const v of ["in_progress", "completed", "cancelled"]) expect(FN).toContain(`"${v}"`);
    expect(FN).toContain('return "planning"');
  });

  it("keeps the internal review state instead of demoting it to planning on save", () => {
    expect(FN).toContain("INTERNAL_REVIEW_STATUS");
  });

  it("the form takes its initial status from the shared function", () => {
    expect(FORM).toContain("normalizeFormStatus(project?.status)");
    expect(FORM).not.toContain("function normStatus");
  });
});
