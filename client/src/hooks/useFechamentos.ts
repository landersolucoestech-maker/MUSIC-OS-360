import { useQuery } from "@tanstack/react-query";
import { MOCK_FECHAMENTOS } from "@/data/mockData";

export interface FechamentoContabil {
  id: string;
  user_id: string;
  org_id: string;
  periodo: string;
  status: string;
  data_fechamento: string | null;
  receitas: number;
  despesas: number;
  resultado: number;
  observacoes: string | null;
  created_at: string;
}

export function useFechamentos() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["fechamentos_contabeis"],
    queryFn: async () => MOCK_FECHAMENTOS as FechamentoContabil[],
  });

  return {
    fechamentos: data || [],
    isLoading,
    error,
  };
}
