import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AbramusSearchRow } from "@/components/forms/AbramusSearchRow";
import type { AbramusSearchResult } from "@/hooks/useAbramus";

const useAbramusStatusMock = vi.fn();
const useAbramusSearchMock = vi.fn();
const useAbramusImportMock = vi.fn();
const useAbramusLocalLookupMock = vi.fn();

vi.mock("@/hooks/useAbramus", () => ({
  useAbramusStatus: () => useAbramusStatusMock(),
  useAbramusSearch: (...args: unknown[]) => useAbramusSearchMock(...args),
  useAbramusImport: (...args: unknown[]) => useAbramusImportMock(...args),
  useAbramusLocalLookup: (...args: unknown[]) => useAbramusLocalLookupMock(...args),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));

function renderRow(props: Partial<React.ComponentProps<typeof AbramusSearchRow>> = {}) {
  return render(
    <MemoryRouter>
      <AbramusSearchRow kind="obras" query="" {...props} />
    </MemoryRouter>
  );
}

const defaultImport = {
  mutateAsync: vi.fn(),
  isPending: false,
};

describe("AbramusSearchRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAbramusImportMock.mockReturnValue(defaultImport);
    useAbramusLocalLookupMock.mockReturnValue({ data: new Map() });
  });

  it("renders the 'Banco ABRAMUS' heading and verifying state while status is loading", () => {
    useAbramusStatusMock.mockReturnValue({ data: undefined, isLoading: true });
    useAbramusSearchMock.mockReturnValue({ data: undefined, isFetching: false, error: null });

    renderRow({ query: "ab" });

    expect(screen.getByTestId("abramus-section-heading")).toHaveTextContent("Banco ABRAMUS");
    expect(screen.getByText(/Verificando integração ABRAMUS/i)).toBeInTheDocument();
  });

  it("shows 'not configured' message and a link to settings when integration is disconnected", () => {
    useAbramusStatusMock.mockReturnValue({
      data: { connected: false },
      isLoading: false,
    });
    useAbramusSearchMock.mockReturnValue({ data: undefined, isFetching: false, error: null });

    renderRow({ query: "ab" });

    expect(screen.getByTestId("abramus-not-configured")).toBeInTheDocument();
    const link = screen.getByTestId("link-abramus-configurar");
    expect(link).toHaveAttribute("href", "/configuracoes");
  });

  it("shows the typing hint when connected but query is shorter than 2 characters", () => {
    useAbramusStatusMock.mockReturnValue({
      data: { connected: true },
      isLoading: false,
    });
    useAbramusSearchMock.mockReturnValue({ data: undefined, isFetching: false, error: null });

    renderRow({ query: "a" });

    expect(screen.getByTestId("abramus-hint")).toHaveTextContent(
      /Digite ao menos 2 caracteres/i
    );
  });

  it("shows the loading state when results are being fetched", () => {
    useAbramusStatusMock.mockReturnValue({
      data: { connected: true },
      isLoading: false,
    });
    useAbramusSearchMock.mockReturnValue({ data: undefined, isFetching: true, error: null });

    renderRow({ query: "amor" });

    expect(screen.getByTestId("abramus-loading")).toHaveTextContent(/Consultando ABRAMUS/i);
  });

  it("shows a generic error message when the search hook reports a network error", () => {
    useAbramusStatusMock.mockReturnValue({
      data: { connected: true },
      isLoading: false,
    });
    useAbramusSearchMock.mockReturnValue({
      data: undefined,
      isFetching: false,
      error: new Error("boom"),
    });

    renderRow({ query: "amor" });

    expect(screen.getByTestId("abramus-error")).toHaveTextContent(/Falha ao consultar ABRAMUS/i);
  });

  it("treats an api-level 'not_configured' payload as the not-configured state", () => {
    useAbramusStatusMock.mockReturnValue({
      data: { connected: true },
      isLoading: false,
    });
    useAbramusSearchMock.mockReturnValue({
      data: { results: [], error: "not_configured" },
      isFetching: false,
      error: null,
    });

    renderRow({ query: "amor" });

    expect(screen.getByTestId("abramus-not-configured")).toBeInTheDocument();
    expect(screen.getByTestId("link-abramus-configurar")).toBeInTheDocument();
  });

  it("shows a friendly message for upstream API errors", () => {
    useAbramusStatusMock.mockReturnValue({
      data: { connected: true },
      isLoading: false,
    });
    useAbramusSearchMock.mockReturnValue({
      data: { results: [], error: "upstream_error" },
      isFetching: false,
      error: null,
    });

    renderRow({ query: "amor" });

    expect(screen.getByTestId("abramus-api-error")).toHaveTextContent(
      /Tente novamente em instantes/i
    );
  });

  it("shows the empty state when there are no results", () => {
    useAbramusStatusMock.mockReturnValue({
      data: { connected: true },
      isLoading: false,
    });
    useAbramusSearchMock.mockReturnValue({
      data: { results: [] },
      isFetching: false,
      error: null,
    });

    renderRow({ query: "amor" });

    expect(screen.getByTestId("abramus-empty")).toHaveTextContent(
      /Nenhum resultado no banco ABRAMUS/i
    );
  });

  it("renders the results list and respects the limit prop", () => {
    useAbramusStatusMock.mockReturnValue({
      data: { connected: true },
      isLoading: false,
    });

    const results: AbramusSearchResult[] = [
      { external_id: "abr-1", titulo: "Amor de Verão", iswc: "T-123", artista_nome: "X" },
      { external_id: "abr-2", titulo: "Amor Antigo", iswc: "T-456", artista_nome: "Y" },
      { external_id: "abr-3", titulo: "Amor Verdadeiro", iswc: "T-789" },
    ];

    useAbramusSearchMock.mockReturnValue({
      data: { results },
      isFetching: false,
      error: null,
    });

    renderRow({ query: "amor", limit: 2 });

    expect(screen.getByTestId("abramus-results-list")).toBeInTheDocument();
    expect(screen.getByTestId("abramus-result-abr-1")).toBeInTheDocument();
    expect(screen.getByTestId("abramus-result-abr-2")).toBeInTheDocument();
    expect(screen.queryByTestId("abramus-result-abr-3")).toBeNull();
    expect(screen.getAllByText("ABRAMUS").length).toBeGreaterThan(0);
  });

  it("does not call the search hook with the real query when status is not connected", () => {
    useAbramusStatusMock.mockReturnValue({
      data: { connected: false },
      isLoading: false,
    });
    useAbramusSearchMock.mockReturnValue({ data: undefined, isFetching: false, error: null });

    renderRow({ query: "amor" });

    expect(useAbramusSearchMock).toHaveBeenCalledWith("obras", "");
  });

  it("forwards the query to useAbramusSearch when connected", () => {
    useAbramusStatusMock.mockReturnValue({
      data: { connected: true },
      isLoading: false,
    });
    useAbramusSearchMock.mockReturnValue({ data: undefined, isFetching: false, error: null });

    renderRow({ query: "amor", kind: "fonogramas" });

    expect(useAbramusSearchMock).toHaveBeenCalledWith("fonogramas", "amor");
  });

  it("calls the import mutation and onImported with the local id when a result is selected", async () => {
    useAbramusStatusMock.mockReturnValue({
      data: { connected: true },
      isLoading: false,
    });

    const result: AbramusSearchResult = {
      external_id: "abr-99",
      titulo: "Selecionável",
      iswc: "T-999",
      artista_nome: "Tester",
      genero: "Pop",
    };

    useAbramusSearchMock.mockReturnValue({
      data: { results: [result] },
      isFetching: false,
      error: null,
    });

    const mutateAsync = vi.fn().mockResolvedValue({
      success: true,
      record: { id: "local-uuid-1" },
    });
    useAbramusImportMock.mockReturnValue({ mutateAsync, isPending: false });

    const onImported = vi.fn();
    renderRow({ query: "sel", onImported });

    fireEvent.click(screen.getByTestId("abramus-result-abr-99"));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith({
        external_id: "abr-99",
        record: result,
      });
    });

    await waitFor(() => {
      expect(onImported).toHaveBeenCalledWith({
        ...result,
        localId: "local-uuid-1",
      });
    });
  });

  it("swallows mutation errors silently (toast is handled inside the hook)", async () => {
    useAbramusStatusMock.mockReturnValue({
      data: { connected: true },
      isLoading: false,
    });

    const result: AbramusSearchResult = {
      external_id: "abr-7",
      titulo: "Falha",
    };

    useAbramusSearchMock.mockReturnValue({
      data: { results: [result] },
      isFetching: false,
      error: null,
    });

    const mutateAsync = vi.fn().mockRejectedValue(new Error("nope"));
    useAbramusImportMock.mockReturnValue({ mutateAsync, isPending: false });

    const onImported = vi.fn();
    renderRow({ query: "fal", onImported });

    fireEvent.click(screen.getByTestId("abramus-result-abr-7"));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalled();
    });
    expect(onImported).not.toHaveBeenCalled();
  });

  it("ignores clicks while a previous import is pending", () => {
    useAbramusStatusMock.mockReturnValue({
      data: { connected: true },
      isLoading: false,
    });

    useAbramusSearchMock.mockReturnValue({
      data: {
        results: [
          { external_id: "abr-pending", titulo: "Aguardando" } as AbramusSearchResult,
        ],
      },
      isFetching: false,
      error: null,
    });

    const mutateAsync = vi.fn().mockResolvedValue({
      success: true,
      record: { id: "x" },
    });
    useAbramusImportMock.mockReturnValue({ mutateAsync, isPending: true });

    renderRow({ query: "agu" });

    fireEvent.click(screen.getByTestId("abramus-result-abr-pending"));
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("triggers selection on Enter and Space keystrokes", async () => {
    useAbramusStatusMock.mockReturnValue({
      data: { connected: true },
      isLoading: false,
    });

    useAbramusSearchMock.mockReturnValue({
      data: {
        results: [
          { external_id: "abr-key", titulo: "Tecla" } as AbramusSearchResult,
        ],
      },
      isFetching: false,
      error: null,
    });

    const mutateAsync = vi.fn().mockResolvedValue({
      success: true,
      record: { id: "local-key" },
    });
    useAbramusImportMock.mockReturnValue({ mutateAsync, isPending: false });

    renderRow({ query: "tec" });

    fireEvent.keyDown(screen.getByTestId("abramus-result-abr-key"), { key: "Enter" });
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(1));

    fireEvent.keyDown(screen.getByTestId("abramus-result-abr-key"), { key: " " });
    await waitFor(() => expect(mutateAsync).toHaveBeenCalledTimes(2));
  });

  it("flags rows already imported and reuses the local id without calling the import mutation", async () => {
    useAbramusStatusMock.mockReturnValue({
      data: { connected: true },
      isLoading: false,
    });

    const result: AbramusSearchResult = {
      external_id: "abr-existing",
      titulo: "Já no banco",
    };

    useAbramusSearchMock.mockReturnValue({
      data: { results: [result] },
      isFetching: false,
      error: null,
    });

    const localMap = new Map([
      ["abr-existing", { id: "local-existing", titulo: "Já no banco" }],
    ]);
    useAbramusLocalLookupMock.mockReturnValue({ data: localMap });

    const mutateAsync = vi.fn();
    useAbramusImportMock.mockReturnValue({ mutateAsync, isPending: false });

    const onImported = vi.fn();
    renderRow({ query: "exi", onImported });

    expect(screen.getByTestId("badge-already-imported-abr-existing")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("abramus-result-abr-existing"));

    await waitFor(() => {
      expect(onImported).toHaveBeenCalledWith({
        ...result,
        localId: "local-existing",
      });
    });
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it("renders an overflow hint based on has_more / total from the search response", () => {
    useAbramusStatusMock.mockReturnValue({
      data: { connected: true },
      isLoading: false,
    });

    const results: AbramusSearchResult[] = Array.from({ length: 3 }).map((_, i) => ({
      external_id: `abr-of-${i}`,
      titulo: `Item ${i}`,
    }));

    useAbramusSearchMock.mockReturnValue({
      data: { results, total: 42, has_more: true },
      isFetching: false,
      error: null,
    });

    renderRow({ query: "amor", limit: 3 });

    const overflow = screen.getByTestId("abramus-overflow");
    expect(overflow).toHaveTextContent(/Mostrando 3 de 42/);
  });
});
