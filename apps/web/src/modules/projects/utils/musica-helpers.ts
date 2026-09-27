export interface MusicaData {
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

export interface MusicaInfo {
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
export function parseMusicasFromProjeto(projeto: { musicas?: MusicaData[] } | null | undefined): MusicaData[] {
  return Array.isArray(projeto?.musicas) ? projeto!.musicas! : [];
}

function joinArray(arr: string[] | string | undefined | null): string {
  if (!arr) return "";
  if (Array.isArray(arr)) return arr.filter(Boolean).join(", ");
  return arr;
}

export function getMusicaInfo(m: MusicaData): MusicaInfo {
  const min = m.duracaoMin || "";
  const seg = m.duracaoSeg || "";
  const duracao = min && seg ? `${min}:${seg.padStart(2, "0")}` : min ? `${min}:00` : "";
  return {
    name: m.name || "",
    genero: m.genero || "",
    idioma: m.idioma || "",
    compositores: joinArray(m.compositores),
    interpretes: joinArray(m.interpretes),
    produtores: joinArray(m.produtores),
    duracao,
    soloFeat: m.soloFeat || "solo",
    originalRemix: m.originalRemix || "original",
    instrumental: m.instrumental || "nao",
    letra: m.letra || "",
    audioUrl: m.audioUrl || "",
  };
}

export function getFirstMusicaInfo(projeto: { musicas?: MusicaData[] } | null | undefined): MusicaInfo {
  const musicas = parseMusicasFromProjeto(projeto);
  if (musicas.length === 0) {
    return {
      name: "", genero: "", idioma: "", compositores: "", interpretes: "",
      produtores: "", duracao: "", soloFeat: "solo", originalRemix: "original",
      instrumental: "nao", letra: "", audioUrl: "",
    };
  }
  return getMusicaInfo(musicas[0]);
}
