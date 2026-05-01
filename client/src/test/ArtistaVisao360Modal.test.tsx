// @ts-nocheck
// Integration test para ArtistaVisao360Modal (Task #361).
//
// Verifica que os chips de tendência (PlatformMiniTrend) aparecem nos
// cards de Spotify / YouTube / Deezer da seção "Perfis e Redes Sociais"
// do modal Visão 360°, respeitando o gating por ID configurado:
//   * Plataforma sem ID configurado → nem chip nem placeholder aparece
//     (a query nem é disparada).
//   * Plataforma com ID configurado mas sem histórico (0 ou 1 snapshot)
//     → placeholder "— sem histórico" aparece dentro do card.
//   * Plataforma com ID configurado e histórico crescendo → badge
//     "em crescimento" + percentual aparecem dentro do card.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act } from "react";
import { render, screen, within, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { MetricEvolutionPoint } from "@/hooks/useSpotify";

// Estabiliza o ResponsiveContainer do recharts (usado por outras seções
// do modal) para evitar avisos sobre dimensões zero no jsdom.
vi.mock("recharts", async () => {
  const actual: any = await vi.importActual("recharts");
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => (
      <div style={{ width: 400, height: 200 }}>{children}</div>
    ),
  };
});

// Mocks dos hooks de dados do modal (não nos importam aqui — só queremos
// renderizar a tab "Perfil"). Retornam arrays vazios.
vi.mock("@/hooks/useObras", () => ({
  useObras: () => ({ obras: [], isLoading: false }),
}));
vi.mock("@/hooks/useFonogramas", () => ({
  useFonogramas: () => ({ fonogramas: [], isLoading: false }),
}));
vi.mock("@/hooks/useLancamentos", () => ({
  useLancamentos: () => ({ lancamentos: [], isLoading: false }),
}));
vi.mock("@/hooks/useProjetos", () => ({
  useProjetos: () => ({ projetos: [], isLoading: false }),
}));
vi.mock("@/hooks/useMetas", () => ({
  useMetas: () => ({ metas: [], isLoading: false }),
}));
vi.mock("@/hooks/useContratos", () => ({
  useContratos: () => ({ contratos: [], isLoading: false }),
}));

const spotifyMock = vi.fn();
const youtubeMock = vi.fn();
const deezerMock = vi.fn();

vi.mock("@/hooks/useSpotify", async () => {
  const actual: any = await vi.importActual("@/hooks/useSpotify");
  return {
    ...actual,
    useSpotifyEvolution: (...args: any[]) => spotifyMock(...args),
  };
});

vi.mock("@/hooks/useYouTube", async () => {
  const actual: any = await vi.importActual("@/hooks/useYouTube");
  return {
    ...actual,
    useYouTubeEvolution: (...args: any[]) => youtubeMock(...args),
  };
});

vi.mock("@/hooks/useDeezer", async () => {
  const actual: any = await vi.importActual("@/hooks/useDeezer");
  return {
    ...actual,
    useDeezerEvolution: (...args: any[]) => deezerMock(...args),
  };
});

import { ArtistaVisao360Modal } from "@/components/forms/ArtistaVisao360Modal";

function point(date: string, followers: number | null): MetricEvolutionPoint {
  return { captured_at: date, followers, popularity: null, views: null };
}

function emptyQuery() {
  return { data: [], isLoading: false, error: null };
}

function dataQuery(points: MetricEvolutionPoint[]) {
  return { data: points, isLoading: false, error: null };
}

async function renderModal(artista: any) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <ArtistaVisao360Modal
        open
        onOpenChange={() => {}}
        artista={artista}
      />
    </QueryClientProvider>,
  );
  // Navega para a aba "Perfil" onde ficam os cards de plataforma.
  // Radix Tabs trigger usa pointer events; combinamos pointerDown + click.
  const tab = screen.getByRole("tab", { name: /perfil/i });
  await act(async () => {
    fireEvent.pointerDown(tab, { button: 0, ctrlKey: false });
    fireEvent.mouseDown(tab, { button: 0 });
    fireEvent.click(tab);
  });
  // Confirma que a tab "Perfil" foi ativada e os cards estão visíveis.
  await screen.findByTestId("card-visao360-spotify");
  return utils;
}

describe("<ArtistaVisao360Modal /> trend chips na aba Perfil", async () => {
  beforeEach(() => {
    spotifyMock.mockReset();
    youtubeMock.mockReset();
    deezerMock.mockReset();
  });

  it("renderiza chip 'em crescimento' no card Spotify quando há histórico subindo", async () => {
    spotifyMock.mockReturnValue(
      dataQuery([
        point("2026-04-01T06:20:00Z", 1000),
        point("2026-04-30T06:20:00Z", 1042),
      ]),
    );
    youtubeMock.mockReturnValue(emptyQuery());
    deezerMock.mockReturnValue(emptyQuery());

    await renderModal({
      id: "art-1",
      nome_artistico: "Teste",
      spotify_artist_id: "spot-1",
      youtube_channel_id: null,
      deezer_url: null,
    });

    const spotifyCard = screen.getByTestId("card-visao360-spotify");
    const badge = within(spotifyCard).getByTestId("visao360-spotify-trend-badge");
    expect(badge).toHaveAttribute("aria-label", "em crescimento");
    expect(
      within(spotifyCard).getByTestId("visao360-spotify-trend-pct"),
    ).toHaveTextContent(/\+4\.2%/);
  });

  it("renderiza placeholder '— sem histórico' quando o ID está configurado mas só há 1 snapshot", async () => {
    spotifyMock.mockReturnValue(emptyQuery());
    youtubeMock.mockReturnValue(
      dataQuery([point("2026-04-30T06:20:00Z", 500)]),
    );
    deezerMock.mockReturnValue(emptyQuery());

    await renderModal({
      id: "art-1",
      nome_artistico: "Teste",
      spotify_artist_id: "spot-1",
      youtube_channel_id: "UC1",
      deezer_url: "https://www.deezer.com/artist/123",
    });

    const youtubeCard = screen.getByTestId("card-visao360-youtube");
    expect(
      within(youtubeCard).getByTestId("visao360-youtube-trend-empty"),
    ).toHaveTextContent(/sem histórico/i);
    expect(
      within(youtubeCard).queryByTestId("visao360-youtube-trend-badge"),
    ).not.toBeInTheDocument();
  });

  it("não renderiza chip nem placeholder quando o ID da plataforma não está configurado", async () => {
    spotifyMock.mockReturnValue(emptyQuery());
    youtubeMock.mockReturnValue(emptyQuery());
    deezerMock.mockReturnValue(emptyQuery());

    await renderModal({
      id: "art-1",
      nome_artistico: "Teste",
      // Sem spotify_artist_id, youtube_channel_id ou deezer_url:
      spotify_artist_id: null,
      youtube_channel_id: null,
      deezer_url: null,
    });

    const spotifyCard = screen.getByTestId("card-visao360-spotify");
    const youtubeCard = screen.getByTestId("card-visao360-youtube");
    const deezerCard = screen.getByTestId("card-visao360-deezer");

    for (const [card, prefix] of [
      [spotifyCard, "visao360-spotify"],
      [youtubeCard, "visao360-youtube"],
      [deezerCard, "visao360-deezer"],
    ] as const) {
      expect(
        within(card).queryByTestId(`${prefix}-trend-badge`),
      ).not.toBeInTheDocument();
      expect(
        within(card).queryByTestId(`${prefix}-trend-empty`),
      ).not.toBeInTheDocument();
    }
  });

  it("dispara as queries de evolução apenas quando o ID está configurado", async () => {
    spotifyMock.mockReturnValue(emptyQuery());
    youtubeMock.mockReturnValue(emptyQuery());
    deezerMock.mockReturnValue(emptyQuery());

    await renderModal({
      id: "art-1",
      nome_artistico: "Teste",
      spotify_artist_id: "spot-1",
      youtube_channel_id: null,
      deezer_url: null,
    });

    // Spotify configurado → recebeu o artistaId real (não null).
    expect(spotifyMock).toHaveBeenCalled();
    expect(spotifyMock.mock.calls[0][0]).toBe("art-1");
    // YouTube e Deezer sem ID → recebem null (query desabilitada).
    expect(youtubeMock.mock.calls[0][0]).toBeNull();
    expect(deezerMock.mock.calls[0][0]).toBeNull();
  });
});
