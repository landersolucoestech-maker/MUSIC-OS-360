/**
 * LeadViewModal.interacoes-equipe.guard.test.ts
 *
 * Permanent guard (REM-04 / GAP-10): `historicoInteracoes` was always []
 * — the real team interaction log (`/lead-interactions`) was never
 * fetched. This test fails if the real integration is removed.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SOURCE = fs.readFileSync(path.resolve(__dirname, "LeadViewModal.tsx"), "utf8");

describe("LeadViewModal — real record of team interactions (REM-04)", () => {
  it("uses useLeadInteractions to fetch real data (not a hardcoded empty array)", () => {
    expect(SOURCE).toMatch(/useLeadInteractions\(lead\?\.id\)/);
  });

  it("renders the real list, not a static placeholder", () => {
    expect(SOURCE).toMatch(/teamInteractions\.map/);
  });
});
