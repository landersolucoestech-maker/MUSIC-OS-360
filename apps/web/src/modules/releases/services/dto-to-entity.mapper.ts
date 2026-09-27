/**
 * releases/mappers/dto-to-entity.mapper.ts
 * Contextual inheritance seeds: parent entity → child form pre-fill.
 */

import type { ReleaseFormFields } from "./entity-to-form.mapper";

export function projectToReleaseSeed(project: {
  id: string;
  title?: string | null;
  artist_id?: string | null;
  music_genre?: string | null;
  type?: string | null;
}): Partial<ReleaseFormFields> {
  return {
    projetoSeed: project.id,
    title:      project.title?.trim() ?? "",
    artist_id:  project.artist_id ?? "",
    genero:      project.music_genre ?? "",
    type:        project.type ?? "single",
  };
}
