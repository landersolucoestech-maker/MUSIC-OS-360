import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/modules/settings/services/settings.service", () => ({
  settingsService: {
    getOperationalLists: vi.fn(() => []),
    saveOperationalLists: vi.fn(),
  },
}));

import { settingsService } from "@/modules/settings/services/settings.service";
import { useOperationalSettings, DEFAULT_CONTACT_INDIVIDUAL_CLASSIFICATIONS } from "./useOperationalSettings";

const LEGACY_ID = "contact-individual-videomaker";

beforeEach(() => vi.mocked(settingsService.getOperationalLists).mockReset().mockReturnValue([]));

describe("contact individual classification default id", () => {
  it("the default keeps the stable id mapped to the VIDEOMAKER slug", () => {
    const item = DEFAULT_CONTACT_INDIVIDUAL_CLASSIFICATIONS.find((i) => i.id === LEGACY_ID);
    expect(item?.slug).toBe("VIDEOMAKER");
    expect(item?.kind).toBe("contact_individual_classification");
  });

  it("a stored item with that id is read back once, not duplicated by the defaults merge", () => {
    const stored = DEFAULT_CONTACT_INDIVIDUAL_CLASSIFICATIONS.map((i) => ({ ...i, name: i.id === LEGACY_ID ? "Videomaker (editado)" : i.name }));
    vi.mocked(settingsService.getOperationalLists).mockReturnValue(stored as never);
    const { result } = renderHook(() => useOperationalSettings());
    const matches = result.current.getItemsByKind("contact_individual_classification").filter((i) => i.id === LEGACY_ID);
    expect(matches).toHaveLength(1);
    expect(matches[0].slug).toBe("VIDEOMAKER");
    expect(matches[0].name).toBe("Videomaker (editado)");
  });
});

describe("VIDEOMAKER individual classification option", () => {
  it("is offered in the select with value VIDEOMAKER and label Videomaker", () => {
    const { result } = renderHook(() => useOperationalSettings());
    expect(result.current.getOptionsByKind("contact_individual_classification")).toContainEqual({ value: "VIDEOMAKER", label: "Videomaker" });
  });
  it("a stored list missing it gets it back from the defaults merge under the VIDEOMAKER slug", () => {
    const stored = DEFAULT_CONTACT_INDIVIDUAL_CLASSIFICATIONS.filter((i) => i.id !== LEGACY_ID);
    vi.mocked(settingsService.getOperationalLists).mockReturnValue(stored as never);
    const { result } = renderHook(() => useOperationalSettings());
    const slugs = result.current.getItemsByKind("contact_individual_classification").map((i) => i.slug);
    expect(slugs.filter((s) => s === "VIDEOMAKER")).toHaveLength(1);
  });
  it("a tenant-created classification named Videomaker is normalised to the VIDEOMAKER slug; near-misses stay distinct", () => {
    const { result } = renderHook(() => useOperationalSettings());
    expect(result.current.getOptionsByKind("contact_individual_classification").map((o) => o.value)).not.toContain("VIDEO_MAKER");
    expect(result.current.getOptionsByKind("contact_individual_classification").map((o) => o.value)).not.toContain("videomaker");
  });
});
