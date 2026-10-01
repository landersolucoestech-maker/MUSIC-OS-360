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
// Per spec: draft → metadata_pending → assets_pending → review → approved →
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
// Canonical ContractStatus values (packages/types) — mirrors contracts.workflow.ts.

const CONTRACTS_DEFS: RawDef[] = [
  { from: 'draft',                  to: 'under_review',         label: 'Enviar para Análise' },
  { from: 'under_review',           to: 'draft',                label: 'Retornar para Rascunho' },
  { from: 'under_review',           to: 'awaiting_signature',   label: 'Aprovar para Assinatura' },
  { from: 'awaiting_signature',     to: 'signed',               label: 'Registrar Assinatura' },
  { from: 'signed',                 to: 'in_force',             label: 'Ativar Contrato' },
  { from: 'in_force',               to: 'expiring',             label: 'Marcar como Vencendo' },
  { from: ['expiring', 'in_force'], to: 'expired',              label: 'Registrar Vencimento' },
  { from: ['expired', 'in_force', 'signed'], to: 'terminated', label: 'Encerrar Contrato' },
  { from: ['draft', 'under_review', 'awaiting_signature'], to: 'cancelled', label: 'Cancelar' },
];

// ─── Leads ──────────────────────────────────────────────────────────────────
// Canonical LeadStatus values (packages/types) — mirrors leads.workflow.ts.

const LEADS_DEFS: RawDef[] = [
  { from: 'new',                   to: 'contacted',   label: 'Iniciar Contato' },
  { from: ['new', 'contacted'],    to: 'in_contact',  label: 'Em Contato' },
  { from: ['contacted', 'in_contact'], to: 'qualified', label: 'Qualificar Lead' },
  { from: 'qualified',             to: 'proposal',    label: 'Enviar Proposta' },
  { from: 'proposal',              to: 'negotiation', label: 'Em Negociação' },
  { from: ['proposal', 'negotiation'], to: 'closed',  label: 'Fechar Negócio' },
  { from: ['new', 'contacted', 'in_contact', 'qualified', 'proposal', 'negotiation'],
    to: 'lost', label: 'Marcar como Perdido' },
  { from: ['lost', 'inactive'],    to: 'new',         label: 'Reativar Lead' },
  { from: ['closed', 'lost'],      to: 'inactive',    label: 'Arquivar' },
];

// ─── Campaigns ──────────────────────────────────────────────────────────────
// Canonical CampaignStatus values (packages/types) — mirrors campaigns.workflow.ts.

const CAMPAIGNS_DEFS: RawDef[] = [
  { from: 'draft',                to: 'planning',     label: 'Iniciar Planejamento' },
  { from: 'planning',             to: 'active',       label: 'Ativar Campanha' },
  { from: 'active',               to: 'paused',       label: 'Pausar Campanha' },
  { from: 'paused',               to: 'active',       label: 'Retomar Campanha' },
  { from: ['active', 'paused'],   to: 'completed',    label: 'Concluir Campanha' },
  { from: ['draft', 'planning', 'active', 'paused'], to: 'cancelled', label: 'Cancelar Campanha' },
];

// ─── Projects ───────────────────────────────────────────────────────────────
// Canonical ProjectStatus values: planning → in_progress → review → completed / cancelled

const PROJECTS_DEFS: RawDef[] = [
  { from: 'planning',                          to: 'in_progress',  label: 'Iniciar Projeto' },
  { from: 'in_progress',                       to: 'review',       label: 'Enviar para Revisão' },
  { from: 'review',                            to: 'in_progress',  label: 'Solicitar Alterações' },
  { from: 'review',                            to: 'completed',    label: 'Concluir Projeto' },
  { from: ['planning', 'in_progress', 'review'],
    to: 'cancelled', label: 'Cancelar Projeto' },
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

