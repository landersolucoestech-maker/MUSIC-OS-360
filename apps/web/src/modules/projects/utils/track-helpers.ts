import { canonicalTrackInstrumental, canonicalTrackLanguage } from "./track-vocabulary";

export interface TrackData {
  id?: string;
  name?: string;
  soloFeat?: string;
  originalRemix?: string;
  instrumental?: string;
  durationMinutes?: string;
  durationSeconds?: string;
  genre?: string;
  language?: string;
  composers?: string[];
  performers?: string[];
  producers?: string[];
  lyrics?: string;
  audioUrl?: string;
  /** Local-only: file metadata derived from a local File pick or a HEAD request on audioUrl.
   *  Never persisted to descricao JSON. */
  audioFile?: { name: string; size: number } | null;
}

export interface TrackInfo {
  name: string;
  genre: string;
  language: string;
  composers: string;
  performers: string;
  producers: string;
  duration: string;
  soloFeat: string;
  originalRemix: string;
  instrumental: string;
  lyrics: string;
  audioUrl: string;
}

/**
 * tracks normalized into project_tracks (migration 20260718000013) — the API
 * already returns the hydrated array in `project.tracks`. `descricao` is again
 * pure free text and is no longer used as the source of the songs.
 */
export function parseTracksFromProject(project: { tracks?: TrackData[] } | null | undefined): TrackData[] {
  return Array.isArray(project?.tracks) ? project!.tracks! : [];
}

function joinArray(arr: string[] | string | undefined | null): string {
  if (!arr) return "";
  if (Array.isArray(arr)) return arr.filter(Boolean).join(", ");
  return arr;
}

export function getTrackInfo(m: TrackData): TrackInfo {
  const min = m.durationMinutes || "";
  const seconds = m.durationSeconds || "";
  const duration = min && seconds ? `${min}:${seconds.padStart(2, "0")}` : min ? `${min}:00` : "";
  return {
    name: m.name || "",
    genre: m.genre || "",
    language: canonicalTrackLanguage(m.language),
    composers: joinArray(m.composers),
    performers: joinArray(m.performers),
    producers: joinArray(m.producers),
    duration: duration,
    soloFeat: m.soloFeat || "solo",
    originalRemix: m.originalRemix || "original",
    instrumental: canonicalTrackInstrumental(m.instrumental) || "no",
    lyrics: m.lyrics || "",
    audioUrl: m.audioUrl || "",
  };
}

export function getFirstTrackInfo(project: { tracks?: TrackData[] } | null | undefined): TrackInfo {
  const tracks = parseTracksFromProject(project);
  if (tracks.length === 0) {
    return {
      name: "", genre: "", language: "", composers: "", performers: "",
      producers: "", duration: "", soloFeat: "solo", originalRemix: "original",
      instrumental: "no", lyrics: "", audioUrl: "",
    };
  }
  return getTrackInfo(tracks[0]);
}
