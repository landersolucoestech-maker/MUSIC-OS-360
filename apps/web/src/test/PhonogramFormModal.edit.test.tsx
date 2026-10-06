// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./_helpers/render-with-providers";
import React from "react";

const { updatePhonogramMock, addPhonogramMock } = vi.hoisted(() => ({
  updatePhonogramMock: vi.fn().mockResolvedValue({}),
  addPhonogramMock: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/modules/catalog/hooks/usePhonograms", () => {
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

vi.mock("@/modules/catalog/hooks/useWorks", () => {
  const stableWorks = [
    {
      id: "obra-1",
      title: "Canção Vinculada",
      music_genre: "pop",
      composer_names: ["Alice"],
      status: "registered",
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

// Task J: the useArtists() hook (capped at the tenant's first 50) is
// deliberately EMPTY here — if the performer resolution in selectObra
// (PhonogramFormModal.tsx) still depended on scanning that array, the test
// below would fail. The real resolution must come from storage.findById (GET
// /artists/:id), which works for any artist of the tenant.
vi.mock("@/modules/artist/hooks/useArtists", async () => {
  const actual = await vi.importActual<typeof import("@/modules/artist/hooks/useArtists")>(
    "@/modules/artist/hooks/useArtists",
  );
  return {
    ...actual,
    useArtists: () => ({
      artists: [] as any[],
      isLoading: false,
      error: null,
      addArtist: { mutateAsync: vi.fn() },
      updateArtist: { mutateAsync: vi.fn() },
      deleteArtist: { mutateAsync: vi.fn() },
    }),
  };
});

vi.mock("@/shared/hooks/useCurrentOrgId", () => ({
  useCurrentOrgId: () => ({ orgId: "org-1", isLoading: false }),
}));

// Task I: PhonogramFormModal hydrates the linked work via useEntityById
// (a direct GET /works/:id), no longer scanning the useWorks() list — the
// fixture must come from storage.findById, not from the useWorks() mock above.
vi.mock("@/shared/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/storage")>("@/shared/lib/storage");
  return {
    ...actual,
    storage: {
      ...actual.storage,
      findById: vi.fn(async (table: string, id: string) => {
        if (table === "works" && id === "obra-1") {
          return { id: "obra-1", title: "Canção Vinculada", music_genre: "pop", composer_names: ["Alice"], status: "registered" };
        }
        // Task J: an artist "outside the cap" — it would never be among the first 50
        // returned by an unfiltered useArtists(); it is only reachable by a direct GET
        // /artists/:id (see selectObra in PhonogramFormModal.tsx).
        if (table === "artists" && id === "art-99") {
          return { id: "art-99", stage_name: "Artista Fora Do Cap" };
        }
        return undefined;
      }),
      // Search result of the linkable work — used by the "Buscar
      // obra" popover (useEntityLookup inside PhonogramFormModal). A single
      // record whose artist is only resolvable via storage.findById above.
      listPaged: vi.fn(async (table: string) => {
        if (table === "works") {
          return {
            items: [
              {
                id: "obra-99",
                title: "Obra Rara",
                music_genre: "pop",
                composer_names: [],
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

import { PhonogramFormModal } from "@/modules/catalog/components/PhonogramFormModal";

describe("PhonogramFormModal edit mode", () => {
  beforeEach(() => {
    updatePhonogramMock.mockClear();
    addPhonogramMock.mockClear();
  });

  const basePhonogram = {
    id: "fono-1",
    title: "Canção Vinculada",
    work_id: "obra-1",
    isrc: "BR-ABC-25-12345",
    duration_seconds: 260,
    record_label_name: "Gravadora X",
    aggregator: "distrokid",
    media_type: "physical",
    recording_classification: "live",
    country_of_recording: "BR",
    publication_country: "ZZ",
    recording_date: "2025-12-01T00:00:00.000Z",
    participation: {
      phonographic_producers: [
        { id: "pp-1", name: "Pedro", percentage: "20" },
        { id: "pp-2", name: "Marta", percentage: "21.7" },
      ],
      performers: [],
      session_musicians: [],
    },
    status: "under_review",
    // Pre-CZ-040 Portuguese fields must be ignored (no fallback reads).
    gravadora: "Legado",
    cod_ecad: "LEGACY-ECAD",
    duracao_min: 9,
    duracao_seg: 9,
  };

  it("pre-fills every field from the persisted fonograma row", async () => {
    renderWithProviders(
      <PhonogramFormModal
        open={true}
        onOpenChange={() => {}}
        mode="edit"
        phonogram={basePhonogram}
      />
    );

    // Linked obra is hydrated
    let linkedWorkTitle: HTMLElement | undefined;
    await waitFor(() => {
      linkedWorkTitle = screen.getByTestId("text-linked-work-title");
      expect(linkedWorkTitle).toHaveTextContent("Canção Vinculada");
    });
    // Composers of the linked work come from its canonical `composer_names` (CZ-039)
    expect(linkedWorkTitle?.parentElement).toHaveTextContent("Alice");

    // ISRC parts
    expect(screen.getByDisplayValue("BR")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ABC")).toBeInTheDocument();
    expect(screen.getByDisplayValue("25")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12345")).toBeInTheDocument();

    // Duration
    expect(screen.getByTestId("input-duration-minutes")).toHaveValue("4");
    expect(screen.getByTestId("input-duration-seconds")).toHaveValue("20");

    // The legacy cod_ecad is not read
    expect(screen.getByTestId("input-ecad-code")).toHaveValue("");

    // Phonographic producers read from the canonical participation
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
        phonogram={basePhonogram}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("text-linked-work-title")).toBeInTheDocument();
    });

    // Edit ISRC designationInput
    const designationInput = screen.getByDisplayValue("12345") as HTMLInputElement;
    fireEvent.change(designationInput, { target: { value: "99999" } });

    // Accept terms
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[checkboxes.length - 1]);

    fireEvent.click(screen.getByTestId("button-submit-phonogram"));

    await waitFor(() => {
      expect(updatePhonogramMock).toHaveBeenCalledTimes(1);
    });

    const callArg = updatePhonogramMock.mock.calls[0][0];
    expect(callArg.id).toBe("fono-1");
    expect(callArg.work_id).toBe("obra-1");
    expect(callArg.isrc).toBe("BR-ABC-25-99999");
    expect(callArg.duration_seconds).toBe(260);
    expect(callArg.duration_text).toBe("04:20");
    expect(callArg.record_label_name).toBe("Gravadora X");
    expect(callArg.aggregator).toBe("distrokid");
    expect(callArg.media_type).toBe("physical");
    expect(callArg.recording_classification).toBe("live");
    expect(callArg.country_of_recording).toBe("BR");
    expect(callArg.publication_country).toBe("ZZ");
    expect(callArg.recording_date).toBe("2025-12-01");
    // Participation round-trips with the canonical category and item keys
    expect(callArg.participation.phonographic_producers).toEqual([
      { id: "pp-1", name: "Pedro", percentage: "20" },
      { id: "pp-2", name: "Marta", percentage: "21.7" },
    ]);
    expect(callArg.status).toBe("under_review");
    // CZ-040: no pre-CZ-040 Portuguese key is ever sent
    for (const legacy of [
      "gravadora", "cod_ecad", "cod_entidade", "agregadora", "isrc_pais", "isrc_registrante", "isrc_ano",
      "isrc_designacao", "criada_por_ia", "nacional", "pub_simultanea", "emissao", "midia", "classificacao",
      "pais_publicacao", "pais_origem", "participacao", "arquivo_audio", "gravacao_original",
      "data_lancamento", "duracao_min", "duracao_seg",
    ]) {
      expect(callArg).not.toHaveProperty(legacy);
    }
    // Tenant isolation: org_id/orgId must NEVER be part of the payload the
    // frontend sends — the API derives the tenant from the authenticated
    // request context (see music-registration.mapper.ts). A client-supplied
    // org_id would be a tenant-spoofing vector; this assertion is a
    // regression guard against that ever being reintroduced.
    expect(callArg.org_id).toBeUndefined();
    expect(callArg.orgId).toBeUndefined();
  });

  // Task J — Lookup Gap Zero: proves that the performer resolution chain
  // inside selectObra (when linking a work in the Phonogram form)
  // uses a real search/lookup by ID instead of scanning the capped array of
  // useArtists(). The useArtists() mock above returns an empty list —
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

    fireEvent.click(screen.getByTestId("button-search-work"));

    const option = await screen.findByTestId("option-work-obra-99");
    fireEvent.click(option);

    await waitFor(() => {
      const nameInputs = screen
        .getAllByPlaceholderText("Nome do participante")
        .map((el) => (el as HTMLInputElement).value);
      expect(nameInputs).toContain("Artista Fora Do Cap");
    });
  });
});
