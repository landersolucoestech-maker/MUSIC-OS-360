import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/shared/lib/api-client";

import { toUserMessage } from "@/shared/lib/errors";
/**
 * The company's registration settings — persisted in the real backend
 * (GET/PATCH /company-settings, tenant-scoped, RLS + encrypted CNPJ).
 * Keeps the same flat pt-BR shape used by the Settings screen and by the
 * invoice form, mapping to/from the backend's nested DTO.
 */
export interface CompanySettings {
  id?: string;
  user_id?: string;
  org_id?: string;
  company_name: string;
  fantasy_name: string;
  cnpj: string;
  inscricao_estadual: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  cidade: string;
  estado: string;
  telefone: string;
  responsavel: string;
  banco: string;
  agencia: string;
  conta: string;
}

interface CompanySettingsResponse {
  legalName: string | null;
  tradeName: string | null;
  cnpj: string | null;
  stateRegistration: string | null;
  contactName: string | null;
  address: {
    zipCode?: string; street?: string; number?: string; complement?: string;
    city?: string; state?: string; country?: string;
  };
  phone: string | null;
  banking: { bankName?: string; agency?: string; account?: string };
}

const defaultCompanySettings: CompanySettings = {
  company_name: "",
  fantasy_name: "",
  cnpj: "",
  inscricao_estadual: "",
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  cidade: "",
  estado: "",
  telefone: "",
  responsavel: "",
  banco: "",
  agencia: "",
  conta: "",
};

function toCompanySettings(res: CompanySettingsResponse): CompanySettings {
  const address = res.address ?? {};
  const banking = res.banking ?? {};
  return {
    company_name: res.legalName ?? "",
    fantasy_name: res.tradeName ?? "",
    cnpj: res.cnpj ?? "",
    inscricao_estadual: res.stateRegistration ?? "",
    cep: address.zipCode ?? "",
    logradouro: address.street ?? "",
    numero: address.number ?? "",
    complemento: address.complement ?? "",
    cidade: address.city ?? "",
    estado: address.state ?? "",
    telefone: res.phone ?? "",
    responsavel: res.contactName ?? "",
    banco: banking.bankName ?? "",
    agencia: banking.agency ?? "",
    conta: banking.account ?? "",
  };
}

function toUpdateDto(company: Partial<CompanySettings>) {
  return {
    legalName: company.company_name,
    tradeName: company.fantasy_name,
    cnpj: company.cnpj || undefined,
    stateRegistration: company.inscricao_estadual,
    contactName: company.responsavel,
    address: {
      zipCode: company.cep,
      street: company.logradouro,
      number: company.numero,
      complement: company.complemento,
      city: company.cidade,
      state: company.estado,
    },
    phone: company.telefone,
    banking: {
      bankName: company.banco,
      agency: company.agencia,
      account: company.conta,
    },
  };
}

export function useCompanySettings() {
  const queryClient = useQueryClient();
  const [companySettings, setCompanySettings] = useState<CompanySettings>(defaultCompanySettings);
  const [saving, setSaving] = useState(false);

  const query = useQuery({
    queryKey: ["company_settings"],
    queryFn: () => api.get<CompanySettingsResponse>("/company-settings"),
  });

  useEffect(() => {
    if (query.data) setCompanySettings(toCompanySettings(query.data));
  }, [query.data]);

  const saveCompanySettings = async (company: Partial<CompanySettings>): Promise<boolean> => {
    setSaving(true);
    try {
      const updated = await api.patch<CompanySettingsResponse>("/company-settings", toUpdateDto(company));
      setCompanySettings(toCompanySettings(updated));
      queryClient.setQueryData(["company_settings"], updated);
      toast.success("Configurações da empresa salvas com sucesso!");
      return true;
    } catch (err) {
      toast.error(toUserMessage(err, "Erro ao salvar configurações da empresa"));
      return false;
    } finally {
      setSaving(false);
    }
  };

  return {
    companySettings,
    isLoading: query.isLoading,
    error: query.error,
    saving,
    setCompanySettings,
    saveCompanySettings,
  };
}
