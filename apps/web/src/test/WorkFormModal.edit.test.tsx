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
              { id: "project-99", title: "Projeto Raro", status: "concluido", artist_id: "art-99" },
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

  // Persisted work in the canonical CZ-039 response shape.
  const baseWork = {
    id: "work-1",
    title: "Canção Original",
    music_genre: "pop",
    iswc: "T-123.456.789-0",
    duration_text: "03:45",
    status: "under_review",
    language: "pt",
    is_instrumental: false,
    ai_used: false,
    ai_usage_level: null,
    composer_names: ["Alice", "Bob"],
    translator_names: ["Carol"],
    ecad_code: "ECAD-1",
    society_code: "SOC-1",
    work_origin: "original",
    project_id: null,
    org_id: "org-1",
  };

  it("pre-fills every field from the persisted work row", () => {
    renderWithProviders(
      <WorkFormModal
        open={true}
        onOpenChange={() => {}}
        mode="edit"
        work={baseWork}
      />
    );

    // Title hydrated from title
    const titleInput = screen.getByDisplayValue("Canção Original");
    expect(titleInput).toBeInTheDocument();

    // ISWC
    expect(screen.getByDisplayValue("T-123.456.789-0")).toBeInTheDocument();

    // ECAD / society codes
    expect(screen.getByDisplayValue("ECAD-1")).toBeInTheDocument();
    expect(screen.getByDisplayValue("SOC-1")).toBeInTheDocument();

    // Duration: 3 min and 45 sec
    expect(screen.getByTestId("input-duration-minutes")).toHaveValue("3");
    expect(screen.getByTestId("input-duration-seconds")).toHaveValue("45");

    // Participants expanded from composer_names + translator_names
    const nameInputs = screen
      .getAllByPlaceholderText("Nome do participante")
      .map((el) => (el as HTMLInputElement).value);
    expect(nameInputs).toEqual(expect.arrayContaining(["Alice", "Bob", "Carol"]));

    // Origin badge in PT-BR
    expect(screen.getByTestId("badge-work-origin-original")).toHaveTextContent("Obra Autoral");
  });

  it("shows PT-BR labels for the ISO language code, status and participant roles — never the raw values", () => {
    renderWithProviders(
      <WorkFormModal
        open={true}
        onOpenChange={() => {}}
        mode="edit"
        work={{
          ...baseWork,
          composer_names: null,
          translator_names: null,
          participants: [
            { id: "p-1", name: "Alice", role: "composer_author", link: null, percentage: "60.000" },
            { id: "p-2", name: "Carol", role: "translator", link: null, percentage: "40.000" },
          ],
        }}
      />
    );

    const languageTrigger = screen.getByTestId("trigger-work-language");
    expect(languageTrigger).toHaveTextContent("Português");
    expect(languageTrigger).not.toHaveTextContent(/^pt$/);

    expect(screen.getByTestId("trigger-work-status")).toHaveTextContent("Em Análise");

    const composerRole = screen.getByTestId("trigger-participant-role-p-1");
    expect(composerRole).toHaveTextContent("Compositor/Autor");
    expect(composerRole).not.toHaveTextContent("composer_author");
    const translatorRole = screen.getByTestId("trigger-participant-role-p-2");
    expect(translatorRole).toHaveTextContent("Tradutor");
    expect(translatorRole).not.toHaveTextContent("translator");
  });

  it("saves edits via updateWork with the canonical (CZ-039) payload", async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <WorkFormModal
        open={true}
        onOpenChange={onOpenChange}
        mode="edit"
        work={baseWork}
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
    const saveButton = screen.getByTestId("button-submit-work");
    await act(async () => {
      fireEvent.submit(saveButton.closest("form")!);
    });

    expect(toastErrorMock).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(updateWorkMock).toHaveBeenCalledTimes(1);
    });

    const callArg = updateWorkMock.mock.calls[0][0];
    expect(callArg.id).toBe("work-1");
    expect(callArg.title).toBe("Canção Editada");
    // Canonical status round-trips unchanged
    expect(callArg.status).toBe("under_review");
    // Duration text stays MM:SS
    expect(callArg.duration_text).toBe("03:45");
    // Canonical values: ISO language code, booleans, work origin
    expect(callArg.language).toBe("pt");
    expect(callArg.is_instrumental).toBe(false);
    expect(callArg.ai_used).toBe(false);
    expect(callArg.work_origin).toBe("original");
    expect(callArg.ecad_code).toBe("ECAD-1");
    expect(callArg.society_code).toBe("SOC-1");
    // composer_names/translator_names preserved (derived from the participants)
    expect(callArg.composer_names).toEqual(["Alice", "Bob"]);
    expect(callArg.translator_names).toEqual(["Carol"]);
    expect(callArg.participants.map((p) => [p.name, p.role])).toEqual([
      ["Alice", "composer_author"],
      ["Bob", "composer_author"],
      ["Carol", "translator"],
    ]);
    expect(callArg.iswc).toBe("T-123.456.789-0");
    // Exactly the canonical request fields (+ id / optimistic-lock token) — no other
    // key (e.g. a pre-CZ-039 Portuguese field name) can be present.
    expect(Object.keys(callArg).sort()).toEqual([
      "ai_harmony", "ai_lyrics", "ai_melody", "ai_usage_level", "ai_used", "alternative_titles",
      "artist_id", "composer_names", "duration_text", "ecad_code", "expectedUpdatedAt", "id",
      "is_instrumental", "iswc", "language", "lyrics", "music_genre", "participants", "project_id",
      "related_references", "society_code", "status", "title", "translator_names", "work_origin",
    ]);
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

    fireEvent.change(screen.getByTestId("input-search-project"), { target: { value: "Projeto" } });

    const option = await screen.findByTestId("option-project-project-99", {}, { timeout: 3000 });
    fireEvent.click(option);

    await waitFor(() => {
      const nameInputs = screen
        .getAllByPlaceholderText("Nome do participante")
        .map((el) => (el as HTMLInputElement).value);
      expect(nameInputs).toContain("Artista Fora Do Cap");
    });
  });
});

