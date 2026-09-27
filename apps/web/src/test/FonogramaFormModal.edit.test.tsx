// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./_helpers/render-with-providers";
import React from "react";

const { updatePhonogramMock, addPhonogramMock } = vi.hoisted(() => ({
  updatePhonogramMock: vi.fn().mockResolvedValue({}),
  addPhonogramMock: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/modules/catalog/hooks/useFonogramas", () => {
  const stableReturn = {
    phonograms: [] as any[],
    isLoading: false,
    error: null,
    addPhonogram: { mutateAsync: addPhonogramMock },
    updatePhonogram: { mutateAsync: updatePhonogramMock },
    deletePhonogram: { mutateAsync: vi.fn() },
  };
  return { usePhonograms: () => stableReturn };
});

vi.mock("@/modules/catalog/hooks/useObras", () => {
  const stableWorks = [
    {
      id: "obra-1",
      title: "Canção Vinculada",
      music_genre: "pop",
      compositores: ["Alice"],
      status: "registrado",
    },
  ];
  const stableReturn = {
    works: stableWorks,
    isLoading: false,
    error: null,
    addWork: { mutateAsync: vi.fn() },
    updateWork: { mutateAsync: vi.fn() },
    deleteWork: { mutateAsync: vi.fn() },
  };
  return { useWorks: () => stableReturn };
});

// Task J: the useArtistas() hook (capped at the tenant's first 50) is
// deliberately EMPTY here — if the performer resolution in selectObra
// (FonogramaFormModal.tsx) still depended on scanning that array, the test
// below would fail. The real resolution must come from storage.findById (GET
// /artists/:id), which works for any artist of the tenant.
vi.mock("@/modules/artist/hooks/useArtists", async () => {
  const actual = await vi.importActual<typeof import("@/modules/artist/hooks/useArtists")>(
    "@/modules/artist/hooks/useArtists",
  );
  return {
    ...actual,
    useArtists: () => ({
      artistas: [] as any[],
      isLoading: false,
      error: null,
      addArtista: { mutateAsync: vi.fn() },
      updateArtista: { mutateAsync: vi.fn() },
      deleteArtista: { mutateAsync: vi.fn() },
    }),
  };
});

vi.mock("@/shared/hooks/useCurrentOrgId", () => ({
  useCurrentOrgId: () => ({ orgId: "org-1", isLoading: false }),
}));

// Task I: FonogramaFormModal hydrates the linked work via useEntityById
// (a direct GET /works/:id), no longer scanning the useWorks() list — the
// fixture must come from storage.findById, not from the useWorks() mock above.
vi.mock("@/shared/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/storage")>("@/shared/lib/storage");
  return {
    ...actual,
    storage: {
      ...actual.storage,
      findById: vi.fn(async (table: string, id: string) => {
        if (table === "obras" && id === "obra-1") {
          return { id: "obra-1", title: "Canção Vinculada", music_genre: "pop", compositores: ["Alice"], status: "registrado" };
        }
        // Task J: an artist "outside the cap" — it would never be among the first 50
        // returned by an unfiltered useArtistas(); it is only reachable by a direct GET
        // /artists/:id (see selectObra in FonogramaFormModal.tsx).
        if (table === "artistas" && id === "art-99") {
          return { id: "art-99", nome_artistico: "Artista Fora Do Cap" };
        }
        return undefined;
      }),
      // Search result of the linkable work — used by the "Buscar
      // obra" popover (useEntityLookup inside FonogramaFormModal). A single
      // record whose artist is only resolvable via storage.findById above.
      listPaged: vi.fn(async (table: string) => {
        if (table === "obras") {
          return {
            items: [
              {
                id: "obra-99",
                title: "Obra Rara",
                music_genre: "pop",
                compositores: [],
                artist_id: "art-99",
              },
            ],
            page: 1,
            pageSize: 20,
            total: 1,
            totalPages: 1,
          };
        }
        return { items: [], page: 1, pageSize: 20, total: 0, totalPages: 1 };
      }),
    },
  };
});

vi.mock("@/modules/catalog/components/AbramusSearchRow", () => ({
  AbramusSearchRow: () => null,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { PhonogramFormModal } from "@/modules/catalog/components/FonogramaFormModal";

describe("FonogramaFormModal edit mode", () => {
  beforeEach(() => {
    updatePhonogramMock.mockClear();
    addPhonogramMock.mockClear();
  });

  const basePhonogram = {
    id: "fono-1",
    title: "Canção Vinculada",
    work_id: "obra-1",
    isrc: "BR-ABC-25-12345",
    duration_text: "04:20",
    gravadora: "Gravadora X",
    produtores: ["Pedro", "Marta"],
    status: "analise",
    org_id: "org-1",
  };

  it("pre-fills every field from the persisted fonograma row", async () => {
    renderWithProviders(
      <PhonogramFormModal
        open={true}
        onOpenChange={() => {}}
        mode="edit"
        fonograma={basePhonogram}
      />
    );

    // Linked obra is hydrated
    await waitFor(() => {
      expect(screen.getByTestId("text-obra-vinculada-title")).toHaveTextContent(
        "Canção Vinculada",
      );
    });

    // ISRC parts
    expect(screen.getByDisplayValue("BR")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ABC")).toBeInTheDocument();
    expect(screen.getByDisplayValue("25")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12345")).toBeInTheDocument();

    // Duration
    expect(screen.getByTestId("input-duracao-minutos")).toHaveValue("4");
    expect(screen.getByTestId("input-duracao-segundos")).toHaveValue("20");

    // Produtores carried over
    const nameInputs = screen
      .getAllByPlaceholderText("Nome do participante")
      .map((el) => (el as HTMLInputElement).value);
    expect(nameInputs).toEqual(expect.arrayContaining(["Pedro", "Marta"]));
  });

  it("saves edits via updatePhonogram with the right payload", async () => {
    renderWithProviders(
      <PhonogramFormModal
        open={true}
        onOpenChange={vi.fn()}
        mode="edit"
        fonograma={basePhonogram}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("text-obra-vinculada-title")).toBeInTheDocument();
    });

    // Edit ISRC designacao
    const designacao = screen.getByDisplayValue("12345") as HTMLInputElement;
    fireEvent.change(designacao, { target: { value: "99999" } });

    // Accept terms
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[checkboxes.length - 1]);

    fireEvent.click(screen.getByTestId("button-submit-fonograma"));

    await waitFor(() => {
      expect(updatePhonogramMock).toHaveBeenCalledTimes(1);
    });

    const callArg = updatePhonogramMock.mock.calls[0][0];
    expect(callArg.id).toBe("fono-1");
    expect(callArg.work_id).toBe("obra-1");
    expect(callArg.isrc).toBe("BR-ABC-25-99999");
    expect(callArg.duration_text).toBe("04:20");
    // The merged form persists Gravadora X via the agregadora field (mapped from gravadora)
    expect(callArg.agregadora).toBe("Gravadora X");
    // Produtores from the legacy column survive the round-trip via the participacao JSON
    const producerNames = (callArg.participacao?.produtorFonografico ?? []).map(
      (p: { name: string }) => p.name,
    );
    expect(producerNames).toEqual(expect.arrayContaining(["Pedro", "Marta"]));
    expect(callArg.status).toBe("under_review");
    // Tenant isolation: org_id/orgId must NEVER be part of the payload the
    // frontend sends — the API derives the tenant from the authenticated
    // request context (see registro-musicas.mapper.ts). A client-supplied
    // org_id would be a tenant-spoofing vector; this assertion is a
    // regression guard against that ever being reintroduced.
    expect(callArg.org_id).toBeUndefined();
    expect(callArg.orgId).toBeUndefined();
  });

  // Task J — Lookup Gap Zero: proves that the performer resolution chain
  // inside selectObra (when linking a work in the Phonogram form)
  // uses a real search/lookup by ID instead of scanning the capped array of
  // useArtistas(). The useArtistas() mock above returns an empty list —
  // if the code regressed to `artistas.find(...)`, the performer would never
  // be filled.
  it("resolves the interprete's artist name via storage.findById, not from the capped artistas list", async () => {
    renderWithProviders(
      <PhonogramFormModal
        open={true}
        onOpenChange={() => {}}
        mode="create"
      />
    );

    fireEvent.click(screen.getByTestId("button-buscar-obra"));

    const option = await screen.findByTestId("option-obra-obra-99");
    fireEvent.click(option);

    await waitFor(() => {
      const nameInputs = screen
        .getAllByPlaceholderText("Nome do participante")
        .map((el) => (el as HTMLInputElement).value);
      expect(nameInputs).toContain("Artista Fora Do Cap");
    });
  });
});
