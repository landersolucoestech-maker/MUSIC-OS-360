// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import React from "react";

// Mocks must be declared before importing the component.
const { updateObraMock, addObraMock } = vi.hoisted(() => ({
  updateObraMock: vi.fn().mockResolvedValue({}),
  addObraMock: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/hooks/useObras", () => {
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

vi.mock("@/hooks/useProjetos", () => {
  const stableReturn = { projetos: [] as any[], isLoading: false, error: null };
  return { useProjetos: () => stableReturn };
});

vi.mock("@/hooks/useArtistasAssinados", () => {
  const stableReturn = { artistas: [] as any[], isLoading: false, error: null };
  return { useArtistasAssinados: () => stableReturn };
});

vi.mock("@/components/forms/AbramusSearchRow", () => ({
  AbramusSearchRow: () => null,
}));

vi.mock("@/hooks/useCurrentOrgId", () => ({
  useCurrentOrgId: () => ({ orgId: "org-1", isLoading: false }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { ObraFormModal } from "@/components/forms/ObraFormModal";

describe("ObraFormModal edit mode", () => {
  beforeEach(() => {
    updateObraMock.mockClear();
    addObraMock.mockClear();
  });

  const baseObra = {
    id: "obra-1",
    titulo: "Canção Original",
    genero: "pop",
    iswc: "T-123.456.789-0",
    duracao: "03:45",
    status: "analise",
    compositores: ["Alice", "Bob"],
    letristas: ["Carol"],
    projeto_id: null,
    org_id: "org-1",
  };

  it("pre-fills every field from the persisted obra row", () => {
    render(
      <ObraFormModal
        open={true}
        onOpenChange={() => {}}
        mode="edit"
        obra={baseObra}
      />
    );

    // Title hydrated from titulo
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
    render(
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
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[checkboxes.length - 1]);

    // Submit form
    const saveButton = screen.getByTestId("button-submit-obra");
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(updateObraMock).toHaveBeenCalledTimes(1);
    });

    const callArg = updateObraMock.mock.calls[0][0];
    expect(callArg.id).toBe("obra-1");
    expect(callArg.titulo).toBe("Canção Editada");
    // Status round-trips back to DB form
    expect(callArg.status).toBe("analise");
    // Duracao stays MM:SS
    expect(callArg.duracao).toBe("03:45");
    // Compositores/letristas preserved
    expect(callArg.compositores).toEqual(["Alice", "Bob"]);
    expect(callArg.letristas).toEqual(["Carol"]);
    expect(callArg.iswc).toBe("T-123.456.789-0");
    expect(callArg.org_id).toBe("org-1");
    expect(callArg.genero).toBe("pop");
  });
});
