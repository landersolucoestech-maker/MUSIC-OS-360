import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/**
 * Configurações do usuário e da empresa em localStorage.
 *
 * Originalmente persistia em `user_settings`, `company_settings` e
 * `organizations` no Supabase. Sem backend, salvamos tudo em
 * localStorage por usuário (chave `lander_user_settings:<id>` etc).
 */

export interface UserSettings {
  id?: string;
  user_id?: string;
  full_name: string;
  phone: string;
  cargo: string;
  avatar_url: string;
  notify_email: boolean;
  notify_push: boolean;
  notify_lancamentos: boolean;
  notify_contratos: boolean;
  notify_financeiro: boolean;
  notify_marketing: boolean;
  auto_notificar_vencimento: boolean;
  auto_lembrete_renovacao: boolean;
  auto_alerta_financeiro: boolean;
  auto_backup: boolean;
  auto_relatorio_semanal: boolean;
  theme: string;
  accent_color: string;
  sidebar_compact: boolean;
  animations_enabled: boolean;
  language: string;
  timezone: string;
  date_format: string;
  time_format: string;
  currency: string;
}

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

const defaultUserSettings: UserSettings = {
  full_name: "",
  phone: "",
  cargo: "",
  avatar_url: "",
  notify_email: true,
  notify_push: false,
  notify_lancamentos: true,
  notify_contratos: true,
  notify_financeiro: true,
  notify_marketing: false,
  auto_notificar_vencimento: true,
  auto_lembrete_renovacao: true,
  auto_alerta_financeiro: false,
  auto_backup: true,
  auto_relatorio_semanal: false,
  theme: "dark",
  accent_color: "red",
  sidebar_compact: false,
  animations_enabled: true,
  language: "pt-BR",
  timezone: "America/Sao_Paulo",
  date_format: "DD/MM/YYYY",
  time_format: "24h",
  currency: "BRL",
};

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

const userKey = (id: string) => `lander_user_settings:${id}`;
const companyKey = (id: string) => `lander_company_settings:${id}`;
const orgSlugKey = (id: string) => `lander_org_slug:${id}`;

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return { ...fallback, ...(JSON.parse(raw) as Partial<T>) } as T;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignora falha de quota
  }
}

export function useUserSettings() {
  const { user } = useAuth();
  const [userSettings, setUserSettings] = useState<UserSettings>(defaultUserSettings);
  const [companySettings, setCompanySettings] = useState<CompanySettings>(defaultCompanySettings);
  const [orgSlug, setOrgSlug] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadSettings = () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setUserSettings(readJSON<UserSettings>(userKey(user.id), defaultUserSettings));
      setCompanySettings(
        readJSON<CompanySettings>(companyKey(user.id), defaultCompanySettings),
      );
      try {
        setOrgSlug(localStorage.getItem(orgSlugKey(user.id)) ?? "");
      } catch {
        setOrgSlug("");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const saveUserSettings = async (settings: Partial<UserSettings>) => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = { ...userSettings, ...settings, user_id: user.id };
      writeJSON(userKey(user.id), updated);
      setUserSettings(updated);
      toast.success("Configurações salvas com sucesso!");
    } finally {
      setSaving(false);
    }
  };

  const saveCompanySettings = async (settings: Partial<CompanySettings>) => {
    if (!user) return;
    setSaving(true);
    try {
      const updated = { ...companySettings, ...settings, user_id: user.id };
      writeJSON(companyKey(user.id), updated);
      setCompanySettings(updated);
      toast.success("Configurações da empresa salvas com sucesso!");
    } finally {
      setSaving(false);
    }
  };

  const saveOrgSlug = async (slug: string): Promise<boolean> => {
    if (!user) return false;
    const slugRegex = /^[a-z0-9-]+$/;
    if (!slugRegex.test(slug)) {
      toast.error("O slug deve conter apenas letras minúsculas, números e hífens.");
      return false;
    }
    setSaving(true);
    try {
      try {
        localStorage.setItem(orgSlugKey(user.id), slug);
      } catch {
        // ignora falha de quota
      }
      setOrgSlug(slug);
      return true;
    } finally {
      setSaving(false);
    }
  };

  return {
    userSettings,
    companySettings,
    orgSlug,
    loading,
    saving,
    setUserSettings,
    setCompanySettings,
    setOrgSlug,
    saveUserSettings,
    saveCompanySettings,
    saveOrgSlug,
    refreshSettings: loadSettings,
  };
}
