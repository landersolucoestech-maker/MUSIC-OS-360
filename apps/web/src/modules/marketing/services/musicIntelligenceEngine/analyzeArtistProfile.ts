import type { ArtistProfileContext } from "./types";

export function buildArtistProfilePrompt(context: ArtistProfileContext) {
  return [
    `Executar diagnóstico estratégico completo para ${context.artist.label}.`,
    `Scores iniciais: ${JSON.stringify(context.scores)}. Gargalo principal: ${context.bottleneck}.`,
    `Catálogo: ${context.catalog.totalReleases} lançamentos, ${context.catalog.totalTracks} faixas, frequência ${context.catalog.frequency}.`,
    `Gênero predominante: ${context.predominantGenre || "pendente"}. Subgêneros: ${context.subgenres.join(", ") || "pendentes"}. Mood: ${context.moods.join(", ") || "pendente"}.`,
    `Público/sinais: ${context.publicSignals.join(", ") || "sem sinais cadastrados"}.`,
    `Marketing: ${context.operations.campaigns.length} campanhas, ${context.operations.contents.length} conteúdos, ${context.operations.pitchings.length} pitchings, ${context.operations.tasks.length} tarefas.`,
    "Retornar score geral, branding, catálogo, engajamento, consistência, crescimento, estágio de carreira, gargalo, pontos fortes, pontos fracos, oportunidades, riscos, recomendações e plano 30/60/90 dias.",
  ].join("\n\n");
}

