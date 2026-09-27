/**
 * workflow.types.ts
 *
 * Core type definitions for the MUSIC OS 360 Workflow Engine.
 * All domain workflow definitions implement these interfaces.
 */

export interface WorkflowTransition<TState extends string = string> {
  from: TState | TState[];
  to: TState;
  roles?: string[];
  label?: string;
  guard?: WorkflowGuard<TState>;
  hooks?: WorkflowHooks<TState>;
}

export type WorkflowGuard<TState extends string = string> = (
  context: WorkflowContext<TState>
) => Promise<WorkflowGuardResult>;

export interface WorkflowGuardResult {
  allowed: boolean;
  /** PT-BR end-user copy explaining the rejection (returned as the HTTP message). */
  reason?: string;
}

export interface WorkflowHooks<TState extends string = string> {
  before?: (context: WorkflowContext<TState>) => Promise<void>;
  after?: (context: WorkflowContext<TState>) => Promise<void>;
}

export interface WorkflowContext<TState extends string = string> {
  entityType: string;
  entityId: string;
  tenantId: string;
  actorId: string;
  actorRole?: string;
  fromStatus: TState;
  toStatus: TState;
  entity: Record<string, unknown>;
  reason?: string;
}

export interface WorkflowDefinition<TState extends string = string> {
  name: string;
  entityType: string;
  initialState: TState;
  states: TState[];
  transitions: WorkflowTransition<TState>[];
}

export interface AllowedTransition<TState extends string = string> {
  to: TState;
  label?: string;
}

/** Why the engine rejected a transition (machine code). */
export type WorkflowTransitionErrorCode =
  | 'transition_not_defined'
  | 'actor_role_missing'
  | 'role_not_authorized'
  | 'guard_rejected';

/** PT-BR end-user copy per rejection code (guard rejections use the guard's own copy). */
export const WORKFLOW_TRANSITION_USER_MESSAGES: Readonly<Record<WorkflowTransitionErrorCode, string>> = {
  transition_not_defined: 'Esta mudança de status não é permitida.',
  actor_role_missing: 'Você precisa estar autenticado para realizar esta ação.',
  role_not_authorized: 'Seu perfil não tem permissão para realizar esta mudança de status.',
  guard_rejected: 'A mudança de status não atende às condições necessárias.',
};

/**
 * Rejected workflow transition. `message` is an English technical diagnostic
 * (it names states, roles and the workflow — never shown to end users);
 * `userMessage` is the PT-BR copy the HTTP layer returns.
 */
export class WorkflowTransitionError extends Error {
  readonly userMessage: string;

  constructor(
    message: string,
    public readonly fromStatus: string,
    public readonly toStatus: string,
    public readonly code: WorkflowTransitionErrorCode,
    userMessage?: string,
  ) {
    super(message);
    this.name = 'WorkflowTransitionError';
    this.userMessage = userMessage ?? WORKFLOW_TRANSITION_USER_MESSAGES[code];
  }
}
