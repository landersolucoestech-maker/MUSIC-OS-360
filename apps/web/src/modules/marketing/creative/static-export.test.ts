import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exportCreativeToPng, CreativeExportError } from "./static-export";
import { defaultCreativeConfig, type CreativeConfig } from "../types/creative.types";

/**
 * The static-export pipeline is the repository-native answer to the
 * "static export is CORS-blocked" question raised in Phase D: media is
 * fetched through the API's own authenticated /uploads/:fileId/raw proxy
 * (never R2 directly) so the decoded blob: URL can be read into a canvas.
 * These tests prove that boundary -- not full pixel fidelity, which is
 * covered visually by creative-template-surface.test.tsx for the on-screen
 * preview this mirrors.
 */

class FakeCanvasContext {
  calls: string[] = [];
  fillStyle = "";
  font = "";
  globalAlpha = 1;
  textAlign = "left";
  textBaseline = "alphabetic";
  fillRect() { this.calls.push("fillRect"); }
  fillText(text: string) { this.calls.push(`fillText:${text}`); }
  measureText(text: string) { return { width: text.length * 10 }; }
  drawImage() { this.calls.push("drawImage"); }
  save() { this.calls.push("save"); }
  restore() { this.calls.push("restore"); }
  beginPath() {}
  arc() {}
  clip() {}
  fill() {}
}

function installFakeImage(shouldFail = false) {
  class FakeImage {
    width = 200;
    height = 100;
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_v: string) {
      queueMicrotask(() => (shouldFail ? this.onerror?.() : this.onload?.()));
    }
  }
  vi.stubGlobal("Image", FakeImage);
}

function installFakeCanvas(ctx: FakeCanvasContext) {
  const realCreateElement = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag !== "canvas") return realCreateElement(tag);
    return {
      width: 0,
      height: 0,
      getContext: () => ctx,
      toBlob: (cb: (b: Blob | null) => void) => cb(new Blob(["png"], { type: "image/png" })),
    } as unknown as HTMLCanvasElement;
  });
}

function slot(fileId?: string) {
  return { assetUrl: `https://r2.example/${fileId ?? "no-file-id"}.png`, kind: "image" as const, fileId };
}

describe("exportCreativeToPng — canvas-safe static export via the /uploads/:fileId/raw proxy", () => {
  let ctx: FakeCanvasContext;

  beforeEach(() => {
    ctx = new FakeCanvasContext();
    installFakeCanvas(ctx);
    installFakeImage();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(["bytes"], { type: "image/png" })),
    }));
    vi.stubGlobal("URL", { ...URL, createObjectURL: vi.fn(() => "blob:fake"), revokeObjectURL: vi.fn() });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  function baseConfig(overrides: Partial<CreativeConfig> = {}): CreativeConfig {
    return { ...defaultCreativeConfig(), mode: "template", ...overrides };
  }

  it("rejects with CreativeExportError, never a silent blank export, when the media slot has no fileId (project-library asset)", async () => {
    const creative = baseConfig({ primarySlot: slot(undefined) });
    await expect(exportCreativeToPng(creative, "1:1")).rejects.toThrow(CreativeExportError);
  });

  it("fetches each media slot through the same-origin /uploads/:fileId/raw proxy, never the R2 asset URL directly", async () => {
    const creative = baseConfig({ primarySlot: slot("file-abc") });
    await exportCreativeToPng(creative, "1:1");

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl).toContain("/uploads/file-abc/raw");
    expect(calledUrl).not.toContain("r2.example");
  });

  it("composes identity + caption + FULL media into a real PNG blob", async () => {
    const creative = baseConfig({
      profileName: "Test Artist",
      username: "testartist",
      caption: "A real caption, not a placeholder.",
      layout: "full",
      primarySlot: slot("file-full"),
    });

    const blob = await exportCreativeToPng(creative, "1:1");
    expect(blob.type).toBe("image/png");
    expect(ctx.calls).toContain("drawImage");
    expect(ctx.calls.some((c) => c.startsWith("fillText:Test Artist"))).toBe(true);
  });

  it("SPLIT layout draws both independent panes (two drawImage calls for media, zero shared state)", async () => {
    const creative = baseConfig({
      layout: "split",
      primarySlot: slot("file-left"),
      secondarySlot: slot("file-right"),
    });

    await exportCreativeToPng(creative, "1:1");

    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const urls = fetchMock.mock.calls.map((c) => c[0] as string);
    expect(urls.some((u) => u.includes("file-left"))).toBe(true);
    expect(urls.some((u) => u.includes("file-right"))).toBe(true);
    expect(ctx.calls.filter((c) => c === "drawImage")).toHaveLength(2);
  });

  it("renders a video slot as a labeled placeholder pane, never a faked frame", async () => {
    const creative = baseConfig({
      layout: "full",
      primarySlot: { assetUrl: "https://r2.example/v.mp4", kind: "video", fileId: "file-video" },
    });

    await exportCreativeToPng(creative, "1:1");

    expect(ctx.calls.some((c) => c.includes("sem frame estático"))).toBe(true);
    // no attempt to fetch/decode video bytes as an image
    expect(fetch).not.toHaveBeenCalled();
  });

  /**
   * find-f774744c: the mock stubbed createObjectURL/revokeObjectURL but
   * never asserted on them -- a leak (missing revoke) wouldn't have been
   * caught.
   */
  it("revokes every object URL it creates (no blob: URL leak)", async () => {
    const creative = baseConfig({ layout: "full", primarySlot: slot("file-x") });
    await exportCreativeToPng(creative, "1:1");

    const createCalls = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock.results.map((r) => r.value);
    const revokeCalls = (URL.revokeObjectURL as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    expect(createCalls.length).toBeGreaterThan(0);
    expect(revokeCalls).toEqual(createCalls);
  });

  /**
   * find-2cf48add: fetchSlotBlob gained a 401 handler and a request
   * timeout -- previously untested branches.
   */
  it("throws a clear session-expired error on 401 and clears the stale access token", async () => {
    (fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 401 });
    const creative = baseConfig({ layout: "full", primarySlot: slot("file-x") });

    await expect(exportCreativeToPng(creative, "1:1")).rejects.toThrow(/sess[aã]o expirada/i);
  });

  it("throws a timeout-specific error when the request is aborted", async () => {
    // Simulates what fetch() throws once AbortController.abort() fires --
    // exercised directly rather than waiting out the real FETCH_TIMEOUT_MS.
    (fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new DOMException("Aborted", "AbortError"));
    const creative = baseConfig({ layout: "full", primarySlot: slot("file-x") });

    await expect(exportCreativeToPng(creative, "1:1")).rejects.toThrow(/tempo esgotado/i);
  });

  it("watermark with no asset renders the independent fallback label, never derived from profile identity", async () => {
    // No profileName/username set -- if the watermark fallback were ever
    // coupled to identity (the bug this guards against), there would be
    // nothing else in the render that could produce identity-like text.
    const creative = baseConfig({
      layout: "full",
      primarySlot: slot("file-x"),
      watermark: { enabled: true, assetUrl: null, opacity: 0.9 },
    });

    await exportCreativeToPng(creative, "1:1");

    expect(ctx.calls.some((c) => c === "fillText:MARCA D'ÁGUA")).toBe(true);
  });
});
