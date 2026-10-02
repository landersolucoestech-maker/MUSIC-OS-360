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
