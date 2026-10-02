// @ts-nocheck
// Component tests for ArtistEvolutionSection (Task #358).
//
// Mocks the three hooks (useSpotifyEvolution, useYouTubeEvolution,
// useDeezerEvolution) and verifies:
//   * 0 platforms with history → verdict "ainda não há dados"
//   * Only 1 point available across all platforms → verdict still treats it
//     as "sem histórico suficiente" (needs >= 2 snapshots)
//   * 2 growing platforms + 1 without history → verdict "em crescimento"
//   * Declining platforms → verdict "em queda"
//   * Tied trend (equal snapshots) → verdict "estável" with balance 0
//   * Platforms without a configured ID → cards show missing-config label
//   * null artistId → error message
import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "./_helpers/render-with-providers";
type MetricEvolutionPoint = { date: string; captured_at?: string; followers?: number | null; popularity?: number | null; views?: number | null; [key: string]: unknown; };

// Stabilizes the ResponsiveContainer inside the cards.
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
      // (see useArtistPlatformEvolution.ts) — platform is the last element.
      const key = Array.isArray(options?.queryKey) ? options.queryKey[options.queryKey.length - 1] : "";
      if (key === "spotify") return spotifyMock();
      if (key === "youtube") return youtubeMock();
      if (key === "deezer") return deezerMock();
      return { data: [], isLoading: false, error: null };
    },
  };
});

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

const fullArtist = {
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
  it("artist without id: renders an error message", () => {
    spotifyMock.mockReturnValue(emptyQuery());
    youtubeMock.mockReturnValue(emptyQuery());
    deezerMock.mockReturnValue(emptyQuery());
    renderWithProviders(<ArtistEvolutionSection artist={{ id: null }} />);
    expect(
      screen.getByText(/não foi possível carregar a evolução/i),
    ).toBeInTheDocument();
  });

  it("0 platforms with history: verdict shows 'ainda não há dados'", () => {
    spotifyMock.mockReturnValue(emptyQuery());
    youtubeMock.mockReturnValue(emptyQuery());
    deezerMock.mockReturnValue(emptyQuery());
    renderWithProviders(<ArtistEvolutionSection artist={fullArtist} />);

    expect(screen.getByTestId("section-evolution")).toBeInTheDocument();
    expect(screen.getByTestId("text-evolution-status")).toHaveTextContent(
      /sem histórico/i,
    );
    expect(screen.getByTestId("text-evolution-message")).toHaveTextContent(
      /ainda não há histórico suficiente/i,
    );
    // aggregate metrics do not appear when trackedCount === 0
    expect(
      screen.queryByTestId("text-evolution-avg-pct"),
    ).not.toBeInTheDocument();
  });

  it("only 1 snapshot per platform: verdict still shows 'sem histórico suficiente'", () => {
    // computeEvolutionSummary requires >= 2 points to compute a trend.
    // With 1 point, hasEnoughData=false → trackedCount=0 in the aggregate.
    spotifyMock.mockReturnValue(
      dataQuery([point("2026-04-30T06:20:00Z", 1000)]),
    );
    youtubeMock.mockReturnValue(
      dataQuery([point("2026-04-30T06:20:00Z", 500)]),
    );
    deezerMock.mockReturnValue(
      dataQuery([point("2026-04-30T06:20:00Z", 300)]),
    );

    renderWithProviders(<ArtistEvolutionSection artist={fullArtist} />);

    expect(screen.getByTestId("text-evolution-status")).toHaveTextContent(
      /sem histórico/i,
    );
    expect(screen.getByTestId("text-evolution-message")).toHaveTextContent(
      /ainda não há histórico suficiente/i,
    );
    // The aggregate metrics block (balance / avg pct / platforms) only
    // appears when trackedCount > 0.
    expect(
      screen.queryByTestId("text-evolution-platforms"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("text-evolution-balance"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("text-evolution-avg-pct"),
    ).not.toBeInTheDocument();
  });

  it("platforms with 2+ snapshots and zero variation: 'estável' verdict with balance 0", () => {
    // Audience exactly equal between two snapshots → delta=0,
    // percent=0, direction='flat' for each platform. The aggregate must
    // remain 'estável' with total balance 0 and avg pct 0.
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

    renderWithProviders(<ArtistEvolutionSection artist={fullArtist} />);

    expect(screen.getByTestId("text-evolution-status")).toHaveTextContent(
      /estável/i,
    );
    // 3 tracked platforms, all with zero variation
    expect(screen.getByTestId("text-evolution-platforms")).toHaveTextContent(
      /3 de 7/,
    );
    // Total absolute balance = 0; the component formats it as "+0"
    expect(screen.getByTestId("text-evolution-balance")).toHaveTextContent(
      /^\+0$/,
    );
    // Average variation = 0%
    expect(screen.getByTestId("text-evolution-avg-pct")).toHaveTextContent(
      /0/,
    );
    // The verdict message mentions stability across the platforms
    expect(screen.getByTestId("text-evolution-message")).toHaveTextContent(
      /est[aá]vel/i,
    );
    expect(screen.getByTestId("text-evolution-message")).toHaveTextContent(
      /Spotify, YouTube, Deezer/,
    );
  });

  it("2 growing platforms + 1 without history: 'em crescimento' verdict", () => {
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

    renderWithProviders(<ArtistEvolutionSection artist={fullArtist} />);

    expect(screen.getByTestId("text-evolution-status")).toHaveTextContent(
      /em crescimento/i,
    );
    // 2 platforms with history, 1 without history (deezer)
    expect(screen.getByTestId("text-evolution-platforms")).toHaveTextContent(
      /2 de 7/,
    );
    // absolute balance: +200 (spotify) + +200 (youtube) = +400
    expect(screen.getByTestId("text-evolution-balance")).toHaveTextContent(/400/);
    // average variation: (20% + 40%) / 2 = 30%
    expect(screen.getByTestId("text-evolution-avg-pct")).toHaveTextContent(
      /\+30/,
    );
    // message mentions the tracked platforms
    expect(screen.getByTestId("text-evolution-message")).toHaveTextContent(
      /Spotify, YouTube/i,
    );
  });

  it("declining platforms: 'em queda' verdict", () => {
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

    renderWithProviders(<ArtistEvolutionSection artist={fullArtist} />);

    expect(screen.getByTestId("text-evolution-status")).toHaveTextContent(
      /em queda/i,
    );
    expect(screen.getByTestId("text-evolution-platforms")).toHaveTextContent(
      /3 de 7/,
    );
    expect(screen.getByTestId("text-evolution-balance")).toHaveTextContent(/350/);
  });

  it("platforms without a registered ID: cards show missing-config label", () => {
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

  it("partial loading: verdict already computes based on what arrived (detailed metrics become skeleton)", () => {
    spotifyMock.mockReturnValue(
      dataQuery([
        point("2026-04-01T06:20:00Z", 1000),
        point("2026-04-30T06:20:00Z", 1100),
      ]),
    );
    youtubeMock.mockReturnValue(loadingQuery());
    deezerMock.mockReturnValue(loadingQuery());

    renderWithProviders(<ArtistEvolutionSection artist={fullArtist} />);

    expect(screen.getByTestId("text-evolution-status")).toHaveTextContent(
      /em crescimento/i,
    );
    // The detailed block (balance / avg pct / platforms) is replaced by a
    // skeleton while some hook is still loading. But the verdict message
    // already mentions the platform that has history (Spotify).
    expect(screen.getByTestId("text-evolution-message")).toHaveTextContent(
      /Spotify/,
    );
    expect(
      screen.queryByTestId("text-evolution-platforms"),
    ).not.toBeInTheDocument();
  });
});

