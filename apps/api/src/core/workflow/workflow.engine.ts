/**
 * workflow.engine.ts
 *
 * Generic Workflow Engine for MUSIC OS 360.
 * Validates and executes state transitions defined in WorkflowDefinition.
 */

import {
  WorkflowDefinition,
  WorkflowContext,
  AllowedTransition,
  WorkflowTransitionError,
} from './workflow.types';

export class WorkflowEngine<TState extends string = string> {
  constructor(private readonly definition: WorkflowDefinition<TState>) {}

  /**
   * Returns all transitions the actor can take from the current status.
   * Deny-by-default: if a transition declares roles and actorRole is absent, it is excluded.
   */
  getAllowedTransitions(
    currentStatus: TState,
    actorRole?: string,
  ): AllowedTransition<TState>[] {
    return this.definition.transitions
      .filter((t) => {
        const froms = Array.isArray(t.from) ? t.from : [t.from];
        if (!froms.includes(currentStatus)) return false;
        // Deny-by-default: if transition has role restrictions and no actorRole provided, deny.
        if (t.roles) {
          if (!actorRole) return false;
          if (!t.roles.includes(actorRole)) return false;
        }
        return true;
      })
      .map((t) => ({ to: t.to, label: t.label }));
  }

  /**
   * Returns true if the transition from→to is permitted for the given actor role.
   * Deny-by-default: if transition declares roles and actorRole is absent, returns false.
   */
  canTransition(fromStatus: TState, toStatus: TState, actorRole?: string): boolean {
    return this.definition.transitions.some((t) => {
      const froms = Array.isArray(t.from) ? t.from : [t.from];
      if (!froms.includes(fromStatus) || t.to !== toStatus) return false;
      if (t.roles) {
        if (!actorRole) return false;
        if (!t.roles.includes(actorRole)) return false;
      }
      return true;
    });
  }

  /** Executes the transition, running guards and hooks. Throws WorkflowTransitionError on failure. */
  async transition(context: WorkflowContext<TState>): Promise<void> {
    const { fromStatus, toStatus, actorRole } = context;

    const matched = this.definition.transitions.find((t) => {
      const froms = Array.isArray(t.from) ? t.from : [t.from];
      return froms.includes(fromStatus) && t.to === toStatus;
    });

    if (!matched) {
      throw new WorkflowTransitionError(
        `Invalid transition: '${fromStatus}' → '${toStatus}' is not allowed in workflow '${this.definition.name}'`,
        fromStatus,
        toStatus,
        'transition_not_defined',
      );
    }

    // Deny-by-default: if transition declares roles, actorRole MUST be present and authorized.
    if (matched.roles) {
      if (!actorRole) {
        throw new WorkflowTransitionError(
          `Access denied: authentication required for transition '${fromStatus}' → '${toStatus}'`,
          fromStatus,
          toStatus,
          'actor_role_missing',
        );
      }
      if (!matched.roles.includes(actorRole)) {
        throw new WorkflowTransitionError(
          `Insufficient permission: role '${actorRole}' cannot perform '${fromStatus}' → '${toStatus}'`,
          fromStatus,
          toStatus,
          'role_not_authorized',
        );
      }
    }

    if (matched.guard) {
      const result = await matched.guard(context);
      if (!result.allowed) {
        throw new WorkflowTransitionError(
          `Guard rejected transition '${fromStatus}' → '${toStatus}' in workflow '${this.definition.name}'`,
          fromStatus,
          toStatus,
          'guard_rejected',
          result.reason,
        );
      }
    }

    if (matched.hooks?.before) {
      await matched.hooks.before(context);
    }

    if (matched.hooks?.after) {
      await matched.hooks.after(context);
    }
  }

  getDefinition(): WorkflowDefinition<TState> {
    return this.definition;
  }
}
