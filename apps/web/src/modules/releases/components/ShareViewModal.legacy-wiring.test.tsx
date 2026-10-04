import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/shared/hooks/useEntityLookup", () => ({ useEntityById: () => ({ entity: undefined }) }));
vi.mock("@/modules/releases/hooks/useReleases", () => ({ useReleases: () => ({ releases: [] }) }));
vi.mock("@/shared/components/StoredFileLink", () => ({ StoredFileLink: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import { ShareViewModal } from "./ShareViewModal";
import type { Share } from "../types";

const renderHistory = (history: unknown[]) =>
  render(<ShareViewModal open onOpenChange={() => undefined} share={{ id: "s1", history } as unknown as Share} />);

const percentageOf = (version: number) => {
  const row = screen.getByTestId(`history-v${version}`);
  return row.querySelector("span.text-primary")?.textContent ?? null;
};

// Share history entries persisted by older builds carry the deprecated `percentual` key.
describe("ShareViewModal version history percentage", () => {
  it("shows the percentage of an entry that only has the deprecated key", () => {
    renderHistory([{ version: 1, date: "2024-01-01", ["percentual"]: 12.5 }]);
    expect(percentageOf(1)).toBe("12.5%");
  });

  it("shows the canonical percentage unchanged", () => {
    renderHistory([{ version: 2, date: "2024-01-01", percentage: 40 }]);
    expect(percentageOf(2)).toBe("40%");
  });

  it("the canonical percentage wins over the deprecated key", () => {
    renderHistory([{ version: 3, date: "2024-01-01", percentage: 30, ["percentual"]: 99 }]);
    expect(percentageOf(3)).toBe("30%");
  });

  it("each entry shows its own percentage", () => {
    renderHistory([
      { version: 1, date: "2024-01-01", ["percentual"]: 10 },
      { version: 2, date: "2024-02-01", percentage: 20 },
    ]);
    expect(percentageOf(1)).toBe("10%");
    expect(percentageOf(2)).toBe("20%");
  });

  it("an entry with no percentage at all renders no percentage badge", () => {
    renderHistory([{ version: 4, date: "2024-01-01", description: "Only a note" }]);
    expect(percentageOf(4)).toBeNull();
    expect(screen.getByTestId("history-v4").textContent).not.toContain("%");
    expect(screen.getByText("Only a note")).toBeTruthy();
  });
});
