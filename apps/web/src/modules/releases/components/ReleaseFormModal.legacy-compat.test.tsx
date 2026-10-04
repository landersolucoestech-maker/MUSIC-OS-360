import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const project = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("@/shared/hooks/useEntityLookup", () => ({
  useEntityLookup: ({ table }: { table: string }) => ({ items: table === "projects" ? [project.current] : [] }),
  useEntityById: () => ({ entity: undefined }),
}));
vi.mock("@/shared/lib/storage", () => ({
  storage: {
    findById: vi.fn().mockResolvedValue(undefined),
    listPaged: vi.fn().mockResolvedValue({ items: [] }),
  },
}));
vi.mock("@/modules/releases/hooks/useReleases", () => ({
  useReleases: () => ({ addRelease: vi.fn(), updateRelease: vi.fn() }),
}));
vi.mock("@/shared/hooks/useUploadToR2", () => ({
  useUploadToR2: () => ({ upload: vi.fn(), isUploading: false }),
  R2NotConfiguredError: class extends Error {},
}));
vi.mock("@/modules/releases/hooks/useDistributionPlatforms", () => ({
  useDistributionPlatforms: () => ({ enabledPlatforms: [], hasAnyConnected: false }),
}));
vi.mock("@/shared/components/StoredFileLink", () => ({ StoredFileLink: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import { ReleaseFormModal } from "./ReleaseFormModal";

async function selectProject(proj: Record<string, unknown>) {
  project.current = proj;
  render(<ReleaseFormModal open onOpenChange={() => undefined} mode="create" />);
  fireEvent.focus(screen.getByTestId("input-search-project"));
  fireEvent.click(await screen.findByTestId(`option-project-${proj.id}`));
}

beforeEach(() => vi.clearAllMocks());

describe("ReleaseFormModal project seed: genre alias", () => {
  it.each([
    ["eletronico"],
    ["electronico"],
    ["eletronica"],
  ])("project genre %s pre-selects the canonical Eletrônica option", async (genre) => {
    await selectProject({ id: "p1", title: "Proj", artist_id: "a1", music_genre: genre, type: "single" });
    await waitFor(() => expect(screen.getByTestId("select-genre").textContent).toContain("Eletrônica"));
  });
});

describe("ReleaseFormModal project seed: legacy track JSON keys in projects.description", () => {
  it("maps produtores and letra to the canonical track producers and lyrics", async () => {
    const description = JSON.stringify([{ nome: "Faixa Um", compositores: ["Comp"], produtores: ["Bob Producer"], letra: "texto da letra legado" }]);
    await selectProject({ id: "p2", title: "Proj", artist_id: "a1", music_genre: "pop", type: "single", description });
    // The seed is applied asynchronously; the title field confirms it landed before navigating on.
    await waitFor(() => expect(screen.getByDisplayValue("Proj")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Envio de faixas" }));
    expect(await screen.findByDisplayValue("Bob Producer")).toBeTruthy();
    expect(screen.getByDisplayValue("texto da letra legado")).toBeTruthy();
    // `nome` seeds the canonical track title and `compositores` the canonical composers.
    expect(screen.getByDisplayValue("Faixa Um")).toBeTruthy();
    expect(screen.getByDisplayValue("Comp")).toBeTruthy();
  });
});

describe("ReleaseFormModal project seed: hydrated project.tracks (canonical source)", () => {
  it("pre-fills the release tracks from project.tracks even when description is free text", async () => {
    await selectProject({
      id: "p3", title: "Proj", artist_id: "a1", music_genre: "pop", type: "single",
      description: "texto livre, não é JSON",
      tracks: [{ name: "Faixa Canônica", composers: ["Comp Canon"], producers: ["Prod Canon"], lyrics: "letra canônica" }],
    });
    await waitFor(() => expect(screen.getByDisplayValue("Proj")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Envio de faixas" }));
    expect(await screen.findByDisplayValue("Faixa Canônica")).toBeTruthy();
    expect(screen.getByDisplayValue("Comp Canon")).toBeTruthy();
    expect(screen.getByDisplayValue("Prod Canon")).toBeTruthy();
    expect(screen.getByDisplayValue("letra canônica")).toBeTruthy();
  });
});
