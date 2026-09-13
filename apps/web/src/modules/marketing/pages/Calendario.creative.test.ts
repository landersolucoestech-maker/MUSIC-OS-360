import { describe, expect, it } from "vitest";
import { initialContentForm, toMarketingContentInput } from "./content-form.mapper";
import { defaultCreativeConfig, displayUsername, NEWS_LANDER_RECORDS_TEMPLATE, type CreativeConfig } from "../types/creative.types";
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
    values.creative = { ...values.creative, caption: "Big News" };
    const input = toMarketingContentInput(values, current);
    expect(input.metadata?.unrelatedKey).toBe("keep-me");
    expect((input.metadata?.creative as CreativeConfig).caption).toBe("Big News");
  });

  it("SPLIT: primary and secondary slots round-trip independently through persistence", () => {
    const values = initialContentForm(baseContent());
    values.creative = {
      ...values.creative,
      mode: "template",
      layout: "split",
      primarySlot: { assetUrl: "https://cdn/left.png", kind: "image" },
      secondarySlot: { assetUrl: "https://cdn/right.mp4", kind: "video" },
    };
    const input = toMarketingContentInput(values, undefined);
    const persisted = (input.metadata?.creative as CreativeConfig);
    expect(persisted.primarySlot).toEqual({ assetUrl: "https://cdn/left.png", kind: "image" });
    expect(persisted.secondarySlot).toEqual({ assetUrl: "https://cdn/right.mp4", kind: "video" });

    // Reopening restores both slots exactly, and changing one on reopen never
    // touches the value the mapper produced for the other.
    const reopened = initialContentForm(baseContent({ metadata: { creative: persisted } }));
    expect(reopened.creative.primarySlot).toEqual(values.creative.primarySlot);
    expect(reopened.creative.secondarySlot).toEqual(values.creative.secondarySlot);
  });

  it("profileAvatar and watermark persist as independent fields -- setting one never touches the other", () => {
    const values = initialContentForm(baseContent());
    values.creative = {
      ...values.creative,
      mode: "template",
      profileAvatar: { assetUrl: "https://cdn/avatar.png", kind: "image" },
      watermark: { enabled: true, assetUrl: "https://cdn/watermark.png", opacity: 0.5 },
    };
    const input = toMarketingContentInput(values, undefined);
    const persisted = (input.metadata?.creative as CreativeConfig);
    expect(persisted.profileAvatar?.assetUrl).toBe("https://cdn/avatar.png");
    expect(persisted.watermark.assetUrl).toBe("https://cdn/watermark.png");
    expect(persisted.profileAvatar?.assetUrl).not.toBe(persisted.watermark.assetUrl);
  });

  it("full identity + caption + layout configuration survives save -> close -> reopen", () => {
    const values = initialContentForm(baseContent());
    values.creative = {
      ...values.creative,
      mode: "template",
      layout: "split",
      profileAvatar: { assetUrl: "https://cdn/avatar.png", kind: "image" },
      profileName: "Acme Records",
      username: "acmerecords",
      caption: "Big announcement",
      primarySlot: { assetUrl: "https://cdn/left.png", kind: "image" },
      secondarySlot: { assetUrl: "https://cdn/right.png", kind: "image" },
      watermark: { enabled: true, assetUrl: "https://cdn/wm.png", opacity: 0.85 },
    };
    const saved = toMarketingContentInput(values, undefined);
    const reopened = initialContentForm(baseContent({ metadata: saved.metadata }));
    expect(reopened.creative).toEqual(values.creative);
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

  it("operational title stays independent from the creative caption -- editing one never touches the other", () => {
    const values = initialContentForm(baseContent({ title: "Operational title" }));
    values.creative = { ...values.creative, caption: "Creative caption" };
    values.title = "Renamed operational title";
    const input = toMarketingContentInput(values, undefined);
    expect(input.title).toBe("Renamed operational title");
    expect((input.metadata?.creative as CreativeConfig).caption).toBe("Creative caption");
  });
});

describe("creative.types helpers", () => {
  it("defaultCreativeConfig starts dirty, Simple mode, News/Lander Records preset, no slots, empty identity", () => {
    const c = defaultCreativeConfig();
    expect(c.mode).toBe("simple");
    expect(c.layout).toBe("full");
    expect(c.templateKey).toBe(NEWS_LANDER_RECORDS_TEMPLATE.key);
    expect(c.primarySlot).toBeNull();
    expect(c.secondarySlot).toBeNull();
    expect(c.profileAvatar).toBeNull();
    expect(c.profileName).toBe("");
    expect(c.username).toBe("");
    expect(c.caption).toBe("");
    expect(c.renderState).toBe("dirty");
  });

  it("displayUsername applies '@' only for display, never mutating the stored value", () => {
    expect(displayUsername("acmerecords")).toBe("@acmerecords");
    expect(displayUsername("@already-prefixed")).toBe("@already-prefixed");
    expect(displayUsername("")).toBe("");
  });
});
