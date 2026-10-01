import { describe, expect, it } from "vitest";
import { safeHref, safeImageSrc, safeLinkHref, safeMediaSrc } from "./safe-url";

const EVIL = [
  "javascript:alert(1)",
  "JaVaScRiPt:alert(1)",
  " javascript:alert(1)",
  "\tjavascript:alert(1)",
  "java\tscript:alert(1)",
  "java\nscript:alert(1)",
  "java\rscript:alert(1)",
  "\u0001javascript:alert(1)",
  "/\t/evil.example",
  "/\n\\evil.example",
  "/\r/evil.example",
  "/safe\u0000path",
  "data:text/html,<script>alert(1)</script>",
  "data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==",
  "vbscript:msgbox(1)",
  "//evil.example/x",
  "\\\\evil.example/x",
  "/\\evil.example",
  "file:///etc/passwd",
  "ftp://example.com/x",
  "r2://bucket/tenants/t/images/f/x.png",
  "",
  "   ",
];

describe("safeHref (single guard for raw hrefs from API data)", () => {
  it.each(EVIL)("rejects %j", (value) => {
    expect(safeHref(value)).toBeUndefined();
  });
  it.each([null, undefined, 5, {}, ["https://a.example"], true])("rejects non-string %j", (value) => {
    expect(safeHref(value)).toBeUndefined();
  });
  it("rejects relative paths and bare hosts (no link, text only)", () => {
    expect(safeHref("/settings/billing")).toBeUndefined();
    expect(safeHref("example.com/x")).toBeUndefined();
    expect(safeHref("javascript:alert(1)//https://ok.example")).toBeUndefined();
  });
  it("keeps http, https and mailto (trimmed)", () => {
    expect(safeHref("https://example.com/a?b=1#c")).toBe("https://example.com/a?b=1#c");
    expect(safeHref("  http://localhost:54321/storage/v1/object/public/x.png ")).toBe("http://localhost:54321/storage/v1/object/public/x.png");
    expect(safeHref("HTTPS://EXAMPLE.COM")).toBe("HTTPS://EXAMPLE.COM");
    expect(safeHref("mailto:a@b.com")).toBe("mailto:a@b.com");
    expect(safeHref("https://pub-abc.r2.dev/tenants/t/audio/f/a.wav")).toBe("https://pub-abc.r2.dev/tenants/t/audio/f/a.wav");
  });
});

describe("safeLinkHref / safeMediaSrc / safeImageSrc: scheme-relative and obfuscated values", () => {
  const rejected = EVIL.filter((value) => value.trim() && !value.startsWith("r2:") && !value.startsWith("ftp:"));
  it.each(rejected)("safeLinkHref rejects %j", (value) => {
    expect(safeLinkHref(value)).toBe("");
  });
  it.each(rejected)("safeMediaSrc rejects %j", (value) => {
    expect(safeMediaSrc(value)).toBe("");
  });
  it.each(rejected)("safeImageSrc rejects %j", (value) => {
    expect(safeImageSrc(value)).toBe("");
  });
  it("keeps legitimate links and media (http(s), same-origin relative, blob)", () => {
    expect(safeLinkHref("https://x.supabase.co/storage/v1/object/public/a.png")).toBe("https://x.supabase.co/storage/v1/object/public/a.png");
    expect(safeLinkHref("/settings/billing")).toBe("/settings/billing");
    expect(safeMediaSrc("https://pub.r2.dev/a.mp3")).toBe("https://pub.r2.dev/a.mp3");
    expect(safeMediaSrc("blob:https://app.example/abc")).toBe("blob:https://app.example/abc");
    expect(safeMediaSrc("mailto:a@b.com")).toBe("");
    expect(safeMediaSrc(null)).toBe("");
  });
});
