/**
 * Compat wiring: ProjectFormModal canonicalizes the stored (legacy) track tokens when loading a
 * project (instrumental sim/nao -> yes/no, language slug -> ISO code), so what it writes back is
 * canonical. Observed through the real submit payload.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const addMutate = vi.fn();
const updateMutate = vi.fn();

vi.mock("@/modules/projects/hooks/useProjects", () => ({
  useProjects: () => ({
    addProject: { mutateAsync: addMutate },
    updateProject: { mutateAsync: updateMutate },
  }),
}));
vi.mock("@/shared/hooks/useUploadToR2", () => ({
  useUploadToR2: () => ({ upload: vi.fn() }),
  R2NotConfiguredError: class extends Error {},
}));
vi.mock("@/shared/hooks/useEntityLookup", () => ({
  useEntityLookup: () => ({ items: [] }),
  useEntityById: () => ({ entity: undefined }),
}));
vi.mock("@/shared/components/AsyncEntityCombobox", () => ({
  AsyncEntityCombobox: () => null,
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { ProjectFormModal } from "./ProjectFormModal";

async function savedTracks(tracks: Record<string, unknown>[]) {
  const project = {
    id: "p1", title: "Faixa", type: "single", status: "planning", updated_at: "2026-09-01T00:00:00Z",
    tracks,
  };
  render(<ProjectFormModal open onOpenChange={() => {}} mode="edit" project={project} />);
  fireEvent.click(screen.getByRole("button", { name: /^salvar$/i }));
  await waitFor(() => expect(updateMutate).toHaveBeenCalledTimes(1));
  return updateMutate.mock.calls[0][0].tracks as Array<Record<string, string>>;
}

describe("ProjectFormModal loads legacy track tokens as canonical values", () => {
  beforeEach(() => {
    addMutate.mockReset().mockResolvedValue({ id: "p-new" });
    updateMutate.mockReset().mockResolvedValue({});
  });

  it.each([
    ["sim", "yes"],
    ["Sim", "yes"],
    ["nao", "no"],
    ["não", "no"],
  ])("legacy instrumental %j is resubmitted as %s", async (legacy, canonical) => {
    const tracks = await savedTracks([{ id: "t1", name: "Faixa", instrumental: legacy }]);
    expect(tracks[0].instrumental).toBe(canonical);
  });

  it.each([
    ["portugues", "pt"],
    ["ingles", "en"],
  ])("legacy language slug %j is resubmitted as ISO code %s", async (legacy, code) => {
    const tracks = await savedTracks([{ id: "t1", name: "Faixa", language: legacy }]);
    expect(tracks[0].language).toBe(code);
  });

  it("negative: canonical values, free text and absent values are not rewritten into something else", async () => {
    const tracks = await savedTracks([
      { id: "t1", name: "A", instrumental: "yes", language: "en" },
      { id: "t2", name: "B", language: "Klingon" },
      { id: "t3", name: "C" },
    ]);
    expect(tracks[0]).toMatchObject({ instrumental: "yes", language: "en" });
    expect(tracks[1].language).toBe("klingon");
    expect(tracks[2]).toMatchObject({ instrumental: "no", language: "" });
  });
});
