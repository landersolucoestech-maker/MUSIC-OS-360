import type { Tables, TablesInsert, TablesUpdate } from "@/types/database";
import { QUERY_KEYS } from "@/lib/query-config";
import { useSupabaseQuery } from "./useSupabaseQuery";

export type TemplateContrato = Tables<"templates_contratos">;
export type TemplateContratoInsert = Omit<TablesInsert<"templates_contratos">, "user_id" | "id" | "created_at" | "updated_at">;
export type TemplateContratoUpdate = Omit<TablesUpdate<"templates_contratos">, "id" | "user_id" | "created_at" | "updated_at">;

export function useTemplatesContratos() {
  const result = useSupabaseQuery<TemplateContrato>({
    queryKey: [...QUERY_KEYS.TEMPLATES_CONTRATOS],
    table: "templates_contratos",
  }, {
    create: { success: "Template criado com sucesso!", error: "Erro ao criar template" },
    update: { success: "Template atualizado com sucesso!", error: "Erro ao atualizar template" },
    delete: { success: "Template excluído com sucesso!", error: "Erro ao excluir template" },
  });

  return {
    templates: result.data,
    isLoading: result.isLoading,
    error: result.error,
    addTemplate: result.create,
    updateTemplate: result.update,
    deleteTemplate: result.delete,
  };
}
