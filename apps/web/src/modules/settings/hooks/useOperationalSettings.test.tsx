import { act, renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/modules/settings/services/settings.service", () => ({
  settingsService: {
    getOperationalLists: vi.fn(() => []),
    saveOperationalLists: vi.fn(),
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { settingsService } from "@/modules/settings/services/settings.service";
import { useOperationalSettings, DEFAULT_EVENT_TYPES } from "./useOperationalSettings";

const ROWS = [
  { id: "1", tenant_id: "t1", kind: "event_type", name: "Shows", slug: "shows", description: null, active: true, order: 40, group: "Agenda", metadata: {} },
  { id: "2", tenant_id: "t1", kind: "event_type", name: "Ensaios", slug: "ensaios", description: null, active: true, order: 20, group: "Agenda", metadata: {} },
  { id: "3", tenant_id: "t1", kind: "event_type", name: "Desativado", slug: "disabled", description: null, active: false, order: 10, group: "Agenda", metadata: {} },
  { id: "4", tenant_id: "t1", kind: "lead_type", name: "Artista", slug: "artista", description: null, active: true, order: 10, group: "Musical", metadata: {} },
];

beforeEach(() => {
  vi.mocked(settingsService.getOperationalLists).mockReset().mockReturnValue([]);
  vi.mocked(settingsService.saveOperationalLists).mockReset();
});

// find-d4f19636 (Wave 13): this hook is deliberately synchronous/localStorage-backed,
// NOT wired to the real /operational-list-items backend API — storage.setRaw/getRaw
// are documented stubs (see settings.service.ts's own header comment) chosen on
// purpose after a real crash (Part 79: a synchronous throw during mount brought
// down the whole React tree). This test previously asserted an async,
// listOperationalListItems-backed contract that was never actually shipped —
// reclassified as REAL_PRODUCT_DECISION (wire vs. keep client-only) rather than a
// simple staleness fix; this file now tests the hook that actually exists.
describe("useOperationalSettings", () => {
  it("does not throw on mount even without saved data (storage.getRaw crash fix) and falls back to the defaults", () => {
    const { result } = renderHook(() => useOperationalSettings());
    expect(result.current.getOptionsByKind("event_type").length).toEqual(DEFAULT_EVENT_TYPES.filter((i) => i.active).length);
  });

  it("getOptionsByKind excludes inactive items and reflects the saved name (not the default) for existing items", () => {
    vi.mocked(settingsService.getOperationalLists).mockReturnValue(ROWS as never);
    const { result } = renderHook(() => useOperationalSettings());

    const options = result.current.getOptionsByKind("event_type");
    // exactly a pre-OL1 platform default -> read under its canonical English slug
    expect(options).toContainEqual({ value: "rehearsals", label: "Ensaios" });
    expect(options.some((o) => o.value === "ensaios")).toBe(false);
    expect(options).toContainEqual({ value: "shows", label: "Shows" });
    expect(options.some((o) => o.value === "disabled")).toBe(false);
  });

  it("getItemsByKind does not mix other taxonomies (returns only items of the requested kind)", () => {
    vi.mocked(settingsService.getOperationalLists).mockReturnValue(ROWS as never);
    const { result } = renderHook(() => useOperationalSettings());

    const leadTypeItems = result.current.getItemsByKind("lead_type");
    expect(leadTypeItems.every((i) => i.kind === "lead_type")).toBe(true);
    expect(leadTypeItems.some((i) => i.slug === "artista")).toBe(true);
  });

  it("createItem persists through settingsService.saveOperationalLists", () => {
    vi.mocked(settingsService.getOperationalLists).mockReturnValue(ROWS as never);
    const { result } = renderHook(() => useOperationalSettings());

    act(() => {
      result.current.createItem("event_type", { name: "Gravação" });
    });

    expect(settingsService.saveOperationalLists).toHaveBeenCalled();
    expect(result.current.getItemsByKind("event_type").some((i) => i.slug === "gravacao")).toBe(true);
  });

  it("legacy reader: edited or tenant-authored items keep their slug, exact legacy defaults are read as canonical without duplicates", () => {
    vi.mocked(settingsService.getOperationalLists).mockReturnValue([
      { ...ROWS[1], id: "a", name: "Ensaios de banda" }, // edited name -> NOT proven platform, untouched
      { ...ROWS[0], id: "b", kind: "lead_status", name: "Novo lead", slug: "novo_lead" }, // pre-OL1 API seed
      { ...ROWS[0], id: "c", kind: "lead_type", name: "Meu tipo", slug: "artista_banda" }, // tenant content on a legacy slug
    ] as never);
    const { result } = renderHook(() => useOperationalSettings());

    const eventSlugs = result.current.getItemsByKind("event_type").map((i) => i.slug);
    expect(eventSlugs).toContain("ensaios");
    expect(eventSlugs).toContain("rehearsals"); // default still appended next to the edited legacy-slug row
    const statuses = result.current.getItemsByKind("lead_status");
    expect(statuses.filter((i) => i.slug === "new")).toHaveLength(1);
    expect(statuses.some((i) => i.slug === "novo_lead")).toBe(false);
    expect(result.current.getItemsByKind("lead_type").find((i) => i.id === "c")?.slug).toBe("artista_banda");
  });

  it("default canonical slugs: lead_status is the LeadStatus enum, events/leads/services are English, labels stay pt-BR", async () => {
    const { LeadStatus } = await import("@music-os-360/types");
    const { result } = renderHook(() => useOperationalSettings());
    expect(result.current.getOptionsByKind("lead_status").map((o) => o.value).sort()).toEqual(Object.values(LeadStatus).sort());
    expect(result.current.getOptionsByKind("event_type").map((o) => o.value)).toEqual([
      "studio_sessions", "rehearsals", "photo_shoots", "shows", "interviews", "podcasts", "tv_shows", "radio", "content_production", "meetings",
    ]);
    expect(result.current.getOptionsByKind("lead_type")[0]).toEqual({ value: "artist_or_band", label: "Artista / Banda" });
    expect(result.current.getOptionsByKind("service_interest").some((o) => o.value === "other" && o.label === "Outro")).toBe(true);
  });
});
