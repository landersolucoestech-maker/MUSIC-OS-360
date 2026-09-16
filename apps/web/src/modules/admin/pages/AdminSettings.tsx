import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AdminLayout } from "../layouts/AdminLayout";
import { ListSectionHeader } from "@/shared/components/ListSectionHeader";
import { Button } from "@/shared/ui/button";
import { Badge } from "@/shared/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { cn } from "@/shared/lib/utils";
import { IS_PROD } from "@/shared/lib/env";
import {
  useAdminIntegrations,
  useIntegrationCategories,
  useUpdateIntegrationGovernance,
} from "../hooks/useAdminIntegrations";
import type {
  AdminIntegration,
  AudienceMode,
  PublicationState,
} from "../services/admin-integrations.service";
import { adminUsersService } from "../services/admin-users.service";
import type { IntegrationStatus, PlatformIntegrationProvider } from "../types";
import {
  IntegrationLogo,
  type IntegrationLogoId,
} from "@/shared/integrations";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/shared/ui/dropdown-menu";
import {
  Settings, Mail, Shield, Bell, Webhook, KeyRound, Zap,
  CheckCircle2, AlertCircle, Clock, XCircle,
  Eye, EyeOff, RefreshCw, Plus, Trash2, Copy,
  ToggleLeft, ToggleRight, Users, ShieldOff, Search,
  MoreHorizontal, Activity, FileText, ScrollText,
} from "lucide-react";

/* ── types ── */
type TabKey = "usuarios" | "geral" | "email" | "seguranca" | "notificacoes" | "webhooks" | "chaves-api" | "integracoes";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "geral",        label: "Geral",       icon: Settings  },
  { key: "email",        label: "Email",        icon: Mail      },
  { key: "seguranca",    label: "Segurança",    icon: Shield    },
  { key: "notificacoes", label: "Notificações", icon: Bell      },
  { key: "webhooks",     label: "Webhooks",     icon: Webhook   },
  { key: "chaves-api",   label: "Chaves API",   icon: KeyRound  },
  { key: "integracoes",  label: "Integrações",  icon: Zap       },
  { key: "usuarios",     label: "Usuários",     icon: Users     },
];

/* ── integration helpers ── */
const STATUS_CFG: Record<IntegrationStatus, { label: string; color: string; bg: string; icon: React.ComponentType<{ className?: string }> }> = {
  active:   { label: "Ativo",      color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
  inactive: { label: "Inativo",    color: "text-muted-foreground",    bg: "bg-muted border-border",             icon: XCircle      },
  disabled: { label: "Desabilitado",color: "text-muted-foreground",   bg: "bg-muted border-border",              icon: XCircle      },
  error:    { label: "Erro",       color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20",        icon: AlertCircle  },
  pending:  { label: "Pendente",   color: "text-yellow-400",  bg: "bg-yellow-500/10 border-yellow-500/20",  icon: Clock        },
};
const CAT_LABEL: Record<string, string> = {
  core: "Core da Plataforma", billing: "Billing", email: "E-mail",
  observability: "Observabilidade", storage: "Storage", api: "API", webhook: "Webhooks",
  contracts: "Contratos", rights: "Direitos & Associações", fiscal: "Fiscal",
  social: "Redes Sociais", music_platform: "Plataformas de Música",
  launch_connector: "Conectores de Lançamento", marketing: "Marketing",
  // legado (App/tenant)
  payment: "Pagamento", communication: "Comunicação", analytics: "Métricas", music: "Música", accounting: "Accounting", distribution: "Distribuição",
};
const ENV_LABEL: Record<string, string> = { production: "Produção", sandbox: "Sandbox", disabled: "Desabilitado" };
function fmtDate(iso?: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/* ── shared UI ── */
function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[12px] font-medium text-muted-foreground  tracking-wide">{label}</label>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
function Inp({ placeholder, defaultValue, type = "text" }: { placeholder?: string; defaultValue?: string; type?: string }) {
  return (
    <input
      type={type}
      defaultValue={defaultValue}
      placeholder={placeholder}
      className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
    />
  );
}
function Sel({ options, defaultValue }: { options: string[]; defaultValue?: string }) {
  return (
    <select
      defaultValue={defaultValue}
      className="w-full rounded-xl border border-border bg-muted px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/40"
    >
      {options.map(o => <option key={o} value={o} className="bg-card">{o}</option>)}
    </select>
  );
}
function Toggle({ label, desc, defaultOn = false }: { label: string; desc?: string; defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn);
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
      <div>
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {desc && <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>}
      </div>
      <button onClick={() => setOn(!on)} className="shrink-0" data-testid={`toggle-${label}`}>
        {on ? <ToggleRight className="h-6 w-6 text-primary" /> : <ToggleLeft className="h-6 w-6 text-muted-foreground" />}
      </button>
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <h3 className="text-[12px] font-semibold text-muted-foreground  tracking-wider">{title}</h3>
      {children}
    </div>
  );
}
/**
 * CODEBASE_MAP Gotcha #19: this panel's inputs (Inp/Sel/Toggle above) are all
 * uncontrolled (defaultValue only, no onChange) and this button previously
 * fired `toast.success("Configurações salvas")` unconditionally -- no state
 * was even read, let alone sent to an API. No backend contract exists for
 * platform-wide settings (name/URL/timezone/SMTP/trial days/etc.); inventing
 * one is out of scope for a truthfulness fix. Disabled + honest copy instead
 * of a lying success toast, per "make the UI truthful rather than invent
 * backend behavior" -- matches the already-honest empty-state pattern this
 * same file uses for API_KEYS/webhooks below.
 */
function SaveBar() {
  return (
    <div className="flex justify-end items-center gap-2 pt-2">
      <span className="text-[11px] text-muted-foreground">Esta seção ainda não persiste alterações.</span>
      <button
        className="rounded-xl bg-primary/40 px-5 py-2 text-[13px] font-semibold text-primary-foreground/70 cursor-not-allowed"
        data-testid="button-save-settings"
        disabled
        title="Ainda não implementado -- não há endpoint de configurações da plataforma"
      >
        Salvar Alterações
      </button>
    </div>
  );
}

/* ── panels ── */
function TabGeral() {
  return (
    <div className="space-y-4">
      <Section title="Informações da Plataforma">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Nome da Plataforma"><Inp defaultValue="MUSIC OS 360" /></Field>
          <Field label="URL da Plataforma"><Inp defaultValue="musicos360.com" /></Field>
          <Field label="Fuso Horário">
            <Sel options={["America/Sao_Paulo", "America/Manaus", "America/Fortaleza", "UTC"]} defaultValue="America/Sao_Paulo" />
          </Field>
          <Field label="Idioma Padrão">
            <Sel options={["Português (Brasil)", "English", "Español"]} defaultValue="Português (Brasil)" />
          </Field>
          <Field label="Formato de Data">
            <Sel options={["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"]} defaultValue="DD/MM/YYYY" />
          </Field>
          <Field label="Moeda Padrão">
            <Sel options={["BRL — Real Brasileiro", "USD — Dólar", "EUR — Euro"]} defaultValue="BRL — Real Brasileiro" />
          </Field>
        </div>
      </Section>
      <Section title="Suporte & Contato">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Email de Suporte"><Inp defaultValue="suporte@musicos360.com" type="email" /></Field>
          <Field label="Telefone de Suporte"><Inp defaultValue="+55 11 99999-0000" /></Field>
          <Field label="Endereço" hint="Usado em documentos fiscais e contratos">
            <Inp defaultValue="Rua das Artes, 123 — Sala 45, São Paulo, SP" />
          </Field>
          <Field label="CNPJ"><Inp defaultValue="00.000.000/0001-00" /></Field>
        </div>
      </Section>
      <Section title="Manutenção">
        <div className="space-y-0">
          <Toggle label="Modo de Manutenção" desc="Bloqueia acesso de todos os usuários finais à plataforma" />
          <Toggle label="Duração padrão do trial" desc="Exibir banner de trial vencido ao invés de bloquear" defaultOn />
        </div>
        <Field label="Dias de Trial Padrão">
          <Sel options={["7 dias", "14 dias", "30 dias", "60 dias"]} defaultValue="14 dias" />
        </Field>
      </Section>
      <SaveBar />
    </div>
  );
}

function TabEmail() {
  const [showPass, setShowPass] = useState(false);
  return (
    <div className="space-y-4">
      <Section title="Configuração SMTP">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Host SMTP"><Inp placeholder="smtp.exemplo.com" /></Field>
          <Field label="Porta">
            <Sel options={["465 (SSL)", "587 (TLS)", "25 (padrão)"]} defaultValue="587 (TLS)" />
          </Field>
          <Field label="Usuário SMTP"><Inp placeholder="usuario@dominio.com" type="email" /></Field>
          <Field label="Senha SMTP">
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                placeholder="••••••••••••"
                className="w-full rounded-xl border border-border bg-muted px-3 py-2 pr-9 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
              />
              <button className="absolute right-3 top-1/2 -translate-y-1/2" onClick={() => setShowPass(!showPass)}>
                {showPass ? <EyeOff className="h-3.5 w-3.5 text-muted-foreground" /> : <Eye className="h-3.5 w-3.5 text-muted-foreground" />}
              </button>
            </div>
          </Field>
          <Field label="Nome do Remetente"><Inp defaultValue="MUSIC OS 360" /></Field>
          <Field label="Email do Remetente"><Inp defaultValue="noreply@musicos360.com" type="email" /></Field>
        </div>
      </Section>
      <Section title="Templates de Email">
        <div className="space-y-0">
          <Toggle label="Email de Boas-vindas" desc="Enviado ao criar novo tenant" defaultOn />
          <Toggle label="Redefinição de Senha" desc="Link seguro com expiração de 1h" defaultOn />
          <Toggle label="Convite de Usuário" desc="Enviado ao convidar membros" defaultOn />
          <Toggle label="Alertas de Contrato" desc="Vencimentos próximos e assinaturas" defaultOn />
          <Toggle label="Relatório Semanal" desc="Resumo automático toda segunda-feira" />
        </div>
      </Section>
      <SaveBar />
    </div>
  );
}

function TabSeguranca() {
  return (
    <div className="space-y-4">
      <Section title="Política de Senhas">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Comprimento Mínimo">
            <Sel options={["8 caracteres", "10 caracteres", "12 caracteres", "16 caracteres"]} defaultValue="12 caracteres" />
          </Field>
          <Field label="Expiração de Senha">
            <Sel options={["Nunca", "30 dias", "60 dias", "90 dias"]} defaultValue="90 dias" />
          </Field>
        </div>
        <div className="space-y-0">
          <Toggle label="Exigir letras maiúsculas e minúsculas" defaultOn />
          <Toggle label="Exigir números" defaultOn />
          <Toggle label="Exigir caracteres especiais" defaultOn />
          <Toggle label="Impedir reutilização das últimas 5 senhas" defaultOn />
        </div>
      </Section>
      <Section title="Autenticação">
        <div className="space-y-0">
          <Toggle label="Autenticação de Dois Fatores (2FA)" desc="Obrigar 2FA para todos os usuários admin" defaultOn />
          <Toggle label="Login via Google" desc="Permitir SSO com conta Google" />
          <Toggle label="Login via Microsoft" desc="Permitir SSO com conta Microsoft" />
          <Toggle label="Bloqueio após tentativas falhas" desc="Bloquear conta após 5 tentativas" defaultOn />
        </div>
      </Section>
      <Section title="Sessão">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Timeout de Sessão" hint="Usuário é desconectado após inatividade">
            <Sel options={["30 minutos", "1 hora", "4 horas", "8 horas", "24 horas"]} defaultValue="4 horas" />
          </Field>
          <Field label="Máximo de Sessões Simultâneas">
            <Sel options={["1 sessão", "2 sessões", "5 sessões", "Ilimitado"]} defaultValue="5 sessões" />
          </Field>
        </div>
      </Section>
      <Section title="Auditoria & Logs">
        <div className="space-y-0">
          <Toggle label="Registrar todos os logins" defaultOn />
          <Toggle label="Registrar alterações de dados sensíveis" defaultOn />
          <Toggle label="Alertar logins de IPs desconhecidos" defaultOn />
          <Toggle label="Exportar logs para SIEM externo" />
        </div>
      </Section>
      <SaveBar />
    </div>
  );
}

function TabNotificacoes() {
  return (
    <div className="space-y-4">
      <Section title="Canais de Notificação">
        <div className="space-y-0">
          <Toggle label="Notificações por Email" defaultOn />
          <Toggle label="Notificações Push (browser)" defaultOn />
          <Toggle label="Notificações In-App" defaultOn />
          <Toggle label="Notificações via Webhook" />
          <Toggle label="Notificações via Slack" />
        </div>
      </Section>
      <Section title="Eventos do Sistema">
        <div className="space-y-0">
          <Toggle label="Novo usuário criado" defaultOn />
          <Toggle label="Novo tenant cadastrado" defaultOn />
          <Toggle label="Falha de integração" defaultOn />
          <Toggle label="Limite de plano atingido" defaultOn />
          <Toggle label="Contrato próximo do vencimento" defaultOn />
          <Toggle label="Erro crítico de sistema" defaultOn />
          <Toggle label="Backup concluído" />
          <Toggle label="Relatório semanal gerado" />
        </div>
      </Section>
      <Section title="Alertas de MRR & Churn">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Alerta MRR Mínimo (R$)" hint="Notifica quando MRR cai abaixo deste valor">
            <Inp defaultValue="100000" type="number" />
          </Field>
          <Field label="Alerta Churn (%)" hint="Notifica quando churn mensal supera este percentual">
            <Inp defaultValue="5" type="number" />
          </Field>
          <Field label="Frequência de Resumos">
            <Sel options={["Diário", "Semanal", "Mensal", "Desativado"]} defaultValue="Semanal" />
          </Field>
          <Field label="Horário de Envio">
            <Sel options={["08:00", "09:00", "10:00", "18:00"]} defaultValue="09:00" />
          </Field>
        </div>
      </Section>
      <SaveBar />
    </div>
  );
}

// Webhooks configurados virão da API real (/admin/webhooks) quando o endpoint
// existir. Nunca exibir dados fictícios — vazio até lá.
const WEBHOOKS: Array<{ id: string; url: string; events: string[]; status: string; last_called: string }> = [];

function TabWebhooks() {
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors" data-testid="button-add-webhook">
          <Plus className="h-3.5 w-3.5" /> Novo Webhook
        </button>
      </div>
      <Section title="Endpoints Configurados">
        <div className="space-y-3">
          {WEBHOOKS.map(wh => (
            <div key={wh.id} className="rounded-xl border border-border bg-muted p-4 space-y-2" data-testid={`webhook-${wh.id}`}>
              <div className="flex items-center justify-between gap-3">
                <span className="text-[12px] font-sans text-muted-foreground truncate">{wh.url}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={cn("text-[10px] border", wh.status === "active" ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-red-500/10 text-red-400 border-red-500/20")}>
                    {wh.status === "active" ? "Ativo" : "Erro"}
                  </Badge>
                  <button className="text-muted-foreground hover:text-muted-foreground transition-colors"><RefreshCw className="h-3.5 w-3.5" /></button>
                  <button className="text-muted-foreground hover:text-red-400 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {wh.events.map(e => (
                  <span key={e} className="text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary/80 font-sans">{e}</span>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">Último disparo: {fmtDate(wh.last_called)}</p>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Segredo de Assinatura">
        <Field label="Webhook Secret" hint="Usado para validar a autenticidade dos eventos recebidos">
          <div className="flex items-center gap-2">
            <input
              type="password"
              defaultValue=""
              placeholder="Configurar via API de webhooks"
              className="flex-1 rounded-xl border border-border bg-muted px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-primary/40"
            />
            <button className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[12px] text-muted-foreground hover:text-muted-foreground transition-colors">
              <RefreshCw className="h-3.5 w-3.5" /> Rotacionar
            </button>
          </div>
        </Field>
      </Section>
    </div>
  );
}

// Chaves de API virão da API real quando o endpoint existir. Vazio até lá.
const API_KEYS: Array<{ id: string; name: string; key: string; created: string; last_used: string; scopes: string[] }> = [];

function TabChavesApi() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[12px] text-muted-foreground">{API_KEYS.length} chaves ativas</p>
        <button className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 transition-colors" data-testid="button-create-key">
          <Plus className="h-3.5 w-3.5" /> Nova Chave API
        </button>
      </div>
      <Section title="Chaves Ativas">
        <div className="space-y-3">
          {API_KEYS.map(k => (
            <div key={k.id} className="rounded-xl border border-border bg-muted p-4 space-y-3" data-testid={`apikey-${k.id}`}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-muted-foreground">{k.name}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Criada em {new Date(k.created).toLocaleDateString("pt-BR")} · Último uso: {fmtDate(k.last_used)}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button className="text-muted-foreground hover:text-muted-foreground transition-colors" title="Copiar"><Copy className="h-3.5 w-3.5" /></button>
                  <button className="text-muted-foreground hover:text-red-400 transition-colors" title="Revogar"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
              <span className="text-[12px] font-sans text-muted-foreground bg-muted px-3 py-1.5 rounded-lg block truncate">{k.key}</span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {k.scopes.map(s => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded-md bg-primary/10 text-primary/70 font-medium capitalize">{s}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Documentação">
        <p className="text-[12px] text-muted-foreground leading-relaxed">
          Inclua o header <span className="font-sans text-primary/70">Authorization: Bearer sk_live_...</span> em todas as requisições REST.
        </p>
        <button className="mt-1 text-[12px] text-primary hover:underline">Ver documentação completa →</button>
      </Section>
    </div>
  );
}

const PROVIDER_LOGO: Partial<Record<string, IntegrationLogoId>> = {
  stripe: "stripe", abramus: "abramus", ecad: "ecad", ubc: "ubc",
  autentique: "autentique", clicksign: "clicksign", docusign: "docusign", nfe: "nfe",
  meta_business: "meta_business", google_business: "google_business",
  onerpm: "onerpm", distrokid: "distrokid", symphonic: "symphonic",
  soundon: "soundon", somvibe: "somvibe", musicpro: "musicpro",
};
const ENV_BADGE: Record<string, string> = {
  production: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  sandbox: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  disabled: "bg-muted text-muted-foreground border-border",
};

function TabIntegracoes() {
  const { data: integrations, isLoading, isError, error, refetch } = useAdminIntegrations();
  const { data: categories } = useIntegrationCategories();
  const updateGovernance = useUpdateIntegrationGovernance();

  function setPublication(row: AdminIntegration, publicationState: PublicationState) {
    updateGovernance.mutate({ id: row.id, patch: { publicationState } });
  }

  function setAudience(row: AdminIntegration, field: "viewAudience" | "useAudience", mode: AudienceMode) {
    const current = field === "viewAudience" ? row.viewAudience : row.useAudience;
    updateGovernance.mutate({ id: row.id, patch: { [field]: { ...current, mode } } });
  }

  function setCategory(row: AdminIntegration, categoryId: string) {
    updateGovernance.mutate({ id: row.id, patch: { categoryId: categoryId || null } });
  }

  const published    = integrations.filter((i) => i.publicationState === "available").length;
  const draft        = integrations.filter((i) => i.publicationState === "hidden").length;
  const notImplemented = integrations.filter((i) => i.technicalCapability === "not_implemented").length;
  const contradictions = integrations.filter((i) => i.publishedWithoutCapability).length;

  const metrics = [
    { label: "Integrações governadas", value: integrations.length, icon: Zap,          color: "text-muted-foreground", bg: "bg-muted" },
    { label: "Publicadas",             value: published,           icon: CheckCircle2, color: "text-emerald-400",      bg: "bg-emerald-500/10" },
    { label: "Em rascunho",            value: draft,               icon: ShieldOff,    color: "text-muted-foreground", bg: "bg-muted" },
    { label: "Sem adapter",            value: notImplemented,      icon: AlertCircle,  color: "text-yellow-400",       bg: "bg-yellow-500/10" },
  ];

  const byCategory = integrations.reduce<Record<string, AdminIntegration[]>>((acc, i) => {
    const key = i.categoryName ?? "Sem categoria";
    (acc[key] = acc[key] ?? []).push(i);
    return acc;
  }, {});

  // LOADING / ERROR / EMPTY são três estados distintos. Um erro NUNCA pode ser
  // renderizado como "não há integrações" — foi assim que uma falha de request
  // passou por catálogo vazio enquanto o banco tinha 14 registros.
  if (isLoading) {
    return <p className="text-sm text-muted-foreground" data-testid="admin-integrations-loading">Carregando governança de integrações…</p>;
  }

  if (isError) {
    const status = (error as { statusCode?: number } | null)?.statusCode;
    return (
      <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 space-y-2" data-testid="admin-integrations-error">
        <p className="text-sm font-medium text-destructive">
          Não foi possível carregar a governança de integrações
          {typeof status === "number" ? ` (HTTP ${status})` : ""}.
        </p>
        <p className="text-xs text-muted-foreground">
          {(error as Error | null)?.message ?? "Erro desconhecido."} Isto NÃO significa que o
          catálogo está vazio — verifique se a API está no ar e se a rota
          <code className="mx-1">GET /admin/integrations</code> existe nesta build.
        </p>
        <Button variant="outline" size="sm" onClick={() => void refetch()}>Tentar novamente</Button>
      </div>
    );
  }

  if (integrations.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="admin-integrations-empty">
        A API respondeu com sucesso, mas o catálogo administrativo está vazio.
        Rode a migration de governança para popular <code>platform_integrations</code>.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold">Governança de integrações</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          Define o que cada cliente enxerga e pode usar. A capacidade técnica é somente leitura —
          vem do código, não deste painel: publicar uma integração sem adapter não a faz funcionar,
          e o backend continua bloqueando o uso.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div key={m.label} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-3">
              <div className={`rounded-md p-2 ${m.bg}`}>
                <m.icon className={`h-4 w-4 ${m.color}`} />
              </div>
              <div>
                <p className="text-xl font-semibold tabular-nums">{m.value}</p>
                <p className="text-xs text-muted-foreground">{m.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {contradictions > 0 && (
        <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4">
          <p className="text-sm font-medium text-yellow-500">
            {contradictions} integração(ões) publicada(s) sem adapter implementado
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Clientes na audiência enxergam, mas o uso é negado pelo backend. Implemente o adapter
            ou volte para rascunho.
          </p>
        </div>
      )}

      {Object.entries(byCategory).map(([category, rows]) => (
        <section key={category} className="space-y-3">
          <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">{category}</h4>
          <div className="space-y-3">
            {rows.map((row) => (
              <div key={row.id} className="rounded-lg border border-border bg-card p-4 space-y-4" data-testid={`admin-integration-${row.providerKey}`}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{row.name}</span>
                      <code className="text-xs text-muted-foreground">{row.providerKey}</code>
                      {row.isCore && <Badge variant="info">Core</Badge>}
                      {row.technicalCapability === "implemented"
                        ? <Badge variant="success">Adapter implementado</Badge>
                        : <Badge variant="warning">Sem adapter</Badge>}
                      {row.publishedWithoutCapability && <Badge variant="danger">Publicado sem adapter</Badge>}
                    </div>
                    {row.capabilityEvidence && (
                      <p className="text-xs text-muted-foreground mt-1 font-mono">{row.capabilityEvidence}</p>
                    )}
                    {row.requiredEnv.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Requer no ambiente: {row.requiredEnv.join(", ")}
                      </p>
                    )}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <label className="space-y-1.5 block">
                    <span className="text-xs text-muted-foreground">Publicação</span>
                    <select
                      className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
                      value={row.publicationState}
                      disabled={updateGovernance.isPending}
                      onChange={(e) => setPublication(row, e.target.value as PublicationState)}
                      data-testid={`publication-${row.providerKey}`}
                    >
                      <option value="hidden">Oculta</option>
                      <option value="coming_soon">Em breve</option>
                      <option value="beta">Beta</option>
                      <option value="available">Disponível</option>
                      <option value="temporarily_unavailable">Temporariamente indisponível</option>
                    </select>
                  </label>

                  <label className="space-y-1.5 block">
                    <span className="text-xs text-muted-foreground">Quem enxerga (VIEW)</span>
                    <select
                      className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
                      value={row.viewAudience.mode}
                      disabled={updateGovernance.isPending}
                      onChange={(e) => setAudience(row, "viewAudience", e.target.value as AudienceMode)}
                      data-testid={`view-audience-${row.providerKey}`}
                    >
                      <option value="none">Ninguém</option>
                      <option value="all">Todos os clientes</option>
                      <option value="plans">Por plano</option>
                      <option value="tenants">Clientes específicos</option>
                    </select>
                  </label>

                  <label className="space-y-1.5 block">
                    <span className="text-xs text-muted-foreground">Quem usa (USE)</span>
                    <select
                      className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
                      value={row.useAudience.mode}
                      disabled={updateGovernance.isPending}
                      onChange={(e) => setAudience(row, "useAudience", e.target.value as AudienceMode)}
                      data-testid={`use-audience-${row.providerKey}`}
                    >
                      <option value="none">Ninguém</option>
                      <option value="all">Todos os clientes</option>
                      <option value="plans">Por plano</option>
                      <option value="tenants">Clientes específicos</option>
                    </select>
                  </label>

                  <label className="space-y-1.5 block">
                    <span className="text-xs text-muted-foreground">Categoria</span>
                    <select
                      className="w-full h-9 rounded-md border border-border bg-background px-2 text-sm"
                      value={categories.find((c) => c.name === row.categoryName)?.id ?? ""}
                      disabled={updateGovernance.isPending}
                      onChange={(e) => setCategory(row, e.target.value)}
                    >
                      <option value="">Sem categoria</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

// Estilo de badge por slug de papel — best-effort, não é uma lista exaustiva:
// qualquer slug não mapeado aqui ainda exibe seu role_name real, só sem cor especial.
const ROLE_STYLE: Record<string, string> = {
  super_admin: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  tenant_owner: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  owner:       "text-amber-400 bg-amber-500/10 border-amber-500/20",
  admin:       "text-primary bg-primary/10 border-primary/20",
  manager:     "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
  financial:   "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  accounting:  "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  viewer:      "text-muted-foreground bg-muted border-border",
};
const DEFAULT_ROLE_STYLE = "text-muted-foreground bg-muted border-border";

function TabUsuarios() {
  const [search, setSearch] = useState("");
  const usersQuery = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => adminUsersService.list(),
  });
  const users = usersQuery.data ?? [];

  const filtered = users.filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || u.tenant_name.toLowerCase().includes(q);
  });
  const active  = users.filter(u => u.status === "active").length;
  const blocked = users.filter(u => u.status === "blocked").length;
  const mfa     = users.filter(u => u.mfa_enabled).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Usuários Ativos", value: active,                  color: "text-emerald-400", bg: "bg-emerald-500/10", icon: Users     },
          { label: "Bloqueados",      value: blocked,                 color: "text-red-400",     bg: "bg-red-500/10",     icon: ShieldOff },
          { label: "Com MFA",         value: mfa,                     color: "text-primary",    bg: "bg-primary/10",    icon: Shield    },
          { label: "Total",           value: users.length, color: "text-muted-foreground",    bg: "bg-muted",        icon: Users     },
        ].map(({ label, value, color, bg, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-4">
            <div className={cn("flex h-8 w-8 items-center justify-center rounded-xl mb-3", bg)}>
              <Icon className={cn("h-4 w-4", color)} />
            </div>
            <p className="text-xl font-bold text-foreground">{value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          placeholder="Buscar usuários..."
          className="w-full pl-9 rounded-xl border border-border bg-muted py-2 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
          value={search}
          onChange={e => setSearch(e.target.value)}
          data-testid="input-search-users"
        />
      </div>

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <ListSectionHeader
          title="Usuários Administrativos"
          count={filtered.length}
          description="Acompanhe usuários, tenants, papéis, MFA e sessões ativas"
          className="p-4"
        />
        {usersQuery.isLoading ? (
          <div className="py-10 text-center text-[13px] text-muted-foreground">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center text-[13px] text-muted-foreground">Nenhum usuário encontrado.</div>
        ) : (
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              {["Usuário", "Tenant", "Role", "MFA", "Status", "Sessões", "Último Login"].map(h => (
                <TableHead key={h} className="text-[11px] font-semibold text-muted-foreground  tracking-wider">{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((u) => {
              const statusColor = u.status === "active" ? "text-emerald-400" : u.status === "blocked" ? "text-red-400" : "text-muted-foreground";
              return (
                <TableRow key={u.id} className="border-border hover:bg-muted transition-colors" data-testid={`user-${u.id}`}>
                  <TableCell className="py-3.5">
                    <p className="text-[13px] font-medium text-foreground">{u.name}</p>
                    <p className="text-[11px] text-muted-foreground">{u.email}</p>
                  </TableCell>
                  <TableCell className="py-3.5 text-[12px] text-muted-foreground">{u.tenant_name}</TableCell>
                  <TableCell className="py-3.5">
                    <Badge variant="outline" className={cn("text-[10px] border", ROLE_STYLE[u.role_slug] ?? DEFAULT_ROLE_STYLE)}>
                      {u.role_name}
                    </Badge>
                  </TableCell>
                  <TableCell className="py-3.5">
                    {u.mfa_enabled === null
                      ? <span className="text-[11px] text-muted-foreground">Indisponível</span>
                      : u.mfa_enabled
                        ? <Shield className="h-3.5 w-3.5 text-emerald-400" />
                        : <ShieldOff className="h-3.5 w-3.5 text-muted-foreground" />}
                  </TableCell>
                  <TableCell className="py-3.5">
                    <span className={cn("text-[12px] font-medium capitalize", statusColor)}>
                      {u.status === "active" ? "Ativo" : "Bloqueado"}
                    </span>
                  </TableCell>
                  <TableCell className="py-3.5 text-[12px] text-muted-foreground">Indisponível</TableCell>
                  <TableCell className="py-3.5">
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {u.last_login
                        ? new Date(u.last_login).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })
                        : "Indisponível"}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        )}
      </div>
    </div>
  );
}

const TAB_PANELS: Record<TabKey, React.ComponentType> = {
  usuarios:     TabUsuarios,
  geral:        TabGeral,
  email:        TabEmail,
  seguranca:    TabSeguranca,
  notificacoes: TabNotificacoes,
  webhooks:     TabWebhooks,
  "chaves-api": TabChavesApi,
  integracoes:  TabIntegracoes,
};

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<TabKey>("geral");
  const Panel = TAB_PANELS[activeTab];

  return (
    <AdminLayout>
      <div className="p-6 space-y-6 animate-fade-in bg-card min-h-full">
        <div>
          <h1 className="text-xl font-bold text-foreground">Configurações</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">Gerencie todas as configurações da plataforma</p>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-0.5 border-b border-border overflow-x-auto pb-0 flex-nowrap">
          {TABS.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-[12px] font-medium whitespace-nowrap border-b-2 transition-all -mb-px",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-muted-foreground hover:border-border",
                )}
                data-testid={`tab-settings-${tab.key}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Panel */}
        <Panel />
      </div>
    </AdminLayout>
  );
}


