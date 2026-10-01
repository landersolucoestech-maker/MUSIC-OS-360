/**
 * Stored-XSS guard (SEC1 / find-77526160): release/work/project/marketing/monitoring
 * links and media come from API data whose URL fields were not validated. Every
 * `href`/`src` in these components must come from safeHref (external text links),
 * safeImageSrc/safeMediaSrc (media) or StoredFileLink (stored files: signed
 * download for uploads, safeLinkHref otherwise). A raw `href={value}` fails here.
 */
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.resolve(__dirname, "..");
const FILES = [
  "modules/releases/components/ReleaseViewModal.tsx",
  "modules/releases/components/ReleaseFormModal.tsx",
  "modules/releases/pages/Releases.tsx",
  "modules/catalog/components/WorkViewModal.tsx",
  "modules/catalog/components/PhonogramFormModal.tsx",
  "modules/marketing/pages/Tasks.tsx",
  "modules/marketing/components/MarketingAssetCard.tsx",
  "modules/marketing/components/campaign-builder/steps.tsx",
  "modules/monitoring/rights/components/DetectionDetailModal.tsx",
  "modules/monitoring/components/TakedownViewModal.tsx",
  "modules/projects/components/ProjectViewModal.tsx",
  "modules/projects/components/ProjectFormModal.tsx",
  "modules/projects/pages/Projects.tsx",
  "modules/settings/pages/BillingBlockedPage.tsx",
];
const SAFE_EXPR = /^(safeHref|safeImageSrc|safeMediaSrc|safeLinkHref|safeExternalUrl)\(|^URL\.createObjectURL\(/;

describe("API-fed href/src in the SEC1 components go through the safe-url helpers", () => {
  for (const file of FILES) {
    it(file, () => {
      const source = fs.readFileSync(path.join(SRC, file), "utf8");
      const offenders: string[] = [];
      for (const match of source.matchAll(/\b(href|src)=\{([^}]*(?:\{[^}]*\}[^}]*)*)\}/g)) {
        const expr = match[2].trim();
        if (/^["'`]\//.test(expr) && !expr.includes("${")) continue; // literal in-app path
        if (!SAFE_EXPR.test(expr)) offenders.push(`${match[1]}={${expr}}`);
      }
      expect(offenders).toEqual([]);
      expect(/\.href\s*=|window\.open\(/.test(source) ? "dynamic navigation present" : "none").toBe("none");
    });
  }

  it("no raw <a href> is left bound to API data where StoredFileLink/safeHref apply", () => {
    for (const file of FILES) {
      const source = fs.readFileSync(path.join(SRC, file), "utf8");
      expect(source).not.toMatch(/href=\{(?!safe)[^}]*(url|Url|link)\b/);
    }
  });
});
