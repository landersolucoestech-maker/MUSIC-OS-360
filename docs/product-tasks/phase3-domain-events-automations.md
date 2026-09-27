# FASE 3 — Domain Events + Automações

## What & Why
O sistema tem hoje apenas 9 eventos de domínio definidos no `DOMAIN_EVENTS` constant e um `EventsService` wrapper sobre EventEmitter2, mas sem handlers concretos registados, sem payload tipado por evento e sem automações reais. Esta fase implementa o barramento de eventos completo com payloads fortemente tipados, handlers concretos e as automações operacionais que transformam o ERP num sistema reativo.

## Done looks like
- `apps/api/src/core/events/` expandido com: `domain-events.types.ts` (interfaces tipadas para cada evento), `event-bus.service.ts` (wrapper com emit tipado), handlers por módulo em `apps/api/src/modules/<name>/handlers/`
- Eventos de domínio implementados com payload tipado:
  - `ArtistCreated` → dispara: notificação ao owner, bootstrap de metas iniciais, criação de pasta de media
  - `ReleaseApproved` → dispara: checklist operacional (capa, ISRC, UPC, distribuidora), notificação ao artista, criação de WorkflowTask
  - `ContractSigned` → dispara: atualização do vínculo artista, notificação ao jurídico, audit trail enriquecido
  - `LeadConverted` → dispara: criação de Client, criação de artista em onboarding, disparo de email de boas-vindas
  - `CampaignStarted` → dispara: criação de monitoramento inicial, notificação ao marketing
  - `CampaignEnded` → dispara: geração de relatório de performance, notificação
  - `OrganizationCreated` (TenantCreated) → dispara: bootstrap de dados iniciais (categorias, templates, roles), seed de notificações de boas-vindas
  - `UserInvited` → dispara: email de convite, notificação in-app
  - `AssetUploaded` → dispara: validação de tipo/tamanho, enfileiramento de processamento (thumbnail, waveform placeholder)
  - `TicketResolved` → dispara: notificação ao requester, atualização de SLA metrics
  - `WorkflowTransitioned` (genérico) → dispara: audit log de transição, notificação contextual
- Event handlers são `@OnEvent()` NestJS decorators — desacoplados dos services emissores
- Todos os eventos persistem em `domain_event_log` (nova tabela): event_type, tenant_id, aggregate_type, aggregate_id, payload JSONB, occurred_at, processed_at, correlation_id
- `correlation_id` propagado do request através de AsyncLocalStorage — rastreável de ponta a ponta
- Frontend recebe notificações in-app em tempo real via WebSocket existente para eventos relevantes

## Out of scope
- Broker externo (RabbitMQ, Kafka) — continuar com EventEmitter2 interno
- Retry automático de handlers com falha (BullMQ já existe mas não é usado aqui)
- Eventos de analytics de plataformas externas (YouTube, TikTok, etc.)

## Steps
1. **Tipar todos os eventos de domínio** — Criar `domain-events.types.ts` com interfaces para cada evento: `ArtistCreatedEvent`, `ReleaseApprovedEvent`, `ContractSignedEvent`, etc. Cada interface herda de `BaseDomainEvent<T>` com `type`, `tenantId`, `actorId`, `correlationId`, `occurredAt`, `payload`.
2. **Criar domain_event_log entity + migration** — Nova entidade TypeORM para persitência de eventos emitidos: event_type, aggregate_type, aggregate_id, tenant_id, actor_id, correlation_id, payload, occurred_at, processed_at, error. Append-only (sem soft-delete, sem update).
3. **Expandir DOMAIN_EVENTS constant** — Adicionar todos os eventos em falta: `release.approved`, `release.distributed`, `campaign.started`, `campaign.ended`, `lead.converted`, `asset.uploaded`, `ticket.resolved`, `workflow.transitioned`. Organizar por aggregate.
4. **Implementar handlers concretos** — Por módulo, criar handlers com `@OnEvent(DOMAIN_EVENTS.X)`: `ArtistEventHandler`, `ReleaseEventHandler`, `ContractEventHandler`, `LeadEventHandler`, `CampaignEventHandler`, `UploadEventHandler`, `TicketEventHandler`. Cada handler implementa a automação correspondente e persiste no domain_event_log.
5. **Integrar correlation_id via AsyncLocalStorage** — Criar middleware que gera `X-Correlation-ID` por request e o armazena em AsyncLocalStorage. `EventsService.emit()` lê o correlation_id automaticamente e o inclui em todos os eventos.
6. **Notificações in-app reativas** — Handler de notificação que escuta eventos relevantes e persiste em `notifications` + emite via WebSocket para o user_id afetado.

## Relevant files
- `apps/api/src/core/events/events.service.ts`
- `apps/api/src/core/websocket/websocket.gateway.ts`
- `apps/api/src/database/entities.ts`
- `apps/api/src/modules/artists/artists.service.ts`
- `apps/api/src/modules/releases/releases.service.ts`
- `apps/api/src/modules/contracts/contracts.service.ts`
- `packages/types/src/enums.ts`
