# PHASE 3 — Domain Events + Automations

## What & Why
The system today has only 9 domain events defined in the `DOMAIN_EVENTS` constant and an `EventsService` wrapper over EventEmitter2, but no concrete handlers registered, no typed payload per event and no real automations. This phase implements the complete event bus with strongly typed payloads, concrete handlers and the operational automations that turn the ERP into a reactive system.

## Done looks like
- `apps/api/src/core/events/` expanded with: `domain-events.types.ts` (typed interfaces for each event), `event-bus.service.ts` (wrapper with typed emit), per-module handlers in `apps/api/src/modules/<name>/handlers/`
- Domain events implemented with a typed payload:
  - `ArtistCreated` → triggers: notification to the owner, bootstrap of initial goals, creation of a media folder
  - `ReleaseApproved` → triggers: operational checklist (cover, ISRC, UPC, distributor), notification to the artist, creation of a WorkflowTask
  - `ContractSigned` → triggers: update of the artist link, notification to legal, enriched audit trail
  - `LeadConverted` → triggers: creation of a Client, creation of an artist in onboarding, sending of a welcome email
  - `CampaignStarted` → triggers: creation of initial monitoring, notification to marketing
  - `CampaignEnded` → triggers: generation of a performance report, notification
  - `OrganizationCreated` (TenantCreated) → triggers: bootstrap of initial data (categories, templates, roles), seeding of welcome notifications
  - `UserInvited` → triggers: invitation email, in-app notification
  - `AssetUploaded` → triggers: type/size validation, enqueueing of processing (thumbnail, waveform placeholder)
  - `TicketResolved` → triggers: notification to the requester, update of SLA metrics
  - `WorkflowTransitioned` (generic) → triggers: transition audit log, contextual notification
- Event handlers are NestJS `@OnEvent()` decorators — decoupled from the emitting services
- All events persist in `domain_event_log` (new table): event_type, tenant_id, aggregate_type, aggregate_id, payload JSONB, occurred_at, processed_at, correlation_id
- `correlation_id` propagated from the request through AsyncLocalStorage — traceable end to end
- The frontend receives real-time in-app notifications via the existing WebSocket for relevant events

## Out of scope
- External broker (RabbitMQ, Kafka) — keep the internal EventEmitter2
- Automatic retry of failed handlers (BullMQ already exists but is not used here)
- Analytics events from external platforms (YouTube, TikTok, etc.)

## Steps
1. **Type all domain events** — Create `domain-events.types.ts` with interfaces for each event: `ArtistCreatedEvent`, `ReleaseApprovedEvent`, `ContractSignedEvent`, etc. Each interface extends `BaseDomainEvent<T>` with `type`, `tenantId`, `actorId`, `correlationId`, `occurredAt`, `payload`.
2. **Create the domain_event_log entity + migration** — New TypeORM entity for persisting emitted events: event_type, aggregate_type, aggregate_id, tenant_id, actor_id, correlation_id, payload, occurred_at, processed_at, error. Append-only (no soft-delete, no update).
3. **Expand the DOMAIN_EVENTS constant** — Add all the missing events: `release.approved`, `release.distributed`, `campaign.started`, `campaign.ended`, `lead.converted`, `asset.uploaded`, `ticket.resolved`, `workflow.transitioned`. Organize by aggregate.
4. **Implement concrete handlers** — Per module, create handlers with `@OnEvent(DOMAIN_EVENTS.X)`: `ArtistEventHandler`, `ReleaseEventHandler`, `ContractEventHandler`, `LeadEventHandler`, `CampaignEventHandler`, `UploadEventHandler`, `TicketEventHandler`. Each handler implements the corresponding automation and persists to the domain_event_log.
5. **Integrate correlation_id via AsyncLocalStorage** — Create middleware that generates an `X-Correlation-ID` per request and stores it in AsyncLocalStorage. `EventsService.emit()` reads the correlation_id automatically and includes it in all events.
6. **Reactive in-app notifications** — A notification handler that listens to relevant events and persists them in `notifications` + emits via WebSocket to the affected user_id.

## Relevant files
- `apps/api/src/core/events/events.service.ts`
- `apps/api/src/core/websocket/websocket.gateway.ts`
- `apps/api/src/database/entities.ts`
- `apps/api/src/modules/artists/artists.service.ts`
- `apps/api/src/modules/releases/releases.service.ts`
- `apps/api/src/modules/contracts/contracts.service.ts`
- `packages/types/src/enums.ts`
