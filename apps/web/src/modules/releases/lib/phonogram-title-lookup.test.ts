import { describe, expect, it, vi, beforeEach } from "vitest";

const listPaged = vi.fn();
vi.mock("@/shared/lib/storage", () => ({ storage: { listPaged: (...a: unknown[]) => listPaged(...a) } }));

import { findPhonogramByTitle } from "@/modules/releases/lib/phonogram-title-lookup";
import { formatGenres, genreLabel } from "@/modules/releases/lib/genre-match";

describe("findPhonogramByTitle", () => {
  beforeEach(() => listPaged.mockReset());

  it("returns undefined without querying for a blank title", async () => {
    expect(await findPhonogramByTitle("   ")).toBeUndefined();
    expect(listPaged).not.toHaveBeenCalled();
  });

  it("normalizes the REQUESTED title (case, accents, spaces) before comparing", async () => {
    listPaged.mockResolvedValue({ items: [{ id: "a", title: "outra cancao" }, { id: "b", title: "cancao nova" }] });
    const found = await findPhonogramByTitle("  CANÇÃO Nova ");
    expect(found?.id).toBe("b");
    expect(listPaged).toHaveBeenCalledWith("phonograms", { page: 1, pageSize: 5, filters: { search: "  CANÇÃO Nova " } });
  });

  it("normalizes the STORED title (case, accents, spaces) before comparing", async () => {
    listPaged.mockResolvedValue({ items: [{ id: "a", title: "Outra Canção" }, { id: "b", title: "  CANÇÃO Nova " }] });
    expect((await findPhonogramByTitle("cancao nova"))?.id).toBe("b");
  });

  it("does not return a phonogram whose normalized title differs (substring is not a match)", async () => {
    listPaged.mockResolvedValue({ items: [{ id: "a", title: "Canção Nova Edição" }, { id: "c" }] });
    expect(await findPhonogramByTitle("Canção Nova")).toBeUndefined();
  });
});

describe("formatGenres (release review step)", () => {
  it("joins the labels of the primary and secondary genre and falls back to a dash", () => {
    expect(formatGenres("", "")).toBe("—");
    const primary = genreLabel("rock");
    expect(primary).not.toBe("");
    expect(formatGenres("rock", "")).toBe(primary);
    expect(formatGenres("rock", "pop")).toBe(`${primary}, ${genreLabel("pop")}`);
  });

  it("keeps free text that is not a known genre slug and never resolves inherited members", () => {
    expect(formatGenres("Custom Genre", "")).toBe("Custom Genre");
    expect(formatGenres("constructor", "")).toBe("constructor");
  });
});
