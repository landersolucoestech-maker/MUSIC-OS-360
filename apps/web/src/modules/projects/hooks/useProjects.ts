import { QUERY_KEYS } from "@/shared/lib/query-config";
import { useDataQuery } from "@/shared/hooks/useDataQuery";
import type {
  Project,
  ProjectInsert,
  ProjectUpdate,
  ProjectWorkSummary,
  ProjectWithRelations,
  ProjectWithRelationsExtended,
} from "../types/projects.types";

export type { Project, ProjectInsert, ProjectUpdate, ProjectWorkSummary, ProjectWithRelations, ProjectWithRelationsExtended };

export function useProjects(enabled = true, artistId?: string) {
  const result = useDataQuery<ProjectWithRelations>({
    queryKey: artistId ? [...QUERY_KEYS.PROJECTS, "by-artist", artistId] : [...QUERY_KEYS.PROJECTS],
    table: "projects",
    enabled,
    // QueryProjectDto só aceita "artistId" (Task H alinhou DTO/service nesse nome) —
    // "artist_id" era rejeitado pelo whitelist do ValidationPipe (400), quebrando
    // a aba Projetos do modal Visão 360° do artista.
    filters: artistId ? { artistId: artistId } : undefined,
  }, {
    create: { success: "Projeto criado com sucesso!", error: "Erro ao criar projeto" },
    update: { success: "Projeto atualizado com sucesso!", error: "Erro ao atualizar projeto" },
    delete: { success: "Projeto excluído com sucesso!", error: "Erro ao excluir projeto" },
  });

  return {
    projects: result.data,
    isLoading: result.isLoading,
    error: result.error,
    refetch: result.refetch,
    addProject: result.create,
    updateProject: result.update,
    deleteProject: result.delete,
  };
}
