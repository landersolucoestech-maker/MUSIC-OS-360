/**
 * Guard: ProjectViewModal.getStatusBadge no longer probes Portuguese status substrings
 * ("pendente", "conclu"): projects.status carries chk_projects_status, English-only,
 * since 20260910000022 (planning | in_progress | review | completed | cancelled).
 */
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SOURCE = fs.readFileSync(path.resolve(__dirname, "ProjectViewModal.tsx"), "utf8");
const FN = SOURCE.slice(SOURCE.indexOf("const getStatusBadge"), SOURCE.indexOf("return (\n      <Dialog"));

describe("ProjectViewModal getStatusBadge", () => {
  it.each(["pendente", "conclu"])("does not probe the Portuguese substring %s", (word) => {
    expect(FN.length).toBeGreaterThan(100);
    expect(FN).not.toContain(word);
  });

  it("keeps the canonical English statuses", () => {
    for (const v of ["planning", "completed", "in_progress", "cancelled"]) expect(FN).toContain(`"${v}"`);
  });

  it("presents the internal review state through a known badge instead of printing the raw value", () => {
    expect(FN).toContain('"review"');
  });
});
