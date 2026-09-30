import { describe, it, expect, vi, beforeEach } from "vitest";
import { runAudit } from "@/shared/lib/audit/runner";
import { storage } from "@/shared/lib/storage";

vi.mock("@/shared/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/storage")>("@/shared/lib/storage");
  return { ...actual, storage: { ...actual.storage, list: vi.fn() } };
});

const mockedList = vi.mocked(storage.list);

// Ids an attacker would need to turn a navigation target into an external one
// (protocol-relative, backslash, scheme, dot-segments) — the shapes behind
// react-router advisories 1124268 / CVE-2025-68470.
const HOSTILE_IDS = [
  "//evil.example",
  "\\\\evil.example",
  "/\\evil.example",
  "javascript:alert(1)",
  "https://evil.example/x",
  "../../\\evil.example",
  "x#@evil.example",
];

const APP_ORIGIN = "https://app.example";

describe("audit fix_path (DataAudit navigate target)", () => {
  beforeEach(() => {
    mockedList.mockReset();
  });

  it("is always an internal route: a literal pathname, whatever the stored row id", async () => {
    mockedList.mockImplementation((async () =>
      HOSTILE_IDS.map((id) => ({ id, updated_at: "2026-01-01" }))) as typeof storage.list);

    const result = await runAudit();
    const targets = [...result.records, ...result.issues].map((item) => item.fix_path);

    expect(result.records.length).toBeGreaterThan(0);
    for (const target of targets) {
      // A literal "/route" prefix: never "//", "/\", a scheme or a relative path.
      expect(target).toMatch(/^\/[a-z-]+(?:\/[a-z-]+)*\?[A-Za-z]+=/);
      // The browser's own URL parser (backslashes and dot-segments included) keeps it same-origin.
      expect(new URL(target, APP_ORIGIN).origin).toBe(APP_ORIGIN);
    }
  });
});
