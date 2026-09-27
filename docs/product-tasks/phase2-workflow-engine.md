# FASE 2 — Workflow Engine Real

## What & Why
Hoje todos os módulos com ciclo de vida (Releases, Contracts, Leads, Campaigns, Projects, Tickets, Licenciamento) usam `status: string` mutável sem guards de transição. Qualquer serviço pode mover qualquer entidade para qualquer status sem validação, sem auditoria de transição e sem side-effects controlados. Esta fase implementa uma camada de state machine formal que torna os workflows previsíveis, auditáveis e extensíveis.

## Done looks like
- `apps/api/src/core/workflow/` contém: `workflow.engine.ts` (motor genérico), `workflow.types.ts` (interfaces State, Transition, Guard, Hook), `workflow.service.ts` (serviço injetável)
- Workflows concretos implementados em cada módulo:
  - `releases.workflow.ts`: draft → metadata_pending → assets_pending → review → approved → scheduled → distributed → released → archived / cancelled
  - `contracts.workflow.ts`: rascunho → em_analise → aguardando_assinatura → assinado → vigente → encerrado / cancelado
  - `leads.workflow.ts`: novo → contato → qualificado → proposta → fechado / perdido
  - `campaigns.workflow.ts`: rascunho → planejamento → ativa → pausada → concluida / cancelada
  - `projects.workflow.ts`: planejamento → em_andamento → revisao → concluido / cancelado
  - `tickets.workflow.ts`: open → in_progress → pending_user → resolved → closed / cancelled
- Cada workflow define: estados permitidos, transições válidas com `from/to/role[]`, guards de negócio (ex: Release não pode ir para `review` sem capa_url), hooks pre/post-transition, auditoria automática de cada transição
- `WorkflowService.transition(entity, newStatus, actor)` é o único ponto de mutação de status — serviços NÃO atribuem `entity.status` diretamente
- Transições ilegais lançam `WorkflowTransitionError` (400) com motivo detalhado
- Histórico de transições salvo em tabela `workflow_transitions` (entity_type, entity_id, from_status, to_status, actor_id, reason, timestamp)
- Frontend recebe `allowed_transitions[]` no payload de detalhe da entidade — botões de ação são gerados dinamicamente

## Out of scope
- UI de configuração de workflow pelo usuário
- BPMN ou engine externo
- Workflows para entidades contábeis (Transaction segue modelo simples)

## Steps
1. **Criar core workflow engine** — Implementar `WorkflowEngine<TState>` genérico com métodos `canTransition`, `transition`, `getAllowedTransitions`. Definir interfaces `WorkflowDefinition`, `WorkflowTransition`, `WorkflowGuard`, `WorkflowHook`.
2. **Criar entidade workflow_transitions** — Nova entidade TypeORM para histórico de transições: entity_type, entity_id, tenant_id, from_status, to_status, actor_id, reason, metadata, created_at. Criar migration correspondente.
3. **Implementar workflows de domínio** — Criar ficheiro de definição por módulo (releases, contracts, leads, campaigns, projects, tickets). Cada ficheiro exporta um `WorkflowDefinition` com todos os estados, transições, roles autorizadas e guards.
4. **Integrar nos services** — Refatorar `ReleasesService`, `ContractsService`, `LeadsService`, `CampaignsService`, `ProjectsService` para chamar `WorkflowService.transition()` em vez de atribuir `status` diretamente. Guards de negócio específicos (ex: contrato precisa de arquivo_url para assinar).
5. **Expor allowed_transitions na API** — Adicionar campo `allowed_transitions` nos responses de detalhe (GET /releases/:id, GET /contracts/:id, etc.) baseado no role do actor autenticado.
6. **Adaptar frontend** — Nos módulos de detalhe (ContratoViewModal, LancamentoFormModal, etc.), consumir `allowed_transitions` para renderizar botões de ação disponíveis dinamicamente em vez de botões estáticos hardcoded.

## Relevant files
- `apps/api/src/modules/releases/releases.service.ts`
- `apps/api/src/modules/contracts/contracts.service.ts`
- `apps/api/src/core/events/events.service.ts`
- `apps/api/src/core/rbac/rbac.service.ts`
- `apps/api/src/database/entities.ts`
- `apps/web/src/modules/releases/pages/Lancamentos.tsx`
- `apps/web/src/modules/contracts/pages/Contratos.tsx`
- `packages/types/src/enums.ts`
