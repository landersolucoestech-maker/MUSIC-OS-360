// @ts-nocheck
// Component tests para ArtistEvolutionSection (Task #358).
//
// Mocka os três hooks (useSpotifyEvolution, useYouTubeEvolution,
// useDeezerEvolution) e verifica:
//   * 0 plataformas com histórico → veredito "ainda não há dados"
//   * Apenas 1 ponto disponível em todas as plataformas → veredito ainda
//     trata como "sem histórico suficiente" (precisa de >= 2 snapshots)
//   * 2 plataformas crescendo + 1 sem histórico → veredito "em crescimento"
//   * Plataformas em queda → veredito "em queda"
//   * Tendência empatada (snapshots iguais) → veredito "estável" com saldo 0
//   * Plataformas sem ID configurado → cards mostram missing-config label
//   * artistId null → mensagem de erro
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "./_helpers/render-with-providers";
type MetricEvolutionPoint = { date: string; captured_at?: string; followers?: number | null; popularity?: number | null; views?: number | null; [key: string]: unknown; };

// Estabiliza o ResponsiveContainer dentro dos cards.
vi.mock("recharts", async () => {
  const actual: any = await vi.importActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => (
      <div style={{ width: 400, height: 200 }}>{children}</div>
    ),
  };
});

const { spotifyMock, youtubeMock, deezerMock } = vi.hoisted(() => ({
  spotifyMock: vi.fn(),
  youtubeMock: vi.fn(),
  deezerMock: vi.fn(),
}));

vi.mock("@tanstack/react-query", async () => {
  const actual: any = await vi.importActual("@tanstack/react-query");
  return {
    ...actual,
    useQuery: (options: any) => {
      // queryKey shape: [...QUERY_KEYS.ARTISTS, artistId, "evolution", platform]
      // (ver useArtistPlatformEvolution.ts) — plataforma é o último elemento.
      const key = Array.isArray(options?.queryKey) ? options.queryKey[options.queryKey.length - 1] : "";
      if (key === "spotify") return spotifyMock();
      if (key === "youtube") return youtubeMock();
      if (key === "deezer") return deezerMock();
      return { data: [], isLoading: false, error: null };
    },
  };
});

vi.mock("@/modules/integrations/hooks/useSpotify", () => ({
  useSpotifyEvolution: (...args: any[]) => spotifyMock(...args),
}));

vi.mock("@/modules/integrations/hooks/useYouTube", () => ({
  useYouTubeEvolution: (...args: any[]) => youtubeMock(...args),
}));

vi.mock("@/modules/integrations/hooks/useDeezer", () => ({
  useDeezerEvolution: (...args: any[]) => deezerMock(...args),
}));

import { ArtistEvolutionSection } from "@/modules/artist/components/ArtistEvolutionSection";

function point(date: string, followers: number | null): MetricEvolutionPoint {
  return { captured_at: date, followers, popularity: null, views: null };
}

function emptyQuery() {
  return { data: [], isLoading: false, error: null };
}

function loadingQuery() {
  return { data: undefined, isLoading: true, error: null };
}

function dataQuery(points: MetricEvolutionPoint[]) {
  return { data: points, isLoading: false, error: null };
}

const fullArtista = {
  id: "art-1",
  spotify_url: "https://open.spotify.com/artist/spot-1",
  youtube_url: "https://www.youtube.com/channel/UC1",
  deezer_url: "https://www.deezer.com/artist/123",
};

beforeEach(() => {
  spotifyMock.mockReset();
  youtubeMock.mockReset();
  deezerMock.mockReset();
});

describe("<ArtistEvolutionSection />", () => {
  it("artista sem id: renderiza mensagem de erro", () => {
    spotifyMock.mockReturnValue(emptyQuery());
    youtubeMock.mockReturnValue(emptyQuery());
    deezerMock.mockReturnValue(emptyQuery());
    renderWithProviders(<ArtistEvolutionSection artist={{ id: null }} />);
    expect(
      screen.getByText(/não foi possível carregar a evolução/i),
    ).toBeInTheDocument();
  });

  it("0 plataformas com histórico: veredito mostra 'ainda não há dados'", () => {
    spotifyMock.mockReturnValue(emptyQuery());
    youtubeMock.mockReturnValue(emptyQuery());
    deezerMock.mockReturnValue(emptyQuery());
    renderWithProviders(<ArtistEvolutionSection artist={fullArtista} />);

    expect(screen.getByTestId("section-evolucao")).toBeInTheDocument();
    expect(screen.getByTestId("text-evolucao-status")).toHaveTextContent(
      /sem histórico/i,
    );
    expect(screen.getByTestId("text-evolucao-mensagem")).toHaveTextContent(
      /ainda não há histórico suficiente/i,
    );
    // métricas agregadas não aparecem quando trackedCount === 0
    expect(
      screen.queryByTestId("text-evolucao-pct-medio"),
    ).not.toBeInTheDocument();
  });

  it("apenas 1 snapshot por plataforma: veredito ainda mostra 'sem histórico suficiente'", () => {
    // computeEvolutionSummary requer >= 2 pontos para calcular tendência.
    // Com 1 ponto, hasEnoughData=false → trackedCount=0 no agregado.
    spotifyMock.mockReturnValue(
      dataQuery([point("2026-04-30T06:20:00Z", 1000)]),
    );
    youtubeMock.mockReturnValue(
      dataQuery([point("2026-04-30T06:20:00Z", 500)]),
    );
    deezerMock.mockReturnValue(
      dataQuery([point("2026-04-30T06:20:00Z", 300)]),
    );

    renderWithProviders(<ArtistEvolutionSection artist={fullArtista} />);

    expect(screen.getByTestId("text-evolucao-status")).toHaveTextContent(
      /sem histórico/i,
    );
    expect(screen.getByTestId("text-evolucao-mensagem")).toHaveTextContent(
      /ainda não há histórico suficiente/i,
    );
    // Bloco agregado de métricas (saldo / pct médio / plataformas) só
    // aparece quando trackedCount > 0.
    expect(
      screen.queryByTestId("text-evolucao-plataformas"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("text-evolucao-saldo"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("text-evolucao-pct-medio"),
    ).not.toBeInTheDocument();
  });

  it("plataformas com 2+ snapshots e variação zero: veredito 'estável' com saldo 0", () => {
    // Audiência exatamente igual entre dois snapshots → delta=0,
    // percent=0, direction='flat' em cada plataforma. Agregado deve
    // permanecer 'estável' com saldo total 0 e pct médio 0.
    spotifyMock.mockReturnValue(
      dataQuery([
        point("2026-04-01T06:20:00Z", 1000),
        point("2026-04-30T06:20:00Z", 1000),
      ]),
    );
    youtubeMock.mockReturnValue(
      dataQuery([
        point("2026-04-01T06:20:00Z", 500),
        point("2026-04-30T06:20:00Z", 500),
      ]),
    );
    deezerMock.mockReturnValue(
      dataQuery([
        point("2026-04-01T06:20:00Z", 300),
        point("2026-04-30T06:20:00Z", 300),
      ]),
    );

    renderWithProviders(<ArtistEvolutionSection artist={fullArtista} />);

    expect(screen.getByTestId("text-evolucao-status")).toHaveTextContent(
      /estável/i,
    );
    // 3 plataformas acompanhadas, todas com variação zero
    expect(screen.getByTestId("text-evolucao-plataformas")).toHaveTextContent(
      /3 de 7/,
    );
    // Saldo total absoluto = 0; o componente formata como "+0"
    expect(screen.getByTestId("text-evolucao-saldo")).toHaveTextContent(
      /^\+0$/,
    );
    // Variação média = 0%
    expect(screen.getByTestId("text-evolucao-pct-medio")).toHaveTextContent(
      /0/,
    );
    // Mensagem do veredito menciona estabilidade nas plataformas
    expect(screen.getByTestId("text-evolucao-mensagem")).toHaveTextContent(
      /est[aá]vel/i,
    );
    expect(screen.getByTestId("text-evolucao-mensagem")).toHaveTextContent(
      /Spotify, YouTube, Deezer/,
    );
  });

  it("2 plataformas crescendo + 1 sem histórico: veredito 'em crescimento'", () => {
    spotifyMock.mockReturnValue(
      dataQuery([
        point("2026-04-01T06:20:00Z", 1000),
        point("2026-04-30T06:20:00Z", 1200),
      ]),
    );
    youtubeMock.mockReturnValue(
      dataQuery([
        point("2026-04-01T06:20:00Z", 500),
        point("2026-04-30T06:20:00Z", 700),
      ]),
    );
    deezerMock.mockReturnValue(emptyQuery());

    renderWithProviders(<ArtistEvolutionSection artist={fullArtista} />);

    expect(screen.getByTestId("text-evolucao-status")).toHaveTextContent(
      /em crescimento/i,
    );
    // 2 plataformas com histórico, 1 sem histórico (deezer)
    expect(screen.getByTestId("text-evolucao-plataformas")).toHaveTextContent(
      /2 de 7/,
    );
    // saldo absoluto: +200 (spotify) + +200 (youtube) = +400
    expect(screen.getByTestId("text-evolucao-saldo")).toHaveTextContent(/400/);
    // variação média: (20% + 40%) / 2 = 30%
    expect(screen.getByTestId("text-evolucao-pct-medio")).toHaveTextContent(
      /\+30/,
    );
    // mensagem cita as plataformas acompanhadas
    expect(screen.getByTestId("text-evolucao-mensagem")).toHaveTextContent(
      /Spotify, YouTube/i,
    );
  });

  it("plataformas em queda: veredito 'em queda'", () => {
    spotifyMock.mockReturnValue(
      dataQuery([
        point("2026-04-01T06:20:00Z", 1000),
        point("2026-04-30T06:20:00Z", 800),
      ]),
    );
    youtubeMock.mockReturnValue(
      dataQuery([
        point("2026-04-01T06:20:00Z", 500),
        point("2026-04-30T06:20:00Z", 400),
      ]),
    );
    deezerMock.mockReturnValue(
      dataQuery([
        point("2026-04-01T06:20:00Z", 300),
        point("2026-04-30T06:20:00Z", 250),
      ]),
    );

    renderWithProviders(<ArtistEvolutionSection artist={fullArtista} />);

    expect(screen.getByTestId("text-evolucao-status")).toHaveTextContent(
      /em queda/i,
    );
    expect(screen.getByTestId("text-evolucao-plataformas")).toHaveTextContent(
      /3 de 7/,
    );
    expect(screen.getByTestId("text-evolucao-saldo")).toHaveTextContent(/350/);
  });

  it("plataformas sem ID cadastrado: cards mostram missing-config label", () => {
    spotifyMock.mockReturnValue(emptyQuery());
    youtubeMock.mockReturnValue(emptyQuery());
    deezerMock.mockReturnValue(emptyQuery());
      renderWithProviders(
      <ArtistEvolutionSection
        artist={{
          id: "art-1",
          spotify_url: null,
          youtube_url: null,
          deezer_url: null,
        }}
      />,
    );
    expect(
      screen.getByText(/sem perfil do spotify cadastrado/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/sem canal do youtube cadastrado/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/sem perfil do deezer cadastrado/i),
    ).toBeInTheDocument();
  });

  it("loading parcial: veredito já computa com base no que chegou (métricas detalhadas viram skeleton)", () => {
    spotifyMock.mockReturnValue(
      dataQuery([
        point("2026-04-01T06:20:00Z", 1000),
        point("2026-04-30T06:20:00Z", 1100),
      ]),
    );
    youtubeMock.mockReturnValue(loadingQuery());
    deezerMock.mockReturnValue(loadingQuery());

    renderWithProviders(<ArtistEvolutionSection artist={fullArtista} />);

    expect(screen.getByTestId("text-evolucao-status")).toHaveTextContent(
      /em crescimento/i,
    );
    // O bloco detalhado (saldo / pct médio / plataformas) é substituído por
    // um skeleton enquanto algum hook ainda está carregando. Mas a mensagem
    // do veredito já cita a plataforma que tem histórico (Spotify).
    expect(screen.getByTestId("text-evolucao-mensagem")).toHaveTextContent(
      /Spotify/,
    );
    expect(
      screen.queryByTestId("text-evolucao-plataformas"),
    ).not.toBeInTheDocument();
  });
});

