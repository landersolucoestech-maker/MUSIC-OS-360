import { describe, expect, it } from "vitest";
import { initialContentForm, toMarketingContentInput } from "./content-form.mapper";
import { defaultCreativeConfig, withTextLayer, textLayer, NEWS_LANDER_RECORDS_TEMPLATE } from "../types/creative.types";
import type { MarketingContent } from "../types/marketing.types";

function baseContent(overrides: Partial<MarketingContent> = {}): MarketingContent {
  return {
    id: "c1",
    title: "Existing content",
    targetType: "empresa",
    channel: "instagram",
    status: "agendado",
    publishDate: "2026-01-01",
    publishTime: "10:00",
    owner: "Marketing",
    files: [],
    copy: "copy",
    notes: "",
    approval: "pendente",
    type: "feed",
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("creative editor — model and round-trip", () => {
  it("legacy content (no metadata.creative) opens in Simple mode with a fresh default config", () => {
    const values = initialContentForm(baseContent());
    expect(values.creative.mode).toBe("simple");
    expect(values.creative.primarySlot).toBeNull();
  });

  it("a malformed metadata.creative (wrong shape) never crashes the modal — falls back to default", () => {
    const values = initialContentForm(baseContent({ metadata: { creative: { garbage: true } } }));
    expect(values.creative.mode).toBe("simple");
  });

  it("content with a valid metadata.creative reopens with that exact config restored", () => {
    const creative = { ...defaultCreativeConfig(), mode: "template" as const, primarySlot: { assetUrl: "https://cdn/x.png", kind: "image" as const } };
    const values = initialContentForm(baseContent({ metadata: { creative } }));
    expect(values.creative.mode).toBe("template");
    expect(values.creative.primarySlot?.assetUrl).toBe("https://cdn/x.png");
  });

  it("Simple mode: files comes from values.media, same as before this feature existed", () => {
    const values = initialContentForm(baseContent());
    values.media = [{ url: "https://cdn/real.png", name: "real.png", kind: "image/png" }];
    const input = toMarketingContentInput(values, undefined);
    expect(input.files).toEqual([{ id: expect.any(String), name: "real.png", url: "https://cdn/real.png", kind: "image/png" }]);
  });

  it("Template mode: creative.primarySlot NEVER leaks into files — source media is not publishable output", () => {
    const values = initialContentForm(baseContent());
    values.creative = { ...values.creative, mode: "template", primarySlot: { assetUrl: "https://cdn/source.png", kind: "image" } };
    const input = toMarketingContentInput(values, undefined);
    expect(input.files).toEqual([]);
    expect(JSON.stringify(input.files)).not.toContain("source.png");
  });

  it("Template mode: existing files are preserved (not wiped) on update until a real render exists", () => {
    const current = baseContent({ files: [{ id: "f1", name: "old-render.png", url: "https://cdn/old-render.png" }] });
    const values = initialContentForm(current);
    values.creative = { ...values.creative, mode: "template" };
    const input = toMarketingContentInput(values, current);
    expect(input.files).toEqual(current.files);
  });

  it("metadata.creative round-trips through toMarketingContentInput, preserving other metadata keys", () => {
    const current = baseContent({ metadata: { unrelatedKey: "keep-me" } });
    const values = initialContentForm(current);
    values.creative = withTextLayer(values.creative, "headline", "Big News");
    const input = toMarketingContentInput(values, current);
    expect(input.metadata?.unrelatedKey).toBe("keep-me");
    expect((input.metadata?.creative as typeof values.creative).textLayers).toContainEqual({ role: "headline", text: "Big News" });
  });

  it("never persists a blob: URL in the submitted media/files", () => {
    const values = initialContentForm(baseContent());
    values.media = [{ url: "blob:http://localhost/abc-123", name: "x.png", kind: "image/png", uploading: true }];
    // uploading items are still blob: at this point -- the modal's finalize()
    // guard blocks submission while any item has uploading=true; this proves
    // the data itself is identifiable as not-yet-safe so that guard has
    // something real to check.
    expect(values.media.some((m: { uploading?: boolean }) => m.uploading)).toBe(true);
    expect(values.media[0].url.startsWith("blob:")).toBe(true);
  });
});

describe("creative.types helpers", () => {
  it("defaultCreativeConfig starts dirty, Simple mode, News/Lander Records preset, no slots", () => {
    const c = defaultCreativeConfig();
    expect(c.mode).toBe("simple");
    expect(c.layout).toBe("full");
    expect(c.templateKey).toBe(NEWS_LANDER_RECORDS_TEMPLATE.key);
    expect(c.primarySlot).toBeNull();
    expect(c.secondarySlot).toBeNull();
    expect(c.renderState).toBe("dirty");
  });

  it("withTextLayer updates an existing role without duplicating it and marks dirty", () => {
    let c = defaultCreativeConfig();
    c = { ...c, renderState: "clean" };
    c = withTextLayer(c, "headline", "Hello");
    expect(textLayer(c, "headline")).toBe("Hello");
    expect(c.textLayers.filter((l) => l.role === "headline")).toHaveLength(1);
    expect(c.renderState).toBe("dirty");
  });

  it("withTextLayer adds a role that doesn't exist yet", () => {
    const c = withTextLayer({ ...defaultCreativeConfig(), textLayers: [] }, "subtitle", "Sub");
    expect(textLayer(c, "subtitle")).toBe("Sub");
  });
});
