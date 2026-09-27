/**
 * workflow-transitions.ts
 *
 * Frontend mirror of the backend workflow definitions.
 * Allows view modals to compute `allowed_transitions` from the entity's
 * current status without a round-trip to the backend — works in both
 * mock mode and HTTP mode.
 *
 * IMPORTANT: keep in sync with apps/api/src/core/workflow/definitions/
 */

export interface WorkflowTransition {
  to: string;
  label: string;
}

type RawDef = { from: string | string[]; to: string; label: string };

function matchesFrom(def: RawDef, currentStatus: string): boolean {
  const from = def.from;
  if (Array.isArray(from)) return from.includes(currentStatus);
  return from === currentStatus;
}

function buildAllowed(defs: RawDef[], currentStatus: string): WorkflowTransition[] {
  return defs
    .filter((d) => matchesFrom(d, currentStatus))
    .map((d) => ({ to: d.to, label: d.label }));
}

// ─── Releases ───────────────────────────────────────────────────────────────
// Conforme spec: draft → metadata_pending → assets_pending → review → approved →
//                scheduled → distributed → released → archived / cancelled

const RELEASES_DEFS: RawDef[] = [
  { from: 'draft',             to: 'metadata_pending', label: 'Preencher Metadados' },
  { from: 'metadata_pending',  to: 'assets_pending',   label: 'Enviar arquivos' },
  { from: 'assets_pending',    to: 'review',           label: 'Enviar para Revisão' },
  { from: 'review',            to: 'approved',         label: 'Aprovar' },
  { from: 'review',            to: 'assets_pending',   label: 'Solicitar revisão de arquivos' },
  { from: 'approved',          to: 'scheduled',        label: 'Agendar Distribuição' },
  { from: 'scheduled',         to: 'distributed',      label: 'Confirmar Distribuição' },
  { from: 'distributed',       to: 'released',         label: 'Publicado nas Plataformas' },
  { from: ['draft', 'metadata_pending', 'assets_pending', 'review', 'approved', 'scheduled'],
    to: 'cancelled', label: 'Cancelar' },
  { from: 'released',          to: 'archived',         label: 'Arquivar' },
];

// ─── Contracts ──────────────────────────────────────────────────────────────

const CONTRACTS_DEFS: RawDef[] = [
  { from: 'rascunho',               to: 'em_analise',           label: 'Enviar para Análise' },
  { from: 'em_analise',             to: 'rascunho',             label: 'Retornar para Rascunho' },
  { from: 'em_analise',             to: 'aguardando_assinatura',label: 'Aprovar para Assinatura' },
  { from: 'aguardando_assinatura',  to: 'assinado',             label: 'Registrar Assinatura' },
  { from: 'assinado',               to: 'vigente',              label: 'Ativar Contrato' },
  { from: 'vigente',                to: 'vencendo',             label: 'Marcar como Vencendo' },
  { from: ['vencendo', 'vigente'],  to: 'vencido',              label: 'Registrar Vencimento' },
  { from: ['vencido', 'vigente', 'assinado'], to: 'encerrado',  label: 'Encerrar Contrato' },
  { from: ['rascunho', 'em_analise', 'aguardando_assinatura'], to: 'cancelado', label: 'Cancelar' },
];

// ─── Leads ──────────────────────────────────────────────────────────────────

const LEADS_DEFS: RawDef[] = [
  { from: 'novo',                 to: 'contato',     label: 'Iniciar Contato' },
  { from: ['novo', 'contato'],    to: 'em_contato',  label: 'Em Contato' },
  { from: ['contato', 'em_contato'], to: 'qualificado', label: 'Qualificar Lead' },
  { from: 'qualificado',          to: 'proposta',    label: 'Enviar Proposta' },
  { from: 'proposta',             to: 'negociacao',  label: 'Em Negociação' },
  { from: ['proposta', 'negociacao'], to: 'fechado', label: 'Fechar Negócio' },
  { from: ['novo', 'contato', 'em_contato', 'qualificado', 'proposta', 'negociacao'],
    to: 'perdido', label: 'Marcar como Perdido' },
  { from: ['perdido', 'inativo'], to: 'novo',    label: 'Reativar Lead' },
  { from: ['fechado', 'perdido'], to: 'inativo', label: 'Arquivar' },
];

// ─── Campaigns ──────────────────────────────────────────────────────────────

const CAMPAIGNS_DEFS: RawDef[] = [
  { from: 'rascunho',             to: 'planejamento', label: 'Iniciar Planejamento' },
  { from: 'planejamento',         to: 'ativa',        label: 'Ativar Campanha' },
  { from: 'ativa',                to: 'pausada',      label: 'Pausar Campanha' },
  { from: 'pausada',              to: 'ativa',        label: 'Retomar Campanha' },
  { from: ['ativa', 'pausada'],   to: 'concluida',    label: 'Concluir Campanha' },
  { from: ['rascunho', 'planejamento', 'ativa', 'pausada'], to: 'cancelada', label: 'Cancelar Campanha' },
];

// ─── Projects ───────────────────────────────────────────────────────────────
// Conforme spec: planejamento → em_andamento → revisao → concluido / cancelado

const PROJECTS_DEFS: RawDef[] = [
  { from: 'planejamento',                      to: 'em_andamento', label: 'Iniciar Projeto' },
  { from: 'em_andamento',                      to: 'revisao',      label: 'Enviar para Revisão' },
  { from: 'revisao',                           to: 'em_andamento', label: 'Solicitar Alterações' },
  { from: 'revisao',                           to: 'concluido',    label: 'Concluir Projeto' },
  { from: ['planejamento', 'em_andamento', 'revisao'],
    to: 'cancelado', label: 'Cancelar Projeto' },
];

// ─── Tickets ────────────────────────────────────────────────────────────────

const TICKETS_DEFS: RawDef[] = [
  { from: 'open',          to: 'in_progress',   label: 'Iniciar Atendimento' },
  { from: 'in_progress',   to: 'pending_user',  label: 'Aguardar Resposta do Usuário' },
  { from: 'pending_user',  to: 'in_progress',   label: 'Retomar Atendimento' },
  { from: ['in_progress', 'pending_user'], to: 'resolved', label: 'Resolver Ticket' },
  { from: 'resolved',      to: 'closed',        label: 'Fechar Ticket' },
  { from: 'resolved',      to: 'in_progress',   label: 'Reabrir Ticket' },
  { from: ['open', 'in_progress', 'pending_user'], to: 'cancelled', label: 'Cancelar Ticket' },
];

// ─── Public API ─────────────────────────────────────────────────────────────

export type WorkflowEntityType =
  | 'release'
  | 'contract'
  | 'lead'
  | 'campaign'
  | 'project'
  | 'ticket';

const DEFS_MAP: Record<WorkflowEntityType, RawDef[]> = {
  release:  RELEASES_DEFS,
  contract: CONTRACTS_DEFS,
  lead:     LEADS_DEFS,
  campaign: CAMPAIGNS_DEFS,
  project:  PROJECTS_DEFS,
  ticket:   TICKETS_DEFS,
};

/**
 * Returns the workflow-allowed transitions for the given entity type and status.
 * Works in mock mode and HTTP mode — no backend call required.
 */
export function getWorkflowAllowedTransitions(
  entityType: WorkflowEntityType,
  currentStatus: string | null | undefined,
): WorkflowTransition[] {
  if (!currentStatus) return [];
  const defs = DEFS_MAP[entityType];
  if (!defs) return [];
  return buildAllowed(defs, currentStatus);
}

/**
 * Resolves the allowed transitions to render for a given entity.
 *
 * Priority rules:
 *  1. In HTTP mode the API detail endpoint returns `allowed_transitions` on the
 *     entity, filtered by the actor's role and any workflow guards.  This is the
 *     authoritative list — always prefer it.
 *  2. In mock mode the entity has no `allowed_transitions` field (mock data does
 *     not include it), so fall back to the local workflow definition mirror.
 *
 * Use this function in every view modal / drawer that renders a WorkflowTransitionPanel.
 * Never call `getWorkflowAllowedTransitions` directly in UI components.
 */
export function resolveAllowedTransitions(
  entityType: WorkflowEntityType,
  currentStatus: string | null | undefined,
  serverTransitions?: { to: string; label?: string }[] | null,
): WorkflowTransition[] {
  // When serverTransitions is an array (even empty) the backend is authoritative:
  //   • non-empty → those are the role-filtered allowed moves
  //   • empty     → backend intentionally denied all moves for this actor/status
  // Only fall back to local mirror when serverTransitions is undefined/null,
  // which only happens in mock mode where the entity has no allowed_transitions field.
  if (Array.isArray(serverTransitions)) {
    return serverTransitions.map(t => ({ to: t.to, label: t.label ?? t.to }));
  }
  return getWorkflowAllowedTransitions(entityType, currentStatus);
}

