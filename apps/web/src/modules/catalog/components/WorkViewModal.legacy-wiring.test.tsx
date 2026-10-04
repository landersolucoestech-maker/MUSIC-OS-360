// @ts-nocheck
// WorkViewModal reads every section through the canonical-first mapper readers. A work that only
// carries derived name lists / delimited strings is expanded; flags are real booleans (negative case).
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import React from "react";
import { renderWithProviders } from "@/test/_helpers/render-with-providers";

vi.mock("@/shared/hooks/useEntityLookup", () => ({
  useEntityById: () => ({ entity: undefined }),
}));

import { WorkViewModal } from "@/modules/catalog/components/WorkViewModal";

const switchOf = (label: string) =>
  screen.getByText(label).parentElement!.querySelector('[role="switch"]') as HTMLElement;
const valueOf = (label: string) => (screen.getByText(label).nextElementSibling as HTMLElement).textContent;

function renderWork(work: Record<string, unknown>) {
  return renderWithProviders(<WorkViewModal open={true} onOpenChange={() => {}} work={work} />);
}

describe("WorkViewModal renders through the mapper readers", () => {
  it("work with delimited strings, name lists and AI blocks renders every section", () => {
    renderWork({
      id: "w1",
      title: "Obra Legada",
      status: "registered",
      duration_text: "03:07",
      is_instrumental: true,
      ai_used: true,
      ai_usage_level: "partial",
      ai_harmony: { tool: "HarmonyTool", prompt: "harmony prompt text" },
      ai_melody: { tool: "MelodyTool", prompt: "" },
      ai_lyrics: { tool: "", prompt: "lyrics prompt text" },
      alternative_titles: "Titulo Alt Um; Titulo Alt Dois",
      related_references: "Ref Um, Ref Dois",
      lyrics: "linha 1\nlinha 2",
      composer_names: ["Compositor Legado"],
      translator_names: ["Tradutor Legado"],
    });
    expect(valueOf("Duração")).toBe("3min 7seg");
    expect(switchOf("Instrumental")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Inteligência Artificial")).toBeInTheDocument();
    expect(switchOf("Criada por IA")).toHaveAttribute("aria-checked", "true");
    expect(valueOf("Tipo de Geração IA")).toBe("Parcialmente");
    expect(screen.getByText("Elementos IA: Harmonia, Melodia, Letra")).toBeInTheDocument();
    expect(screen.getByText("HarmonyTool")).toBeInTheDocument();
    expect(screen.getByText("harmony prompt text")).toBeInTheDocument();
    expect(screen.getByText("MelodyTool")).toBeInTheDocument();
    expect(screen.getByText("lyrics prompt text")).toBeInTheDocument();
    expect(screen.getByText("Titulo Alt Um")).toBeInTheDocument();
    expect(screen.getByText("Titulo Alt Dois")).toBeInTheDocument();
    expect(screen.getByText("Ref Um")).toBeInTheDocument();
    expect(screen.getByText("Ref Dois")).toBeInTheDocument();
    expect(screen.getByText(/linha 1/)).toBeInTheDocument();
    expect(screen.getByText("Compositor Legado")).toBeInTheDocument();
    expect(screen.getByText("Tradutor Legado")).toBeInTheDocument();
    expect(screen.getByText("Compositor/Autor")).toBeInTheDocument();
    expect(screen.getByText("Tradutor")).toBeInTheDocument();
    expect(screen.queryByText(/\[object Object\]/)).toBeNull();
  });

  it("negative: a plain work shows no AI/titles/references/lyrics/participants sections and unchecked flags", () => {
    renderWork({ id: "w2", title: "Obra Simples", status: "pending", is_instrumental: false, ai_used: false });
    expect(switchOf("Instrumental")).toHaveAttribute("aria-checked", "false");
    expect(screen.queryByText("Inteligência Artificial")).toBeNull();
    expect(screen.queryByText("Outros Títulos")).toBeNull();
    expect(screen.queryByText("Referências Conectadas")).toBeNull();
    expect(screen.queryByText("Letra")).toBeNull();
    expect(screen.queryByText(/Participantes/)).toBeNull();
    expect(valueOf("Duração")).toBe("—");
    expect(screen.queryByText(/\[object Object\]/)).toBeNull();
  });

  it("negative: ai_used true without level/elements shows the switch on, no level and no element blocks", () => {
    renderWork({ id: "w3", title: "Obra IA", status: "pending", ai_used: true, ai_usage_level: "bogus", ai_harmony: "x" });
    expect(switchOf("Criada por IA")).toHaveAttribute("aria-checked", "true");
    expect(valueOf("Tipo de Geração IA")).toBe("—");
    expect(screen.queryByText(/Elementos IA/)).toBeNull();
  });
});
