import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/shared/lib/api-client";

import { toUserMessage } from "@/shared/lib/errors";
/**
 * The company's registration settings — persisted in the real backend
 * (GET/PATCH /company-settings, tenant-scoped, RLS + encrypted CNPJ).
 * Keeps the same flat shape used by the Settings screen and by the
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
  zipCode: string;
  street: string;
  number: string;
  complement: string;
  city: string;
  state: string;
  phone: string;
  contactName: string;
  bankName: string;
  agency: string;
  account: string;
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
  zipCode: "",
  street: "",
  number: "",
  complement: "",
  city: "",
  state: "",
  phone: "",
  contactName: "",
  bankName: "",
  agency: "",
  account: "",
};

function toCompanySettings(res: CompanySettingsResponse): CompanySettings {
  const address = res.address ?? {};
  const banking = res.banking ?? {};
  return {
    company_name: res.legalName ?? "",
    fantasy_name: res.tradeName ?? "",
    cnpj: res.cnpj ?? "",
    inscricao_estadual: res.stateRegistration ?? "",
    zipCode: address.zipCode ?? "",
    street: address.street ?? "",
    number: address.number ?? "",
    complement: address.complement ?? "",
    city: address.city ?? "",
    state: address.state ?? "",
    phone: res.phone ?? "",
    contactName: res.contactName ?? "",
    bankName: banking.bankName ?? "",
    agency: banking.agency ?? "",
    account: banking.account ?? "",
  };
}

function toUpdateDto(company: Partial<CompanySettings>) {
  return {
    legalName: company.company_name,
    tradeName: company.fantasy_name,
    cnpj: company.cnpj || undefined,
    stateRegistration: company.inscricao_estadual,
    contactName: company.contactName,
    address: {
      zipCode: company.zipCode,
      street: company.street,
      number: company.number,
      complement: company.complement,
      city: company.city,
      state: company.state,
    },
    phone: company.phone,
    banking: {
      bankName: company.bankName,
      agency: company.agency,
      account: company.account,
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
