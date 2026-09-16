/**
 * Campanhas.estimated-metrics-disclosure.guard.test.ts
 *
 * Guarda permanente (CODEBASE_MAP Gotcha #16): fabricated/budget-derived
 * campaign metrics must never render as unqualified real KPIs. Locks the
 * KPI-strip caption, the per-campaign detail disclosure note, and the
 * per-line "(estimado)" labels to their data source (metrics.isEstimated),
 * not to a hardcoded string that would silently go stale if a real
 * ad-platform integration is ever wired up.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SOURCE = fs.readFileSync(path.resolve(__dirname, "Campanhas.tsx"), "utf8");

describe("Campanhas — fabricated metrics disclosed, never presented as real (CODEBASE_MAP #16)", () => {
  it("the top KPI strip's Cliques caption reflects whether all contributing campaigns are estimated", () => {
    expect(SOURCE).toMatch(/clicksAllEstimated/);
    expect(SOURCE).toMatch(/caption=\{totals\.clicksAllEstimated \? "estimado" : "total"\}/);
  });

  it("the campaign detail view shows an explicit estimated-metrics disclosure note", () => {
    expect(SOURCE).toMatch(/data-testid="campaign-metrics-estimated-note"/);
    expect(SOURCE).toMatch(/campaign\.metrics\.isEstimated !== false/);
  });

  it("per-metric labels are derived from isEstimated, not hardcoded", () => {
    expect(SOURCE).toMatch(/function estimatedLabel\(base: string, campaign: MarketingCampaign\): string/);
    expect(SOURCE).toMatch(/label=\{estimatedLabel\("Cliques", campaign\)\}/);
    expect(SOURCE).toMatch(/label=\{estimatedLabel\("Impressões", campaign\)\}/);
    expect(SOURCE).toMatch(/label=\{estimatedLabel\("Conversões", campaign\)\}/);
    expect(SOURCE).toMatch(/label=\{estimatedLabel\("CTR", campaign\)\}/);
  });
});
