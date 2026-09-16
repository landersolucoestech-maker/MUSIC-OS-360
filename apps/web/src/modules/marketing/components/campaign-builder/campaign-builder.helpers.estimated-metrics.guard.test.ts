/**
 * campaign-builder.helpers.estimated-metrics.guard.test.ts
 *
 * Guarda permanente (CODEBASE_MAP Gotcha #16 -- "Marketing campaign builder
 * fabricates fake performance metrics ... and displays them as real,
 * unqualified KPIs once saved"): estimateCampaignResults() is a pure
 * budget*constant calculation, never a real ad-platform measurement --
 * publish() never actually calls one. toMarketingCampaignInput() must always
 * mark its metrics isEstimated: true so every consumer (Campanhas.tsx,
 * marketing.service.ts's campaignFromApi) can disclose this instead of
 * presenting the numbers as measured performance.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SOURCE = fs.readFileSync(path.resolve(__dirname, "campaign-builder.helpers.ts"), "utf8");

describe("campaign-builder.helpers — metrics always marked estimated (CODEBASE_MAP #16)", () => {
  it("toMarketingCampaignInput's metrics object sets isEstimated: true", () => {
    const fnStart = SOURCE.indexOf("export function toMarketingCampaignInput");
    const fnBody = SOURCE.slice(fnStart, SOURCE.indexOf("\n}", fnStart));
    expect(fnBody).toMatch(/metrics:\s*\{[\s\S]*?isEstimated:\s*true,?[\s\S]*?\}/);
  });

  it("estimateCampaignResults stays a pure budget-derived calculation (no real API call)", () => {
    const fnBlock = SOURCE.slice(
      SOURCE.indexOf("export function estimateCampaignResults"),
      SOURCE.indexOf("export function toMarketingCampaignInput"),
    );
    expect(fnBlock).not.toMatch(/await |fetch\(|api\./);
  });
});
