/**
 * Compat wiring: the spreadsheet import of the Artists page converts each row through the single
 * form definition (parseArtistImportRow: legacy/PT-BR headers and values) and then through
 * formValuesToArtistPayload (canonical persistence payload). Observed at the addArtist mutation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const addArtistMutateAsync = vi.fn();
const readRows = vi.fn();
const toastError = vi.fn();

vi.mock("@/modules/artist/hooks/useArtists", () => ({
  useArtists: () => ({
    artists: [],
    deleteArtist: { mutate: vi.fn(), mutateAsync: vi.fn() },
    addArtist: { mutateAsync: addArtistMutateAsync },
    isLoading: false,
  }),
}));
vi.mock("@/modules/artist/hooks/useSignedArtists", () => ({ useSignedArtists: () => ({ artists: [] }) }));
vi.mock("@/modules/artist/hooks/useArtistsPaginated", () => ({
  useArtistsPaginated: () => ({ artists: [], total: 0, isLoading: false, error: null, refetch: vi.fn() }),
  useArtistRelationshipStats: () => ({ stats: { total: 0, exclusive: 0, partner: 0, independent: 0 } }),
  useMusicGenres: () => ({ genres: [] }),
}));
vi.mock("@/modules/artist/components/ArtistFormModal", () => ({ ArtistFormModal: () => null }));
vi.mock("@/modules/artist/components/ArtistVision360Modal", () => ({ ArtistVision360Modal: () => null }));
vi.mock("@/modules/artist/components/ArtistPlatformMetrics", () => ({ ArtistPlatformMetrics: () => null }));
vi.mock("@/shared/components/MainLayout", () => ({
  MainLayout: ({ actions, children }: { actions?: React.ReactNode; children?: React.ReactNode }) => (
    <div>
      {actions}
      {children}
    </div>
  ),
}));
vi.mock("@/shared/components/RequirePermission", () => ({
  RequirePermission: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/shared/lib/xlsx-isolated", () => ({ readSpreadsheetRows: (...a: unknown[]) => readRows(...a) }));
vi.mock("sonner", () => ({ toast: { error: (...a: unknown[]) => toastError(...a), success: vi.fn() } }));

import Artists from "./Artists";

async function importRows(rows: Record<string, unknown>[]) {
  readRows.mockResolvedValue({ sheetNames: ["Sheet1"], rows });
  render(
    <MemoryRouter>
      <Artists />
    </MemoryRouter>,
  );
  const input = screen.getByTestId("input-import-excel");
  const file = { arrayBuffer: async () => new ArrayBuffer(0) };
  fireEvent.change(input, { target: { files: [file] } });
  await waitFor(() => expect(readRows).toHaveBeenCalled());
}

describe("Artists page spreadsheet import", () => {
  beforeEach(() => {
    addArtistMutateAsync.mockReset().mockResolvedValue({ id: "new" });
    readRows.mockReset();
    toastError.mockReset();
  });

  it("a row with legacy headers/values is posted as the canonical artist payload", async () => {
    await importRows([
      {
        nome_artistico: "  Artista Legado  ",
        genero_musical: "Rock",
        tipo_perfil: "Gravadora",
        data_nascimento: "1990-05-17",
        observacoes: "bio legada",
        "Função": "Produtor, Compositor/Autor",
        "Distribuidoras": "",
      },
    ]);
    await waitFor(() => expect(addArtistMutateAsync).toHaveBeenCalledTimes(1));
    const payload = addArtistMutateAsync.mock.calls[0][0] as Record<string, unknown>;
    // canonical persistence keys (formValuesToArtistPayload -> formToArtistPayload), trimmed
    expect(payload).toMatchObject({
      stageName: "Artista Legado",
      musicGenre: "Rock",
      profileType: "record_label",
      birthDate: "1990-05-17",
      notes: "bio legada",
    });
    // form-value keys of the parsed row never reach the API payload
    expect(payload).not.toHaveProperty("biography");
    expect(payload.specialties).toEqual(expect.arrayContaining(["producer"]));
    // payload is the persistence shape (empty optional fields are null, not "")
    expect(payload.fullName).toBeNull();
    expect(payload.relationships).toBeNull();
  });

  it("negative: a row without an artist name is skipped, valid rows are still imported", async () => {
    await importRows([{ genero_musical: "Rock" }, { nome_artistico: "Valido" }]);
    await waitFor(() => expect(addArtistMutateAsync).toHaveBeenCalledTimes(1));
    expect(addArtistMutateAsync.mock.calls[0][0]).toMatchObject({ stageName: "Valido" });
  });

  it("negative: an unrecognized profile type falls back to the canonical default instead of leaking the raw cell", async () => {
    await importRows([{ nome_artistico: "X", tipo_perfil: "algo-desconhecido" }]);
    await waitFor(() => expect(addArtistMutateAsync).toHaveBeenCalledTimes(1));
    expect(addArtistMutateAsync.mock.calls[0][0]).toMatchObject({ profileType: "independent" });
  });
});
