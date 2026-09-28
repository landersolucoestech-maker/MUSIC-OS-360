/**
 * Stored-XSS guard (security F1): artist/CRM URLs come from API data that is
 * not URL-validated end to end (artist metadata allow-list, gallery_urls,
 * imports). Every `href` bound in these modules must come from
 * safeExternalUrl (absolute http/https only) or go through StoredFileLink
 * (safeLinkHref + signed download). A raw `href={url}` fails this test.
 */
import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SRC = path.resolve(__dirname, "..");
const MODULES = ["modules/artist", "modules/crm-relationships"];

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".tsx") && !/\.test\.tsx$/.test(entry.name)) out.push(full);
  }
  return out;
}

describe("artist/CRM links built from API data use safeExternalUrl", () => {
  it("binds href only to a value produced by safeExternalUrl", () => {
    const violations: string[] = [];
    for (const mod of MODULES) {
      for (const file of walk(path.join(SRC, mod))) {
        const source = fs.readFileSync(file, "utf8");
        for (const match of source.matchAll(/href=\{([^}]+)\}/g)) {
          const expr = match[1].trim();
          const declared = new RegExp(`const\\s+${expr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*=\\s*safeExternalUrl\\(`).test(source);
          if (!declared && !expr.startsWith("safeExternalUrl(")) violations.push(`${path.relative(SRC, file)}: href={${expr}}`);
        }
        if (/window\.open\(/.test(source) && !/window\.open\(\s*safeExternalUrl\(/.test(source)) {
          violations.push(`${path.relative(SRC, file)}: window.open without safeExternalUrl`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
