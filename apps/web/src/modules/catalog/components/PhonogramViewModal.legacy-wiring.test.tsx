// @ts-nocheck
// PhonogramViewModal reads the record only through phonogramToFormFields: a record that carries
// the full `isrc` (no split columns) and only `duration_text` still shows ISRC parts, duration and codes.
import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import React from "react";
import { renderWithProviders } from "@/test/_helpers/render-with-providers";

vi.mock("@/shared/hooks/useEntityLookup", () => ({
  useEntityById: () => ({ entity: undefined }),
}));

import { PhonogramViewModal } from "@/modules/catalog/components/PhonogramViewModal";

function fieldValue(label: string): string {
  const labelEl = screen.getByText(label);
  return (labelEl.nextElementSibling as HTMLElement).textContent ?? "";
}

describe("PhonogramViewModal renders through phonogramToFormFields", () => {
  it("record with only the full ISRC and duration_text shows split ISRC, duration, codes and status", () => {
    renderWithProviders(
      <PhonogramViewModal
        open={true}
        onOpenChange={() => {}}
        phonogram={{
          id: "pho-1",
          title: "Faixa Legada",
          status: "registered",
          isrc: "BRXYZ2400042",
          duration_text: "03:07",
          ecad_code: "ECAD-77",
          society_code: "SOC-1",
          music_genre: "samba",
          record_label_name: "Gravadora Antiga",
          is_instrumental: true,
          notes: "observacao legada",
          participation: {
            phonographic_producers: [{ id: "p1", name: "Produtor Um", percentage: "50" }],
            performers: [],
            session_musicians: [],
          },
        }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Faixa Legada" })).toBeInTheDocument();
    expect(fieldValue("ISRC")).toBe("BR-XYZ-24-00042");
    expect(fieldValue("Duração")).toBe("3min 7seg");
    expect(fieldValue("Código ECAD")).toBe("ECAD-77");
    expect(fieldValue("Código de Cadastro da Sociedade")).toBe("SOC-1");
    expect(fieldValue("Gênero Musical")).toBe("samba");
    expect(fieldValue("Gravadora")).toBe("Gravadora Antiga");
    expect(screen.getByText("observacao legada")).toBeInTheDocument();
    expect(screen.getByText("Produtor Um")).toBeInTheDocument();
    expect(screen.getByText("Total: 50.00% de 100%")).toBeInTheDocument();
  });

  it("negative: a record without ISRC/duration/codes renders placeholders, not raw record values", () => {
    renderWithProviders(
      <PhonogramViewModal open={true} onOpenChange={() => {}} phonogram={{ id: "pho-2", status: "pending" }} />,
    );
    expect(screen.getByText("Fonograma sem título")).toBeInTheDocument();
    expect(fieldValue("ISRC")).toBe("—");
    expect(fieldValue("Duração")).toBe("—");
    expect(fieldValue("Código ECAD")).toBe("—");
    expect(screen.getByText("Total: 0.00% de 100%")).toBeInTheDocument();
  });
});
