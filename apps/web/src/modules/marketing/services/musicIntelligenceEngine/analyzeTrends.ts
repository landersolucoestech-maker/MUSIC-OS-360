import type { IntelligenceSources } from "./types";
import { mostCommon } from "./utils";

export function analyzeTrendsContext(sources: IntelligenceSources, filters?: { genre?: string; platform?: string; period?: string }) {
  const genres = sources.releases.map((item) => item.music_genre).filter(Boolean).map(String);
  const channels = sources.contents.map((item) => item.channel).filter(Boolean).map(String);
  return {
    filters,
    risingGenres: [filters?.genre || mostCommon(genres) || "genero a definir"],
    growingFormats: [filters?.platform || mostCommon(channels) || "Reels/TikTok/Shorts"],
    internalMatches: sources.releases.slice(0, 6).map((item) => item.title),
    practicalSuggestions: [
      "Cruzar tendencia com lancamentos que ja possuem audio/letra/capa completos.",
      "Gerar cortes curtos para validar potencial antes de campanha paga.",
      "Reaproveitar catalogo com melhor fit editorial.",
    ],
  };
}
