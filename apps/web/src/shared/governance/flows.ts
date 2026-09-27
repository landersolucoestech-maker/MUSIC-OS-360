/**
 * shared/governance/flows.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * MUSIC OS 360 — Canonical Operational Flows
 *
 * Documents the end-to-end business flows that cross multiple modules.
 * Each flow describes: actors, steps, entities created/modified,
 * modules involved, future integrations and extension points.
 *
 * RULE: any new flow crossing 2+ modules must be
 *        documented here before it is implemented.
 *
 * Documented flows:
 *   F01 — New Artist Onboarding
 *   F02 — Music Release
 *   F03 — Contract Lifecycle
 *   F04 — Financial Cycle (Transaction → P&L)
 *   F05 — Commercial Flow Lead → Client → Contract
 *   F06 — Release Marketing Campaign
 *   F07 — Content Takedown
 *   F08 — ECAD Reconciliation
 *   F09 — Work Licensing
 *   F10 — New Tenant Onboarding
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Flow types ───────────────────────────────────────────────────────────────

export interface FlowStep {
  step:            number;
  actor:           string;
  action:          string;
  module:          string;
  entitiesAffected: string[];
  integrations:    string[];
  uiElement?:      string;
  notes?:          string;
}

export interface OperationalFlow {
  id:           string;
  name:         string;
  description:  string;
  actors:       string[];
  modules:      string[];
  steps:        FlowStep[];
  successCriteria: string[];
  futureIntegrations: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// F01 — NEW ARTIST ONBOARDING
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOW_ARTISTA_ONBOARDING: OperationalFlow = {
  id:          "F01",
  name:        "New artist onboarding",
  description:
    "Complete flow from prospecting an artist to the " +
    "active state in the system, with a complete profile, a signed contract and " +
    "first catalog records.",
  actors:      ["A&R manager", "Artist", "System"],
  modules:     ["crm", "artists", "contracts", "catalog"],
  steps: [
    {
      step:             1,
      actor:            "A&R manager",
      action:           "Create a Lead for the prospect artist",
      module:           "crm",
      entitiesAffected: ["Lead"],
      integrations:     [],
      uiElement:        "LeadFormModal / Sales CRM",
      notes:            "Lead linked to the target artist; temperature 'quente'.",
    },
    {
      step:             2,
      actor:            "A&R manager",
      action:           "Move the Lead through the pipeline up to 'fechado'",
      module:           "crm",
      entitiesAffected: ["Lead"],
      integrations:     [],
      uiElement:        "Leads table",
    },
    {
      step:             3,
      actor:            "A&R manager",
      action:           "Create the Artist profile with basic data",
      module:           "artists",
      entitiesAffected: ["Artista"],
      integrations:     [],
      uiElement:        "ArtistFormModal",
      notes:            "Initial status: 'prospecto'.",
    },
    {
      step:             4,
      actor:            "A&R manager",
      action:           "Create a Contract from a template",
      module:           "contracts",
      entitiesAffected: ["Contrato", "TemplateContrato"],
      integrations:     [],
      uiElement:        "ContractFormModal",
      notes:            "Initial status: 'rascunho'.",
    },
    {
      step:             5,
      actor:            "System",
      action:           "Send the Contract for digital signature",
      module:           "contracts",
      entitiesAffected: ["Contrato"],
      integrations:     ["autentique"],
      uiElement:        "ContratoDetailPage — 'Enviar para Assinatura' button",
      notes:            "FUTURE: Autentique API. Today: status mock.",
    },
    {
      step:             6,
      actor:            "Artist",
      action:           "Sign the contract digitally",
      module:           "contracts",
      entitiesAffected: ["Contrato"],
      integrations:     ["autentique"],
      notes:            "The Autentique webhook updates the status → 'vigente'.",
    },
    {
      step:             7,
      actor:            "A&R manager",
      action:           "Complete the Artist profile (tax data, platforms, relationships)",
      module:           "artists",
      entitiesAffected: ["Artista"],
      integrations:     [],
      uiElement:        "Artista360View — edit tabs",
      notes:            "Status → 'contratado'; after complete onboarding → 'ativo'.",
    },
    {
      step:             8,
      actor:            "Catalog manager",
      action:           "Register the artist's first Works and Sound recordings",
      module:           "catalog",
      entitiesAffected: ["Obra", "Fonograma", "Share"],
      integrations:     [],
      uiElement:        "RegistroMusicas / ObraFormModal",
    },
  ],
  successCriteria: [
    "Artist with status 'ativo'",
    "Contract with status 'vigente'",
    "At least one Work registered in the catalog",
    "Tax data (CPF/CNPJ) filled in",
  ],
  futureIntegrations: [
    "Supabase Auth — create a user account for the artist",
    "Autentique — real digital signature",
    "Resend — e-mail notifications at each stage",
    "Spotify for Artists — import initial metrics",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// F02 — MUSIC RELEASE
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOW_LANCAMENTO_MUSICAL: OperationalFlow = {
  id:          "F02",
  name:        "Music release",
  description:
    "End-to-end flow of a music release from creation to " +
    "publication on the platforms and the start of monitoring.",
  actors:      ["A&R manager", "Catalog manager", "Distributor", "System"],
  modules:     ["catalog", "releases", "marketing", "monitoring"],
  steps: [
    {
      step:             1,
      actor:            "Catalog manager",
      action:           "Ensure every work and sound recording of the release is registered",
      module:           "catalog",
      entitiesAffected: ["Obra", "Fonograma"],
      integrations:     [],
      notes:            "Sound recordings must have an ISRC assigned before delivery.",
    },
    {
      step:             2,
      actor:            "A&R manager",
      action:           "Create the Release and associate sound recordings",
      module:           "releases",
      entitiesAffected: ["Lancamento"],
      integrations:     [],
      uiElement:        "LancamentoFormModal",
      notes:            "Initial status: 'analise'.",
    },
    {
      step:             3,
      actor:            "A&R manager",
      action:           "Define the release shares (composition and master)",
      module:           "releases",
      entitiesAffected: ["Share"],
      integrations:     [],
      uiElement:        "GestaoSharesPage",
    },
    {
      step:             4,
      actor:            "A&R manager",
      action:           "Approve the release internally",
      module:           "releases",
      entitiesAffected: ["Lancamento"],
      integrations:     [],
      notes:            "Status → 'aprovado'.",
    },
    {
      step:             5,
      actor:            "A&R manager",
      action:           "Deliver to the distributor",
      module:           "releases",
      entitiesAffected: ["Lancamento"],
      integrations:     [],
      notes:            "Status → 'entregue'. FUTURE: distributor API.",
    },
    {
      step:             6,
      actor:            "Marketing manager",
      action:           "Create a marketing campaign for the release",
      module:           "marketing",
      entitiesAffected: ["Campanha", "Conteudo"],
      integrations:     ["meta-ads", "tiktok", "google-ads"],
      uiElement:        "CampanhaFormModal / CalendarioConteudo",
    },
    {
      step:             7,
      actor:            "Distributor",
      action:           "Confirm publication on the platforms",
      module:           "releases",
      entitiesAffected: ["Lancamento"],
      integrations:     [],
      notes:            "Status → 'publicado'.",
    },
    {
      step:             8,
      actor:            "System",
      action:           "Start monitoring for unauthorized use",
      module:           "monitoring",
      entitiesAffected: ["Takedown"],
      integrations:     ["ecad", "youtube", "spotify"],
      notes:            "FUTURE: automatic alerts via Content ID and ECAD.",
    },
  ],
  successCriteria: [
    "Release with status 'publicado'",
    "Every sound recording with an ISRC",
    "Shares defined (sum = 100% per type)",
    "Marketing campaign active",
  ],
  futureIntegrations: [
    "Spotify for Artists — confirm availability",
    "YouTube Content ID — enable automatic protection",
    "ECAD — register sound recordings for collection",
    "Distributors (Abramus, SoundOn, DistroKid) — direct delivery",
    "Resend — publication notifications",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// F03 — CONTRACT LIFECYCLE
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOW_CONTRATO: OperationalFlow = {
  id:          "F03",
  name:        "Contract lifecycle",
  description:
    "From creation to termination of a contract, including " +
    "expiration, renewal and digital signature alerts.",
  actors:      ["Legal manager", "Counterparty", "System"],
  modules:     ["contracts", "artists", "crm"],
  steps: [
    { step: 1, actor: "Legal manager", action: "Select a template and create a draft",
      module: "contracts", entitiesAffected: ["Contrato"], integrations: [],
      uiElement:        "ContractFormModal" },
    { step: 2, actor: "Legal manager", action: "Review and approve the draft internally",
      module: "contracts", entitiesAffected: ["Contrato"], integrations: [] },
    { step: 3, actor: "Legal manager", action: "Send for signature via Autentique",
      module: "contracts", entitiesAffected: ["Contrato"], integrations: ["autentique"],
      notes: "Status → 'aguardando_assinatura'." },
    { step: 4, actor: "Counterparty", action: "Sign digitally",
      module: "contracts", entitiesAffected: ["Contrato"], integrations: ["autentique"] },
    { step: 5, actor: "System", action: "The webhook confirms signatures → status 'vigente'",
      module: "contracts", entitiesAffected: ["Contrato"], integrations: ["autentique"] },
    { step: 6, actor: "System", action: "Alert 30 days before expiration",
      module: "contracts", entitiesAffected: ["Contrato"], integrations: ["resend"],
      notes: "Status → 'vencendo'. Automatic e-mail via Resend (future)." },
    { step: 7, actor: "Legal manager", action: "Renew or terminate the contract",
      module: "contracts", entitiesAffected: ["Contrato"], integrations: [],
      notes: "Renew → new date → 'vigente'. Terminate → 'encerrado'." },
  ],
  successCriteria: [
    "Contract signed by every party",
    "Expiration alerts configured",
    "Version history available",
  ],
  futureIntegrations: [
    "Autentique — legally valid digital signature (ICP-Brasil)",
    "Resend — expiration alerts 30/7/1 days before",
    "R2 — storage of signed contract PDFs",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// F04 — FINANCIAL CYCLE
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOW_FINANCEIRO: OperationalFlow = {
  id:          "F04",
  name:        "Financial cycle (Transaction → P&L)",
  description:
    "Transaction recording, P&L generation per artist/project, " +
    "bank reconciliation and invoice issuance.",
  actors:      ["Finance manager", "System"],
  modules:     ["accounting", "artists", "projects"],
  steps: [
    { step: 1, actor: "Finance manager", action: "Record a transaction (revenue or expense)",
      module: "accounting", entitiesAffected: ["Transacao"], integrations: [],
      uiElement: "TransacaoFormModal",
      notes: "Link to an artist and/or project for a segmented P&L." },
    { step: 2, actor: "System", action: "Update the cash flow",
      module: "accounting", entitiesAffected: ["Transacao"], integrations: [],
      uiElement: "FluxoCaixaPage" },
    { step: 3, actor: "System", action: "Recalculate the P&L per artist and per project",
      module: "accounting", entitiesAffected: ["Transacao"], integrations: [],
      uiElement: "ContabilidadePage (P&L + Recoupment)" },
    { step: 4, actor: "Finance manager", action: "Import the bank OFX for reconciliation",
      module: "accounting", entitiesAffected: ["Transacao"], integrations: [],
      uiElement: "ConciliacaoPage" },
    { step: 5, actor: "Finance manager", action: "Issue an invoice for service revenue",
      module: "accounting", entitiesAffected: ["NotaFiscal"], integrations: [],
      uiElement: "NotaFiscalFormModal" },
    { step: 6, actor: "Finance manager", action: "Generate financial reports",
      module: "accounting", entitiesAffected: [], integrations: [],
      uiElement: "RelatoriosPage",
      notes: "XLSX/PDF export (future integration with R2 for storage)." },
  ],
  successCriteria: [
    "Every transaction of the period recorded",
    "P&L per artist and project updated",
    "OFX reconciliation with no pending items",
  ],
  futureIntegrations: [
    "R2 — export of reports and invoices as PDF",
    "Resend — automatic periodic reports by e-mail",
    "Tax gateway — real NF-e / NFS-e issuance",
    "Open Banking — automatic OFX import",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// F05 — Sales flow: Lead → CLIENT → CONTRACT
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOW_LEAD_CONTRATO: OperationalFlow = {
  id:          "F05",
  name:        "Lead → Client → Contract flow",
  description:
    "Sales flow from identifying an opportunity " +
    "up to its contractual formalization.",
  actors:      ["Sales manager"],
  modules:     ["crm", "contracts"],
  steps: [
    { step: 1, actor: "Sales manager", action: "Create a Lead in the sales table",
      module: "crm", entitiesAffected: ["Lead"], integrations: [],
      uiElement: "LeadsTable" },
    { step: 2, actor: "Sales manager", action: "Move the Lead through the pipeline up to 'fechado'",
      module: "crm", entitiesAffected: ["Lead"], integrations: [],
      uiElement: "LeadsTable" },
    { step: 3, actor: "Sales manager", action: "Convert the Lead into a Client",
      module: "crm", entitiesAffected: ["Lead", "Cliente"], integrations: [],
      notes: "Lead data pre-populates the Client form." },
    { step: 4, actor: "Sales manager", action: "Create a Contract linked to the Client",
      module: "contracts", entitiesAffected: ["Contrato"], integrations: [],
      notes: "Continues in flow F03." },
  ],
  successCriteria: [
    "Lead with status 'fechado'",
    "Client created in the CRM",
    "Contract started",
  ],
  futureIntegrations: [
    "Resend — automatic follow-up of inactive leads",
    "PostHog — lead conversion funnel",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// F06 — RELEASE MARKETING CAMPAIGN
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOW_CAMPANHA_MARKETING: OperationalFlow = {
  id:          "F06",
  name:        "Release marketing campaign",
  description:
    "Planning, execution and monitoring of a digital campaign " +
    "to promote a music release.",
  actors:      ["Marketing manager", "System"],
  modules:     ["marketing", "releases"],
  steps: [
    { step: 1, actor: "Marketing manager", action: "Create a Campaign linked to the Release",
      module: "marketing", entitiesAffected: ["Campanha"], integrations: [],
      uiElement: "CampanhaFormModal" },
    { step: 2, actor: "Marketing manager", action: "Create a creative Briefing with AI",
      module: "marketing", entitiesAffected: ["Campanha"], integrations: ["openai"],
      uiElement: "IACreativaSection",
      notes: "AIGenerateButton generates copy for posts, ads and the release." },
    { step: 3, actor: "Marketing manager", action: "Plan content in the Editorial Calendar",
      module: "marketing", entitiesAffected: ["Conteudo"], integrations: [],
      uiElement: "CalendarioConteudo" },
    { step: 4, actor: "Marketing manager", action: "Activate paid campaigns (Meta, TikTok, Google)",
      module: "marketing", entitiesAffected: ["Campanha"], integrations: ["meta-ads", "tiktok", "google-ads"],
      notes: "FUTURE: direct integration with ad APIs." },
    { step: 5, actor: "System", action: "Monitor reach and engagement metrics",
      module: "marketing", entitiesAffected: [], integrations: ["meta-ads", "tiktok", "google-ads", "youtube"],
      uiElement: "AnalyticsPage" },
  ],
  successCriteria: [
    "Campaign active on the target platforms",
    "Editorial calendar filled in",
    "KPIs defined and being monitored",
  ],
  futureIntegrations: [
    "Meta Ads API — creation and management of Facebook/Instagram campaigns",
    "TikTok Ads API — TikTok campaigns",
    "Google Ads API — YouTube Ads e Display",
    "PostHog — campaign conversion tracking",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// F07 — CONTENT TAKEDOWN
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOW_TAKEDOWN: OperationalFlow = {
  id:          "F07",
  name:        "Takedown of unauthorized content",
  description:
    "Identification, submission and follow-up of removal requests " +
    "for unauthorized use of the catalog.",
  actors:      ["Monitoring manager", "Digital platform", "System"],
  modules:     ["monitoring", "catalog"],
  steps: [
    { step: 1, actor: "Monitoring manager", action: "Identify the infringement (URL of the unauthorized content)",
      module: "monitoring", entitiesAffected: [], integrations: [] },
    { step: 2, actor: "Monitoring manager", action: "Create a Takedown linked to a Work/Sound recording",
      module: "monitoring", entitiesAffected: ["Takedown"], integrations: [],
      uiElement: "TakedownFormModal",
      notes: "Initial status: 'pendente'." },
    { step: 3, actor: "Monitoring manager", action: "Submit the takedown to the platform",
      module: "monitoring", entitiesAffected: ["Takedown"], integrations: ["youtube", "spotify", "tiktok"],
      notes: "Status → 'enviado'. FUTURE: automatic DMCA API." },
    { step: 4, actor: "Digital platform", action: "Process the request",
      module: "monitoring", entitiesAffected: ["Takedown"], integrations: [],
      notes: "Status → 'processando'." },
    { step: 5, actor: "System", action: "Update the status according to the platform response",
      module: "monitoring", entitiesAffected: ["Takedown"], integrations: [],
      notes: "Completed → green. Rejected → red (appeal possible)." },
  ],
  successCriteria: [
    "Content removed (status 'concluido')",
    "Infringement URL inaccessible",
    "Takedown history recorded",
  ],
  futureIntegrations: [
    "YouTube Content ID — automatic detection and claims",
    "ECAD — notification of unauthorized use in public performance",
    "Resend — takedown result notifications",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// F08 — ECAD RECONCILIATION
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOW_CONCILIACAO_ECAD: OperationalFlow = {
  id:          "F08",
  name:        "ECAD reconciliation",
  description:
    "Import of the ECAD report, reconciliation with the local catalog " +
    "and posting of collection revenue in the Accounting module.",
  actors:      ["Rights manager", "System"],
  modules:     ["monitoring", "catalog", "accounting"],
  steps: [
    { step: 1, actor: "Rights manager", action: "Download the collection report from the ECAD portal",
      module: "monitoring", entitiesAffected: [], integrations: ["ecad"] },
    { step: 2, actor: "Rights manager", action: "Import the report into the platform",
      module: "monitoring", entitiesAffected: [], integrations: ["ecad"],
      uiElement: "ECADViewModal — file import",
      notes: "FUTURE: useEcadImportRelatorio() hook." },
    { step: 3, actor: "System", action: "Reconcile report items with catalog sound recordings (by ISRC / cod_ecad)",
      module: "monitoring", entitiesAffected: ["Takedown"], integrations: ["ecad"],
      notes: "rights.adapter.ts → fromRightsRecord()." },
    { step: 4, actor: "Rights manager", action: "Review discrepancies",
      module: "monitoring", entitiesAffected: [], integrations: [] },
    { step: 5, actor: "Rights manager", action: "Post ECAD revenue as a Transaction",
      module: "accounting", entitiesAffected: ["Transacao"], integrations: [],
      uiElement: "TransacaoFormModal (category: 'recebimentos externos de direitos')",
      notes: "'Recebimentos externos de direitos' is ONLY a transaction category, not a domain." },
  ],
  successCriteria: [
    "Every report item reconciled",
    "Discrepancies documented",
    "ECAD revenue posted in Accounting",
  ],
  futureIntegrations: [
    "ECAD API — automatic report import",
    "UBC API — reconciliation of copyright distribution",
    "Abramus API — collection reports via the affiliated society",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// F09 — WORK LICENSING
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOW_LICENCIAMENTO: OperationalFlow = {
  id:          "F09",
  name:        "Work licensing",
  description:
    "Licensing process of a work for a specific use " +
    "(synchronization, mechanical, streaming, etc.) by a client.",
  actors:      ["Licensing manager", "Client", "System"],
  modules:     ["licensing", "catalog", "contracts", "accounting"],
  steps: [
    { step: 1, actor: "Client", action: "Request a usage license",
      module: "crm", entitiesAffected: ["Lead"], integrations: [],
      notes: "Lead created with type 'licenciamento'." },
    { step: 2, actor: "Licensing manager", action: "Create a License linked to the Work",
      module: "licensing", entitiesAffected: ["Licenca"], integrations: [],
      uiElement: "LicencaFormModal" },
    { step: 3, actor: "Licensing manager", action: "Generate the License Contract",
      module: "contracts", entitiesAffected: ["Contrato"], integrations: [],
      notes: "Continues in flow F03." },
    { step: 4, actor: "System", action: "Contract signed → License active",
      module: "licensing", entitiesAffected: ["Licenca"], integrations: [],
      notes: "License status → 'ativo'." },
    { step: 5, actor: "Finance manager", action: "Record licensing revenue",
      module: "accounting", entitiesAffected: ["Transacao"], integrations: [],
      uiElement: "TransacaoFormModal" },
    { step: 6, actor: "System", action: "License expiration alert",
      module: "licensing", entitiesAffected: ["Licenca"], integrations: ["resend"],
      notes: "FUTURE: automatic renewal e-mail." },
  ],
  successCriteria: [
    "License with status 'ativo'",
    "License contract signed",
    "Revenue posted in Accounting",
  ],
  futureIntegrations: [
    "Autentique — license contract with digital signature",
    "Resend — license expiration alerts",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// F10 — NEW TENANT ONBOARDING
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOW_TENANT_ONBOARDING: OperationalFlow = {
  id:          "F10",
  name:        "New tenant onboarding",
  description:
    "Activation flow of a new tenant on the MUSIC OS 360 platform, " +
    "from registration to an operational system.",
  actors:      ["Tenant owner", "MUSIC OS 360 system"],
  modules:     ["settings", "artists", "catalog", "contracts"],
  steps: [
    { step: 1, actor: "Tenant owner", action: "Register the company and create the account",
      module: "settings", entitiesAffected: ["Tenant"], integrations: ["Supabase Auth", "stripe"],
      notes: "FUTURE: Supabase Auth creates the organization; Stripe starts the trial." },
    { step: 2, actor: "Tenant owner", action: "Complete the company profile",
      module: "settings", entitiesAffected: ["Tenant"], integrations: [],
      uiElement: "OnboardingStep: company_profile" },
    { step: 3, actor: "Tenant owner", action: "Invite team members",
      module: "settings", entitiesAffected: [], integrations: ["Supabase Auth", "resend"],
      uiElement: "OnboardingStep: invite_team",
      notes: "Resend sends the invitation e-mail." },
    { step: 4, actor: "Tenant owner", action: "Register the first artist",
      module: "artists", entitiesAffected: ["Artista"], integrations: [],
      uiElement: "OnboardingStep: first_artist" },
    { step: 5, actor: "Tenant owner", action: "Register the first catalog item",
      module: "catalog", entitiesAffected: ["Obra", "Fonograma"], integrations: [],
      uiElement: "OnboardingStep: first_catalog_item" },
    { step: 6, actor: "Tenant owner", action: "Create the first contract",
      module: "contracts", entitiesAffected: ["Contrato"], integrations: [],
      uiElement: "OnboardingStep: first_contract" },
    { step: 7, actor: "Tenant owner", action: "Connect the first integration",
      module: "settings", entitiesAffected: [], integrations: ["abramus"],
      uiElement: "OnboardingStep: connect_integration",
      notes: "Abramus is the only working integration in standalone mode." },
    { step: 8, actor: "System", action: "Onboarding complete — full access to the system",
      module: "settings", entitiesAffected: [], integrations: ["posthog"],
      notes: "PostHog records the 'onboarding_complete' event (future)." },
  ],
  successCriteria: [
    "All 7 onboarding steps completed",
    "At least one invited user",
    "First artist and first catalog item created",
    "Active billing plan (trial or paid)",
  ],
  futureIntegrations: [
    "Supabase Auth — authentication and multi-tenant organization management",
    "Stripe — free trial and conversion to a paid plan",
    "Resend — onboarding transactional e-mails",
    "PostHog — onboarding progression tracking",
  ],
};

// ─── Centralized flow registry ───────────────────────────────────────────────

export const ALL_OPERATIONAL_FLOWS: OperationalFlow[] = [
  FLOW_ARTISTA_ONBOARDING,
  FLOW_LANCAMENTO_MUSICAL,
  FLOW_CONTRATO,
  FLOW_FINANCEIRO,
  FLOW_LEAD_CONTRATO,
  FLOW_CAMPANHA_MARKETING,
  FLOW_TAKEDOWN,
  FLOW_CONCILIACAO_ECAD,
  FLOW_LICENCIAMENTO,
  FLOW_TENANT_ONBOARDING,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getFlow(id: string): OperationalFlow | undefined {
  return ALL_OPERATIONAL_FLOWS.find(f => f.id === id);
}

export function getFlowsByModule(module: string): OperationalFlow[] {
  return ALL_OPERATIONAL_FLOWS.filter(f => f.modules.includes(module));
}

export function getFlowsByIntegration(integrationId: string): OperationalFlow[] {
  return ALL_OPERATIONAL_FLOWS.filter(f =>
    f.steps.some(s => s.integrations.includes(integrationId))
  );
}

