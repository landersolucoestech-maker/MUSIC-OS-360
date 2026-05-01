// @ts-nocheck
// Component tests para ArtistaEvolutionCard (Task #358).
//
// Cobre os 5 cenários da regra de negócio:
//   * 0 snapshots → estado vazio "Sem histórico suficiente ainda"
//   * 1 snapshot  → mostra valor atual mas ainda sem trend
//   * 2+ growing  → trend "up" + percentual positivo + chart
//   * 2+ declining → trend "down" + percentual negativo + chart
//   * 2+ flat     → trend "flat" + 0%
// E também: isLoading (skeleton), isMissingConfig, errorMessage.
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Music2 } from "lucide-react";

// recharts usa ResizeObserver; o setup já injeta um polyfill mas o Responsive
// container só renderiza quando width > 0. Stub para garantir o chart no DOM.
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
  ArtistaEvolutionCard,
  computeEvolutionSummary,
  type EvolutionSummary,
} from "@/components/forms/ArtistaEvolutionCard";
import type { MetricEvolutionPoint } from "@/hooks/useSpotify";

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
  it("retorna estado vazio quando não há snapshots", () => {
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

  it("retorna current mas hasEnoughData=false com 1 snapshot", () => {
    const s = computeEvolutionSummary(
      [point("2026-04-01T06:20:00Z", 100)],
      "followers",
    );
    expect(s.current).toBe(100);
    expect(s.hasEnoughData).toBe(false);
    expect(s.percent).toBeNull();
  });

  it("calcula crescimento entre o snapshot mais antigo e o mais recente", () => {
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

  it("calcula queda quando o último snapshot é menor que o primeiro", () => {
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

  it("considera estável quando current == previous", () => {
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

  it("retorna percent=null quando previous=0 (evita divisão por zero)", () => {
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

  it("ignora pontos com valor null para a métrica selecionada", () => {
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

describe("<ArtistaEvolutionCard />", () => {
  it("0 snapshots: renderiza estado vazio sem chart", () => {
    render(
      <ArtistaEvolutionCard
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
    // current ainda existe mas mostra "—" porque não há valor
    expect(screen.getByTestId("evolucao-spotify-current")).toHaveTextContent("—");
  });

  it("1 snapshot: mostra valor atual mas continua sem trend nem chart", () => {
    render(
      <ArtistaEvolutionCard
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

  it("2+ snapshots crescendo: mostra trend up, percentual e chart", () => {
    render(
      <ArtistaEvolutionCard
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
    // delta absoluto: +500 (formatado como 500)
    expect(screen.getByTestId("evolucao-spotify-delta")).toHaveTextContent(
      /500 no per/i,
    );
  });

  it("2+ snapshots em queda: mostra trend down e percentual negativo", () => {
    render(
      <ArtistaEvolutionCard
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

  it("2+ snapshots iguais: mostra trend flat e 0%", () => {
    render(
      <ArtistaEvolutionCard
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

  it("isMissingConfig: renderiza label de plataforma não configurada", () => {
    render(
      <ArtistaEvolutionCard
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

  it("isLoading: renderiza skeletons no lugar do conteúdo", () => {
    const { container } = render(
      <ArtistaEvolutionCard
        {...baseProps}
        isLoading
        points={undefined}
      />,
    );
    expect(
      screen.queryByTestId("evolucao-spotify-current"),
    ).not.toBeInTheDocument();
    // dois skeletons (header + chart)
    expect(container.querySelectorAll('[data-slot="skeleton"], .animate-pulse').length)
      .toBeGreaterThanOrEqual(1);
  });

  it("errorMessage: renderiza a mensagem de erro em destaque", () => {
    render(
      <ArtistaEvolutionCard
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
