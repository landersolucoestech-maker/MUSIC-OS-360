import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { FonogramaFormModal } from "@/components/forms/FonogramaFormModal";
import type { AbramusSearchResult, AbramusKind } from "@/hooks/useAbramus";

// ---------- Mocks de hooks ----------
const useAbramusStatusMock = vi.fn();
const useAbramusSearchMock = vi.fn();
const useAbramusImportMock = vi.fn();

vi.mock("@/hooks/useAbramus", () => ({
  useAbramusStatus: () => useAbramusStatusMock(),
  useAbramusSearch: (...args: unknown[]) => useAbramusSearchMock(...args),
  useAbramusImport: (...args: unknown[]) => useAbramusImportMock(...args),
}));

// Importante: as referências (`obras`, callbacks) precisam ser estáveis entre
// renders, caso contrário o useEffect que sincroniza `obraVinculada` no
// FonogramaFormModal volta a disparar e zera o estado depois que o
// AbramusSearchRow chama onImported.
const useObrasReturn = {
  obras: [] as never[],
  isLoading: false,
  error: null,
  addObra: vi.fn(),
  updateObra: vi.fn(),
  deleteObra: vi.fn(),
};
vi.mock("@/hooks/useObras", () => ({
  useObras: () => useObrasReturn,
}));

const useFonogramasReturn = {
  fonogramas: [] as never[],
  isLoading: false,
  error: null,
  addFonograma: vi.fn(),
  updateFonograma: vi.fn(),
  deleteFonograma: vi.fn(),
};
vi.mock("@/hooks/useFonogramas", () => ({
  useFonogramas: () => useFonogramasReturn,
}));

vi.mock("@/hooks/useCurrentOrgId", () => ({
  useCurrentOrgId: () => ({ orgId: "org-1" }),
}));

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  }),
}));

// Mock controlado do AbramusSearchRow para expor `onImported` por meio de um
// botão. Os comportamentos do próprio componente já são cobertos em
// `AbramusSearchRow.test.tsx`; aqui validamos somente a *integração* com o
// FonogramaFormModal (onImported -> setObraVinculada).
type AbramusSearchRowProps = {
  kind: AbramusKind;
  query: string;
  limit?: number;
  onImported?: (rec: AbramusSearchResult & { localId: string }) => void;
};

const lastQueryRef: { current: string } = { current: "" };
const lastKindRef: { current: AbramusKind | null } = { current: null };

vi.mock("@/components/forms/AbramusSearchRow", () => ({
  AbramusSearchRow: ({ kind, query, onImported }: AbramusSearchRowProps) => {
    lastQueryRef.current = query;
    lastKindRef.current = kind;
    return (
      <div data-testid="abramus-search-section">
        <p data-testid="abramus-section-heading">Banco ABRAMUS</p>
        <span data-testid="abramus-mock-query">{query}</span>
        <span data-testid="abramus-mock-kind">{kind}</span>
        <button
          type="button"
          data-testid="abramus-mock-import"
          onClick={() =>
            onImported?.({
              external_id: "abr-42",
              titulo: "Amor de Verão",
              genero: "Pop",
              compositores: ["Compositor A", "Compositor B"],
              artista_nome: "Banda X",
              localId: "local-obra-uuid",
            })
          }
        >
          import-mock
        </button>
        <button
          type="button"
          data-testid="abramus-mock-import-empty"
          onClick={() =>
            onImported?.({
              external_id: "abr-99",
              titulo: "Sem id",
              localId: "",
            })
          }
        >
          import-mock-empty
        </button>
      </div>
    );
  },
}));

function renderModal() {
  return render(
    <MemoryRouter>
      <FonogramaFormModal open onOpenChange={() => {}} mode="create" />
    </MemoryRouter>
  );
}

async function openPopoverAndType(value: string) {
  const input = screen.getByTestId("input-buscar-obra") as HTMLInputElement;
  await act(async () => {
    fireEvent.focus(input);
    fireEvent.click(input);
    fireEvent.change(input, { target: { value } });
  });
}

describe("FonogramaFormModal · integração popover ABRAMUS", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lastQueryRef.current = "";
    lastKindRef.current = null;
    useAbramusStatusMock.mockReturnValue({
      data: { connected: true },
      isLoading: false,
    });
    useAbramusSearchMock.mockReturnValue({
      data: { results: [] },
      isFetching: false,
      error: null,
    });
    useAbramusImportMock.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  it("mostra os cabeçalhos das duas seções (sistema + ABRAMUS) dentro do popover", async () => {
    renderModal();
    await openPopoverAndType("amor");

    expect(
      await screen.findByTestId("local-section-heading")
    ).toHaveTextContent(/Obras do sistema/i);
    expect(screen.getByTestId("abramus-section-heading")).toHaveTextContent(
      /Banco ABRAMUS/i
    );
    expect(screen.getByTestId("abramus-mock-kind")).toHaveTextContent("obras");
  });

  it("debounce de 300 ms: a query repassada ao AbramusSearchRow só atualiza após o delay", async () => {
    vi.useFakeTimers();
    try {
      renderModal();

      const input = screen.getByTestId("input-buscar-obra") as HTMLInputElement;
      act(() => {
        fireEvent.focus(input);
        fireEvent.click(input);
        fireEvent.change(input, { target: { value: "amor" } });
      });

      // Antes do delay, o valor passado ao AbramusSearchRow ainda é o
      // anterior (string vazia), comprovando que o debounce está em ação.
      expect(lastQueryRef.current).toBe("");

      act(() => {
        vi.advanceTimersByTime(299);
      });
      expect(lastQueryRef.current).toBe("");

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(lastQueryRef.current).toBe("amor");
    } finally {
      vi.useRealTimers();
    }
  });

  it("ao acionar onImported com localId válido, o modal atualiza obraVinculada e fecha o popover", async () => {
    renderModal();
    await openPopoverAndType("amor");

    const importButton = await screen.findByTestId("abramus-mock-import");

    await act(async () => {
      fireEvent.click(importButton);
    });

    const card = await screen.findByTestId("obra-vinculada-card");
    expect(
      within(card).getByTestId("text-obra-vinculada-titulo")
    ).toHaveTextContent("Amor de Verão");

    // O input de busca somente é renderizado quando obraVinculada é null.
    // Como agora a obra está vinculada, ele desaparece e o popover é fechado.
    await waitFor(() => {
      expect(screen.queryByTestId("input-buscar-obra")).not.toBeInTheDocument();
    });
  });

  it("ao acionar onImported sem localId, mostra toast de erro e mantém obraVinculada nula", async () => {
    const sonner = await import("sonner");
    renderModal();
    await openPopoverAndType("amor");

    const importEmpty = await screen.findByTestId("abramus-mock-import-empty");
    await act(async () => {
      fireEvent.click(importEmpty);
    });

    expect(sonner.toast.error).toHaveBeenCalledWith(
      expect.stringMatching(/Não foi possível resolver a obra importada/i)
    );
    expect(screen.queryByTestId("obra-vinculada-card")).not.toBeInTheDocument();
    expect(screen.getByTestId("input-buscar-obra")).toBeInTheDocument();
  });

  it("propaga o kind 'obras' para o AbramusSearchRow montado pelo popover", async () => {
    renderModal();
    await openPopoverAndType("am");

    expect(lastKindRef.current).toBe("obras");
  });
});
