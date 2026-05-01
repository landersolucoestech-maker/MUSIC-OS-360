import type { ProjetoWithRelations } from "@/hooks/useProjetos";

export type ProjetoWithRelationsExtended = ProjetoWithRelations & {
  compositor?: string | null;
  interprete?: string | null;
  genero?: string | null;
  editora?: string | null;
  progresso?: number | null;
  gasto?: number | null;
  nome?: string | null;
  data_prevista_fim?: string | null;
};
