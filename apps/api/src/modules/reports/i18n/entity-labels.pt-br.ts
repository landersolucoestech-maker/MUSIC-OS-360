/**
 * modules/reports/i18n/entity-labels.pt-br.ts
 *
 * The SINGLE layer of pt-BR labels per ENTITY (table) of the Reports Center —
 * complement of field-labels.pt-br.ts (which covers columns).
 *
 * Same absolute rule: the technical key is infrastructure, the label is product. The
 * frontend NEVER derives text from tableName; it displays the `label` returned by the
 * API. Every REPORTABLE table MUST have an entry here — its absence is flagged
 * as an `UNTRANSLATED_ENTITY` risk in the inventory (never masked).
 */

/** Canonical dictionary (tableName → pt-BR label) of the reportable entities. */
export const ENTITY_LABELS_PT_BR: Readonly<Record<string, string>> = {
  artists: 'Artistas',
  works: 'Obras',
  phonograms: 'Fonogramas',
  contracts: 'Contratos',
  contract_templates: 'Modelos de contrato',
  contract_service_types: 'Tipos de serviço de contrato',
  transactions: 'Transações financeiras',
  invoices: 'Faturas',
  clients: 'Clientes',
  leads: 'Leads',
  lead_interactions: 'Interações de leads',
  campaigns: 'Campanhas',
  briefings: 'Briefings',
  events: 'Eventos',
  projects: 'Projetos',
  releases: 'Lançamentos',
  shares: 'Participações',
  takedowns: 'Takedowns',
  support_tickets: 'Chamados de suporte',
  ecad_reports: 'Relatórios ECAD',
  licenses: 'Licenças',
  inventory_items: 'Itens de inventário',
  content_detections: 'Detecções de conteúdo',
  forms: 'Formulários',
  conversations: 'Conversas',
  operational_tasks: 'Tarefas operacionais',
  financial_categories: 'Categorias financeiras',
  financial_rules: 'Regras financeiras',
  employees: 'Colaboradores',
  payroll_entries: 'Folha de pagamento',
  leave_requests: 'Solicitações de ausência',
  artist_goals: 'Metas de artistas',
  assets: 'Ativos digitais',
  rights_holders: 'Titulares de direitos',
  marketing_projects: 'Projetos de marketing',
  marketing_strategies: 'Estratégias de marketing',
  marketing_assets: 'Ativos de marketing',
  marketing_content_posts: 'Publicações de conteúdo',
  marketing_tasks: 'Tarefas de marketing',
  audiovisual_projects: 'Projetos audiovisuais',
  audiovisual_briefings: 'Briefings audiovisuais',
  audiovisual_tasks: 'Tarefas audiovisuais',
  audiovisual_assets: 'Ativos audiovisuais',
  audiovisual_deliverables: 'Entregáveis audiovisuais',
  pipelines: 'Pipelines',
  pipeline_opportunities: 'Oportunidades de pipeline',
  society_submissions: 'Submissões a sociedades',
  society_accounts: 'Contas de sociedades',
};

/**
 * Resolves an entity's pt-BR label. `null` when not translated —
 * the caller decides whether to flag it (risk) or fall back to tableName, never invent.
 */
export function resolveEntityLabel(tableName: string): string | null {
  return Object.prototype.hasOwnProperty.call(ENTITY_LABELS_PT_BR, tableName) ? ENTITY_LABELS_PT_BR[tableName] : null;
}
