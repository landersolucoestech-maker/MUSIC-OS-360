import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * REGRESSION — Artist 360 View Modal scrolling.
 *
 * Real bug measured in Chromium: Radix's outer `<ScrollArea className="flex-1 min-h-0">`
 * did not scroll. The Radix Viewport uses `height: 100%`, which does NOT resolve
 * against a flex-grow-sized parent — the viewport measured 1467px inside a
 * 681.5px Root, so `scrollHeight === clientHeight` and `scrollTop` never left 0.
 * All content below the fold was unreachable.
 *
 * Fix: the scroll owner became a NATIVE overflow container, sized by the flex
 * itself and independent of percentage resolution.
 *
 * This guard is textual on purpose: jsdom does no layout, so the real scroll
 * proof is the multi-viewport Playwright run. What this test prevents is the
 * structural REGRESSION — someone "simplifying" back to ScrollArea and
 * reintroducing the bug without anything failing.
 */
const FILE = join(__dirname, "ArtistVision360Modal.tsx");
const source = readFileSync(FILE, "utf8");

describe("Artist 360 modal — scroll owner estrutural", () => {
  it("the scroll owner exists and is a native overflow container", () => {
    expect(source).toContain('data-testid="vision360-scroll"');
    expect(source).toMatch(/flex-1 min-h-0 overflow-y-auto[^"]*"\s+data-testid="vision360-scroll"/);
  });

  it("does NOT use Radix ScrollArea as the outer scroll owner again", () => {
    // Inner ScrollAreas (h-[150px], h-[320px]) are still legitimate; what must not
    // come back is the outer one with flex-1, which is exactly the broken pattern.
    expect(source).not.toContain('<ScrollArea className="flex-1 min-h-0">');
  });

  it("the flex chain above the scroll owner stays intact", () => {
    // Without max-h on DialogContent the modal grows beyond the viewport;
    // without min-h-0 on the Tabs the flexible child is never constrained.
    expect(source).toContain("max-h-[90vh]");
    expect(source).toMatch(/<Tabs[^>]*className="[^"]*flex-1[^"]*min-h-0/);
  });

  it("the modal did not gain deliberate horizontal overflow on the scroll owner", () => {
    expect(source).not.toMatch(/data-testid="vision360-scroll"[^>]*overflow-x-auto/);
  });
});
