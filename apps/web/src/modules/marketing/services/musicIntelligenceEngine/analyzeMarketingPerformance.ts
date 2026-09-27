import type { IntelligenceSources } from "./types";

export function analyzeMarketingPerformanceContext(sources: IntelligenceSources) {
  return {
    bestContent: sources.contents.slice(0, 5).map((item) => `${item.title} · ${item.channel}`),
    bestCampaigns: sources.campaigns.slice(0, 5).map((item) => item.name),
    bestReleases: sources.releases.slice(0, 5).map((item) => item.title),
    diagnosis: [
      "Repetir formatos com maior clareza de canal e objetivo.",
      "Abandonar conteúdos sem CTA ou sem vínculo com campanha/lançamento.",
      "Converter insights em tarefas operacionais para manter cadência.",
    ],
  };
}

