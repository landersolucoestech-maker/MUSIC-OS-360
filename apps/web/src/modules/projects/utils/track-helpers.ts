export interface TrackData {
  id?: string;
  name?: string;
  soloFeat?: string;
  originalRemix?: string;
  instrumental?: string;
  duracaoMin?: string;
  duracaoSeg?: string;
  genero?: string;
  idioma?: string;
  compositores?: string[];
  interpretes?: string[];
  produtores?: string[];
  letra?: string;
  audioUrl?: string;
  /** Local-only: file metadata derived from a local File pick or a HEAD request on audioUrl.
   *  Never persisted to descricao JSON. */
  arquivoAudio?: { name: string; size: number } | null;
}

export interface TrackInfo {
  name: string;
  genero: string;
  idioma: string;
  compositores: string;
  interpretes: string;
  produtores: string;
  duracao: string;
  soloFeat: string;
  originalRemix: string;
  instrumental: string;
  letra: string;
  audioUrl: string;
}

/**
 * musicas[] normalized into project_tracks (migration 20260718000013) — the API
 * already returns the hydrated array in `projeto.musicas`. `descricao` is again
 * pure free text and is no longer used as the source of the songs.
 */
export function parseTracksFromProject(project: { musicas?: TrackData[] } | null | undefined): TrackData[] {
  return Array.isArray(project?.musicas) ? project!.musicas! : [];
}

function joinArray(arr: string[] | string | undefined | null): string {
  if (!arr) return "";
  if (Array.isArray(arr)) return arr.filter(Boolean).join(", ");
  return arr;
}

export function getTrackInfo(m: TrackData): TrackInfo {
  const min = m.duracaoMin || "";
  const seg = m.duracaoSeg || "";
  const duration = min && seg ? `${min}:${seg.padStart(2, "0")}` : min ? `${min}:00` : "";
  return {
    name: m.name || "",
    genero: m.genero || "",
    idioma: m.idioma || "",
    compositores: joinArray(m.compositores),
    interpretes: joinArray(m.interpretes),
    produtores: joinArray(m.produtores),
    duracao: duration,
    soloFeat: m.soloFeat || "solo",
    originalRemix: m.originalRemix || "original",
    instrumental: m.instrumental || "nao",
    letra: m.letra || "",
    audioUrl: m.audioUrl || "",
  };
}

export function getFirstTrackInfo(project: { musicas?: TrackData[] } | null | undefined): TrackInfo {
  const tracks = parseTracksFromProject(project);
  if (tracks.length === 0) {
    return {
      name: "", genero: "", idioma: "", compositores: "", interpretes: "",
      produtores: "", duracao: "", soloFeat: "solo", originalRemix: "original",
      instrumental: "nao", letra: "", audioUrl: "",
    };
  }
  return getTrackInfo(tracks[0]);
}
