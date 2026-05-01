// @ts-nocheck
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

const { updateFonogramaMock, addFonogramaMock } = vi.hoisted(() => ({
  updateFonogramaMock: vi.fn().mockResolvedValue({}),
  addFonogramaMock: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/hooks/useFonogramas", () => {
  const stableReturn = {
    fonogramas: [] as any[],
    isLoading: false,
    error: null,
    addFonograma: { mutateAsync: addFonogramaMock },
    updateFonograma: { mutateAsync: updateFonogramaMock },
    deleteFonograma: { mutateAsync: vi.fn() },
  };
  return { useFonogramas: () => stableReturn };
});

vi.mock("@/hooks/useObras", () => {
  const stableObras = [
    {
      id: "obra-1",
      titulo: "Canção Vinculada",
      genero: "pop",
      compositores: ["Alice"],
      status: "registrado",
    },
  ];
  const stableReturn = {
    obras: stableObras,
    isLoading: false,
    error: null,
    addObra: { mutateAsync: vi.fn() },
    updateObra: { mutateAsync: vi.fn() },
    deleteObra: { mutateAsync: vi.fn() },
  };
  return { useObras: () => stableReturn };
});

vi.mock("@/hooks/useCurrentOrgId", () => ({
  useCurrentOrgId: () => ({ orgId: "org-1", isLoading: false }),
}));

vi.mock("@/components/forms/AbramusSearchRow", () => ({
  AbramusSearchRow: () => null,
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { FonogramaFormModal } from "@/components/forms/FonogramaFormModal";

describe("FonogramaFormModal edit mode", () => {
  beforeEach(() => {
    updateFonogramaMock.mockClear();
    addFonogramaMock.mockClear();
  });

  const baseFonograma = {
    id: "fono-1",
    titulo: "Canção Vinculada",
    obra_id: "obra-1",
    isrc: "BR-ABC-25-12345",
    duracao: "04:20",
    gravadora: "Gravadora X",
    produtores: ["Pedro", "Marta"],
    status: "analise",
    org_id: "org-1",
  };

  it("pre-fills every field from the persisted fonograma row", async () => {
    render(
      <FonogramaFormModal
        open={true}
        onOpenChange={() => {}}
        mode="edit"
        fonograma={baseFonograma}
      />
    );

    // Linked obra is hydrated
    await waitFor(() => {
      expect(screen.getByTestId("text-obra-vinculada-titulo")).toHaveTextContent(
        "Canção Vinculada",
      );
    });

    // ISRC parts
    expect(screen.getByDisplayValue("BR")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ABC")).toBeInTheDocument();
    expect(screen.getByDisplayValue("25")).toBeInTheDocument();
    expect(screen.getByDisplayValue("12345")).toBeInTheDocument();

    // Duracao
    expect(screen.getByTestId("input-duracao-minutos")).toHaveValue("4");
    expect(screen.getByTestId("input-duracao-segundos")).toHaveValue("20");

    // Produtores carried over
    const nomeInputs = screen
      .getAllByPlaceholderText("Nome do participante")
      .map((el) => (el as HTMLInputElement).value);
    expect(nomeInputs).toEqual(expect.arrayContaining(["Pedro", "Marta"]));
  });

  it("saves edits via updateFonograma with the right payload", async () => {
    render(
      <FonogramaFormModal
        open={true}
        onOpenChange={vi.fn()}
        mode="edit"
        fonograma={baseFonograma}
      />
    );

    await waitFor(() => {
      expect(screen.getByTestId("text-obra-vinculada-titulo")).toBeInTheDocument();
    });

    // Edit ISRC designacao
    const designacao = screen.getByDisplayValue("12345") as HTMLInputElement;
    fireEvent.change(designacao, { target: { value: "99999" } });

    // Accept terms
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[checkboxes.length - 1]);

    fireEvent.click(screen.getByTestId("button-submit-fonograma"));

    await waitFor(() => {
      expect(updateFonogramaMock).toHaveBeenCalledTimes(1);
    });

    const callArg = updateFonogramaMock.mock.calls[0][0];
    expect(callArg.id).toBe("fono-1");
    expect(callArg.obra_id).toBe("obra-1");
    expect(callArg.isrc).toBe("BR-ABC-25-99999");
    expect(callArg.duracao).toBe("04:20");
    // The merged form persists Gravadora X via the agregadora field (mapped from gravadora)
    expect(callArg.agregadora).toBe("Gravadora X");
    // Produtores from the legacy column survive the round-trip via the participacao JSON
    const produtoresNames = (callArg.participacao?.produtorFonografico ?? []).map(
      (p: { nome: string }) => p.nome,
    );
    expect(produtoresNames).toEqual(expect.arrayContaining(["Pedro", "Marta"]));
    expect(callArg.status).toBe("analise");
    expect(callArg.org_id).toBe("org-1");
  });
});
