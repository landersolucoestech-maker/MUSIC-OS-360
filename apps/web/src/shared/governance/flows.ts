/**
 * shared/governance/flows.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * MUSIC OS 360 — Fluxos Operacionais Canónicos
 *
 * Documenta os fluxos de negócio end-to-end que atravessam múltiplos módulos.
 * Cada fluxo descreve: actores, passos, entidades criadas/modificadas,
 * módulos envolvidos, integrações futuras e pontos de extensão.
 *
 * REGRA: qualquer novo fluxo que atravesse 2+ módulos deve ser
 *        documentado aqui antes de ser implementado.
 *
 * Fluxos documentados:
 *   F01 — Integração de Novo Artista
 *   F02 — Lançamento Musical
 *   F03 — Ciclo de Contrato
 *   F04 — Ciclo Financeiro (Transação → P&L)
 *   F05 — Fluxo Comercial de Lead → Cliente → Contrato
 *   F06 — Campanha de Marketing de Lançamento
 *   F07 — Takedown de Conteúdo
 *   F08 — Conciliação ECAD
 *   F09 — Licenciamento de Obra
 *   F10 — Onboarding de Novo Tenant
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Tipos dos fluxos ─────────────────────────────────────────────────────────

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
// F01 — INTEGRAÇÃO DE NOVO ARTISTA
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOW_ARTISTA_ONBOARDING: OperationalFlow = {
  id:          "F01",
  name:        "Integração de Novo Artista",
  description:
    "Fluxo completo desde a prospecção de um artista até ao estado " +
    "activo no sistema, com perfil completo, contrato assinado e " +
    "primeiros registos de catálogo.",
  actors:      ["Gestor de A&R", "Artista", "Sistema"],
  modules:     ["crm", "artists", "contracts", "catalog"],
  steps: [
    {
      step:             1,
      actor:            "Gestor de A&R",
      action:           "Criar Lead para o artista prospecto",
      module:           "crm",
      entitiesAffected: ["Lead"],
      integrations:     [],
      uiElement:        "LeadFormModal / CRM Comercial",
      notes:            "Lead vinculado ao artista alvo; temperatura 'quente'.",
    },
    {
      step:             2,
      actor:            "Gestor de A&R",
      action:           "Avançar Lead pelo pipeline até 'fechado'",
      module:           "crm",
      entitiesAffected: ["Lead"],
      integrations:     [],
      uiElement:        "Tabela de Leads",
    },
    {
      step:             3,
      actor:            "Gestor de A&R",
      action:           "Criar perfil de Artista com dados básicos",
      module:           "artists",
      entitiesAffected: ["Artista"],
      integrations:     [],
      uiElement:        "ArtistFormModal",
      notes:            "Status inicial: 'prospecto'.",
    },
    {
      step:             4,
      actor:            "Gestor de A&R",
      action:           "Criar Contrato a partir de template",
      module:           "contracts",
      entitiesAffected: ["Contrato", "TemplateContrato"],
      integrations:     [],
      uiElement:        "ContractFormModal",
      notes:            "Status inicial: 'rascunho'.",
    },
    {
      step:             5,
      actor:            "Sistema",
      action:           "Enviar Contrato para assinatura digital",
      module:           "contracts",
      entitiesAffected: ["Contrato"],
      integrations:     ["autentique"],
      uiElement:        "ContratoDetailPage — botão 'Enviar para Assinatura'",
      notes:            "FUTURO: Autentique API. Hoje: mock de status.",
    },
    {
      step:             6,
      actor:            "Artista",
      action:           "Assinar contrato digitalmente",
      module:           "contracts",
      entitiesAffected: ["Contrato"],
      integrations:     ["autentique"],
      notes:            "Webhook Autentique actualiza status → 'vigente'.",
    },
    {
      step:             7,
      actor:            "Gestor de A&R",
      action:           "Completar perfil do Artista (dados fiscais, plataformas, relacionamentos)",
      module:           "artists",
      entitiesAffected: ["Artista"],
      integrations:     [],
      uiElement:        "Artista360View — separadores de edição",
      notes:            "Status → 'contratado'; após onboarding completo → 'ativo'.",
    },
    {
      step:             8,
      actor:            "Gestor de Catálogo",
      action:           "Registar primeiras Obras e Fonogramas do artista",
      module:           "catalog",
      entitiesAffected: ["Obra", "Fonograma", "Share"],
      integrations:     [],
      uiElement:        "RegistroMusicas / ObraFormModal",
    },
  ],
  successCriteria: [
    "Artista com status 'ativo'",
    "Contrato com status 'vigente'",
    "Pelo menos uma Obra registada no catálogo",
    "Dados fiscais (CPF/CNPJ) preenchidos",
  ],
  futureIntegrations: [
    "Supabase Auth — criar conta de utilizador para o artista",
    "Autentique — assinatura digital real",
    "Resend — notificações por email em cada etapa",
    "Spotify for Artists — importar métricas iniciais",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// F02 — LANÇAMENTO MUSICAL
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOW_LANCAMENTO_MUSICAL: OperationalFlow = {
  id:          "F02",
  name:        "Lançamento Musical",
  description:
    "Fluxo end-to-end de um lançamento musical desde a criação até " +
    "à publicação nas plataformas e início de monitoramento.",
  actors:      ["Gestor de A&R", "Gestor de Catálogo", "Distribuidora", "Sistema"],
  modules:     ["catalog", "releases", "marketing", "monitoring"],
  steps: [
    {
      step:             1,
      actor:            "Gestor de Catálogo",
      action:           "Garantir que todas as obras e fonogramas do lançamento estão registados",
      module:           "catalog",
      entitiesAffected: ["Obra", "Fonograma"],
      integrations:     [],
      notes:            "Fonogramas devem ter ISRC atribuído antes da entrega.",
    },
    {
      step:             2,
      actor:            "Gestor de A&R",
      action:           "Criar Lançamento e associar fonogramas",
      module:           "releases",
      entitiesAffected: ["Lancamento"],
      integrations:     [],
      uiElement:        "LancamentoFormModal",
      notes:            "Status inicial: 'analise'.",
    },
    {
      step:             3,
      actor:            "Gestor de A&R",
      action:           "Definir shares do lançamento (composição e master)",
      module:           "releases",
      entitiesAffected: ["Share"],
      integrations:     [],
      uiElement:        "GestaoSharesPage",
    },
    {
      step:             4,
      actor:            "Gestor de A&R",
      action:           "Aprovar lançamento internamente",
      module:           "releases",
      entitiesAffected: ["Lancamento"],
      integrations:     [],
      notes:            "Status → 'aprovado'.",
    },
    {
      step:             5,
      actor:            "Gestor de A&R",
      action:           "Entregar à distribuidora",
      module:           "releases",
      entitiesAffected: ["Lancamento"],
      integrations:     [],
      notes:            "Status → 'entregue'. FUTURO: API de distribuidora.",
    },
    {
      step:             6,
      actor:            "Gestor de Marketing",
      action:           "Criar campanha de marketing para o lançamento",
      module:           "marketing",
      entitiesAffected: ["Campanha", "Conteudo"],
      integrations:     ["meta-ads", "tiktok", "google-ads"],
      uiElement:        "CampanhaFormModal / CalendarioConteudo",
    },
    {
      step:             7,
      actor:            "Distribuidora",
      action:           "Confirmar publicação nas plataformas",
      module:           "releases",
      entitiesAffected: ["Lancamento"],
      integrations:     [],
      notes:            "Status → 'publicado'.",
    },
    {
      step:             8,
      actor:            "Sistema",
      action:           "Iniciar monitoramento de uso não autorizado",
      module:           "monitoring",
      entitiesAffected: ["Takedown"],
      integrations:     ["ecad", "youtube", "spotify"],
      notes:            "FUTURO: alertas automáticos via Content ID e ECAD.",
    },
  ],
  successCriteria: [
    "Lançamento com status 'publicado'",
    "Todos os fonogramas com ISRC",
    "Shares definidos (soma = 100% por type)",
    "Campanha de marketing activa",
  ],
  futureIntegrations: [
    "Spotify for Artists — confirmar disponibilidade",
    "YouTube Content ID — activar protecção automática",
    "ECAD — registar fonogramas para arrecadação",
    "Distribuidoras (Abramus, SoundOn, DistroKid) — entrega directa",
    "Resend — notificações de publicação",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// F03 — CICLO DE CONTRATO
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOW_CONTRATO: OperationalFlow = {
  id:          "F03",
  name:        "Ciclo de Vida de Contrato",
  description:
    "Da criação ao encerramento de um contrato, incluindo alertas " +
    "de vencimento, renovação e assinatura digital.",
  actors:      ["Gestor Jurídico", "Contraparte", "Sistema"],
  modules:     ["contracts", "artists", "crm"],
  steps: [
    { step: 1, actor: "Gestor Jurídico", action: "Seleccionar template e criar rascunho",
      module: "contracts", entitiesAffected: ["Contrato"], integrations: [],
      uiElement:        "ContractFormModal" },
    { step: 2, actor: "Gestor Jurídico", action: "Rever e aprovar rascunho internamente",
      module: "contracts", entitiesAffected: ["Contrato"], integrations: [] },
    { step: 3, actor: "Gestor Jurídico", action: "Enviar para assinatura via Autentique",
      module: "contracts", entitiesAffected: ["Contrato"], integrations: ["autentique"],
      notes: "Status → 'aguardando_assinatura'." },
    { step: 4, actor: "Contraparte", action: "Assinar digitalmente",
      module: "contracts", entitiesAffected: ["Contrato"], integrations: ["autentique"] },
    { step: 5, actor: "Sistema", action: "Webhook confirma assinaturas → status 'vigente'",
      module: "contracts", entitiesAffected: ["Contrato"], integrations: ["autentique"] },
    { step: 6, actor: "Sistema", action: "Alerta 30 dias antes do vencimento",
      module: "contracts", entitiesAffected: ["Contrato"], integrations: ["resend"],
      notes: "Status → 'vencendo'. Email automático via Resend (futuro)." },
    { step: 7, actor: "Gestor Jurídico", action: "Renovar ou encerrar contrato",
      module: "contracts", entitiesAffected: ["Contrato"], integrations: [],
      notes: "Renovar → nova data → 'vigente'. Encerrar → 'encerrado'." },
  ],
  successCriteria: [
    "Contrato assinado por todas as partes",
    "Alertas de vencimento configurados",
    "Histórico de versões disponível",
  ],
  futureIntegrations: [
    "Autentique — assinatura digital com validade jurídica (ICP-Brasil)",
    "Resend — alertas de vencimento 30/7/1 dias antes",
    "R2 — armazenamento dos PDFs de contratos assinados",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// F04 — CICLO FINANCEIRO
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOW_FINANCEIRO: OperationalFlow = {
  id:          "F04",
  name:        "Ciclo Financeiro (Transação → P&L)",
  description:
    "Registo de transações, geração de P&L por artista/projecto, " +
    "conciliação bancária e emissão de nota fiscal.",
  actors:      ["Gestor Financeiro", "Sistema"],
  modules:     ["accounting", "artists", "projects"],
  steps: [
    { step: 1, actor: "Gestor Financeiro", action: "Registar transação (receita ou despesa)",
      module: "accounting", entitiesAffected: ["Transacao"], integrations: [],
      uiElement: "TransacaoFormModal",
      notes: "Vincular a artista e/ou projecto para P&L segmentado." },
    { step: 2, actor: "Sistema", action: "Actualizar fluxo de caixa",
      module: "accounting", entitiesAffected: ["Transacao"], integrations: [],
      uiElement: "FluxoCaixaPage" },
    { step: 3, actor: "Sistema", action: "Recalcular P&L por artista e por projecto",
      module: "accounting", entitiesAffected: ["Transacao"], integrations: [],
      uiElement: "ContabilidadePage (P&L + Recoupment)" },
    { step: 4, actor: "Gestor Financeiro", action: "Importar OFX do banco para conciliação",
      module: "accounting", entitiesAffected: ["Transacao"], integrations: [],
      uiElement: "ConciliacaoPage" },
    { step: 5, actor: "Gestor Financeiro", action: "Emitir Nota Fiscal para receitas de serviço",
      module: "accounting", entitiesAffected: ["NotaFiscal"], integrations: [],
      uiElement: "NotaFiscalFormModal" },
    { step: 6, actor: "Gestor Financeiro", action: "Gerar relatórios financeiros",
      module: "accounting", entitiesAffected: [], integrations: [],
      uiElement: "RelatoriosPage",
      notes: "Exportação XLSX/PDF (futura integração com R2 para armazenamento)." },
  ],
  successCriteria: [
    "Todas as transações do período registadas",
    "P&L por artista e projecto actualizado",
    "Conciliação OFX sem itens pendentes",
  ],
  futureIntegrations: [
    "R2 — exportação de relatórios e notas fiscais em PDF",
    "Resend — relatórios periódicos automáticos por email",
    "Gateway fiscal — emissão real de NF-e / NFS-e",
    "Open Banking — importação automática de OFX",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// F05 — Fluxo Comercial de Lead → CLIENTE → CONTRATO
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOW_LEAD_CONTRATO: OperationalFlow = {
  id:          "F05",
  name:        "Fluxo Lead → Cliente → Contrato",
  description:
    "Fluxo comercial desde a identificação de uma oportunidade " +
    "até à formalização contratual.",
  actors:      ["Gestor Comercial"],
  modules:     ["crm", "contracts"],
  steps: [
    { step: 1, actor: "Gestor Comercial", action: "Criar Lead na tabela comercial",
      module: "crm", entitiesAffected: ["Lead"], integrations: [],
      uiElement: "LeadsTable" },
    { step: 2, actor: "Gestor Comercial", action: "Mover Lead por pipeline até 'fechado'",
      module: "crm", entitiesAffected: ["Lead"], integrations: [],
      uiElement: "LeadsTable" },
    { step: 3, actor: "Gestor Comercial", action: "Converter Lead em Cliente",
      module: "crm", entitiesAffected: ["Lead", "Cliente"], integrations: [],
      notes: "Dados do Lead pré-populam o formulário de Cliente." },
    { step: 4, actor: "Gestor Comercial", action: "Criar Contrato vinculado ao Cliente",
      module: "contracts", entitiesAffected: ["Contrato"], integrations: [],
      notes: "Continua no Fluxo F03." },
  ],
  successCriteria: [
    "Lead com status 'fechado'",
    "Cliente criado no CRM",
    "Contrato iniciado",
  ],
  futureIntegrations: [
    "Resend — follow-up automático de leads inativos",
    "PostHog — funil de conversão de leads",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// F06 — CAMPANHA DE MARKETING DE LANÇAMENTO
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOW_CAMPANHA_MARKETING: OperationalFlow = {
  id:          "F06",
  name:        "Campanha de Marketing de Lançamento",
  description:
    "Planeamento, execução e monitoramento de uma campanha digital " +
    "para promover um lançamento musical.",
  actors:      ["Gestor de Marketing", "Sistema"],
  modules:     ["marketing", "releases"],
  steps: [
    { step: 1, actor: "Gestor de Marketing", action: "Criar Campanha vinculada ao Lançamento",
      module: "marketing", entitiesAffected: ["Campanha"], integrations: [],
      uiElement: "CampanhaFormModal" },
    { step: 2, actor: "Gestor de Marketing", action: "Criar Briefing criativo com IA",
      module: "marketing", entitiesAffected: ["Campanha"], integrations: ["openai"],
      uiElement: "IACreativaSection",
      notes: "AIGenerateButton gera copy para posts, ads e release." },
    { step: 3, actor: "Gestor de Marketing", action: "Planear conteúdo no Calendário Editorial",
      module: "marketing", entitiesAffected: ["Conteudo"], integrations: [],
      uiElement: "CalendarioConteudo" },
    { step: 4, actor: "Gestor de Marketing", action: "Activar campanhas pagas (Meta, TikTok, Google)",
      module: "marketing", entitiesAffected: ["Campanha"], integrations: ["meta-ads", "tiktok", "google-ads"],
      notes: "FUTURO: integração directa com APIs de anúncios." },
    { step: 5, actor: "Sistema", action: "Monitorar métricas de alcance e engagement",
      module: "marketing", entitiesAffected: [], integrations: ["meta-ads", "tiktok", "google-ads", "youtube"],
      uiElement: "AnalyticsPage" },
  ],
  successCriteria: [
    "Campanha activa nas plataformas alvo",
    "Calendário editorial preenchido",
    "KPIs definidos e sendo monitorados",
  ],
  futureIntegrations: [
    "Meta Ads API — criação e gestão de campanhas Facebook/Instagram",
    "TikTok Ads API — campanhas TikTok",
    "Google Ads API — YouTube Ads e Display",
    "PostHog — tracking de conversão de campanha",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// F07 — TAKEDOWN DE CONTEÚDO
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOW_TAKEDOWN: OperationalFlow = {
  id:          "F07",
  name:        "Takedown de Conteúdo Não Autorizado",
  description:
    "Identificação, submissão e acompanhamento de pedidos de remoção " +
    "de uso não autorizado do catálogo.",
  actors:      ["Gestor de Monitoramento", "Plataforma Digital", "Sistema"],
  modules:     ["monitoring", "catalog"],
  steps: [
    { step: 1, actor: "Gestor de Monitoramento", action: "Identificar infracção (URL do conteúdo não autorizado)",
      module: "monitoring", entitiesAffected: [], integrations: [] },
    { step: 2, actor: "Gestor de Monitoramento", action: "Criar Takedown vinculado a Obra/Fonograma",
      module: "monitoring", entitiesAffected: ["Takedown"], integrations: [],
      uiElement: "TakedownFormModal",
      notes: "Status inicial: 'pendente'." },
    { step: 3, actor: "Gestor de Monitoramento", action: "Submeter takedown à plataforma",
      module: "monitoring", entitiesAffected: ["Takedown"], integrations: ["youtube", "spotify", "tiktok"],
      notes: "Status → 'enviado'. FUTURO: DMCA API automática." },
    { step: 4, actor: "Plataforma Digital", action: "Processar pedido",
      module: "monitoring", entitiesAffected: ["Takedown"], integrations: [],
      notes: "Status → 'processando'." },
    { step: 5, actor: "Sistema", action: "Actualizar status conforme resposta da plataforma",
      module: "monitoring", entitiesAffected: ["Takedown"], integrations: [],
      notes: "Concluído → verde. Rejeitado → vermelho (recurso possível)." },
  ],
  successCriteria: [
    "Conteúdo removido (status 'concluido')",
    "URL de infracção inacessível",
    "Histórico de takedown registado",
  ],
  futureIntegrations: [
    "YouTube Content ID — detecção e claims automáticos",
    "ECAD — notificação de uso não autorizado em execução pública",
    "Resend — notificações de resultado do takedown",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// F08 — CONCILIAÇÃO ECAD
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOW_CONCILIACAO_ECAD: OperationalFlow = {
  id:          "F08",
  name:        "Conciliação ECAD",
  description:
    "Importação de relatório ECAD, conciliação com catálogo local " +
    "e lançamento de receita de arrecadação no módulo Accounting.",
  actors:      ["Gestor de Direitos", "Sistema"],
  modules:     ["monitoring", "catalog", "accounting"],
  steps: [
    { step: 1, actor: "Gestor de Direitos", action: "Descarregar relatório de arrecadação do portal ECAD",
      module: "monitoring", entitiesAffected: [], integrations: ["ecad"] },
    { step: 2, actor: "Gestor de Direitos", action: "Importar relatório na plataforma",
      module: "monitoring", entitiesAffected: [], integrations: ["ecad"],
      uiElement: "ECADViewModal — importação de ficheiro",
      notes: "FUTURO: useEcadImportRelatorio() hook." },
    { step: 3, actor: "Sistema", action: "Conciliar itens do relatório com fonogramas do catálogo (por ISRC / cod_ecad)",
      module: "monitoring", entitiesAffected: ["Takedown"], integrations: ["ecad"],
      notes: "rights.adapter.ts → fromRightsRecord()." },
    { step: 4, actor: "Gestor de Direitos", action: "Rever divergências",
      module: "monitoring", entitiesAffected: [], integrations: [] },
    { step: 5, actor: "Gestor de Direitos", action: "Lançar receita ECAD como Transação",
      module: "accounting", entitiesAffected: ["Transacao"], integrations: [],
      uiElement: "TransacaoFormModal (categoria: 'recebimentos externos de direitos')",
      notes: "'Recebimentos externos de direitos' é APENAS uma categoria de transação, não um domínio." },
  ],
  successCriteria: [
    "Todos os itens do relatório conciliados",
    "Divergências documentadas",
    "Receita ECAD lançada no Accounting",
  ],
  futureIntegrations: [
    "ECAD API — importação automática de relatórios",
    "UBC API — conciliação de distribuição de direitos autorais",
    "Abramus API — relatórios de arrecadação via associação filiada",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// F09 — LICENCIAMENTO DE OBRA
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOW_LICENCIAMENTO: OperationalFlow = {
  id:          "F09",
  name:        "Licenciamento de Obra",
  description:
    "Processo de licenciamento de uma obra para uso específico " +
    "(sincronia, mecânica, streaming, etc.) por um cliente.",
  actors:      ["Gestor de Licenciamento", "Cliente", "Sistema"],
  modules:     ["licensing", "catalog", "contracts", "accounting"],
  steps: [
    { step: 1, actor: "Cliente", action: "Solicitar licença de uso",
      module: "crm", entitiesAffected: ["Lead"], integrations: [],
      notes: "Lead criado com tipo 'licenciamento'." },
    { step: 2, actor: "Gestor de Licenciamento", action: "Criar Licença vinculada à Obra",
      module: "licensing", entitiesAffected: ["Licenca"], integrations: [],
      uiElement: "LicencaFormModal" },
    { step: 3, actor: "Gestor de Licenciamento", action: "Gerar Contrato de Licença",
      module: "contracts", entitiesAffected: ["Contrato"], integrations: [],
      notes: "Continua em Fluxo F03." },
    { step: 4, actor: "Sistema", action: "Contrato assinado → Licença activa",
      module: "licensing", entitiesAffected: ["Licenca"], integrations: [],
      notes: "Status Licenca → 'ativo'." },
    { step: 5, actor: "Gestor Financeiro", action: "Registar receita de licenciamento",
      module: "accounting", entitiesAffected: ["Transacao"], integrations: [],
      uiElement: "TransacaoFormModal" },
    { step: 6, actor: "Sistema", action: "Alerta de vencimento da licença",
      module: "licensing", entitiesAffected: ["Licenca"], integrations: ["resend"],
      notes: "FUTURO: email automático de renovação." },
  ],
  successCriteria: [
    "Licença com status 'ativo'",
    "Contrato de licença assinado",
    "Receita lançada no Accounting",
  ],
  futureIntegrations: [
    "Autentique — contrato de licença com assinatura digital",
    "Resend — alertas de vencimento de licença",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// F10 — ONBOARDING DE NOVO TENANT
// ═══════════════════════════════════════════════════════════════════════════════

export const FLOW_TENANT_ONBOARDING: OperationalFlow = {
  id:          "F10",
  name:        "Onboarding de Novo Tenant",
  description:
    "Fluxo de activação de um novo tenant na plataforma MUSIC OS 360, " +
    "desde o registo até ao sistema operacional.",
  actors:      ["Owner do Tenant", "Sistema MUSIC OS 360"],
  modules:     ["settings", "artists", "catalog", "contracts"],
  steps: [
    { step: 1, actor: "Owner do Tenant", action: "Registar empresa e criar conta",
      module: "settings", entitiesAffected: ["Tenant"], integrations: ["Supabase Auth", "stripe"],
      notes: "FUTURO: Supabase Auth cria organização; Stripe inicia trial." },
    { step: 2, actor: "Owner do Tenant", action: "Completar perfil da empresa",
      module: "settings", entitiesAffected: ["Tenant"], integrations: [],
      uiElement: "OnboardingStep: company_profile" },
    { step: 3, actor: "Owner do Tenant", action: "Convidar membros da equipa",
      module: "settings", entitiesAffected: [], integrations: ["Supabase Auth", "resend"],
      uiElement: "OnboardingStep: invite_team",
      notes: "Resend envia email de convite." },
    { step: 4, actor: "Owner do Tenant", action: "Cadastrar primeiro artista",
      module: "artists", entitiesAffected: ["Artista"], integrations: [],
      uiElement: "OnboardingStep: first_artist" },
    { step: 5, actor: "Owner do Tenant", action: "Registar primeiro item de catálogo",
      module: "catalog", entitiesAffected: ["Obra", "Fonograma"], integrations: [],
      uiElement: "OnboardingStep: first_catalog_item" },
    { step: 6, actor: "Owner do Tenant", action: "Criar primeiro contrato",
      module: "contracts", entitiesAffected: ["Contrato"], integrations: [],
      uiElement: "OnboardingStep: first_contract" },
    { step: 7, actor: "Owner do Tenant", action: "Conectar primeira integração",
      module: "settings", entitiesAffected: [], integrations: ["abramus"],
      uiElement: "OnboardingStep: connect_integration",
      notes: "Abramus é a única integração funcional em standalone." },
    { step: 8, actor: "Sistema", action: "Onboarding completo — acesso pleno ao sistema",
      module: "settings", entitiesAffected: [], integrations: ["posthog"],
      notes: "PostHog regista evento 'onboarding_complete' (futuro)." },
  ],
  successCriteria: [
    "Todos os 7 passos de onboarding concluídos",
    "Pelo menos um utilizador convidado",
    "Primeiro artista e primeiro item de catálogo criados",
    "Plano de billing activo (trial ou pago)",
  ],
  futureIntegrations: [
    "Supabase Auth — autenticação e gestão de organização multi-tenant",
    "Stripe — trial gratuito e conversão para plano pago",
    "Resend — emails transaccionais de onboarding",
    "PostHog — tracking de progressão de onboarding",
  ],
};

// ─── Registo centralizado de fluxos ──────────────────────────────────────────

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

