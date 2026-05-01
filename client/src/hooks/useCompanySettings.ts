import { useQuery } from "@tanstack/react-query";
import { MOCK_COMPANY_SETTINGS } from "@/data/mockData";

export interface CompanySettings {
  id: string;
  user_id: string;
  org_id: string;
  company_name: string | null;
  fantasy_name: string | null;
  cnpj: string | null;
  inscricao_estadual: string | null;
  inscricao_municipal?: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  cep: string | null;
  cidade: string | null;
  estado: string | null;
  banco: string | null;
  agencia: string | null;
  conta: string | null;
}

export function useCompanySettings() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["company_settings"],
    queryFn: async () => MOCK_COMPANY_SETTINGS as CompanySettings,
  });

  return { companySettings: data, isLoading, error };
}
