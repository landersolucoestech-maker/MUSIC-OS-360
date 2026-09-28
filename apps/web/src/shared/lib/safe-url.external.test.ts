import { describe, it, expect } from "vitest";
import { safeExternalUrl } from "./safe-url";

describe("safeExternalUrl — stored-XSS guard for links built from API data", () => {
  it("keeps absolute http(s) URLs, trimmed", () => {
    expect(safeExternalUrl("https://instagram.com/banda")).toBe("https://instagram.com/banda");
    expect(safeExternalUrl("  http://example.com/a?b=1  ")).toBe("http://example.com/a?b=1");
    expect(safeExternalUrl("HTTPS://Example.com/Foto.png")).toBe("HTTPS://Example.com/Foto.png");
  });

  it("rejects script-bearing schemes, including mixed case and leading whitespace", () => {
    expect(safeExternalUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeExternalUrl(" JaVaScRiPt:alert(document.cookie)")).toBeUndefined();
    expect(safeExternalUrl("\tjavascript:alert(1)")).toBeUndefined();
    expect(safeExternalUrl("data:text/html,<script>alert(1)</script>")).toBeUndefined();
    expect(safeExternalUrl("data:image/png;base64,iVBORw0KGgo=")).toBeUndefined();
    expect(safeExternalUrl("vbscript:msgbox(1)")).toBeUndefined();
  });

  it("rejects non-web schemes, relative and scheme-less values", () => {
    expect(safeExternalUrl("mailto:a@b.com")).toBeUndefined();
    expect(safeExternalUrl("file:///etc/passwd")).toBeUndefined();
    expect(safeExternalUrl("//evil.example.com")).toBeUndefined();
    expect(safeExternalUrl("/artists/1")).toBeUndefined();
    expect(safeExternalUrl("instagram.com/banda")).toBeUndefined();
    expect(safeExternalUrl("https://")).toBeUndefined();
    expect(safeExternalUrl("http:/one-slash.com")).toBeUndefined();
  });

  it("rejects absent and non-string values", () => {
    expect(safeExternalUrl("")).toBeUndefined();
    expect(safeExternalUrl("   ")).toBeUndefined();
    expect(safeExternalUrl(null)).toBeUndefined();
    expect(safeExternalUrl(undefined)).toBeUndefined();
    expect(safeExternalUrl(42)).toBeUndefined();
    expect(safeExternalUrl({ href: "https://x.com" })).toBeUndefined();
  });
});
