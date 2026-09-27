// @ts-nocheck
// Component tests for PlatformMiniTrend (Task #361).
//
// Covers the compact use of the trend chip in the metric tiles and
// mainly the new `showEmptyState`, which makes the chip appear as
// "— sem histórico" in the 360 dashboard when there is not yet enough
// snapshot data. Also ensures `showSparkline={false}` hides the
// sparkline when we only want the badge in the 360 dashboard.
import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "./_helpers/render-with-providers";

import { PlatformMiniTrend } from "@/modules/artist/components/PlatformMiniTrend";
type MetricEvolutionPoint = { date: string; captured_at?: string; followers?: number | null; popularity?: number | null; views?: number | null; [key: string]: unknown; };

function point(date: string, followers: number | null): MetricEvolutionPoint {
  return { captured_at: date, followers, popularity: null, views: null };
}

describe("<PlatformMiniTrend />", () => {
  it("renders nothing when there is no history and showEmptyState is false (default)", () => {
    const { container } = renderWithProviders(
      <PlatformMiniTrend points={[]} testIdPrefix="mini-spotify" />,
    );
    expect(container.firstChild).toBeNull();
    expect(
      screen.queryByTestId("mini-spotify-trend-empty"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("mini-spotify-trend-badge"),
    ).not.toBeInTheDocument();
  });

  it("renders the '— sem histórico' placeholder when showEmptyState=true and there are no points", () => {
    renderWithProviders(
      <PlatformMiniTrend
        points={[]}
        showEmptyState
        testIdPrefix="visao360-spotify"
      />,
    );
    const empty = screen.getByTestId("visao360-spotify-trend-empty");
    expect(empty).toBeInTheDocument();
    expect(empty).toHaveTextContent(/sem histórico/i);
    expect(empty).toHaveAttribute("aria-label", "sem histórico ainda");
    expect(
      screen.queryByTestId("visao360-spotify-trend-badge"),
    ).not.toBeInTheDocument();
  });

  it("also renders the placeholder with a single snapshot (trend still undetermined)", () => {
    renderWithProviders(
      <PlatformMiniTrend
        points={[point("2026-04-30T06:20:00Z", 1234)]}
        showEmptyState
        testIdPrefix="visao360-deezer"
      />,
    );
    expect(
      screen.getByTestId("visao360-deezer-trend-empty"),
    ).toBeInTheDocument();
  });

  it("renders the 'em crescimento' badge with a positive percentage when growing", () => {
    renderWithProviders(
      <PlatformMiniTrend
        points={[
          point("2026-04-01T06:20:00Z", 1000),
          point("2026-04-30T06:20:00Z", 1042),
        ]}
        showEmptyState
        testIdPrefix="visao360-spotify"
      />,
    );
    const badge = screen.getByTestId("visao360-spotify-trend-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("aria-label", "em crescimento");
    expect(screen.getByTestId("visao360-spotify-trend-pct")).toHaveTextContent(
      /\+4\.2%/,
    );
    // The empty state does not appear when there is a valid trend
    expect(
      screen.queryByTestId("visao360-spotify-trend-empty"),
    ).not.toBeInTheDocument();
  });

  it("renders the 'em queda' badge when the latest snapshot is lower", () => {
    renderWithProviders(
      <PlatformMiniTrend
        points={[
          point("2026-04-01T06:20:00Z", 1000),
          point("2026-04-30T06:20:00Z", 989),
        ]}
        showEmptyState
        testIdPrefix="visao360-youtube"
      />,
    );
    const badge = screen.getByTestId("visao360-youtube-trend-badge");
    expect(badge).toHaveAttribute("aria-label", "em queda");
    expect(screen.getByTestId("visao360-youtube-trend-pct")).toHaveTextContent(
      /−1\.1%/,
    );
  });

  it("renders the 'estável' badge when snapshots are equal", () => {
    renderWithProviders(
      <PlatformMiniTrend
        points={[
          point("2026-04-01T06:20:00Z", 500),
          point("2026-04-30T06:20:00Z", 500),
        ]}
        testIdPrefix="visao360-deezer"
      />,
    );
    const badge = screen.getByTestId("visao360-deezer-trend-badge");
    expect(badge).toHaveAttribute("aria-label", "estável");
    expect(screen.getByTestId("visao360-deezer-trend-pct")).toHaveTextContent(
      /\+0/,
    );
  });

  it("hides the sparkline when showSparkline=false (360 pure chip mode)", () => {
    renderWithProviders(
      <PlatformMiniTrend
        points={[
          point("2026-04-01T06:20:00Z", 1000),
          point("2026-04-15T06:20:00Z", 1100),
          point("2026-04-30T06:20:00Z", 1200),
        ]}
        showSparkline={false}
        testIdPrefix="visao360-spotify"
      />,
    );
    expect(
      screen.getByTestId("visao360-spotify-trend-badge"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("visao360-spotify-sparkline"),
    ).not.toBeInTheDocument();
  });

  it("renders a sparkline by default when history is sufficient", () => {
    renderWithProviders(
      <PlatformMiniTrend
        points={[
          point("2026-04-01T06:20:00Z", 1000),
          point("2026-04-15T06:20:00Z", 1100),
          point("2026-04-30T06:20:00Z", 1200),
        ]}
        testIdPrefix="mini-spotify"
      />,
    );
    expect(
      screen.getByTestId("mini-spotify-sparkline"),
    ).toBeInTheDocument();
  });
});
