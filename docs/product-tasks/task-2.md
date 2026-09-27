---
title: Real Workflow Engine
---
# PHASE 2 — Real Workflow Engine

## What & Why
Today every module with a lifecycle (Releases, Contracts, Leads, Campaigns, Projects, Tickets, Licensing) uses a mutable `status: string` with no transition guards. Any service can move any entity to any status with no validation, no transition audit and no controlled side effects. This phase implements a formal state machine layer that makes the workflows predictable, auditable and extensible.

## Done looks like
- `apps/api/src/core/workflow/` contains: `workflow.engine.ts` (generic engine), `workflow.types.ts` (State, Transition, Guard, Hook interfaces), `workflow.service.ts` (injectable service)
- Concrete workflows implemented in each module:
  - `releases.workflow.ts`: `draft → metadata_pending → assets_pending → review → approved → scheduled → distributed → released → archived / cancelled`
  - `contracts.workflow.ts`: `rascunho → em_analise → aguardando_assinatura → assinado → vigente → encerrado / cancelado`
  - `leads.workflow.ts`: `novo → contato → qualificado → proposta → fechado / perdido`
  - `campaigns.workflow.ts`: `rascunho → planejamento → ativa → pausada → concluida / cancelada`
  - `projects.workflow.ts`: `planejamento → em_andamento → revisao → concluido / cancelado`
  - `tickets.workflow.ts`: `open → in_progress → pending_user → resolved → closed / cancelled`
- Each workflow defines: allowed states, valid transitions with `from/to/role[]`, business guards (e.g. a Release cannot go to `review` without capa_url), pre/post-transition hooks, automatic audit of each transition
- `WorkflowService.transition(entity, newStatus, actor)` is the only status mutation point — services do NOT assign `entity.status` directly
- Illegal transitions throw `WorkflowTransitionError` (400) with a detailed reason
- Transition history saved in the `workflow_transitions` table (entity_type, entity_id, from_status, to_status, actor_id, reason, timestamp)
- The frontend receives `allowed_transitions[]` in the entity detail payload — action buttons are generated dynamically

## Out of scope
- User-facing workflow configuration UI
- BPMN or an external engine
- Workflows for accounting entities (Transaction follows a simple model)

## Steps
1. **Create the core workflow engine** — Implement a generic `WorkflowEngine<TState>` with the methods `canTransition`, `transition`, `getAllowedTransitions`. Define the interfaces `WorkflowDefinition`, `WorkflowTransition`, `WorkflowGuard`, `WorkflowHook`.
2. **Create the workflow_transitions entity** — New TypeORM entity for the transition history: entity_type, entity_id, tenant_id, from_status, to_status, actor_id, reason, metadata, created_at. Create the corresponding migration.
3. **Implement the domain workflows** — Create one definition file per module (releases, contracts, leads, campaigns, projects, tickets). Each file exports a `WorkflowDefinition` with all the states, transitions, authorized roles and guards.
4. **Integrate into the services** — Refactor `ReleasesService`, `ContractsService`, `LeadsService`, `CampaignsService`, `ProjectsService` to call `WorkflowService.transition()` instead of assigning `status` directly. Specific business guards (e.g. a contract needs arquivo_url to be signed).
5. **Expose allowed_transitions in the API** — Add an `allowed_transitions` field to the detail responses (GET /releases/:id, GET /contracts/:id, etc.) based on the authenticated actor's role.
6. **Adapt the frontend** — In the detail modules (ContratoViewModal, LancamentoFormModal, etc.), consume `allowed_transitions` to dynamically render the available action buttons instead of static hardcoded buttons.

## Relevant files
- `apps/api/src/modules/releases/releases.service.ts`
- `apps/api/src/modules/contracts/contracts.service.ts`
- `apps/api/src/core/events/events.service.ts`
- `apps/api/src/core/rbac/rbac.service.ts`
- `apps/api/src/database/entities.ts`
- `apps/web/src/modules/releases/pages/Lancamentos.tsx`
- `apps/web/src/modules/contracts/pages/Contratos.tsx`
- `packages/types/src/enums.ts`