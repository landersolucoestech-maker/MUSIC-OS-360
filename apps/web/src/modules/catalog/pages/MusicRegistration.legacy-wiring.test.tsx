// @ts-nocheck
// Opening "new work" for a project (?newWork=:id) seeds the work form through projectToWorkSeed:
// legacy track values (language slug, instrumental "sim") are mapped to the canonical seed.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import React from "react";

const { project } = vi.hoisted(() => ({ project: { value: null as unknown } }));

const emptyStats = { total: 0, byGroup: {} };
vi.mock("@/modules/catalog/hooks/useWorks", () => ({
  useWorks: () => ({ works: [], isLoading: false, deleteWork: { mutate: vi.fn(), mutateAsync: vi.fn() }, addWork: { mutateAsync: vi.fn() } }),
}));
vi.mock("@/modules/catalog/hooks/usePhonograms", () => ({
  usePhonograms: () => ({ phonograms: [], isLoading: false, deletePhonogram: { mutate: vi.fn(), mutateAsync: vi.fn() }, addPhonogram: { mutateAsync: vi.fn() } }),
}));
vi.mock("@/modules/catalog/hooks/useCatalogPaginated", () => ({
  useWorksPaginated: () => ({ works: [], total: 0, isLoading: false, error: null, refetch: vi.fn() }),
  useWorksStats: () => ({ stats: emptyStats }),
  useWorksGenres: () => ({ genres: [] }),
  usePhonogramsPaginated: () => ({ phonograms: [], total: 0, isLoading: false, error: null, refetch: vi.fn() }),
  usePhonogramsStats: () => ({ stats: emptyStats }),
  usePhonogramsGenres: () => ({ genres: [] }),
}));
vi.mock("@/modules/projects/hooks/useProjects", () => ({ useProjects: () => ({ projects: [] }) }));
vi.mock("@/modules/artist/hooks/useSignedArtists", () => ({ useSignedArtists: () => ({ artists: [] }) }));
vi.mock("@/shared/hooks/useEntityLookup", () => ({
  useEntityById: () => ({ entity: undefined, isLoading: false }),
  useEntityLookup: () => ({ items: [], isLoading: false }),
}));
vi.mock("@/shared/lib/storage", async () => {
  const actual = await vi.importActual("@/shared/lib/storage");
  return { ...actual, storage: { ...actual.storage, findById: vi.fn(async () => project.value) } };
});
vi.mock("@/shared/components/MainLayout", () => ({ MainLayout: ({ children }) => <div>{children}</div> }));
vi.mock("@/shared/components/RequirePermission", () => ({ RequirePermission: ({ children }) => <>{children}</> }));
vi.mock("@/modules/catalog/components/WorkFormModal", () => ({
  WorkFormModal: (props) => (
    <div data-testid="work-form-probe" data-open={String(props.open)} data-origin={props.workOrigin ?? ""}>
      {props.open ? JSON.stringify(props.work ?? null) : ""}
    </div>
  ),
}));
vi.mock("@/modules/catalog/components/WorkViewModal", () => ({ WorkViewModal: () => null }));
vi.mock("@/modules/catalog/components/PhonogramFormModal", () => ({ PhonogramFormModal: () => null }));
vi.mock("@/modules/catalog/components/PhonogramViewModal", () => ({ PhonogramViewModal: () => null }));
vi.mock("@/modules/contracts/components/ContractFormModal", () => ({ ContractFormModal: () => null }));
vi.mock("@/shared/components/DeleteConfirmModal", () => ({ DeleteConfirmModal: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));

import MusicRegistry from "@/modules/catalog/pages/MusicRegistration";

async function openNewWorkForProject() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={["/music-registration?newWork=proj-1"]}>
        <MusicRegistry />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  fireEvent.click(await screen.findByTestId("button-work-origin-original"));
  await waitFor(() => expect(screen.getByTestId("work-form-probe")).toHaveAttribute("data-open", "true"));
  return JSON.parse(screen.getByTestId("work-form-probe").textContent as string);
}

describe("MusicRegistration seeds a new work from a project through projectToWorkSeed", () => {
  beforeEach(() => { project.value = null; });

  it("maps a track with a legacy language slug and instrumental 'sim' to the canonical seed", async () => {
    project.value = {
      id: "proj-1",
      title: "Projeto Titulo",
      artist_id: "art-9",
      music_genre: "ROCK",
      tracks: [
        { name: "  Faixa Um ", genre: "POP", language: "portugues", instrumental: "sim", durationMinutes: "3", durationSeconds: "7", composers: [" Compositor A ", ""], lyrics: "la la" },
        { name: "Faixa Dois" },
      ],
    };
    const seed = await openNewWorkForProject();
    expect(seed).toEqual({
      project_id: "proj-1",
      artist_id: "art-9",
      title: "Faixa Um",
      music_genre: "pop",
      language: "pt",
      duration_text: "03:07",
      is_instrumental: true,
      participants: [expect.objectContaining({ name: "Compositor A", role: "composer_author", link: null, percentage: null })],
      lyrics: "la la",
    });
    expect(screen.getByTestId("work-form-probe")).toHaveAttribute("data-origin", "original");
  });

  it("negative: a project without tracks seeds from the project (no raw project fields leak)", async () => {
    project.value = { id: "proj-1", title: " Titulo do Projeto ", artist_id: null, music_genre: "Samba", tracks: [] };
    const seed = await openNewWorkForProject();
    expect(seed).toEqual({
      project_id: "proj-1",
      artist_id: null,
      title: "Titulo do Projeto",
      music_genre: "samba",
      language: null,
      duration_text: null,
      is_instrumental: false,
      participants: null,
      lyrics: null,
    });
  });

  it("negative: a project that cannot be loaded seeds only the project id", async () => {
    project.value = null;
    const seed = await openNewWorkForProject();
    expect(seed).toEqual({ project_id: "proj-1" });
  });
});
