// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./_helpers/render-with-providers";
import React from "react";

// Mocks must be declared before importing the component.
const { updateWorkMock, addWorkMock, toastErrorMock } = vi.hoisted(() => ({
  updateWorkMock: vi.fn().mockResolvedValue({}),
  addWorkMock: vi.fn().mockResolvedValue({}),
  toastErrorMock: vi.fn(),
}));

vi.mock("@/modules/catalog/hooks/useWorks", () => {
  const stableReturn = {
    works: [] as any[],
    isLoading: false,
    error: null,
    addWork: { mutateAsync: addWorkMock },
    updateWork: { mutateAsync: updateWorkMock },
    deleteWork: { mutateAsync: vi.fn() },
  };
  return { useWorks: () => stableReturn };
});

vi.mock("@/modules/artist/hooks/useSignedArtists", () => {
  const stableReturn = { artistas: [] as any[], isLoading: false, error: null };
  return { useSignedArtists: () => stableReturn };
});

// Task J: the useArtistas() hook (capped at the tenant's first 50) is
// deliberately EMPTY — if the artist resolution inside selectProjeto
// (WorkFormModal.tsx) still depended on scanning that array, the test
// "resolves the linked project's artist..." below would fail.
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

// WorkFormModal.tsx no longer uses useProjetos() (Task J) — the
// "Vincular a Projeto Concluído" picker and the resolution of the project's linked artist now
// go through storage.listPaged/findById directly.
vi.mock("@/shared/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/storage")>("@/shared/lib/storage");
  return {
    ...actual,
    storage: {
      ...actual.storage,
      findById: vi.fn(async (table: string, id: string) => {
        // Task J: an artist "outside the cap" — only reachable by a direct GET /artists/:id
        // (it would never be among the first 50 of useArtistas()).
        if (table === "artistas" && id === "art-99") {
          return { id: "art-99", nome_artistico: "Artista Fora Do Cap" };
        }
        return undefined;
      }),
      listPaged: vi.fn(async (table: string) => {
        if (table === "projects") {
          return {
            items: [
              { id: "projeto-99", title: "Projeto Raro", status: "concluido", artist_id: "art-99" },
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

vi.mock("@/shared/hooks/useCurrentOrgId", () => ({
  useCurrentOrgId: () => ({ orgId: "org-1", isLoading: false }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: toastErrorMock,
  },
}));

import { WorkFormModal } from "@/modules/catalog/components/WorkFormModal";

describe("WorkFormModal edit mode", () => {
  beforeEach(() => {
    updateWorkMock.mockClear();
    addWorkMock.mockClear();
    toastErrorMock.mockClear();
  });

  const baseWork = {
    id: "obra-1",
    title: "Canção Original",
    music_genre: "pop",
    iswc: "T-123.456.789-0",
    duration_text: "03:45",
    status: "analise",
    compositores: ["Alice", "Bob"],
    letristas: ["Carol"],
    project_id: null,
    org_id: "org-1",
  };

  it("pre-fills every field from the persisted obra row", () => {
    renderWithProviders(
      <WorkFormModal
        open={true}
        onOpenChange={() => {}}
        mode="edit"
        obra={baseWork}
      />
    );

    // Title hydrated from title
    const titleInput = screen.getByDisplayValue("Canção Original");
    expect(titleInput).toBeInTheDocument();

    // ISWC
    expect(screen.getByDisplayValue("T-123.456.789-0")).toBeInTheDocument();

    // Duration: 3 min and 45 sec
    expect(screen.getByTestId("input-duracao-minutos")).toHaveValue("3");
    expect(screen.getByTestId("input-duracao-segundos")).toHaveValue("45");

    // Participantes from compositores + letristas
    const nameInputs = screen
      .getAllByPlaceholderText("Nome do participante")
      .map((el) => (el as HTMLInputElement).value);
    expect(nameInputs).toEqual(expect.arrayContaining(["Alice", "Bob", "Carol"]));
  });

  it("saves edits via updateWork with normalized payload", async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <WorkFormModal
        open={true}
        onOpenChange={onOpenChange}
        mode="edit"
        obra={baseWork}
      />
    );

    // Edit the title
    const titleInput = screen.getByDisplayValue("Canção Original") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "Canção Editada" } });

    // Accept terms (required)
    const termosCheckbox = document.querySelector("#termos");
    expect(termosCheckbox).toBeInTheDocument();
    fireEvent.click(termosCheckbox!);

    // Submit form
    const saveButton = screen.getByTestId("button-submit-obra");
    await act(async () => {
      fireEvent.submit(saveButton.closest("form")!);
    });

    expect(toastErrorMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(updateWorkMock).toHaveBeenCalledTimes(1);
    });

    const callArg = updateWorkMock.mock.calls[0][0];
    expect(callArg.id).toBe("obra-1");
    expect(callArg.title).toBe("Canção Editada");
    // Status round-trips back to DB form
    expect(callArg.status).toBe("under_review");
    // Duration text stays MM:SS
    expect(callArg.duration_text).toBe("03:45");
    // Compositores/letristas preserved
    expect(callArg.compositores).toEqual(["Alice", "Bob"]);
    expect(callArg.letristas).toEqual(["Carol"]);
    expect(callArg.iswc).toBe("T-123.456.789-0");
    // Tenant isolation: org_id/orgId must NEVER be part of the payload the
    // frontend sends — the API derives the tenant from the authenticated
    // request context (see music-registration.mapper.ts::formToObraPayload).
    // A client-supplied org_id would be a tenant-spoofing vector; this
    // assertion is a regression guard against that ever being reintroduced.
    expect(callArg.org_id).toBeUndefined();
    expect(callArg.orgId).toBeUndefined();
    expect(callArg.music_genre).toBe("pop");
  });

  // Task J — Lookup Gap Zero: proves that the
  // "Vincular a Projeto Concluído" picker searches via storage.listPaged (server-side) and that the autofill of the
  // linked project's artist resolves via storage.findById by direct ID,
  // never scanning the capped array of useArtistas() (mocked empty above).
  it("resolves the linked project's artist via storage.findById when linking a project", async () => {
    renderWithProviders(
      <WorkFormModal
        open={true}
        onOpenChange={() => {}}
        mode="create"
      />
    );

    fireEvent.change(screen.getByTestId("input-buscar-projeto"), { target: { value: "Projeto" } });

    const option = await screen.findByTestId("option-projeto-projeto-99", {}, { timeout: 3000 });
    fireEvent.click(option);

    await waitFor(() => {
      const nameInputs = screen
        .getAllByPlaceholderText("Nome do participante")
        .map((el) => (el as HTMLInputElement).value);
      expect(nameInputs).toContain("Artista Fora Do Cap");
    });
  });
});

