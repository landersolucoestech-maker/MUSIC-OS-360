import { PENDING_VALUE } from "./pending";
import type { ReleaseContext, TrackAudioAnalysis } from "./types";

export function analyzeAudioDraft(input: Pick<ReleaseContext, "audioUrl" | "genre" | "subgenre" | "mood" | "bpm">): TrackAudioAnalysis {
  const missingData: string[] = [];
  if (!input.audioUrl) missingData.push("audio");
  if (!input.bpm) missingData.push("bpm");
  if (!input.mood) missingData.push("mood");
  if (!input.genre) missingData.push("genero");
  if (!input.subgenre) missingData.push("subgenero");

  return {
    status: input.audioUrl ? "completed" : "pending",
    provider: "music-intelligence-local-audio",
    bpm: input.bpm || PENDING_VALUE,
    key: PENDING_VALUE,
    scale: PENDING_VALUE,
    energy: input.mood ? inferEnergy(input.mood) : PENDING_VALUE,
    danceability: input.bpm ? inferDanceability(input.bpm) : PENDING_VALUE,
    mood: input.mood || PENDING_VALUE,
    genrePrediction: input.genre || PENDING_VALUE,
    subgenrePrediction: input.subgenre || PENDING_VALUE,
    instrumentation: [],
    structure: ["intro", "verso", "refrao", "ponte"].filter(() => Boolean(input.audioUrl)),
    missingData,
  };
}

function inferEnergy(mood: string) {
  const lower = mood.toLowerCase();
  if (lower.includes("festa") || lower.includes("dan")) return "alta";
  if (lower.includes("triste") || lower.includes("introspect")) return "baixa/media";
  return "media";
}

function inferDanceability(bpm: string) {
  const numeric = Number(bpm.replace(/\D/g, ""));
  if (!numeric) return PENDING_VALUE;
  if (numeric >= 95 && numeric <= 130) return "alta";
  if (numeric >= 75) return "media";
  return "baixa";
}
