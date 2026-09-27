import type { ArtistRef, WorkRef } from "@/shared/types/refs";
import type { ProjectStatusValue, ProjectType } from "@/shared/types/enums";

export type { ProjectStatusValue, ProjectType };

export interface Project {
  id: string;
  user_id?: string;
  title: string;
  type?: ProjectType | string | null;
  status?: ProjectStatusValue | string | null;
  artist_id?: string | null;
  budget?: number | null;
  description?: string | null;
  music_genre?: string | null;
  notes?: string | null;
  /** Tracks in development — normalized into project_tracks (migration 20260718000013). */
  musicas?: import("../utils/track-helpers").TrackData[];
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export type ProjectInsert = Omit<Project, "id" | "user_id" | "created_at" | "updated_at">;
export type ProjectUpdate = Partial<ProjectInsert>;

export interface ProjectWorkSummary extends WorkRef {
  status?: string | null;
}

export interface ProjectWithRelations extends Project {
  artistas?: ArtistRef | null;
  obras?: ProjectWorkSummary[] | null;
}

export interface ProjectWithRelationsExtended extends ProjectWithRelations {
  total_obras?: number;
  obras_concluidas?: number;
  compositor?: string | null;
  interprete?: string | null;
  editora?: string | null;
  progresso?: number | null;
  gasto?: number | null;
  nome?: string | null;
  data_prevista_fim?: string | null;
}

