// PhonogramViewModal — CZ-040: reads the canonical (English) phonogram fields and
// renders PT-BR labels only; raw country/media/classification/aggregator/status
// codes never reach the UI, and pre-CZ-040 Portuguese fields are ignored.
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import React from "react";
import { renderWithProviders } from "./_helpers/render-with-providers";

vi.mock("@/shared/lib/storage", async () => {
  const actual = await vi.importActual<typeof import("@/shared/lib/storage")>("@/shared/lib/storage");
  return {
    ...actual,
    storage: {
      ...actual.storage,
      findById: vi.fn(async () => undefined),
    },
  };
});

import { PhonogramViewModal } from "@/modules/catalog/components/PhonogramViewModal";

const phonogram = {
  id: "fono-1",
  title: "Gravação Vista",
  status: "registered",
  ecad_code: "ECAD-7",
  society_code: "SOC-7",
  aggregator: "other",
  isrc: "BRABC2512345",
  duration_seconds: 185,
  media_type: "physical",
  recording_classification: "live",
  country_of_recording: "GB",
  publication_country: "ZZ",
  record_label_name: "Selo Z",
  issue_date: "2026-01-31",
  recording_date: "2025-12-01T00:00:00.000Z",
  participation: {
    phonographic_producers: [{ id: "p1", name: "Pedro", percentage: "41.7" }],
    performers: [{ id: "p2", name: "Ana", percentage: "20" }],
    session_musicians: [],
  },
};

describe("PhonogramViewModal (canonical CZ-040 contract)", () => {
  it("renders PT-BR labels for every coded field", () => {
    renderWithProviders(<PhonogramViewModal open onOpenChange={() => {}} phonogram={phonogram} />);

    expect(screen.getByText("Reino Unido")).toBeInTheDocument();
    expect(screen.getByText("Outro")).toBeInTheDocument();
    expect(screen.getByText("Física")).toBeInTheDocument();
    expect(screen.getByText("Ao vivo")).toBeInTheDocument();
    expect(screen.getByText("Outra")).toBeInTheDocument();
    expect(screen.getByText("Registrado")).toBeInTheDocument();
    expect(screen.getByText("3min 5seg")).toBeInTheDocument();
    expect(screen.getByText("31/01/2026")).toBeInTheDocument();
    expect(screen.getByText("01/12/2025")).toBeInTheDocument();
    expect(screen.getByText("BR-ABC-25-12345")).toBeInTheDocument();
    expect(screen.getByText("ECAD-7")).toBeInTheDocument();
    expect(screen.getByText("SOC-7")).toBeInTheDocument();
    expect(screen.getByText("Selo Z")).toBeInTheDocument();
    // Participants: canonical `name` / `percentage`
    expect(screen.getByText("Pedro")).toBeInTheDocument();
    expect(screen.getByText("41.7%")).toBeInTheDocument();
    expect(screen.getByText("Ana")).toBeInTheDocument();

    for (const raw of ["GB", "ZZ", "physical", "live", "other", "registered"]) {
      expect(screen.queryByText(raw)).not.toBeInTheDocument();
    }
  });

  it("shows — for a country code outside the catalog and ignores pre-CZ-040 fields", () => {
    renderWithProviders(
      <PhonogramViewModal
        open
        onOpenChange={() => {}}
        phonogram={{
          id: "fono-2",
          title: "Legado",
          country_of_recording: "FR",
          gravadora: "Gravadora Antiga",
          cod_ecad: "LEGACY",
          pais_publicacao: "brazil",
          midia: "digital",
          participacao: { produtorFonografico: [{ id: "x", nome: "Velho", percentual: "10" }] },
        }}
      />,
    );
    expect(screen.queryByText("FR")).not.toBeInTheDocument();
    expect(screen.queryByText("Gravadora Antiga")).not.toBeInTheDocument();
    expect(screen.queryByText("LEGACY")).not.toBeInTheDocument();
    expect(screen.queryByText("Brasil")).not.toBeInTheDocument();
    expect(screen.queryByText("Digital")).not.toBeInTheDocument();
    expect(screen.queryByText("Velho")).not.toBeInTheDocument();
    expect(screen.getAllByText("Nenhum participante adicionado.")).toHaveLength(3);
  });
});
