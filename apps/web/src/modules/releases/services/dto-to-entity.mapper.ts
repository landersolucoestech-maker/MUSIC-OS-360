/**
 * releases/mappers/dto-to-entity.mapper.ts
 * Contextual inheritance seeds: parent entity → child form pre-fill.
 */

import type { ReleaseFormFields } from "./entity-to-form.mapper";

export function projectToReleaseSeed(projeto: {
  id: string;
  title?: string | null;
  artist_id?: string | null;
  music_genre?: string | null;
  type?: string | null;
}): Partial<ReleaseFormFields> {
  return {
    projetoSeed: projeto.id,
    title:      projeto.title?.trim() ?? "",
    artist_id:  projeto.artist_id ?? "",
    genero:      projeto.music_genre ?? "",
    type:        projeto.type ?? "single",
  };
}
