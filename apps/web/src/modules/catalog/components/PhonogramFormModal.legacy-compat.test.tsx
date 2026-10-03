// @ts-nocheck
// Legacy project track JSON (projects.description: [{ nome, produtores }]) is still READ
// when a work is linked, and resolves to canonical session_musicians participants.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { renderWithProviders } from "@/test/_helpers/render-with-providers";

const { projectDescription, projectTracks } = vi.hoisted(() => ({ projectDescription: { value: "" }, projectTracks: { value: undefined as unknown } }));

vi.mock("@/modules/catalog/hooks/usePhonograms", () => {
  const stableReturn = {
    phonograms: [],
    isLoading: false,
    error: null,
    addPhonogram: { mutateAsync: vi.fn() },
    updatePhonogram: { mutateAsync: vi.fn() },
    deletePhonogram: { mutateAsync: vi.fn() },
  };
  return { usePhonograms: () => stableReturn };
});
vi.mock("@/modules/catalog/hooks/useWorks", () => {
  const stableReturn = {
    works: [], isLoading: false, error: null,
    addWork: { mutateAsync: vi.fn() }, updateWork: { mutateAsync: vi.fn() }, deleteWork: { mutateAsync: vi.fn() },
  };
  return { useWorks: () => stableReturn };
});
vi.mock("@/modules/artist/hooks/useArtists", async () => {
  const actual = await vi.importActual("@/modules/artist/hooks/useArtists");
  return {
    ...actual,
    useArtists: () => ({
      artists: [], isLoading: false, error: null,
      addArtist: { mutateAsync: vi.fn() }, updateArtist: { mutateAsync: vi.fn() }, deleteArtist: { mutateAsync: vi.fn() },
    }),
  };
});
vi.mock("@/shared/hooks/useCurrentOrgId", () => ({ useCurrentOrgId: () => ({ orgId: "org-1", isLoading: false }) }));
vi.mock("@/shared/lib/storage", async () => {
  const actual = await vi.importActual("@/shared/lib/storage");
  return {
    ...actual,
    storage: {
      ...actual.storage,
      findById: vi.fn(async (table: string, id: string) => {
        if (table === "projects" && id === "proj-1") return { id: "proj-1", description: projectDescription.value, tracks: projectTracks.value };
        return undefined;
      }),
      listPaged: vi.fn(async (table: string) => {
        if (table === "works") {
          return {
            items: [{ id: "obra-7", title: "Canção Sétima", music_genre: "pop", composer_names: [], project_id: "proj-1" }],
            page: 1, pageSize: 20, total: 1, totalPages: 1,
          };
        }
        return { items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 };
      }),
    },
  };
});
vi.mock("@/modules/catalog/components/AbramusSearchRow", () => ({ AbramusSearchRow: () => null }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { PhonogramFormModal } from "@/modules/catalog/components/PhonogramFormModal";

// [legacy track JSON stored in projects.description, participant names expected under session musicians]
const LEGACY_TRACK_JSON: ReadonlyArray<readonly [string, unknown, string[]]> = [
  ["exact title", [{ nome: "Canção Sétima", produtores: ["Beto Legado", "Carla Legada"] }], ["Beto Legado", "Carla Legada"]],
  ["accent/case-insensitive title", [{ nome: "cancao setima", produtores: ["Dora Legada"] }], ["Dora Legada"]],
  ["picks the matching track only", [{ nome: "Outra", produtores: ["Fora"] }, { nome: "Canção Sétima", produtores: ["Eli Legado"] }], ["Eli Legado"]],
  ["no matching track", [{ nome: "Outra", produtores: ["Fora"] }], []],
];

async function linkWork() {
  renderWithProviders(<PhonogramFormModal open={true} onOpenChange={() => {}} mode="create" />);
  fireEvent.click(screen.getByTestId("button-search-work"));
  fireEvent.click(await screen.findByTestId("option-work-obra-7"));
  await waitFor(() => expect(screen.getByTestId("text-linked-work-title")).toHaveTextContent("Canção Sétima"));
}

const participantNames = () =>
  screen.queryAllByPlaceholderText("Nome do participante").map((el) => (el as HTMLInputElement).value).filter(Boolean);

describe("PhonogramFormModal legacy project track JSON (nome/produtores) read-compat", () => {
  beforeEach(() => { projectDescription.value = ""; projectTracks.value = undefined; });

  it.each(LEGACY_TRACK_JSON)("%s", async (_label, tracks, expectedNames) => {
    projectDescription.value = JSON.stringify(tracks);
    await linkWork();
    if (expectedNames.length > 0) {
      await waitFor(() => expect(participantNames()).toEqual(expect.arrayContaining(expectedNames)));
    } else {
      // give the async resolution a chance to (wrongly) populate
      await new Promise((r) => setTimeout(r, 50));
      expect(participantNames()).toEqual([]);
    }
    for (const track of tracks) {
      if (track.nome !== "Canção Sétima" && track.nome !== "cancao setima") {
        for (const name of track.produtores) expect(participantNames()).not.toContain(name);
      }
    }
  });

  it("canonical project tracks (API `tracks[].name/producers`) resolve to session musicians, and win over the legacy description", async () => {
    projectTracks.value = [{ name: "Canção Sétima", producers: ["Gil Canônico"] }, { name: "Outra", producers: ["Fora"] }];
    projectDescription.value = JSON.stringify([{ nome: "Canção Sétima", produtores: ["Beto Legado"] }]);
    await linkWork();
    await waitFor(() => expect(participantNames()).toEqual(expect.arrayContaining(["Gil Canônico"])));
    expect(participantNames()).not.toContain("Beto Legado");
    expect(participantNames()).not.toContain("Fora");
  });

  it("invalid JSON in the legacy description leaves participants blank without breaking the link", async () => {
    projectDescription.value = "{not json";
    await linkWork();
    expect(participantNames()).toEqual([]);
  });
});
