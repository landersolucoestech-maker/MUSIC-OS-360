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
  { id: "3", tenant_id: "t1", kind: "event_type", name: "Desativado", slug: "desativado", description: null, active: false, order: 10, group: "Agenda", metadata: {} },
  { id: "4", tenant_id: "t1", kind: "lead_type", name: "Artista", slug: "artista", description: null, active: true, order: 10, group: "Musical", metadata: {} },
];

beforeEach(() => {
  vi.mocked(settingsService.getOperationalLists).mockReset().mockReturnValue([]);
  vi.mocked(settingsService.saveOperationalLists).mockReset();
});

// find-d4f19636 (Wave 13): this hook is deliberately synchronous/localStorage-backed,
// NOT wired to the real /operational-list-items backend API — storage.setRaw/getRaw
// are documented stubs (see settings.service.ts's own header comment) chosen on
// purpose after a real crash (Parte 79: a synchronous throw during mount brought
// down the whole React tree). This test previously asserted an async,
// listOperationalListItems-backed contract that was never actually shipped —
// reclassified as REAL_PRODUCT_DECISION (wire vs. keep client-only) rather than a
// simple staleness fix; this file now tests the hook that actually exists.
describe("useOperationalSettings", () => {
  it("não lança durante a montagem mesmo sem dados salvos (correção do crash de storage.getRaw) e cai nos defaults", () => {
    const { result } = renderHook(() => useOperationalSettings());
    expect(result.current.getOptionsByKind("event_type").length).toEqual(DEFAULT_EVENT_TYPES.filter((i) => i.active).length);
  });

  it("getOptionsByKind exclui itens inativos e reflete o nome salvo (não o default) para itens já existentes", () => {
    vi.mocked(settingsService.getOperationalLists).mockReturnValue(ROWS as never);
    const { result } = renderHook(() => useOperationalSettings());

    const options = result.current.getOptionsByKind("event_type");
    expect(options).toContainEqual({ value: "ensaios", label: "Ensaios" });
    expect(options).toContainEqual({ value: "shows", label: "Shows" });
    expect(options.some((o) => o.value === "desativado")).toBe(false);
  });

  it("getItemsByKind não mistura outras taxonomias (só retorna itens do kind pedido)", () => {
    vi.mocked(settingsService.getOperationalLists).mockReturnValue(ROWS as never);
    const { result } = renderHook(() => useOperationalSettings());

    const leadTypeItems = result.current.getItemsByKind("lead_type");
    expect(leadTypeItems.every((i) => i.kind === "lead_type")).toBe(true);
    expect(leadTypeItems.some((i) => i.slug === "artista")).toBe(true);
  });

  it("createItem persiste via settingsService.saveOperationalLists", () => {
    vi.mocked(settingsService.getOperationalLists).mockReturnValue(ROWS as never);
    const { result } = renderHook(() => useOperationalSettings());

    act(() => {
      result.current.createItem("event_type", { name: "Gravação" });
    });

    expect(settingsService.saveOperationalLists).toHaveBeenCalled();
    expect(result.current.getItemsByKind("event_type").some((i) => i.slug === "gravacao")).toBe(true);
  });
});
