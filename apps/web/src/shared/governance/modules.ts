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

// ─── Registry types ───────────────────────────────────────────────────────────

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
  /** Root route in React Router */
  route: string;
  /** Feature flag in FeatureFlags */
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
      "Complete artist management: profile, tax data, relationships " +
      "(manager, label, publisher, booker), streaming platform " +
      "metrics and a consolidated 360° view.",
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
      "Complete music catalog: works (compositions, ISWC), sound recordings " +
      "(recordings, ISRC), composition and master shares, " +
      "editorial metadata and territory control.",
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
      "Music releases (single, EP, album, compilation, live): " +
      "metadata, distributors, platforms, delivery dates and " +
      "management of shares/participations per release.",
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
      "Contract management: editable templates, digital signature " +
      "(Autentique), expiration alerts, version history and " +
      "status tracking (draft → signed → terminated).",
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
      "Operational accounting: transactions (revenue/expense), P&L per " +
      "artist and project, cash flow, OFX bank reconciliation, " +
      "recoupment tracking and invoice issuance. " +
      "SCOPE: revenue − expense = net profit. " +
      "Does NOT include: external rights receipts, splits, payment distribution.",
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
      "CRM of clients and contacts: companies, individuals, " +
      "interaction history, segmentation and linking to artists.",
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
      "Campaign and content management: editorial calendar, briefings, " +
      "marketing tasks, Creative AI for copy and " +
      "integration with Meta Ads (stub), Google Ads (stub), " +
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
      "Management of live and studio events: shows, festivals, " +
      "recordings, music videos, rehearsals. Control of status, " +
      "dates, venues and linking to artists and projects.",
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
      "Inventory of equipment and assets: state (available, in use, " +
      "maintenance, lent, discarded), location and " +
      "usage history.",
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
      "Staff management: CLT, PJ, self-employed, interns. " +
      "Positions, departments, employment contracts, " +
      "vacations and absences.",
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
      "Catalog usage monitoring and rights protection: " +
      "takedowns (digital platforms), ECAD reconciliation " +
      "(ECADViewModal), infringement tracking and tracing of unauthorized " +
      "use.",
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
      "Work licensing: synchronization, mechanical, performance, " +
      "print, digital, streaming. Territory control, " +
      "terms and fees per usage type.",
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
      "Management of music projects: albums, EPs, singles, music videos, " +
      "shows, tours and campaigns. P&L per project, " +
      "recoupment tracking and linking to transactions.",
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
      "Sales leads: prospecting, follow-up, proposal and contract." +
      "negotiation → closed / lost. Temperature, priority, " +
      "estimated value and activity history.",
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
      "Audit log of every system action: who did what, " +
      "when and on which entity. Access restricted to owner/admin. " +
      "FUTURE: integration with a persistent backend.",
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
      "Tenant settings: company profile, users, " +
      "RBAC roles and permissions, integrations (ABRAMUS working; " +
      "the rest stubbed) and operational tenant customization.",
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
      "Multichannel support center: real Inbox at /chat (conversation list, " +
      "message timeline, composer, realtime, RBAC, tested tenant isolation) " +
      "on top of the real conversations/messages/notes backend. WhatsApp is the only channel " +
      "with a real webhook + outbound sending (2026-08-22 — fixed: agent replies " +
      "and automatic triage messages used to be stored in the database only, never " +
      "actually reaching WhatsApp). The tenant's Instagram/Facebook/TikTok/website still " +
      "have no real messaging channel (metrics only for the first two) — " +
      "recorded as technical debt, not simulated in the UI.",
  },
};

// ─── Registry access helpers ──────────────────────────────────────────────────

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

// ─── Shared layer rules ──────────────────────────────────────────────────────

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
    "cross-domain types (2+ modules)",
    "primitive UI components (shadcn/Radix)",
    "genuinely cross-domain components",
    "app infrastructure (ErrorBoundary, AdminRoute)",
    "providers (Auth, Tenant)",
    "config (queryClient)",
    "hooks cross-domain",
    "pure utilities",
    "integration contracts",
    "governance",
  ],
  forbidden: [
    "logic specific to a single module",
    "components of a single module only",
    "domain-specific services",
    "entity mappers (they belong to the module)",
  ],
} as const;

