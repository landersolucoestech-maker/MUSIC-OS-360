import { lyricsSentimentLabel } from "./lyricsVocabulary";
import type { ReleaseContext } from "./types";

export function buildPitchingPrompt(context: ReleaseContext, diagnosis = context.diagnosis) {
  return [
    `Gerar pitching completo para ${context.release.label} de ${context.artist.label}.`,
    `Diagnóstico IA da faixa: ${JSON.stringify(diagnosis)}`,
    `Letra analisada: ${context.lyricsAnalysis.mainTheme || "pendente"}; sentimento ${lyricsSentimentLabel(context.lyricsAnalysis.sentiment) || "pendente"}.`,
    `Áudio analisado: BPM ${context.audioAnalysis.bpm}; key ${context.audioAnalysis.key}; energia ${context.audioAnalysis.energy}; mood ${context.audioAnalysis.mood}.`,
    `Metadados: gênero ${context.genre || "pendente"}, subgênero ${context.subgenre || "pendente"}, ISRC ${context.isrc || "pendente"}, UPC ${context.upc || "pendente"}.`,
    "Gerar: pitching universal, Spotify, Deezer, Apple Music, Amazon Music, YouTube Music, curadores independentes, release imprensa, texto distribuidora, resumo executivo, descrições curta/média/longa, playlists, campanhas e cortes para redes sociais.",
  ].join("\n\n");
}
