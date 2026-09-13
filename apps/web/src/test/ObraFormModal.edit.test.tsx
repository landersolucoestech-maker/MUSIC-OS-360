// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "./_helpers/render-with-providers";
import React from "react";

// Mocks must be declared before importing the component.
const { updateObraMock, addObraMock, toastErrorMock } = vi.hoisted(() => ({
  updateObraMock: vi.fn().mockResolvedValue({}),
  addObraMock: vi.fn().mockResolvedValue({}),
  toastErrorMock: vi.fn(),
}));

vi.mock("@/modules/catalog/hooks/useObras", () => {
  const stableReturn = {
    obras: [] as any[],
    isLoading: false,
    error: null,
    addObra: { mutateAsync: addObraMock },
    updateObra: { mutateAsync: updateObraMock },
    deleteObra: { mutateAsync: vi.fn() },
  };
  return { useObras: () => stableReturn };
});

vi.mock("@/modules/artist/hooks/useSignedArtists", () => {
  const stableReturn = { artistas: [] as any[], isLoading: false, error: null };
  return { useSignedArtists: () => stableReturn };
});

// Task J: o hook useArtistas() (capped nos primeiros 50 do tenant) fica
// deliberadamente VAZIO — se a resolução do artista dentro de selectProjeto
// (ObraFormModal.tsx) ainda dependesse de escanear esse array, o teste
// "resolves the linked project's artist..." abaixo falharia.
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

// ObraFormModal.tsx não usa mais useProjetos() (Task J) — o picker "Vincular
// a Projeto Concluído" e a resolução do artista vinculado ao projeto agora
// passam por storage.listPaged/findById direto.
vi.mock("@/shared/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/storage")>("@/shared/lib/storage");
  return {
    ...actual,
    storage: {
      ...actual.storage,
      findById: vi.fn(async (table: string, id: string) => {
        // Task J: artista "fora do cap" — só alcançável por GET /artists/:id
        // direto (nunca estaria entre os primeiros 50 de useArtistas()).
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

import { ObraFormModal } from "@/modules/catalog/components/ObraFormModal";

describe("ObraFormModal edit mode", () => {
  beforeEach(() => {
    updateObraMock.mockClear();
    addObraMock.mockClear();
    toastErrorMock.mockClear();
  });

  const baseObra = {
    id: "obra-1",
    title: "Canção Original",
    genero: "pop",
    iswc: "T-123.456.789-0",
    duracao: "03:45",
    status: "analise",
    compositores: ["Alice", "Bob"],
    letristas: ["Carol"],
    project_id: null,
    org_id: "org-1",
  };

  it("pre-fills every field from the persisted obra row", () => {
    renderWithProviders(
      <ObraFormModal
        open={true}
        onOpenChange={() => {}}
        mode="edit"
        obra={baseObra}
      />
    );

    // Title hydrated from title
    const tituloInput = screen.getByDisplayValue("Canção Original");
    expect(tituloInput).toBeInTheDocument();

    // ISWC
    expect(screen.getByDisplayValue("T-123.456.789-0")).toBeInTheDocument();

    // Duração: 3 min and 45 seg
    expect(screen.getByTestId("input-duracao-minutos")).toHaveValue("3");
    expect(screen.getByTestId("input-duracao-segundos")).toHaveValue("45");

    // Participantes from compositores + letristas
    const nomeInputs = screen
      .getAllByPlaceholderText("Nome do participante")
      .map((el) => (el as HTMLInputElement).value);
    expect(nomeInputs).toEqual(expect.arrayContaining(["Alice", "Bob", "Carol"]));
  });

  it("saves edits via updateObra with normalized payload", async () => {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <ObraFormModal
        open={true}
        onOpenChange={onOpenChange}
        mode="edit"
        obra={baseObra}
      />
    );

    // Edit the title
    const tituloInput = screen.getByDisplayValue("Canção Original") as HTMLInputElement;
    fireEvent.change(tituloInput, { target: { value: "Canção Editada" } });

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
      expect(updateObraMock).toHaveBeenCalledTimes(1);
    });

    const callArg = updateObraMock.mock.calls[0][0];
    expect(callArg.id).toBe("obra-1");
    expect(callArg.title).toBe("Canção Editada");
    // Status round-trips back to DB form
    expect(callArg.status).toBe("under_review");
    // Duracao stays MM:SS
    expect(callArg.duracao).toBe("03:45");
    // Compositores/letristas preserved
    expect(callArg.compositores).toEqual(["Alice", "Bob"]);
    expect(callArg.letristas).toEqual(["Carol"]);
    expect(callArg.iswc).toBe("T-123.456.789-0");
    // Tenant isolation: org_id/orgId must NEVER be part of the payload the
    // frontend sends — the API derives the tenant from the authenticated
    // request context (see registro-musicas.mapper.ts::formToObraPayload).
    // A client-supplied org_id would be a tenant-spoofing vector; this
    // assertion is a regression guard against that ever being reintroduced.
    expect(callArg.org_id).toBeUndefined();
    expect(callArg.orgId).toBeUndefined();
    expect(callArg.genero).toBe("pop");
  });

  // Task J — Lookup Gap Zero: prova que o picker "Vincular a Projeto
  // Concluído" busca via storage.listPaged (server-side) e que o autofill do
  // artista do projeto vinculado resolve via storage.findById por ID direto,
  // nunca escaneando o array capped de useArtistas() (mockado vazio acima).
  it("resolves the linked project's artist via storage.findById when linking a project", async () => {
    renderWithProviders(
      <ObraFormModal
        open={true}
        onOpenChange={() => {}}
        mode="create"
      />
    );

    fireEvent.change(screen.getByTestId("input-buscar-projeto"), { target: { value: "Projeto" } });

    const option = await screen.findByTestId("option-projeto-projeto-99", {}, { timeout: 3000 });
    fireEvent.click(option);

    await waitFor(() => {
      const nomeInputs = screen
        .getAllByPlaceholderText("Nome do participante")
        .map((el) => (el as HTMLInputElement).value);
      expect(nomeInputs).toContain("Artista Fora Do Cap");
    });
  });
});

