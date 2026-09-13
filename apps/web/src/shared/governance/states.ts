/**
 * shared/governance/states.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * MUSIC OS 360 — Máquinas de Estado Canónicas
 *
 * Documenta os ciclos de vida de cada entidade: estados válidos,
 * transições permitidas, estado inicial, estados finais e
 * cor semântica na UI.
 *
 * REGRA DE COR SEMÂNTICA (obrigatória em toda a UI):
 *   Verde    → activo / publicado / concluído / aprovado / emitido
 *   Azul     → em curso / produção / processando / agendado / enviado
 *   Amarelo  → pendente / rascunho / análise / planejamento
 *   Cinza    → inactivo / arquivado / encerrado / liquidado
 *   Vermelho → EXCLUSIVO para: cancelado / rejeitado / vencido /
 *              desligado / falhou / valores negativos
 *
 * PROIBIDO: usar vermelho para estados neutros ou de progresso.
 *
 * Fonte de tipos: shared/types/enums.ts
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ─── Tipos da máquina de estados ─────────────────────────────────────────────

export type UiColor =
  | "green"    // activo / positivo / concluído
  | "blue"     // em curso / agendado
  | "yellow"   // pendente / rascunho / análise
  | "gray"     // inactivo / arquivado / neutro
  | "red";     // cancelado / rejeitado / vencido / falhou (APENAS estes)

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
// ARTISTA — Estado de cadastro
// ═══════════════════════════════════════════════════════════════════════════════

export const ARTISTA_STATE_MACHINE: StateMachine = {
  entity:       "Artista",
  initialState: "prospect",
  states: [
    { value: "prospect",       label: "Prospecto",   color: "yellow", isFinal: false,
      description: "Artista em avaliação — não tem contrato activo." },
    { value: "signed",         label: "Contratado",  color: "blue",   isFinal: false,
      description: "Contrato assinado, onboarding em curso." },
    { value: "active",         label: "Activo",      color: "green",  isFinal: false,
      description: "Artista operacional na label/editora." },
    { value: "inactive",       label: "Inactivo",    color: "gray",   isFinal: false,
      description: "Sem actividade recente; contrato suspenso." },
    { value: "suspended",      label: "Suspenso",    color: "yellow", isFinal: false,
      description: "Relação em análise por incumprimento." },
    { value: "former_artist",  label: "Ex-Artista",  color: "gray",   isFinal: true,
      description: "Contrato encerrado; histórico mantido." },
    { value: "terminated",     label: "Desligado",   color: "red",    isFinal: true,
      description: "Ruptura contratual antecipada ou por falta grave." },
  ],
  transitions: [
    { from: "prospect",  to: "signed",        trigger: "Assinar contrato",    description: "Contrato aceite e assinado digitalmente." },
    { from: "signed",    to: "active",        trigger: "Concluir onboarding", description: "Perfil completo, dados fiscais verificados." },
    { from: "active",    to: "inactive",      trigger: "Inactivar",           description: "Sem actividade durante período definido." },
    { from: "inactive",  to: "active",        trigger: "Reactivar",           description: "Artista retoma actividade." },
    { from: "active",    to: "suspended",     trigger: "Suspender",           description: "Incumprimento de cláusula contratual." },
    { from: "suspended", to: "active",        trigger: "Levantar suspensão",  description: "Resolução da causa de suspensão." },
    { from: "suspended", to: "terminated",    trigger: "Desligar",            description: "Incumprimento não resolvido — ruptura." },
    { from: "active",    to: "former_artist", trigger: "Encerrar contrato",   description: "Contrato expirado naturalmente." },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONTRATO — Ciclo de vida
// ═══════════════════════════════════════════════════════════════════════════════

export const CONTRATO_STATE_MACHINE: StateMachine = {
  entity:       "Contrato",
  initialState: "rascunho",
  states: [
    { value: "rascunho",              label: "Rascunho",              color: "yellow", isFinal: false,
      description: "Em edição; não vinculativo." },
    { value: "aguardando_assinatura", label: "Aguardando Assinatura", color: "blue",   isFinal: false,
      description: "Enviado para assinatura digital (Autentique)." },
    { value: "vigente",               label: "Vigente",               color: "green",  isFinal: false,
      description: "Activo e dentro do prazo de validade." },
    { value: "ativo",                 label: "Activo",                color: "green",  isFinal: false,
      description: "Sinónimo de vigente (compatibilidade)." },
    { value: "vencendo",              label: "A Vencer",              color: "yellow", isFinal: false,
      description: "Vence nos próximos 30 dias — alerta activo." },
    { value: "vencido",               label: "Vencido",               color: "red",    isFinal: false,
      description: "Prazo expirado sem renovação." },
    { value: "encerrado",             label: "Encerrado",             color: "gray",   isFinal: true,
      description: "Encerrado por acordo mútuo ou cumprimento total." },
    { value: "cancelado",             label: "Cancelado",             color: "red",    isFinal: true,
      description: "Cancelado antes da assinatura ou por ruptura." },
  ],
  transitions: [
    { from: "rascunho",              to: "aguardando_assinatura", trigger: "Enviar para assinatura", description: "Enviado via Autentique." },
    { from: "aguardando_assinatura", to: "vigente",               trigger: "Todas as partes assinaram", description: "Autentique confirma assinaturas completas." },
    { from: "aguardando_assinatura", to: "cancelado",             trigger: "Cancelar",              description: "Cancelado antes de assinatura completa." },
    { from: "vigente",               to: "vencendo",              trigger: "Automático (30 dias)",  description: "Job automático detecta proximidade de vencimento." },
    { from: "vencendo",              to: "vencido",               trigger: "Automático (data)",     description: "Data de vencimento atingida sem renovação." },
    { from: "vencido",               to: "vigente",               trigger: "Renovar",               description: "Nova data de vencimento definida." },
    { from: "vigente",               to: "encerrado",             trigger: "Encerrar",              description: "Encerramento por acordo mútuo." },
    { from: "vencido",               to: "encerrado",             trigger: "Arquivar",              description: "Arquivamento após expiração." },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSAÇÃO — Estado de pagamento
// ═══════════════════════════════════════════════════════════════════════════════

export const TRANSACAO_STATE_MACHINE: StateMachine = {
  entity:       "Transacao",
  initialState: "pendente",
  states: [
    { value: "agendado",  label: "Agendado",  color: "blue",   isFinal: false,
      description: "Pagamento programado para data futura." },
    { value: "pendente",  label: "Pendente",  color: "yellow", isFinal: false,
      description: "Aguardando pagamento ou confirmação." },
    { value: "concluido", label: "Concluído", color: "green",  isFinal: true,
      description: "Pagamento efectuado e confirmado." },
    { value: "cancelado", label: "Cancelado", color: "red",    isFinal: true,
      description: "Transação cancelada — nunca efectuada." },
  ],
  transitions: [
    { from: "agendado", to: "pendente",  trigger: "Data de vencimento",   description: "Data chegou; awaiting payment." },
    { from: "pendente", to: "concluido", trigger: "Confirmar pagamento",  description: "Utilizador confirma pagamento recebido/efectuado." },
    { from: "agendado", to: "cancelado", trigger: "Cancelar",             description: "Agendamento cancelado antes da data." },
    { from: "pendente", to: "cancelado", trigger: "Cancelar",             description: "Pagamento não efectuado — transação cancelada." },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// NOTA FISCAL — Ciclo de emissão
// ═══════════════════════════════════════════════════════════════════════════════

export const NOTA_FISCAL_STATE_MACHINE: StateMachine = {
  entity:       "NotaFiscal",
  initialState: "rascunho",
  states: [
    { value: "rascunho",  label: "Rascunho",  color: "yellow", isFinal: false,
      description: "Em preenchimento; não enviada à SEFAZ." },
    { value: "pendente",  label: "Pendente",  color: "blue",   isFinal: false,
      description: "Enviada para emissão; aguardando resposta." },
    { value: "emitida",   label: "Emitida",   color: "green",  isFinal: false,
      description: "Autorizada pela SEFAZ; chave de acesso disponível." },
    { value: "cancelada", label: "Cancelada", color: "red",    isFinal: true,
      description: "Cancelada dentro do prazo legal." },
    { value: "rejeitada", label: "Rejeitada", color: "red",    isFinal: false,
      description: "Rejeitada pela SEFAZ; requer correcção e reenvio." },
  ],
  transitions: [
    { from: "rascunho", to: "pendente",  trigger: "Emitir",    description: "Enviada à SEFAZ / gateway fiscal." },
    { from: "pendente", to: "emitida",   trigger: "Autorizada", description: "SEFAZ autoriza; chave gerada." },
    { from: "pendente", to: "rejeitada", trigger: "Rejeitada",  description: "SEFAZ rejeita; mensagem de erro disponível." },
    { from: "rejeitada",to: "pendente",  trigger: "Corrigir e reenviar", description: "Campos corrigidos; nova tentativa." },
    { from: "emitida",  to: "cancelada", trigger: "Cancelar",  description: "Dentro do prazo legal de cancelamento." },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// OBRA — Estado de registo
// ═══════════════════════════════════════════════════════════════════════════════

export const OBRA_STATE_MACHINE: StateMachine = {
  entity:       "Obra",
  initialState: "pendente",
  states: [
    { value: "pendente",    label: "Pendente",    color: "yellow", isFinal: false,
      description: "Aguardando dados completos para registo." },
    { value: "analise",     label: "Em Análise",  color: "blue",   isFinal: false,
      description: "Em análise pela equipa ou entidade de direitos." },
    { value: "registrado",  label: "Registado",   color: "green",  isFinal: false,
      description: "Registado nas entidades de direitos (ECAD/UBC)." },
    { value: "ativo",       label: "Activo",      color: "green",  isFinal: false,
      description: "Activo no catálogo e disponível para licenciamento." },
    { value: "inativo",     label: "Inactivo",    color: "gray",   isFinal: false,
      description: "Fora de comercialização activa; dados mantidos." },
    { value: "arquivado",   label: "Arquivado",   color: "gray",   isFinal: true,
      description: "Histórico; sem uso comercial activo." },
  ],
  transitions: [
    { from: "pendente",   to: "analise",    trigger: "Submeter para análise",  description: "Dados suficientes para avaliação." },
    { from: "analise",    to: "registrado", trigger: "Registar",               description: "Registo confirmado em entidade de direitos." },
    { from: "registrado", to: "ativo",      trigger: "Activar",                description: "Disponível para licenciamento e arrecadação." },
    { from: "ativo",      to: "inativo",    trigger: "Inactivar",              description: "Retirar de comercialização activa." },
    { from: "inativo",    to: "ativo",      trigger: "Reactivar",              description: "Retomar comercialização." },
    { from: "ativo",      to: "arquivado",  trigger: "Arquivar",               description: "Encerrar ciclo de vida da obra." },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// LANÇAMENTO — Ciclo editorial
// ═══════════════════════════════════════════════════════════════════════════════

export const LANCAMENTO_STATE_MACHINE: StateMachine = {
  entity:       "Lancamento",
  initialState: "analise",
  states: [
    { value: "analise",   label: "Em Análise",  color: "yellow", isFinal: false,
      description: "Metadados em validação interna." },
    { value: "aprovado",  label: "Aprovado",    color: "blue",   isFinal: false,
      description: "Aprovado internamente; aguardando entrega à distribuidora." },
    { value: "entregue",  label: "Entregue",    color: "blue",   isFinal: false,
      description: "Entregue à distribuidora; aguardando publicação." },
    { value: "publicado", label: "Publicado",   color: "green",  isFinal: false,
      description: "Live nas plataformas de streaming." },
    { value: "arquivado", label: "Arquivado",   color: "gray",   isFinal: true,
      description: "Retirado das plataformas; histórico mantido." },
    { value: "cancelado", label: "Cancelado",   color: "red",    isFinal: true,
      description: "Cancelado antes da entrega." },
  ],
  transitions: [
    { from: "analise",   to: "aprovado",  trigger: "Aprovar",         description: "Revisão interna concluída." },
    { from: "analise",   to: "cancelado", trigger: "Cancelar",        description: "Lançamento cancelado na fase de análise." },
    { from: "aprovado",  to: "entregue",  trigger: "Entregar",        description: "Enviado para a distribuidora." },
    { from: "entregue",  to: "publicado", trigger: "Confirmar live",  description: "Distribuidora confirma publicação nas plataformas." },
    { from: "publicado", to: "arquivado", trigger: "Retirar",         description: "Solicitação de retirada das plataformas." },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// LEAD — CRM comercial de captacao
// ═══════════════════════════════════════════════════════════════════════════════

export const LEAD_STATE_MACHINE: StateMachine = {
  entity:       "Lead",
  initialState: "novo",
  states: [
    { value: "novo",         label: "Novo",          color: "blue",   isFinal: false,
      description: "Lead recém-criado; não contactado." },
    { value: "em_contato",   label: "Em Contacto",   color: "blue",   isFinal: false,
      description: "Primeiro contacto realizado." },
    { value: "proposta",     label: "Proposta",       color: "blue",   isFinal: false,
      description: "Proposta comercial enviada." },
    { value: "negociacao",   label: "Negociação",     color: "yellow", isFinal: false,
      description: "Em negociação de termos e valores." },
    { value: "fechado",      label: "Fechado",        color: "green",  isFinal: true,
      description: "Acordo fechado; origina Contrato ou Cliente." },
    { value: "perdido",      label: "Perdido",        color: "red",    isFinal: true,
      description: "Oportunidade perdida; motivo registado." },
    { value: "inativo",      label: "Inactivo",       color: "gray",   isFinal: false,
      description: "Sem interacção recente; parked." },
  ],
  transitions: [
    { from: "novo",       to: "em_contato", trigger: "Contactar",         description: "Primeiro contacto registado." },
    { from: "em_contato", to: "proposta",   trigger: "Enviar proposta",   description: "Proposta comercial preparada." },
    { from: "proposta",   to: "negociacao", trigger: "Iniciar negociação", description: "Cliente respondeu com contra-proposta." },
    { from: "negociacao", to: "fechado",    trigger: "Fechar negócio",    description: "Acordo aceite por ambas as partes." },
    { from: "negociacao", to: "perdido",    trigger: "Marcar como perdido", description: "Oportunidade não concretizada." },
    { from: "proposta",   to: "perdido",    trigger: "Proposta rejeitada", description: "Cliente rejeitou proposta." },
    { from: "perdido",    to: "novo",       trigger: "Reactivar",         description: "Nova janela de oportunidade." },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// TAKEDOWN — Processo de remoção
// ═══════════════════════════════════════════════════════════════════════════════

export const TAKEDOWN_STATE_MACHINE: StateMachine = {
  entity:       "Takedown",
  initialState: "pendente",
  states: [
    { value: "pendente",     label: "Pendente",     color: "yellow", isFinal: false,
      description: "Takedown criado; aguardando envio à plataforma." },
    { value: "enviado",      label: "Enviado",      color: "blue",   isFinal: false,
      description: "Solicitação enviada à plataforma." },
    { value: "processando",  label: "Processando",  color: "blue",   isFinal: false,
      description: "Plataforma está a processar a solicitação." },
    { value: "concluido",    label: "Concluído",    color: "green",  isFinal: true,
      description: "Conteúdo removido com sucesso." },
    { value: "rejeitado",    label: "Rejeitado",    color: "red",    isFinal: true,
      description: "Plataforma rejeitou o pedido de remoção." },
    { value: "falhou",       label: "Falhou",       color: "red",    isFinal: false,
      description: "Erro técnico; reenvio possível." },
  ],
  transitions: [
    { from: "pendente",    to: "enviado",     trigger: "Enviar",       description: "Submissão à plataforma." },
    { from: "enviado",     to: "processando", trigger: "Acusação de recebimento", description: "Plataforma confirma recebimento." },
    { from: "processando", to: "concluido",   trigger: "Remoção confirmada", description: "URL da infracção inacessível." },
    { from: "processando", to: "rejeitado",   trigger: "Rejeição",     description: "Plataforma nega o pedido (fair use, etc.)." },
    { from: "enviado",     to: "falhou",      trigger: "Erro técnico", description: "Falha na comunicação com a plataforma." },
    { from: "falhou",      to: "pendente",    trigger: "Reenviar",     description: "Nova tentativa." },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// EVENTO — Ciclo de produção
// ═══════════════════════════════════════════════════════════════════════════════

export const EVENTO_STATE_MACHINE: StateMachine = {
  entity:       "Evento",
  initialState: "planejado",
  states: [
    { value: "planejado",  label: "Planeado",    color: "yellow", isFinal: false,
      description: "Em planeamento; datas e recursos em definição." },
    { value: "confirmado", label: "Confirmado",  color: "blue",   isFinal: false,
      description: "Contrato assinado; local e data confirmados." },
    { value: "concluido",  label: "Concluído",   color: "green",  isFinal: true,
      description: "Evento realizado com sucesso." },
    { value: "cancelado",  label: "Cancelado",   color: "red",    isFinal: true,
      description: "Evento cancelado antes da realização." },
    { value: "adiado",     label: "Adiado",      color: "yellow", isFinal: false,
      description: "Nova data a confirmar." },
  ],
  transitions: [
    { from: "planejado",  to: "confirmado", trigger: "Confirmar",  description: "Local e data acordados contratualmente." },
    { from: "confirmado", to: "concluido",  trigger: "Realizar",   description: "Evento decorreu." },
    { from: "confirmado", to: "cancelado",  trigger: "Cancelar",   description: "Cancelamento após confirmação." },
    { from: "confirmado", to: "adiado",     trigger: "Adiar",      description: "Data alterada; novo planeamento." },
    { from: "adiado",     to: "confirmado", trigger: "Reconformar", description: "Nova data confirmada." },
    { from: "planejado",  to: "cancelado",  trigger: "Cancelar",   description: "Cancelamento na fase de planeamento." },
  ],
};

// ─── Registo centralizado de todas as máquinas de estado ─────────────────────

export const ALL_STATE_MACHINES: StateMachine[] = [
  ARTISTA_STATE_MACHINE,
  CONTRATO_STATE_MACHINE,
  TRANSACAO_STATE_MACHINE,
  NOTA_FISCAL_STATE_MACHINE,
  OBRA_STATE_MACHINE,
  LANCAMENTO_STATE_MACHINE,
  LEAD_STATE_MACHINE,
  TAKEDOWN_STATE_MACHINE,
  EVENTO_STATE_MACHINE,
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
 * REGRA SEMÂNTICA DE COR — tabela de referência.
 * Todos os componentes Badge, StatusBadge e ContractStatusBadge
 * devem consultar esta tabela para determinar a variante de cor.
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

