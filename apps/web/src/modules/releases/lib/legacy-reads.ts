/**
 * Canonical-first reads of records that may still carry the deprecated Portuguese spellings (persisted rows and
 * responses of builds older than the English contract). The canonical field always wins; the deprecated one is read
 * only when the canonical one is absent. This is the only place of the releases module that names those fields.
 */
import { parseTracksFromProject, type TrackData } from "@/modules/projects/utils/track-helpers";

type Loose = Record<string, unknown>;

/** Credit entries may be plain names or objects ({ name | nome, role }). */
export function creditName(value: unknown): string {
  if (value && typeof value === "object") {
    const entry = value as Loose;
    return String(entry["name"] ?? entry["nome"] ?? "").trim();
  }
  return String(value ?? "").trim();
}

/** Title of a release track: canonical `title`, then deprecated `titulo`, then the position label. */
export function trackTitle(track: Loose, position: number): string {
  return String((track["title"] as string | undefined) || (track["titulo"] as string | undefined) || `Faixa ${position}`);
}

/** Artist of a release track: canonical `artist`, then deprecated `artista`. */
export function trackArtist(track: Loose): string | undefined {
  const value = track["artist"] ?? track["artista"];
  return value == null ? undefined : String(value);
}

/** Percentage of a share-history holder: canonical `percentage`, then deprecated `percentual`. */
export function holderPercentage(holder: Loose): unknown {
  return holder["percentage"] ?? holder["percentual"];
}

/** Label of a project record: canonical `title`, then deprecated `nome`. */
export function projectLabel(project: Loose | null | undefined): string {
  if (!project) return "";
  return String(project["title"] ?? project["nome"] ?? "");
}

export interface SeedTrack { title: string; composers: string[]; producers: string[]; lyrics: string; isrc: string }

/**
 * Tracks a new release is pre-filled with. The API hydrates `project.tracks` (project_tracks table, canonical keys);
 * only when it is empty is the deprecated JSON copy in `project.description` (`nome`, `compositores`, `produtores`,
 * `letra`) read, for projects saved before the tracks were normalized.
 */
export function projectTracksForRelease(project: { tracks?: TrackData[]; description?: string | null }): SeedTrack[] {
  const canonical = parseTracksFromProject(project);
  if (canonical.length > 0) {
    return canonical.map((t) => ({ title: t.name ?? "", composers: t.composers ?? [], producers: t.producers ?? [], lyrics: t.lyrics ?? "", isrc: "" }));
  }
  if (!project.description) return [];
  try {
    const parsed = JSON.parse(project.description) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as Loose[]).map((m) => ({
      title: String(m["name"] ?? m["nome"] ?? ""),
      composers: (m["composers"] ?? m["compositores"] ?? []) as string[],
      producers: (m["producers"] ?? m["produtores"] ?? []) as string[],
      lyrics: String(m["lyrics"] ?? m["letra"] ?? ""),
      isrc: String(m["isrc"] ?? ""),
    }));
  } catch {
    return [];
  }
}
