/**
 * shared/governance/states.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * MUSIC OS 360 — Canonical State Machines
 *
 * Documents each entity's lifecycle: valid states,
 * allowed transitions, initial state, final states and
 * semantic color in the UI.
 *
 * SEMANTIC COLOR RULE (mandatory across the whole UI):
 *   Green    → active / published / completed / approved / issued
 *   Blue     → in progress / production / processing / scheduled / sent
 *   Yellow   → pending / draft / review / planning
 *   Gray     → inactive / archived / closed / settled
 *   Red      → EXCLUSIVELY for: cancelled / rejected / overdue /
 *              terminated / failed / negative values
 *
 * FORBIDDEN: using red for neutral or progress states.
 *
 * Types source: shared/types/enums.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── State machine types ──────────────────────────────────────────────────────

export type UiColor =
  | "green"    // active / positive / completed
  | "blue"     // in progress / scheduled
  | "yellow"   // pending / draft / review
  | "gray"     // inactive / archived / neutral
  | "red";     // cancelled / rejected / overdue / failed (ONLY these)

export interface StateDefinition {
  value: string;
  label: string;
  color: UiColor;
  isFinal: boolean;
  description: string;
}

export interface StateTransition {
  from: string;
  to: string;
  trigger: string;
  description: string;
}

export interface StateMachine {
  entity: string;
  initialState: string;
  states: StateDefinition[];
  transitions: StateTransition[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// ARTIST — Registration state
// ═══════════════════════════════════════════════════════════════════════════════

export const ARTIST_STATE_MACHINE: StateMachine = {
  entity:       "Artista",
  initialState: "prospect",
  states: [
    { value: "prospect",       label: "Prospecto",   color: "yellow", isFinal: false,
      description: "Artist under evaluation — has no active contract." },
    { value: "signed",         label: "Contratado",  color: "blue",   isFinal: false,
      description: "Contract signed, onboarding in progress." },
    { value: "active",         label: "Ativo",      color: "green",  isFinal: false,
      description: "Operational artist at the label/publisher." },
    { value: "inactive",       label: "Inactivo",    color: "gray",   isFinal: false,
      description: "No recent activity; contract suspended." },
    { value: "suspended",      label: "Suspenso",    color: "yellow", isFinal: false,
      description: "Relationship under review for non-compliance." },
    { value: "former_artist",  label: "Ex-Artista",  color: "gray",   isFinal: true,
      description: "Contract terminated; history kept." },
    { value: "terminated",     label: "Desligado",   color: "red",    isFinal: true,
      description: "Early contractual rupture or due to serious misconduct." },
  ],
  transitions: [
    { from: "prospect",  to: "signed",        trigger: "Sign contract",    description: "Contract accepted and digitally signed." },
    { from: "signed",    to: "active",        trigger: "Complete onboarding", description: "Complete profile, tax data verified." },
    { from: "active",    to: "inactive",      trigger: "Inactivar",           description: "No activity during a defined period." },
    { from: "inactive",  to: "active",        trigger: "Reactivar",           description: "The artist resumes activity." },
    { from: "active",    to: "suspended",     trigger: "Suspender",           description: "Breach of a contract clause." },
    { from: "suspended", to: "active",        trigger: "Lift suspension",  description: "Resolution of the suspension cause." },
    { from: "suspended", to: "terminated",    trigger: "Offboard",            description: "Unresolved breach — rupture." },
    { from: "active",    to: "former_artist", trigger: "Terminate contract",   description: "Contract expired naturally." },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRACT — Lifecycle
// ═══════════════════════════════════════════════════════════════════════════════

export const CONTRACT_STATE_MACHINE: StateMachine = {
  entity:       "Contrato",
  initialState: "rascunho",
  states: [
    { value: "rascunho",              label: "Rascunho",              color: "yellow", isFinal: false,
      description: "Being edited; not binding." },
    { value: "aguardando_assinatura", label: "Aguardando Assinatura", color: "blue",   isFinal: false,
      description: "Sent for digital signature (Autentique)." },
    { value: "vigente",               label: "Vigente",               color: "green",  isFinal: false,
      description: "Active and within the validity period." },
    { value: "ativo",                 label: "Ativo",                color: "green",  isFinal: false,
      description: "Synonym of vigente (compatibility)." },
    { value: "vencendo",              label: "A Vencer",              color: "yellow", isFinal: false,
      description: "Expires in the next 30 days — alert active." },
    { value: "vencido",               label: "Vencido",               color: "red",    isFinal: false,
      description: "Term expired without renewal." },
    { value: "encerrado",             label: "Encerrado",             color: "gray",   isFinal: true,
      description: "Terminated by mutual agreement or full performance." },
    { value: "cancelado",             label: "Cancelado",             color: "red",    isFinal: true,
      description: "Canceled before signature or due to rupture." },
  ],
  transitions: [
    { from: "rascunho",              to: "aguardando_assinatura", trigger: "Send for signature", description: "Sent via Autentique." },
    { from: "aguardando_assinatura", to: "vigente",               trigger: "Every party has signed", description: "Autentique confirms complete signatures." },
    { from: "aguardando_assinatura", to: "cancelado",             trigger: "Cancel",              description: "Canceled before complete signature." },
    { from: "vigente",               to: "vencendo",              trigger: "Automatic (30 days)",  description: "An automatic routine detects the upcoming expiration." },
    { from: "vencendo",              to: "vencido",               trigger: "Automatic (date)",     description: "Expiration date reached without renewal." },
    { from: "vencido",               to: "vigente",               trigger: "Renew",               description: "New expiration date defined." },
    { from: "vigente",               to: "encerrado",             trigger: "Terminate",              description: "Termination by mutual agreement." },
    { from: "vencido",               to: "encerrado",             trigger: "Archive",              description: "Archiving after expiration." },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSACTION — Payment state
// ═══════════════════════════════════════════════════════════════════════════════

export const TRANSACAO_STATE_MACHINE: StateMachine = {
  entity:       "Transacao",
  initialState: "pendente",
  states: [
    { value: "agendado",  label: "Agendado",  color: "blue",   isFinal: false,
      description: "Payment scheduled for a future date." },
    { value: "pendente",  label: "Pendente",  color: "yellow", isFinal: false,
      description: "Waiting for payment or confirmation." },
    { value: "concluido", label: "Concluído", color: "green",  isFinal: true,
      description: "Payment made and confirmed." },
    { value: "cancelado", label: "Cancelado", color: "red",    isFinal: true,
      description: "Transaction canceled — never carried out." },
  ],
  transitions: [
    { from: "agendado", to: "pendente",  trigger: "Due date",   description: "Due date reached; waiting for payment." },
    { from: "pendente", to: "concluido", trigger: "Confirm payment",  description: "The user confirms the payment received/made." },
    { from: "agendado", to: "cancelado", trigger: "Cancel",             description: "Schedule canceled before the date." },
    { from: "pendente", to: "cancelado", trigger: "Cancel",             description: "Payment not made — transaction canceled." },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// INVOICE — Issuing cycle
// ═══════════════════════════════════════════════════════════════════════════════

export const INVOICE_STATE_MACHINE: StateMachine = {
  entity:       "NotaFiscal",
  initialState: "rascunho",
  states: [
    { value: "rascunho",  label: "Rascunho",  color: "yellow", isFinal: false,
      description: "Being filled in; not sent to SEFAZ." },
    { value: "pendente",  label: "Pendente",  color: "blue",   isFinal: false,
      description: "Sent for issuance; waiting for the response." },
    { value: "emitida",   label: "Emitida",   color: "green",  isFinal: false,
      description: "Authorized by SEFAZ; access key available." },
    { value: "cancelada", label: "Cancelada", color: "red",    isFinal: true,
      description: "Canceled within the legal period." },
    { value: "rejeitada", label: "Rejeitada", color: "red",    isFinal: false,
      description: "Rejected by SEFAZ; requires correction and resubmission." },
  ],
  transitions: [
    { from: "rascunho", to: "pendente",  trigger: "Issue",    description: "Sent to SEFAZ / the tax gateway." },
    { from: "pendente", to: "emitida",   trigger: "Authorized", description: "SEFAZ authorizes; key generated." },
    { from: "pendente", to: "rejeitada", trigger: "Rejected",  description: "SEFAZ rejects; error message available." },
    { from: "rejeitada",to: "pendente",  trigger: "Correct and resubmit", description: "Fields corrected; new attempt." },
    { from: "emitida",  to: "cancelada", trigger: "Cancel",  description: "Within the legal cancellation period." },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// WORK — Registration state
// ═══════════════════════════════════════════════════════════════════════════════

export const WORK_STATE_MACHINE: StateMachine = {
  entity:       "Obra",
  initialState: "pendente",
  states: [
    { value: "pendente",    label: "Pendente",    color: "yellow", isFinal: false,
      description: "Waiting for complete data for registration." },
    { value: "analise",     label: "Em Análise",  color: "blue",   isFinal: false,
      description: "Under review by the team or the rights society." },
    { value: "registrado",  label: "Registrado",   color: "green",  isFinal: false,
      description: "Registered with the rights societies (ECAD/UBC)." },
    { value: "ativo",       label: "Ativo",      color: "green",  isFinal: false,
      description: "Active in the catalog and available for licensing." },
    { value: "inativo",     label: "Inactivo",    color: "gray",   isFinal: false,
      description: "Out of active commercialization; data kept." },
    { value: "arquivado",   label: "Arquivado",   color: "gray",   isFinal: true,
      description: "Historical; no active commercial use." },
  ],
  transitions: [
    { from: "pendente",   to: "analise",    trigger: "Submit for review",  description: "Enough data for evaluation." },
    { from: "analise",    to: "registrado", trigger: "Register",               description: "Registration confirmed with a rights society." },
    { from: "registrado", to: "ativo",      trigger: "Activar",                description: "Available for licensing and collection." },
    { from: "ativo",      to: "inativo",    trigger: "Inactivar",              description: "Withdraw from active commercialization." },
    { from: "inativo",    to: "ativo",      trigger: "Reactivar",              description: "Resume commercialization." },
    { from: "ativo",      to: "arquivado",  trigger: "Archive",               description: "End the work's lifecycle." },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// RELEASE — Editorial cycle
// ═══════════════════════════════════════════════════════════════════════════════

export const RELEASE_STATE_MACHINE: StateMachine = {
  entity:       "Lancamento",
  initialState: "analise",
  states: [
    { value: "analise",   label: "Em Análise",  color: "yellow", isFinal: false,
      description: "Metadata under internal validation." },
    { value: "aprovado",  label: "Aprovado",    color: "blue",   isFinal: false,
      description: "Approved internally; waiting for delivery to the distributor." },
    { value: "entregue",  label: "Entregue",    color: "blue",   isFinal: false,
      description: "Delivered to the distributor; waiting for publication." },
    { value: "publicado", label: "Publicado",   color: "green",  isFinal: false,
      description: "Live on the streaming platforms." },
    { value: "arquivado", label: "Arquivado",   color: "gray",   isFinal: true,
      description: "Withdrawn from the platforms; history kept." },
    { value: "cancelado", label: "Cancelado",   color: "red",    isFinal: true,
      description: "Canceled before delivery." },
  ],
  transitions: [
    { from: "analise",   to: "aprovado",  trigger: "Approve",         description: "Internal review completed." },
    { from: "analise",   to: "cancelado", trigger: "Cancel",        description: "Release canceled in the review phase." },
    { from: "aprovado",  to: "entregue",  trigger: "Deliver",        description: "Sent to the distributor." },
    { from: "entregue",  to: "publicado", trigger: "Confirm live",  description: "The distributor confirms publication on the platforms." },
    { from: "publicado", to: "arquivado", trigger: "Withdraw",         description: "Request to withdraw from the platforms." },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// LEAD — Sales prospecting CRM
// ═══════════════════════════════════════════════════════════════════════════════

export const LEAD_STATE_MACHINE: StateMachine = {
  entity:       "Lead",
  initialState: "novo",
  states: [
    { value: "novo",         label: "Novo",          color: "blue",   isFinal: false,
      description: "Newly created lead; not contacted." },
    { value: "em_contato",   label: "Em Contato",   color: "blue",   isFinal: false,
      description: "First contact made." },
    { value: "proposta",     label: "Proposta",       color: "blue",   isFinal: false,
      description: "Sales proposal sent." },
    { value: "negociacao",   label: "Negociação",     color: "yellow", isFinal: false,
      description: "Negotiating terms and values." },
    { value: "fechado",      label: "Fechado",        color: "green",  isFinal: true,
      description: "Deal closed; originates a Contract or a Client." },
    { value: "perdido",      label: "Perdido",        color: "red",    isFinal: true,
      description: "Opportunity lost; reason recorded." },
    { value: "inativo",      label: "Inactivo",       color: "gray",   isFinal: false,
      description: "No recent interaction; on hold." },
  ],
  transitions: [
    { from: "novo",       to: "em_contato", trigger: "Contact",         description: "First contact recorded." },
    { from: "em_contato", to: "proposta",   trigger: "Send proposal",   description: "Sales proposal prepared." },
    { from: "proposta",   to: "negociacao", trigger: "Start negotiation", description: "The client replied with a counter-proposal." },
    { from: "negociacao", to: "fechado",    trigger: "Close the deal",    description: "Deal accepted by both parties." },
    { from: "negociacao", to: "perdido",    trigger: "Mark as lost", description: "Opportunity not realized." },
    { from: "proposta",   to: "perdido",    trigger: "Proposal rejected", description: "The client rejected the proposal." },
    { from: "perdido",    to: "novo",       trigger: "Reactivar",         description: "New opportunity window." },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAKEDOWN — Removal process
// ═══════════════════════════════════════════════════════════════════════════════

export const TAKEDOWN_STATE_MACHINE: StateMachine = {
  entity:       "Takedown",
  initialState: "pendente",
  states: [
    { value: "pendente",     label: "Pendente",     color: "yellow", isFinal: false,
      description: "Takedown created; waiting to be sent to the platform." },
    { value: "enviado",      label: "Enviado",      color: "blue",   isFinal: false,
      description: "Request sent to the platform." },
    { value: "processando",  label: "Processando",  color: "blue",   isFinal: false,
      description: "The platform is processing the request." },
    { value: "concluido",    label: "Concluído",    color: "green",  isFinal: true,
      description: "Content removed successfully." },
    { value: "rejeitado",    label: "Rejeitado",    color: "red",    isFinal: true,
      description: "The platform rejected the removal request." },
    { value: "falhou",       label: "Falhou",       color: "red",    isFinal: false,
      description: "Technical error; resubmission possible." },
  ],
  transitions: [
    { from: "pendente",    to: "enviado",     trigger: "Send",       description: "Submission to the platform." },
    { from: "enviado",     to: "processando", trigger: "Acknowledgment of receipt", description: "The platform confirms receipt." },
    { from: "processando", to: "concluido",   trigger: "Removal confirmed", description: "Infringement URL inaccessible." },
    { from: "processando", to: "rejeitado",   trigger: "Rejection",     description: "The platform denies the request (fair use, etc.)." },
    { from: "enviado",     to: "falhou",      trigger: "Technical error", description: "Communication failure with the platform." },
    { from: "falhou",      to: "pendente",    trigger: "Resend",     description: "New attempt." },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// EVENT — Production cycle
// ═══════════════════════════════════════════════════════════════════════════════

export const EVENT_STATE_MACHINE: StateMachine = {
  entity:       "Evento",
  initialState: "planejado",
  states: [
    { value: "planejado",  label: "Planeado",    color: "yellow", isFinal: false,
      description: "Being planned; dates and resources being defined." },
    { value: "confirmado", label: "Confirmado",  color: "blue",   isFinal: false,
      description: "Contract signed; venue and date confirmed." },
    { value: "concluido",  label: "Concluído",   color: "green",  isFinal: true,
      description: "Event held successfully." },
    { value: "cancelado",  label: "Cancelado",   color: "red",    isFinal: true,
      description: "Event canceled before taking place." },
    { value: "adiado",     label: "Adiado",      color: "yellow", isFinal: false,
      description: "New date to be confirmed." },
  ],
  transitions: [
    { from: "planejado",  to: "confirmado", trigger: "Confirm",  description: "Venue and date agreed contractually." },
    { from: "confirmado", to: "concluido",  trigger: "Hold",   description: "The event took place." },
    { from: "confirmado", to: "cancelado",  trigger: "Cancel",   description: "Cancellation after confirmation." },
    { from: "confirmado", to: "adiado",     trigger: "Postpone",      description: "Date changed; new planning." },
    { from: "adiado",     to: "confirmado", trigger: "Reconformar", description: "New date confirmed." },
    { from: "planejado",  to: "cancelado",  trigger: "Cancel",   description: "Cancellation in the planning phase." },
  ],
};

// ─── Centralized registry of every state machine ─────────────────────────────

export const ALL_STATE_MACHINES: StateMachine[] = [
  ARTIST_STATE_MACHINE,
  CONTRACT_STATE_MACHINE,
  TRANSACAO_STATE_MACHINE,
  INVOICE_STATE_MACHINE,
  WORK_STATE_MACHINE,
  RELEASE_STATE_MACHINE,
  LEAD_STATE_MACHINE,
  TAKEDOWN_STATE_MACHINE,
  EVENT_STATE_MACHINE,
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function getStateMachine(entity: string): StateMachine | undefined {
  return ALL_STATE_MACHINES.find(m => m.entity === entity);
}

export function getStateDefinition(entity: string, value: string): StateDefinition | undefined {
  return getStateMachine(entity)?.states.find(s => s.value === value);
}

export function getStateColor(entity: string, value: string): UiColor {
  return getStateDefinition(entity, value)?.color ?? "gray";
}

export function getAllowedTransitions(entity: string, currentState: string): StateTransition[] {
  return getStateMachine(entity)?.transitions.filter(t => t.from === currentState) ?? [];
}

export function isFinalState(entity: string, value: string): boolean {
  return getStateDefinition(entity, value)?.isFinal ?? false;
}

/**
 * SEMANTIC COLOR RULE — reference table.
 * Every Badge, StatusBadge and ContractStatusBadge component
 * must consult this table to determine the color variant.
 */
export const SEMANTIC_COLOR_RULES = {
  green:  ["ativo", "vigente", "concluido", "aprovado", "emitida", "publicado", "registrado", "fechado"],
  blue:   ["agendado", "enviado", "processando", "entregue", "em_contato", "proposta", "confirmado",
           "contratado", "producao", "aguardando_assinatura"],
  yellow: ["pendente", "rascunho", "analise", "planejado", "planejamento", "vencendo",
           "suspenso", "adiado", "negociacao", "revisao"],
  gray:   ["inativo", "arquivado", "encerrado", "ex_artista", "liquidado", "pos_producao", "pausado"],
  red:    ["cancelado", "rejeitado", "vencido", "desligado", "falhou", "perdido",
           "demitido", "descartado"],
} as const;

