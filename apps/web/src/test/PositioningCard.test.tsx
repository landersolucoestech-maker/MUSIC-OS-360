// @ts-nocheck
// Component tests for PositioningCard (Phase 3.2 Part IV).
//
// Covers the acceptance criteria of item 74:
//   * a single main card/diagnosis (Career Stage)
//   * the benchmark is context, never a second diagnosis (no P77/"Forte" in the UI)
//   * friendly labels per platform, never the raw metric key
//   * a dimension without data shows "sem dado", never 0
//   * states: complete, partial (no data), loading, error, benchmark
//     refreshing/insufficient/stale/error — a benchmark failure never breaks
//     the already available Career Stage.
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "./_helpers/render-with-providers";

const mockCareerStage = vi.fn();
const mockBenchmark = vi.fn();

vi.mock("@/modules/artist/hooks/useCareerStage", () => ({
  useCareerStage: () => mockCareerStage(),
}));
vi.mock("@/modules/artist/hooks/useMarketBenchmark", () => ({
  useMarketBenchmark: () => mockBenchmark(),
}));

import { PositioningCard } from "@/modules/artist/components/PositioningCard";

function csResult(overrides = {}) {
  return {
    status: "OK",
    score: 5.6,
    classification: "Em Desenvolvimento",
    confidence: 62,
    coverage: 0.7,
    dimensions: [
      { key: "AUDIENCE", weight: 25, status: "AVAILABLE", score: 40, metricsUsed: [], evidence: [] },
      { key: "STREAMING", weight: 20, status: "UNAVAILABLE", score: null, metricsUsed: [], evidence: [] },
    ],
    positiveFactors: [],
    bottlenecks: [],
    engineVersion: "1.1.0",
    calculatedAt: "2026-08-31T00:00:00.000Z",
    freshness: "FRESH",
    ...overrides,
  };
}

function mbReady(overrides = {}) {
  return {
    readStatus: "READY",
    staleSince: null,
    result: {
      status: "OK",
      score: 77.2,
      label: "Forte",
      cohortDefinition: { sourceArtistUuid: "uuid-1", countryFilter: null, candidateCount: 20 },
      sampleSize: 20,
      fallbackLevel: 2,
      metrics: [
        {
          metricKey: "spotify.monthly_listeners",
          status: "AVAILABLE",
          artistValue: 174996,
          cohortMedian: 141394,
          percentile: 65,
          sampleSize: 20,
          sampleQuality: "MEDIUM",
          source: "soundcharts",
        },
      ],
      engineVersion: "2.0.0",
      calculatedAt: "2026-08-31T00:00:00.000Z",
    },
    ...overrides,
  };
}

describe("<PositioningCard />", () => {
  it("shows a single primary diagnosis, driven by Career Stage", () => {
    mockCareerStage.mockReturnValue({ data: csResult(), isLoading: false, isError: false });
    mockBenchmark.mockReturnValue({ data: mbReady(), isLoading: false, isError: false });
    renderWithProviders(<PositioningCard artistId="a1" />);
    expect(screen.getByText("Posicionamento da Carreira")).toBeInTheDocument();
    expect(screen.getByTestId("positioning-score-a1")).toHaveTextContent("5.6");
    expect(screen.getByTestId("positioning-classification-a1")).toHaveTextContent("Em Desenvolvimento");
  });

  it("never shows raw percentile/P77 or a competing qualitative label in the main view", () => {
    mockCareerStage.mockReturnValue({ data: csResult(), isLoading: false, isError: false });
    mockBenchmark.mockReturnValue({ data: mbReady(), isLoading: false, isError: false });
    const { container } = renderWithProviders(<PositioningCard artistId="a1" />);
    expect(screen.queryByText(/P77/)).not.toBeInTheDocument();
    expect(screen.queryByText("Forte")).not.toBeInTheDocument();
    expect(container.textContent).toContain("Melhor que 77% dos 20 artistas comparáveis");
  });

  it("uses friendly platform labels, never raw metric keys", () => {
    mockCareerStage.mockReturnValue({ data: csResult(), isLoading: false, isError: false });
    mockBenchmark.mockReturnValue({ data: mbReady(), isLoading: false, isError: false });
    renderWithProviders(<PositioningCard artistId="a1" />);
    expect(screen.getByText("Spotify · Ouvintes mensais")).toBeInTheDocument();
    expect(screen.queryByText("spotify.monthly_listeners")).not.toBeInTheDocument();
  });

  it("dimension without data shows 'sem dado', never zero", () => {
    mockCareerStage.mockReturnValue({ data: csResult(), isLoading: false, isError: false });
    mockBenchmark.mockReturnValue({ data: mbReady(), isLoading: false, isError: false });
    renderWithProviders(<PositioningCard artistId="a1" />);
    expect(screen.getByText("sem dado")).toBeInTheDocument();
  });

  it("career stage insufficient data: shows an honest empty state for the whole card", () => {
    mockCareerStage.mockReturnValue({ data: { status: "INSUFFICIENT_DATA", coverage: 0.1 }, isLoading: false, isError: false });
    mockBenchmark.mockReturnValue({ data: mbReady(), isLoading: false, isError: false });
    renderWithProviders(<PositioningCard artistId="a1" />);
    expect(screen.getByText(/Posicionamento não calculado/)).toBeInTheDocument();
  });

  it("career stage loading: shows skeleton placeholders, not an error", () => {
    mockCareerStage.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    mockBenchmark.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    renderWithProviders(<PositioningCard artistId="a1" />);
    expect(screen.queryByTestId("positioning-score-a1")).not.toBeInTheDocument();
    expect(screen.queryByText(/Integração indisponível/)).not.toBeInTheDocument();
  });

  it("career stage error: whole card shows an honest integration-unavailable message", () => {
    mockCareerStage.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    mockBenchmark.mockReturnValue({ data: mbReady(), isLoading: false, isError: false });
    renderWithProviders(<PositioningCard artistId="a1" />);
    expect(screen.getByText(/Integração indisponível/)).toBeInTheDocument();
  });

  it("benchmark REFRESHING with no result yet: career stage still renders, market section shows real searching state with no fabricated progress percentage", () => {
    mockCareerStage.mockReturnValue({ data: csResult(), isLoading: false, isError: false });
    mockBenchmark.mockReturnValue({ data: { readStatus: "REFRESHING", result: null, staleSince: null }, isLoading: false, isError: false });
    renderWithProviders(<PositioningCard artistId="a1" />);
    expect(screen.getByTestId("positioning-score-a1")).toBeInTheDocument();
    expect(screen.getByText(/Buscando artistas comparáveis reais/)).toBeInTheDocument();
    expect(screen.queryByText(/%\s*conclu[ií]do/i)).not.toBeInTheDocument();
  });

  it("benchmark INSUFFICIENT_MARKET_DATA: career stage still renders, market section honestly explains the insufficient cohort", () => {
    mockCareerStage.mockReturnValue({ data: csResult(), isLoading: false, isError: false });
    mockBenchmark.mockReturnValue({
      data: { readStatus: "READY", result: { status: "INSUFFICIENT_MARKET_DATA", sampleSize: 4 }, staleSince: null },
      isLoading: false,
      isError: false,
    });
    renderWithProviders(<PositioningCard artistId="a1" />);
    expect(screen.getByTestId("positioning-score-a1")).toBeInTheDocument();
    expect(screen.getByText(/4 artista\(s\) comparável\(is\)/)).toBeInTheDocument();
  });

  it("benchmark STALE: serves last known comparison instantly with an update indicator, never blocks career stage", () => {
    mockCareerStage.mockReturnValue({ data: csResult(), isLoading: false, isError: false });
    mockBenchmark.mockReturnValue({
      data: mbReady({ readStatus: "STALE", staleSince: "2026-08-30T00:00:00.000Z" }),
      isLoading: false,
      isError: false,
    });
    renderWithProviders(<PositioningCard artistId="a1" />);
    expect(screen.getByText(/Melhor que/)).toBeInTheDocument();
    expect(screen.getByText(/Atualizando em segundo plano/)).toBeInTheDocument();
  });

  it("benchmark failure never breaks career stage rendering", () => {
    mockCareerStage.mockReturnValue({ data: csResult(), isLoading: false, isError: false });
    mockBenchmark.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderWithProviders(<PositioningCard artistId="a1" />);
    expect(screen.getByTestId("positioning-score-a1")).toBeInTheDocument();
    expect(screen.getByText(/última tentativa de comparação falhou/)).toBeInTheDocument();
  });
});
