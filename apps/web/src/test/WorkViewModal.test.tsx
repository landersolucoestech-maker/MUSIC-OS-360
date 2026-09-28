// WorkViewModal — CZ-039: reads the canonical (English) work fields and renders
// PT-BR labels only; raw role/language/AI-level/origin values never reach the UI.
import { describe, it, expect, vi } from "vitest";
import { screen, within } from "@testing-library/react";
import React from "react";
import { renderWithProviders } from "./_helpers/render-with-providers";

// GET /works/:id refresh — returns nothing so the component renders the given record.
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

import { WorkViewModal } from "@/modules/catalog/components/WorkViewModal";

const work = {
  id: "work-1",
  title: "Canção Vista",
  status: "registered",
  music_genre: "pop",
  language: "pt",
  duration_text: "03:05",
  is_instrumental: true,
  ecad_code: "ECAD-9",
  society_code: "SOC-9",
  iswc: "T-1",
  ai_used: true,
  ai_usage_level: "partial" as const,
  ai_harmony: { tool: "Suno", prompt: "chords" },
  ai_melody: null,
  ai_lyrics: null,
  alternative_titles: ["Outro Título"],
  related_references: ["https://ref.test"],
  lyrics: "La la la",
  work_origin: "original" as const,
  participants: [
    { id: "p-1", name: "Alice", role: "composer_author", link: null, percentage: "60.000" },
    { id: "p-2", name: "Carol", role: "translator", link: null, percentage: "40.000" },
    { id: "p-3", name: "Dan", role: "unspecified", link: null, percentage: null },
  ],
};

describe("WorkViewModal (canonical work → PT-BR labels)", () => {
  it("renders participant roles as PT-BR labels, never the raw role values", () => {
    renderWithProviders(<WorkViewModal open={true} onOpenChange={() => {}} work={work} />);

    expect(screen.getByTestId("badge-participant-role-p-1")).toHaveTextContent("Compositor/Autor");
    expect(screen.getByTestId("badge-participant-role-p-2")).toHaveTextContent("Tradutor");
    expect(screen.getByTestId("badge-participant-role-p-3")).toHaveTextContent("Não informado");
    for (const raw of ["composer_author", "translator", "unspecified"]) {
      expect(screen.queryByText(raw)).not.toBeInTheDocument();
    }
  });

  it("renders the language label for the ISO code, the AI usage level label and the origin badge", () => {
    renderWithProviders(<WorkViewModal open={true} onOpenChange={() => {}} work={work} />);

    const languageField = screen.getByText("Idioma").parentElement as HTMLElement;
    expect(within(languageField).getByText("Português")).toBeInTheDocument();
    expect(within(languageField).queryByText("pt")).not.toBeInTheDocument();

    const aiLevelField = screen.getByText("Tipo de Geração IA").parentElement as HTMLElement;
    expect(within(aiLevelField).getByText("Parcialmente")).toBeInTheDocument();
    expect(screen.queryByText("partial")).not.toBeInTheDocument();

    expect(screen.getByTestId("badge-work-origin-original")).toHaveTextContent("Obra Autoral");
    expect(screen.getByText("ECAD-9")).toBeInTheDocument();
    expect(screen.getByText("SOC-9")).toBeInTheDocument();
    expect(screen.getByText("Outro Título")).toBeInTheDocument();
    expect(screen.getByText("La la la")).toBeInTheDocument();
    expect(screen.getByText("Suno")).toBeInTheDocument();
  });

  it("shows '—' for a language code outside the catalog instead of the raw code", () => {
    renderWithProviders(
      <WorkViewModal open={true} onOpenChange={() => {}} work={{ ...work, language: "xx-unknown" }} />,
    );
    const languageField = screen.getByText("Idioma").parentElement as HTMLElement;
    expect(within(languageField).getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("xx-unknown")).not.toBeInTheDocument();
  });
});
