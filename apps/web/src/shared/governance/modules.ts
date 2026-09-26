/**
 * shared/governance/modules.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * MUSIC OS 360 — Canonical Module Registry
 *
 * Single source of truth for:
 *   - The list of every module in the system
 *   - Each module's root route
 *   - RBAC permission key (TenantModuleKey)
 *   - Feature flag controlling access
 *   - The module's primary entities
 *   - Dependencies between modules
 *   - Implementation status
 *
 * RULE: no new module may be added to the system without first
 *        being registered here, with every property filled in.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { TenantModuleKey } from "@/app/providers/TenantContext";

// ─── Tipos do registo ─────────────────────────────────────────────────────────

export type ModuleStatus =
  | "production"    // active, in production (standalone mode)
  | "beta"          // funcional mas incompleto
  | "stub"          // structure present, content to be developed
  | "planned";      // planned, not implemented yet

export interface ModuleDefinition {
  /** Unique module identifier (TenantModuleKey) */
  key: TenantModuleKey;
  /** Display name */
  name: string;
  /** Rota raiz no React Router */
  route: string;
  /** Feature flag em FeatureFlags */
  featureFlag: string;
  /** Primary entities managed by the module */
  primaryEntities: string[];
  /** Modules this one depends on (reads data from) */
  dependsOn: TenantModuleKey[];
  /** Modules that depend on this one (consume its data) */
  consumedBy: TenantModuleKey[];
  /** Current implementation status */
  status: ModuleStatus;
  /** Short functional description */
  description: string;
}

// ─── Module registry ──────────────────────────────────────────────────────────

export const MODULE_REGISTRY: Record<TenantModuleKey, ModuleDefinition> = {

  // ── Artists ─────────────────────────────────────────────────────────────────
  artists: {
    key:             "artists",
    name:            "Artistas",
    route:           "/artistas",
    featureFlag:     "moduleArtists",
    primaryEntities: ["Artista"],
    dependsOn:       ["contracts", "catalog"],
    consumedBy:      ["catalog", "releases", "contracts", "crm",
                      "accounting", "marketing", "events", "monitoring",
                      "licensing", "projects"],
    status:          "production",
    description:
      "Gestão completa de artistas: perfil, dados fiscais, relacionamentos " +
      "(empresário, gravadora, editora, booker), métricas de plataformas de " +
      "streaming e visão 360° consolidada.",
  },

  // ── Catalog ─────────────────────────────────────────────────────────────────
  catalog: {
    key:             "catalog",
    name:            "Catálogo",
    route:           "/catalogo",
    featureFlag:     "moduleCatalog",
    primaryEntities: ["Obra", "Fonograma"],
    dependsOn:       ["artists"],
    consumedBy:      ["releases", "licensing", "monitoring", "accounting"],
    status:          "production",
    description:
      "Catálogo musical completo: obras (composições, ISWC), fonogramas " +
      "(gravações, ISRC), shares de composição e master, " +
      "metadata editorial e controlo de territórios.",
  },

  // ── Releases ────────────────────────────────────────────────────────────────
  releases: {
    key:             "releases",
    name:            "Lançamentos",
    route:           "/lancamentos",
    featureFlag:     "moduleReleases",
    primaryEntities: ["Lancamento", "Share"],
    dependsOn:       ["artists", "catalog"],
    consumedBy:      ["accounting", "marketing", "monitoring"],
    status:          "production",
    description:
      "Lançamentos musicais (single, EP, álbum, compilação, live): " +
      "metadata, distribuidoras, plataformas, datas de entrega e " +
      "gestão de shares/participações por lançamento.",
  },

  // ── Contracts ───────────────────────────────────────────────────────────────
  contracts: {
    key:             "contracts",
    name:            "Contratos",
    route:           "/contratos",
    featureFlag:     "moduleContracts",
    primaryEntities: ["Contrato", "TemplateContrato"],
    dependsOn:       ["artists", "crm"],
    consumedBy:      ["accounting", "artists", "releases"],
    status:          "production",
    description:
      "Gestão de contratos: templates editáveis, assinatura digital " +
      "(Autentique), alertas de vencimento, histórico de versões e " +
      "rastreio de status (rascunho → assinado → encerrado).",
  },

  // ── Accounting ──────────────────────────────────────────────────────────────
  accounting: {
    key:             "accounting",
    name:            "Accounting",
    route:           "/accounting",
    featureFlag:     "moduleAccounting",
    primaryEntities: ["Transacao", "NotaFiscal"],
    dependsOn:       ["artists", "contracts", "projects"],
    consumedBy:      [],
    status:          "production",
    description:
      "Contabilidade operacional: transações (receita/despesa), P&L por " +
      "artista e projecto, fluxo de caixa, conciliação bancária OFX, " +
      "recoupment tracking e emissão de notas fiscais. " +
      "ÂMBITO: receita − despesa = lucro líquido. " +
      "NÃO inclui: recebimentos externos de direitos, splits, distribuição de pagamentos.",
  },

  // ── CRM ─────────────────────────────────────────────────────────────────────
  crm: {
    key:             "crm",
    name:            "CRM",
    route:           "/crm",
    featureFlag:     "moduleCrm",
    primaryEntities: ["Cliente", "Contato"],
    dependsOn:       ["artists"],
    consumedBy:      ["contracts", "marketing", "leads"],
    status:          "production",
    description:
      "CRM de clientes e contactos: empresas, pessoas físicas, " +
      "histórico de interacções, segmentação e vinculação a artistas.",
  },

  // ── Marketing ───────────────────────────────────────────────────────────────
  marketing: {
    key:             "marketing",
    name:            "Marketing",
    route:           "/marketing",
    featureFlag:     "moduleMarketing",
    primaryEntities: ["Campanha", "Conteudo"],
    dependsOn:       ["artists", "releases", "crm"],
    consumedBy:      [],
    status:          "production",
    description:
      "Gestão de campanhas e conteúdo: calendário editorial, briefings, " +
      "tarefas de marketing, IA Criativa para copy e " +
      "integração com Meta Ads (stub), Google Ads (stub), " +
      "TikTok Ads (stub).",
  },

  // ── Events ──────────────────────────────────────────────────────────────────
  events: {
    key:             "events",
    name:            "Eventos",
    route:           "/operacoes/eventos",
    featureFlag:     "moduleEvents",
    primaryEntities: ["Evento"],
    dependsOn:       ["artists", "projects"],
    consumedBy:      ["accounting"],
    status:          "production",
    description:
      "Gestão de eventos ao vivo e em estúdio: shows, festivais, " +
      "gravações, videoclipes, ensaios. Controlo de status, " +
      "datas, locais e vinculação a artistas e projectos.",
  },

  // ── Inventory ───────────────────────────────────────────────────────────────
  inventory: {
    key:             "inventory",
    name:            "Inventário",
    route:           "/operacoes/inventario",
    featureFlag:     "moduleInventory",
    primaryEntities: ["Inventario"],
    dependsOn:       [],
    consumedBy:      ["accounting"],
    status:          "production",
    description:
      "Inventário de equipamentos e activos: estado (disponível, em uso, " +
      "manutenção, emprestado, descartado), localização e " +
      "histórico de utilização.",
  },

  // ── RH ──────────────────────────────────────────────────────────────────────
  rh: {
    key:             "rh",
    name:            "Recursos Humanos",
    route:           "/operacoes/rh",
    featureFlag:     "moduleRh",
    primaryEntities: ["Funcionario", "FeriasAusencia"],
    dependsOn:       [],
    consumedBy:      ["accounting"],
    status:          "production",
    description:
      "Gestão de colaboradores: CLT, PJ, autónomos, estagiários. " +
      "Cargos, departamentos, contratos de trabalho, " +
      "férias e ausências.",
  },

  // ── Monitoring ──────────────────────────────────────────────────────────────
  monitoring: {
    key:             "monitoring",
    name:            "Monitoramento",
    route:           "/monitoramento",
    featureFlag:     "moduleMonitoring",
    primaryEntities: ["Takedown"],
    dependsOn:       ["catalog", "artists"],
    consumedBy:      [],
    status:          "production",
    description:
      "Monitoramento de uso do catálogo e protecção de direitos: " +
      "takedowns (plataformas digitais), conciliação ECAD " +
      "(ECADViewModal), tracking de infracções e rastreio de uso " +
      "não autorizado.",
  },

  // ── Licensing ───────────────────────────────────────────────────────────────
  licensing: {
    key:             "licensing",
    name:            "Licenciamento",
    route:           "/licencas",
    featureFlag:     "moduleLicensing",
    primaryEntities: ["Licenca"],
    dependsOn:       ["catalog", "contracts", "crm"],
    consumedBy:      ["accounting"],
    status:          "production",
    description:
      "Licenciamento de obras: sincronia, mecânica, performance, " +
      "impressão, digital, streaming. Controlo de territórios, " +
      "prazos e valores por tipo de uso.",
  },

  // ── Projects ─────────────────────────────────────────────────────────────────
  projects: {
    key:             "projects",
    name:            "Projetos",
    route:           "/projetos",
    featureFlag:     "moduleProjects",
    primaryEntities: ["Projeto"],
    dependsOn:       ["artists", "catalog", "events"],
    consumedBy:      ["accounting", "events"],
    status:          "production",
    description:
      "Gestão de projectos musicais: álbuns, EPs, singles, videoclipes, " +
      "shows, tours e campanhas. P&L por projecto, " +
      "recoupment tracking e vinculação a transações.",
  },

  // ── Leads ───────────────────────────────────────────────────────────────────
  leads: {
    key:             "leads",
    name:            "Leads",
    route:           "/crm/leads",
    featureFlag:     "moduleLeads",
    primaryEntities: ["Lead"],
    dependsOn:       ["crm"],
    consumedBy:      ["crm", "contracts"],
    status:          "production",
    description:
      "Leads comerciais: captacao, follow-up, proposta e contrato." +
      "negociação → fechado / perdido. Temperatura, prioridade, " +
      "valor estimado e histórico de actividade.",
  },

  // ── Audit ────────────────────────────────────────────────────────────────────
  audit: {
    key:             "audit",
    name:            "Auditoria",
    route:           "/admin/auditoria",
    featureFlag:     "auditLog",
    primaryEntities: ["AuditLog"],
    dependsOn:       [],
    consumedBy:      [],
    status:          "stub",
    description:
      "Log de auditoria de todas as acções do sistema: quem fez o quê, " +
      "quando e em que entidade. Acesso restrito a owner/admin. " +
      "FUTURO: integração com backend persistente.",
  },

  // ── Settings ─────────────────────────────────────────────────────────────────
  settings: {
    key:             "settings",
    name:            "Configurações",
    route:           "/configuracoes",
    featureFlag:     "moduleArtists",  // always accessible
    primaryEntities: ["Tenant", "User", "Role"],
    dependsOn:       [],
    consumedBy:      [],
    status:          "production",
    description:
      "Configurações do tenant: perfil da empresa, utilizadores, " +
      "papéis e permissões RBAC, integrações (ABRAMUS funcional; " +
      "restantes em stub) e personalizacao operacional de tenant.",
  },

  musicchat: {
    key:             "musicchat",
    name:            "MusicChat",
    route:           "/chat",
    featureFlag:     "moduleArtists",
    primaryEntities: ["Conversation", "ConversationMessage", "MusicChatAutomation"],
    dependsOn:       ["crm", "leads", "events", "settings"],
    consumedBy:      ["audit", "marketing", "crm"],
    status:          "production",
    description:
      "Central multicanal de atendimento: Inbox real em /chat (lista de conversas, " +
      "timeline de mensagens, composer, realtime, RBAC, tenant isolation testada) " +
      "sobre o backend real de conversations/messages/notes. WhatsApp é o único canal " +
      "com webhook + envio outbound reais (2026-08-22 — corrigido: respostas do agente " +
      "e mensagens de triagem automatica antes só ficavam gravadas no banco, nunca " +
      "chegavam ao WhatsApp de verdade). Instagram/Facebook/TikTok/site do tenant ainda " +
      "não têm canal de mensagens real (só métricas para os dois primeiros) — " +
      "registrados como pendência técnica, não simulados na UI.",
  },
};

// ─── Helpers de acesso ao registo ─────────────────────────────────────────────

export function getModule(key: TenantModuleKey): ModuleDefinition {
  return MODULE_REGISTRY[key];
}

export function getAllModules(): ModuleDefinition[] {
  return Object.values(MODULE_REGISTRY);
}

export function getModulesByStatus(status: ModuleStatus): ModuleDefinition[] {
  return getAllModules().filter(m => m.status === status);
}

export function getModuleDependencies(key: TenantModuleKey): ModuleDefinition[] {
  return MODULE_REGISTRY[key].dependsOn.map(dep => MODULE_REGISTRY[dep]);
}

export function getModuleConsumers(key: TenantModuleKey): ModuleDefinition[] {
  return getAllModules().filter(m => m.dependsOn.includes(key));
}

// ─── Regras de camada compartilhada ──────────────────────────────────────────

/**
 * RULE: what may and what may NOT go into shared/.
 *
 * MAY go into shared/:
 *   - Types used by 2+ modules (refs.ts, enums.ts)
 *   - Primitive UI components (shadcn/Radix wrappers)
 *   - Genuinely cross-domain components (MainLayout, PageHeader,
 *     ContratoStatusBadge, DataTable, FinanceChart, AIGenerateButton)
 *   - App infrastructure (ErrorBoundary, RouteErrorBoundary, AdminRoute)
 *   - Providers (AuthProvider, TenantProvider)
 *   - Config (queryClient, CACHE_TIMES)
 *   - Cross-domain hooks (useCommandPalette, useTenant, useAuth)
 *   - Pure utilities (utils.ts, normalize.ts, tenant-isolation.ts)
 *   - Integration contracts (shared/integrations/contracts/)
 *   - Governance (shared/governance/)
 *
 * May NOT go into shared/:
 *   - Logic specific to a single module
 *   - Components that only make sense in one module
 *   - Services with specific domain knowledge
 *   - Entity mappers (they belong to the entity's owning module)
 */
export const SHARED_LAYER_RULES = {
  allowed: [
    "tipos cross-domain (2+ módulos)",
    "componentes UI primitivos (shadcn/Radix)",
    "componentes genuinamente cross-domain",
    "infra-estrutura de app (ErrorBoundary, AdminRoute)",
    "providers (Auth, Tenant)",
    "config (queryClient)",
    "hooks cross-domain",
    "utilitários puros",
    "contratos de integração",
    "governance",
  ],
  forbidden: [
    "lógica específica de módulo único",
    "componentes apenas de um módulo",
    "serviços com domínio específico",
    "mappers de entidade (pertencem ao módulo)",
  ],
} as const;

