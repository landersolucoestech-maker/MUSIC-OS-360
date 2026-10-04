import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/modules/settings/services/settings.service", () => ({
  settingsService: {
    getOperationalLists: vi.fn(() => []),
    saveOperationalLists: vi.fn(),
  },
}));

import { settingsService } from "@/modules/settings/services/settings.service";
import { useOperationalSettings } from "./useOperationalSettings";

beforeEach(() => vi.mocked(settingsService.getOperationalLists).mockReset().mockReturnValue([]));

const leadType = (id: string, slug: string, metadata?: Record<string, unknown>) => ({
  id, kind: "lead_type", name: `Tipo ${slug}`, slug, description: "", active: true, order: 900, group: "Custom", ...(metadata ? { metadata } : {}),
});

describe("useOperationalSettings: stored lead_type items with pre-OL1 allowed_service_slugs", () => {
  it("exposes the canonical service slugs (legacy mapped, canonical and unknown kept, order preserved)", () => {
    vi.mocked(settingsService.getOperationalLists).mockReturnValue([
      leadType("lt-custom", "custom_lead", { allowed_service_slugs: ["producao_musical", "mixagem", "mastering", "tenant_service"], note: "kept" }),
    ] as never);
    const { result } = renderHook(() => useOperationalSettings());
    const item = result.current.getItemsByKind("lead_type").find((i) => i.id === "lt-custom");
    expect(item?.metadata?.allowed_service_slugs).toEqual(["music_production", "mixing", "mastering", "tenant_service"]);
    expect(item?.metadata?.note).toBe("kept");
  });

  it("the result is a plain array of strings (a bypassed reader would leak the metadata object)", () => {
    vi.mocked(settingsService.getOperationalLists).mockReturnValue([
      leadType("lt-custom", "custom_lead", { allowed_service_slugs: ["gestao_artistica"] }),
    ] as never);
    const { result } = renderHook(() => useOperationalSettings());
    const slugs = result.current.getItemsByKind("lead_type").find((i) => i.id === "lt-custom")?.metadata?.allowed_service_slugs;
    expect(Array.isArray(slugs)).toBe(true);
    expect(slugs).toEqual(["artist_management"]);
  });

  it("drops non-string entries and does not invent the key when the stored item has none", () => {
    vi.mocked(settingsService.getOperationalLists).mockReturnValue([
      leadType("lt-a", "lead_a", { allowed_service_slugs: ["consultoria", 7, null] }),
      leadType("lt-b", "lead_b", { other: true }),
      leadType("lt-c", "lead_c"),
    ] as never);
    const { result } = renderHook(() => useOperationalSettings());
    const byId = (id: string) => result.current.getItemsByKind("lead_type").find((i) => i.id === id);
    expect(byId("lt-a")?.metadata?.allowed_service_slugs).toEqual(["consulting"]);
    expect(byId("lt-b")?.metadata).toEqual({ other: true });
    expect(byId("lt-c")?.metadata).toBeUndefined();
  });
});
