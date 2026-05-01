// @ts-nocheck
// Component tests para PlatformMiniTrend (Task #361).
//
// Cobre o uso compacto do chip de tendência nos tiles de métrica e
// principalmente o novo `showEmptyState` que faz o chip aparecer como
// "— sem histórico" no dashboard 360 quando ainda não há snapshot
// suficiente. Garante também que `showSparkline={false}` esconde a
// sparkline quando só queremos o badge no dashboard 360.
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { PlatformMiniTrend } from "@/components/forms/PlatformMiniTrend";
import type { MetricEvolutionPoint } from "@/hooks/useSpotify";

function point(date: string, followers: number | null): MetricEvolutionPoint {
  return { captured_at: date, followers, popularity: null, views: null };
}

describe("<PlatformMiniTrend />", () => {
  it("não renderiza nada quando não há histórico e showEmptyState é false (padrão)", () => {
    const { container } = render(
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

  it("renderiza placeholder '— sem histórico' quando showEmptyState=true e não há pontos", () => {
    render(
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

  it("renderiza placeholder também com apenas 1 snapshot (trend ainda indeterminado)", () => {
    render(
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

  it("renderiza badge 'em crescimento' com percentual positivo quando há crescimento", () => {
    render(
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
    // Empty state não aparece quando há trend válido
    expect(
      screen.queryByTestId("visao360-spotify-trend-empty"),
    ).not.toBeInTheDocument();
  });

  it("renderiza badge 'em queda' quando o snapshot mais recente é menor", () => {
    render(
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

  it("renderiza badge 'estável' quando os snapshots são iguais", () => {
    render(
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

  it("oculta a sparkline quando showSparkline=false (modo chip puro do 360)", () => {
    render(
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

  it("renderiza sparkline por padrão quando há histórico suficiente", () => {
    render(
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
