import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ReactNode } from "react";

const diagnosisRef = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock("../../services/musicIntelligenceEngine", () => ({
  loadReleaseContext: (artist: { id: string }, release: { id: string; label: string }) => ({
    artist,
    release,
    diagnosis: diagnosisRef.current,
    lyric: "some lyric",
    references: "some refs",
    audioUrl: "",
    coverUrl: "",
    artistHistory: [],
    relatedCampaigns: [],
    relatedMetrics: [],
    releaseDate: "",
    isrc: "",
    upc: "",
    credits: "",
  }),
  buildPitchingPrompt: () => "prompt",
}));
vi.mock("./Shared", () => ({
  WorkflowSection: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Field: ({ label, children }: { label: string; children: ReactNode }) => (
    <div data-testid={`field-${label}`}><span>{label}</span>{children}</div>
  ),
  EntitySelect: ({ onChange }: { onChange: (o: { id: string; label: string }) => void }) => (
    <button onClick={() => onChange({ id: "r1", label: "Release One" })}>pick-release</button>
  ),
  AsyncEntitySelect: ({ onChange }: { onChange: (o: { id: string; label: string }) => void }) => (
    <button onClick={() => onChange({ id: "a1", label: "Artist One" })}>pick-artist</button>
  ),
  StructuredResult: () => null,
  ResultActions: () => null,
  copyResult: vi.fn(),
}));

import { PitchingTab } from "./PitchingTab";
import type { IntelligenceSources } from "../../services/musicIntelligenceEngine";

const baseDiagnosis = {
  genre: "Pop", subgenre: "Indie Pop", bpm: "120", key: "C", mood: "Alegre", energy: "Alta", theme: "Amor",
  sentiment: "Positivo", targetAudience: "Jovens", editorialTags: [], playlistFit: [], platformPriority: [],
  commercialPotential: "Alto", viralPotential: "Medio", syncPotential: "Baixo", missingData: [],
};

function open(diagnosis: Record<string, unknown>) {
  diagnosisRef.current = { ...baseDiagnosis, ...diagnosis };
  render(
    <PitchingTab
      sources={{ releases: [], suggestions: [] } as unknown as IntelligenceSources}
      onGenerate={vi.fn()}
      isGenerating={false}
    />,
  );
  fireEvent.click(screen.getByText("pick-artist"));
  fireEvent.click(screen.getByText("pick-release"));
}

const NOTE = "Pendente para revisão manual ou inferência da IA.";
const valueBox = (label: string) => (screen.getByTestId(`field-${label}`).children[1] as HTMLElement).textContent;
const hasNote = (label: string) => screen.getByTestId(`field-${label}`).textContent?.includes(NOTE) ?? false;

// The pending sentinel is "pending" (canonical) or the deprecated PT-BR spelling; real values must be shown as-is.
describe("PitchingTab diagnosis review pending values", () => {
  it("shows real values untouched and without the pending note", () => {
    open({});
    expect(valueBox("Gênero detectado")).toBe("Pop");
    expect(valueBox("BPM detectado")).toBe("120");
    expect(hasNote("Gênero detectado")).toBe(false);
    expect(hasNote("BPM detectado")).toBe(false);
  });

  it.each([
    ["canonical sentinel", "pending"],
    ["deprecated PT-BR sentinel", "pendente"],
    ["empty value", ""],
  ])("shows Pendente plus the manual-review note for the %s", (_label, value) => {
    open({ genre: value, bpm: value });
    expect(valueBox("Gênero detectado")).toBe("Pendente");
    expect(hasNote("Gênero detectado")).toBe(true);
    expect(valueBox("BPM detectado")).toBe("Pendente");
    expect(hasNote("BPM detectado")).toBe(true);
  });

  it("only the pending field is flagged, its neighbours keep their value", () => {
    open({ subgenre: "pendente" });
    expect(valueBox("Subgênero detectado")).toBe("Pendente");
    expect(valueBox("Clima detectado")).toBe("Alegre");
    expect(hasNote("Clima detectado")).toBe(false);
  });
});
