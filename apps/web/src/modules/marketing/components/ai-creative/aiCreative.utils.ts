import type { AiGeneratedResult, AiSuggestion } from "../../types/marketing.types";

export const MAX_WAV_SIZE_BYTES = 80 * 1024 * 1024;
export const ACCEPTED_AUDIO_MIME = ["audio/wav", "audio/x-wav"];
export const ACCEPTED_AUDIO_EXTENSIONS = [".wav"];
export const MUSICAL_PROJECT_TYPES = new Set(["album", "ep", "single", "videoclipe", "show", "tour", "podcast"]);

export const AI_KIND_LABEL: Record<AiSuggestion["kind"], string> = {
  analise_fonograma: "Análise fonográfica",
  analise_letra: "Análise de letra",
  planejamento_campanha: "Planejamento de campanha",
  sugestao_conteudo: "Sugestão de conteúdo",
  legenda: "Legenda",
  roteiro: "Roteiro",
  analise_artista: "Análise de artista",
  analise_marca: "Análise de marca",
  analise_empresa: "Análise de empresa",
  pitch_playlist: "Pitch para playlists",
  pitch_imprensa: "Pitch para imprensa",
  posicionamento: "Posicionamento",
  calendario_editorial: "Calendário editorial",
  conteudo_bastidores: "Conteúdo de bastidores",
  conteudo_corporativo: "Conteúdo corporativo",
};

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function getExtension(fileName: string) {
  const index = fileName.lastIndexOf(".");
  return index >= 0 ? fileName.slice(index).toLowerCase() : "";
}

export function validateWavFile(file: File) {
  const extension = getExtension(file.name);
  if (!ACCEPTED_AUDIO_EXTENSIONS.includes(extension)) return "Envie um arquivo com extensão .wav.";
  if (!ACCEPTED_AUDIO_MIME.includes(file.type)) return "O tipo MIME precisa ser audio/wav ou audio/x-wav.";
  if (file.size > MAX_WAV_SIZE_BYTES) return `O arquivo deve ter no máximo ${formatBytes(MAX_WAV_SIZE_BYTES)}.`;
  return "";
}

export function normalizeResult(output: AiSuggestion["output"]): AiGeneratedResult {
  if (!Array.isArray(output)) return output;
  return {
    summary: output[0] ?? "Resultado gerado anteriormente.",
    creativeDirection: "Registro legado convertido para visualização estruturada.",
    strengths: output.slice(0, 3),
    risks: [],
    audience: [],
    positioning: [],
    contentIdeas: output,
    campaignIdeas: [],
    pitchSuggestions: [],
    nextActions: [],
  };
}

export function getLatestResult(suggestions: AiSuggestion[], kinds: AiSuggestion["kind"][]) {
  const suggestion = suggestions.find((item) => kinds.includes(item.kind));
  return suggestion ? normalizeResult(suggestion.output) : null;
}

export function joinPrompt(parts: Array<string | undefined>) {
  return parts.filter((part) => part && part.trim()).join("\n\n");
}
