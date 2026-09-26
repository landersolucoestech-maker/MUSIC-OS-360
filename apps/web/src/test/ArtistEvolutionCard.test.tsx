// @ts-nocheck
// Component tests for ArtistEvolutionCard (Task #358).
//
// Covers the 5 business-rule scenarios:
//   * 0 snapshots → empty state "Sem histórico suficiente ainda"
//   * 1 snapshot  → shows the current value but still no trend
//   * 2+ growing  → trend "up" + positive percentage + chart
//   * 2+ declining → trend "down" + negative percentage + chart
//   * 2+ flat     → trend "flat" + 0%
// Also: isLoading (skeleton), isMissingConfig, errorMessage.
import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "./_helpers/render-with-providers";
import { Music2 } from "lucide-react";

// recharts uses ResizeObserver; the setup already injects a polyfill but the
// Responsive container only renders when width > 0. Stub to guarantee the chart is in the DOM.
vi.mock("recharts", async () => {
  const actual: any = await vi.importActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => (
      <div style={{ width: 400, height: 200 }}>{children}</div>
    ),
  };
});

import {
  ArtistEvolutionCard,
  computeEvolutionSummary,
  type EvolutionSummary,
} from "@/modules/artist/components/ArtistEvolutionCard";
type MetricEvolutionPoint = { date: string; captured_at?: string; followers?: number | null; popularity?: number | null; views?: number | null; [key: string]: unknown; };

function point(date: string, followers: number | null): MetricEvolutionPoint {
  return { captured_at: date, followers, popularity: null, views: null };
}

const baseProps = {
  title: "Spotify",
  subtitle: "Seguidores",
  Icon: Music2,
  accent: "#1DB954",
  metric: "followers" as const,
  metricLabel: "Seguidores",
  testIdPrefix: "evolucao-spotify",
};

describe("computeEvolutionSummary", () => {
  it("returns an empty state when there are no snapshots", () => {
    const s = computeEvolutionSummary([], "followers");
    expect(s).toMatchObject({
      current: null,
      previous: null,
      delta: null,
      percent: null,
      direction: "flat",
      hasEnoughData: false,
    });
  });

  it("returns current but hasEnoughData=false with 1 snapshot", () => {
    const s = computeEvolutionSummary(
      [point("2026-04-01T06:20:00Z", 100)],
      "followers",
    );
    expect(s.current).toBe(100);
    expect(s.hasEnoughData).toBe(false);
    expect(s.percent).toBeNull();
  });

  it("computes growth between the oldest and the most recent snapshot", () => {
    const s = computeEvolutionSummary(
      [
        point("2026-04-01T06:20:00Z", 100),
        point("2026-04-15T06:20:00Z", 110),
        point("2026-04-30T06:20:00Z", 130),
      ],
      "followers",
    );
    expect(s.hasEnoughData).toBe(true);
    expect(s.current).toBe(130);
    expect(s.previous).toBe(100);
    expect(s.delta).toBe(30);
    expect(s.percent).toBe(30);
    expect(s.direction).toBe("up");
  });

  it("computes a drop when the last snapshot is lower than the first", () => {
    const s = computeEvolutionSummary(
      [
        point("2026-04-01T06:20:00Z", 200),
        point("2026-04-30T06:20:00Z", 150),
      ],
      "followers",
    );
    expect(s.direction).toBe("down");
    expect(s.delta).toBe(-50);
    expect(s.percent).toBe(-25);
  });

  it("considers it stable when current == previous", () => {
    const s = computeEvolutionSummary(
      [
        point("2026-04-01T06:20:00Z", 100),
        point("2026-04-30T06:20:00Z", 100),
      ],
      "followers",
    );
    expect(s.direction).toBe("flat");
    expect(s.delta).toBe(0);
    expect(s.percent).toBe(0);
  });

  it("returns percent=null when previous=0 (avoids division by zero)", () => {
    const s = computeEvolutionSummary(
      [
        point("2026-04-01T06:20:00Z", 0),
        point("2026-04-30T06:20:00Z", 50),
      ],
      "followers",
    );
    expect(s.delta).toBe(50);
    expect(s.percent).toBeNull();
    expect(s.direction).toBe("up");
  });

  it("ignores points with a null value for the selected metric", () => {
    const s = computeEvolutionSummary(
      [
        point("2026-04-01T06:20:00Z", null),
        point("2026-04-15T06:20:00Z", 100),
        point("2026-04-30T06:20:00Z", 150),
      ],
      "followers",
    );
    expect(s.previous).toBe(100);
    expect(s.current).toBe(150);
    expect(s.hasEnoughData).toBe(true);
  });
});

describe("<ArtistEvolutionCard />", () => {
  it("0 snapshots: renders an empty state without a chart", () => {
    renderWithProviders(
      <ArtistEvolutionCard
        {...baseProps}
        isLoading={false}
        points={[]}
      />,
    );
    expect(
      screen.getByTestId("evolucao-spotify-empty"),
    ).toHaveTextContent(/sem histórico suficiente/i);
    expect(
      screen.queryByTestId("evolucao-spotify-trend"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("evolucao-spotify-chart"),
    ).not.toBeInTheDocument();
    // current still exists but shows "—" because there is no value
    expect(screen.getByTestId("evolucao-spotify-current")).toHaveTextContent("—");
  });

  it("1 snapshot: shows the current value but still no trend or chart", () => {
    renderWithProviders(
      <ArtistEvolutionCard
        {...baseProps}
        isLoading={false}
        points={[point("2026-04-30T06:20:00Z", 1234)]}
      />,
    );
    expect(screen.getByTestId("evolucao-spotify-current")).toHaveTextContent(
      "1.234",
    );
    expect(
      screen.getByTestId("evolucao-spotify-empty"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("evolucao-spotify-trend"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("evolucao-spotify-chart"),
    ).not.toBeInTheDocument();
  });

  it("2+ growing snapshots: shows trend up, percentage and chart", () => {
    renderWithProviders(
      <ArtistEvolutionCard
        {...baseProps}
        isLoading={false}
        points={[
          point("2026-04-01T06:20:00Z", 1000),
          point("2026-04-15T06:20:00Z", 1100),
          point("2026-04-30T06:20:00Z", 1500),
        ]}
      />,
    );
    expect(screen.getByTestId("evolucao-spotify-current")).toHaveTextContent(
      "1.500",
    );
    const trend = screen.getByTestId("evolucao-spotify-trend");
    expect(trend).toBeInTheDocument();
    expect(trend).toHaveAttribute("aria-label", "Métrica em crescimento");
    expect(screen.getByTestId("evolucao-spotify-percent")).toHaveTextContent(
      /\+50/,
    );
    expect(screen.getByTestId("evolucao-spotify-chart")).toBeInTheDocument();
    // absolute delta: +500 (formatted as 500)
    expect(screen.getByTestId("evolucao-spotify-delta")).toHaveTextContent(
      /500 no per/i,
    );
  });

  it("2+ declining snapshots: shows trend down and negative percentage", () => {
    renderWithProviders(
      <ArtistEvolutionCard
        {...baseProps}
        isLoading={false}
        points={[
          point("2026-04-01T06:20:00Z", 2000),
          point("2026-04-30T06:20:00Z", 1500),
        ]}
      />,
    );
    expect(screen.getByTestId("evolucao-spotify-current")).toHaveTextContent(
      "1.500",
    );
    const trend = screen.getByTestId("evolucao-spotify-trend");
    expect(trend).toHaveAttribute("aria-label", "Métrica em queda");
    expect(screen.getByTestId("evolucao-spotify-percent")).toHaveTextContent(
      /−25/,
    );
    expect(screen.getByTestId("evolucao-spotify-chart")).toBeInTheDocument();
  });

  it("2+ equal snapshots: shows trend flat and 0%", () => {
    renderWithProviders(
      <ArtistEvolutionCard
        {...baseProps}
        isLoading={false}
        points={[
          point("2026-04-01T06:20:00Z", 500),
          point("2026-04-30T06:20:00Z", 500),
        ]}
      />,
    );
    const trend = screen.getByTestId("evolucao-spotify-trend");
    expect(trend).toHaveAttribute("aria-label", "Métrica estável");
    expect(screen.getByTestId("evolucao-spotify-percent")).toHaveTextContent(
      /\+0/,
    );
    expect(screen.getByTestId("evolucao-spotify-chart")).toBeInTheDocument();
  });

  it("isMissingConfig: renders the label for an unconfigured platform", () => {
    renderWithProviders(
      <ArtistEvolutionCard
        {...baseProps}
        isLoading={false}
        isMissingConfig
        missingConfigLabel="Sem perfil cadastrado."
        points={undefined}
      />,
    );
    expect(screen.getByText(/sem perfil cadastrado/i)).toBeInTheDocument();
    expect(
      screen.queryByTestId("evolucao-spotify-current"),
    ).not.toBeInTheDocument();
  });

  it("isLoading: renders skeletons in place of the content", () => {
    const { container } = renderWithProviders(
      <ArtistEvolutionCard
        {...baseProps}
        isLoading
        points={undefined}
      />,
    );
    expect(
      screen.queryByTestId("evolucao-spotify-current"),
    ).not.toBeInTheDocument();
    // two skeletons (value + chart)
    expect(container.querySelectorAll(".bg-muted").length)
      .toBeGreaterThanOrEqual(1);
  });

  it("errorMessage: renders the error message prominently", () => {
    renderWithProviders(
      <ArtistEvolutionCard
        {...baseProps}
        isLoading={false}
        errorMessage="Falha ao carregar histórico."
        points={undefined}
      />,
    );
    expect(screen.getByText(/falha ao carregar/i)).toBeInTheDocument();
    expect(
      screen.queryByTestId("evolucao-spotify-current"),
    ).not.toBeInTheDocument();
  });
});

