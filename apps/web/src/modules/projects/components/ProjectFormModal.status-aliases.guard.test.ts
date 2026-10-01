/**
 * Guard: ProjectFormModal.normStatus no longer special-cases Portuguese status words
 * (projects.status carries chk_projects_status, English-only, since 20260910000022).
 * A leftover Portuguese word falls to the neutral default ("planning").
 */
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SOURCE = fs.readFileSync(path.resolve(__dirname, "ProjectFormModal.tsx"), "utf8");
const FN = SOURCE.slice(SOURCE.indexOf("function normStatus"), SOURCE.indexOf("function normEnum"));

describe("ProjectFormModal normStatus", () => {
  it.each(["andamento", "em_andamento", "concluido", "cancelado"])("does not special-case %s", (word) => {
    expect(FN).not.toContain(`"${word}"`);
  });

  it("keeps the canonical English statuses and the planning default", () => {
    for (const v of ["in_progress", "completed", "cancelled"]) expect(FN).toContain(`"${v}"`);
    expect(FN).toContain('return "planning"');
  });
});
