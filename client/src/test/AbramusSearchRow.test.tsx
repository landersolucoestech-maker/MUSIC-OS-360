// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const statusMock = vi.fn();
const searchMock = vi.fn();
const importMock = vi.fn();
const localLookupMock = vi.fn();

vi.mock("@/hooks/useAbramus", () => ({
  useAbramusStatus: () => statusMock(),
  useAbramusSearch: (...args: unknown[]) => searchMock(...args),
  useAbramusImport: (...args: unknown[]) => importMock(...args),
  useAbramusLocalLookup: (...args: unknown[]) => localLookupMock(...args),
}));

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import { AbramusSearchRow } from "@/components/forms/AbramusSearchRow";

const renderWith = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

const baseResult = {
  external_id: "ABR-123",
  titulo: "Canção de Teste",
  iswc: "T-123456789-0",
  isrc: null,
  artista_nome: "Artista X",
  genero: "MPB",
};

const setupHooks = ({
  results = [baseResult],
  lookup = new Map(),
  importPending = false,
  importMutate = vi.fn().mockResolvedValue({
    success: true,
    record: { id: "local-new-1" },
  }),
} = {}) => {
  statusMock.mockReturnValue({
    data: { connected: true },
    isLoading: false,
  });
  searchMock.mockReturnValue({
    data: { results },
    isFetching: false,
    error: null,
  });
  importMock.mockReturnValue({
    mutateAsync: importMutate,
    isPending: importPending,
  });
  localLookupMock.mockReturnValue({ data: lookup });
  return { importMutate };
};

describe("AbramusSearchRow — already-imported flow", () => {
  beforeEach(() => {
    statusMock.mockReset();
    searchMock.mockReset();
    importMock.mockReset();
    localLookupMock.mockReset();
    toastSuccess.mockReset();
    toastError.mockReset();
  });

  it("shows the 'Já no sistema' badge when the obra has a local match", () => {
    setupHooks({
      lookup: new Map([
        ["ABR-123", { id: "local-1", titulo: "Canção de Teste" }],
      ]),
    });

    renderWith(<AbramusSearchRow kind="obras" query="canção" />);

    expect(
      screen.getByTestId("badge-already-imported-ABR-123")
    ).toBeInTheDocument();
  });

  it("does NOT render the badge when there is no local match", () => {
    setupHooks({ lookup: new Map() });

    renderWith(<AbramusSearchRow kind="obras" query="canção" />);

    expect(
      screen.queryByTestId("badge-already-imported-ABR-123")
    ).not.toBeInTheDocument();
  });

  it("clicking an already-imported obra calls onImported with localId and SKIPS useAbramusImport", async () => {
    const { importMutate } = setupHooks({
      lookup: new Map([
        ["ABR-123", { id: "local-1", titulo: "Canção de Teste" }],
      ]),
    });
    const onImported = vi.fn();

    renderWith(
      <AbramusSearchRow kind="obras" query="canção" onImported={onImported} />
    );

    fireEvent.click(screen.getByTestId("abramus-result-ABR-123"));

    await waitFor(() => {
      expect(onImported).toHaveBeenCalledTimes(1);
    });
    expect(onImported).toHaveBeenCalledWith(
      expect.objectContaining({ external_id: "ABR-123", localId: "local-1" })
    );
    expect(importMutate).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith("Obra já cadastrada — vinculada");
  });

  it("clicking an already-imported fonograma shows the fonograma toast", async () => {
    const { importMutate } = setupHooks({
      lookup: new Map([
        ["ABR-123", { id: "local-9", titulo: "Faixa Teste" }],
      ]),
    });
    const onImported = vi.fn();

    renderWith(
      <AbramusSearchRow
        kind="fonogramas"
        query="faixa"
        onImported={onImported}
      />
    );

    fireEvent.click(screen.getByTestId("abramus-result-ABR-123"));

    await waitFor(() => {
      expect(onImported).toHaveBeenCalledWith(
        expect.objectContaining({ localId: "local-9" })
      );
    });
    expect(importMutate).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledWith(
      "Fonograma já cadastrado — vinculado"
    );
  });

  it("clicking a NEW obra (no local match) calls useAbramusImport", async () => {
    const { importMutate } = setupHooks({ lookup: new Map() });
    const onImported = vi.fn();

    renderWith(
      <AbramusSearchRow kind="obras" query="canção" onImported={onImported} />
    );

    fireEvent.click(screen.getByTestId("abramus-result-ABR-123"));

    await waitFor(() => {
      expect(importMutate).toHaveBeenCalledTimes(1);
    });
    expect(importMutate).toHaveBeenCalledWith({
      external_id: "ABR-123",
      record: expect.objectContaining({ external_id: "ABR-123" }),
    });
    expect(onImported).toHaveBeenCalledWith(
      expect.objectContaining({ localId: "local-new-1" })
    );
    // toast.success here would come from the mutation's onSuccess (mocked away);
    // crucially, the "já cadastrada" toast should NOT fire.
    expect(toastSuccess).not.toHaveBeenCalledWith(
      "Obra já cadastrada — vinculada"
    );
  });
});
