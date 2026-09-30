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

// Rows below use the keys the API really returns (GET /projects, /licenses,
// /events return the canonical English columns; the Portuguese names are
// deprecated INPUT aliases only and never appear in a response).
type Row = Record<string, unknown>;

const completeRows: Record<string, Row> = {
  projects: { id: "p1", title: "Album", type: "album", status: "planning", music_genre: "MPB", artist_id: "a1" },
  licenses: { id: "l1", title: "Sync license", client_name: "Acme", amount: 1500, status: "active" },
  events: { id: "e1", title: "Show", starts_at: "2026-10-01T20:00:00Z", venue: "Arena", artist_id: "a1" },
};

function mockRows(byTable: Record<string, Row[]>) {
  mockedList.mockImplementation((async (table: string) => {
    const rows = byTable[table];
    return rows ?? [];
  }) as unknown as typeof storage.list);
}

const recordFor = (result: Awaited<ReturnType<typeof runAudit>>, module: string) =>
  result.records.find((record) => record.module === module);

describe("audit completeness uses the canonical API keys", () => {
  beforeEach(() => {
    mockedList.mockReset();
  });

  it.each([
    ["projects", "projects"],
    ["licensing", "licenses"],
    ["events", "events"],
  ])("a canonical complete %s record has no missing fields", async (module, table) => {
    mockRows({ [table]: [completeRows[table]] });

    const record = recordFor(await runAudit(), module);

    expect(record).toBeDefined();
    expect(record?.missing_fields).toEqual([]);
    expect(record?.recommended_missing_fields).toEqual([]);
    expect(record?.is_complete).toBe(true);
    expect(record?.completeness).toBe(100);
  });

  it("does not count the deprecated Portuguese project key as the canonical genre", async () => {
    mockRows({ projects: [{ ...completeRows.projects, music_genre: undefined, genero: "MPB" }] });

    const record = recordFor(await runAudit(), "projects");

    expect(record?.recommended_missing_fields).toContain("Gênero musical");
  });

  it("does not count the deprecated Portuguese license keys as client and amount", async () => {
    mockRows({ licenses: [{ id: "l2", title: "Sync", cliente: "Acme", valor: 900, status: "active" }] });

    const record = recordFor(await runAudit(), "licensing");

    expect(record?.missing_fields).toContain("Cliente");
    expect(record?.recommended_missing_fields).toContain("Valor");
  });

  it("does not count the non-existent start_date key as the event start", async () => {
    mockRows({ events: [{ id: "e2", title: "Show", start_date: "2026-10-01", venue: "Arena", artist_id: "a1" }] });

    const record = recordFor(await runAudit(), "events");

    expect(record?.missing_fields).toContain("Data de início");
  });

  it("treats an amount of 0 as present", async () => {
    mockRows({ licenses: [{ ...completeRows.licenses, amount: 0 }] });

    const record = recordFor(await runAudit(), "licensing");

    expect(record?.recommended_missing_fields).not.toContain("Valor");
    expect(record?.is_complete).toBe(true);
  });

  it("labels a license by its canonical client when it has no title", async () => {
    mockRows({ licenses: [{ ...completeRows.licenses, title: "" }] });

    const record = recordFor(await runAudit(), "licensing");

    expect(record?.entity_label).toBe("Acme");
  });

  it("keeps the other tables when one table fails, without leaking the raw error", async () => {
    mockedList.mockImplementation((async (table: string) => {
      if (table === "licenses") throw new Error("ECONNREFUSED 10.0.0.5:5432 password authentication failed");
      return table === "projects" ? [completeRows.projects] : [];
    }) as unknown as typeof storage.list);

    const result = await runAudit();

    expect(recordFor(result, "projects")?.is_complete).toBe(true);
    expect(recordFor(result, "licensing")).toBeUndefined();
    expect(JSON.stringify(result)).not.toContain("ECONNREFUSED");
  });
});
