> Historical record. Kept as recorded; not the current contract.

# Module: `musicchat` — Zero-Gap Field Traceability Audit

STATUS: COMPLETE

## 0. Central objective — resolved

**MUSICCHAT_RUNTIME_STATUS: PARTIAL**

MusicChat is **not** an AI/LLM chat assistant. Despite the brand name, exhaustive keyword search
(`openai|anthropic|llm|embedding|vector|gemini|groq|mistral|ollama|rag|completion|streaming`) across
`apps/api/src/modules/conversations`, `apps/web/src/modules/musicchat`, `apps/web/src/shared/pages/MusicChat.tsx`,
and the rest of `apps/web`/`apps/api`/`apps/api-v2`/`packages`/`scripts` (already covered incidentally by
Phase 1/2's exhaustive module-by-module sweep, plus a dedicated grep this module) returned **zero matches**
for any AI/LLM provider, embedding, vector store, or RAG code anywhere in the codebase. `MessageSenderType`
does declare an `AI = 'ai'` enum value (`conversations.dto.ts:18`) but nothing in the codebase ever
constructs a message with `sender_type: 'ai'` — it is an unused enum member, not a feature.

MusicChat is a real, substantial **customer-support / omnichannel inbox tool**: `conversations` /
`conversation_messages` / `conversation_notes` (a general-purpose messaging domain, reused elsewhere e.g.
`leads`) plus a triage/escalation automation layer (`musicchat_automation_settings/events/notifications`)
that auto-responds to inbound messages with a configurable menu, routes them to queues/sectors, and
escalates unanswered conversations to supervisors/managers.

It is **PARTIAL**, not ACTIVE, because the "omnichannel" premise is only half-real: the UI/schema model
5 real external channels (whatsapp/instagram/facebook/tiktok/email + internal/custom), but **no webhook
or ingestion endpoint exists anywhere** to actually receive a message from any of those external
providers — `POST .../automation/inbound` (the only entry point that could originate an external-channel
conversation) has no automatic trigger; it can only be invoked manually/internally. It is not DEAD or
DEFERRED_NO_ACTIVE_CONSUMER: both frontend routes are reachable, both backend controllers are fully
implemented and correctly, exhaustively field-mapped to real, persisted tables, and a real ACTIVE CONSUMER
CHAIN exists end-to-end for the **internal/manual** conversation flow (see §9).

**API_V2_MIGRATION_REQUIREMENT: PARTIAL_REQUIRED** — the conversations/messages/notes CRUD, assignment,
transfer, close/reopen, and automation-settings surface are real and should migrate; the external-channel
ingestion concept should NOT be migrated as-is (it has no current implementation to preserve — migrating it
would mean building it new, which is out of scope for a zero-gap *port*). This decision is recorded here
and in `field-traceability.json` explicitly so MusicChat's external-channel concept is not silently promoted
to an API v2 requirement.

## 1. Domain meaning (evidence)

`MUSICCHAT_DOMAIN_MEANING: CUSTOMER_SUPPORT_OMNICHANNEL_INBOX + TRIAGE_AUTOMATION` — evidenced by:
- `MusicChat.tsx` header comment/types: `MusicChatArea = "internal" | "support"`, `SupportChannel =
  "whatsapp"|"instagram"|"facebook"|"tiktok"|"site"|"custom"`, `SupportStatus` (nova/aguardando_atendimento/
  em_atendimento/aguardando_cliente/resolvida/arquivada) — a support-ticket vocabulary, not a chat-completion
  vocabulary.
- `conversations.service.ts` header comment: *"Inbox operacional multi-canal... Nota interna (note) é
  visível apenas para a equipe, nunca para o contact."*
- `MusicChatAutomationService`'s default menu options (Contratação de Shows / Produção Musical / Editora
  Musical / Design / Financeiro / Redação & Conteúdo / Outros / Contato por Engano) are business-triage
  categories for a record label's inbound contact form, not AI conversation topics.
- Cross-module actions available directly from a conversation (`MusicChat.tsx`): create Lead
  (`useLeads`), create Contact (`useContacts`), create calendar Event (`SchedulerFormModal`) — consistent
  with a support-agent workbench, not a chat assistant.

## 2. Tables / entities

| Table | Cols | Entity | Notes |
|---|---|---|---|
| `conversations` | 13 | `ConversationEntity` | id, tenant_id, contact_id (FK→leads.id), subject, status, channel, assigned_to, last_message_at, metadata, created_by, created_at, updated_at, deleted_at |
| `conversation_messages` | 9 | `ConversationMessageEntity` | id, conversation_id (FK), tenant_id, body, sender_id, sender_type, attachments, metadata, created_at |
| `conversation_notes` | 7 | `ConversationNoteEntity` | id, conversation_id (FK), tenant_id, body, author_id, created_at, (no updated_at — notes are immutable) |
| `musicchat_automation_settings` | 21 | `MusicChatAutomationSettingsEntity` | per-tenant singleton: enabled, welcome_message, main_menu_message, menu_options, templates, required_fields, optional_fields, invalid_option_message, absence_message, out_of_hours_message, closing_message, return_to_menu_rule, escalation_rules, notification_channels, supervisor_user_id, manager_user_id + audit cols |
| `musicchat_automation_events` | 8 | `MusicChatAutomationEventEntity` | append-only audit trail of every automation action (welcome_sent/routed/invalid_option/notification_created/settings_updated/conversation_created) |
| `musicchat_automation_notifications` | 11 | `MusicChatAutomationNotificationEntity` | escalation notifications, deduped by (tenant, conversation, level) |

All 6 tables have real, matching backend entities; no CODE_FIELD_ONLY or DB_FIELD_ONLY column found in
this module (every declared entity column is used by at least one service method; every table column has
a corresponding `@Column`).

## 3. Backend endpoints

`ConversationsController` (`apps/api/src/modules/conversations/conversations.controller.ts`, 194 lines) —
`@Controller('conversations')`, 15 endpoints, all IMPLEMENTED (real query builders, real persistence, no
stubs):

| Method | Path | Consumer | DB effect | Realtime effect | Auth |
|---|---|---|---|---|---|
| GET | `/conversations` | `musicChatConversationsService.list()` | SELECT (filtered/paginated) | — | RequireRole viewer+ |
| POST | `/conversations` | `musicChatConversationsService` (create flow) | INSERT | `conversation:created` (ws) + `DOMAIN_EVENTS.LEAD_UPDATED` (internal bus) | RequireRole editor+ |
| GET | `/conversations/:id` | — | SELECT | — | viewer+ |
| PATCH | `/conversations/:id` | `.update()` | UPDATE | `conversation:updated` | editor+ |
| DELETE | `/conversations/:id` | `.archive()` | UPDATE `deleted_at` (soft delete) | — | editor+ |
| PATCH | `/conversations/:id/assign` | `.assign()`/`.transfer()`(assignee) | UPDATE | `conversation:assigned` | editor+ |
| PATCH | `/conversations/:id/transfer` | `.transfer()` | UPDATE (+ `metadata.transfers[]` audit array) | `conversation:transferred` | editor+ |
| PATCH | `/conversations/:id/close` | `.close()` | UPDATE (+ `metadata.closure`) | `conversation:closed` | editor+ |
| PATCH | `/conversations/:id/reopen` | `.reopen()` | UPDATE (+ `metadata.reopened`) | `conversation:reopened` | editor+ |
| GET | `/conversations/:id/messages` | `.messages()` | SELECT (paginated, limit default 50) | — | viewer+ |
| POST | `/conversations/:id/messages` | `.sendMessage()` | INSERT + parent UPDATE `last_message_at` | `conversation:message` | editor+ |
| GET | `/conversations/:id/notes` | — | SELECT | — | viewer+ |
| POST | `/conversations/:id/notes` | `.addNote()` | INSERT | — | editor+ |

`MusicChatAutomationController` (`musicchat-automation.controller.ts`, 84 lines) —
`@Controller('conversations/musicchat/automation')`, 6 endpoints, all IMPLEMENTED:

| Method | Path | Purpose | Auth |
|---|---|---|---|
| GET | `.../settings` | fetch (or lazily create with defaults) per-tenant settings | viewer+ |
| PATCH | `.../settings` | update settings | manager |
| POST | `.../inbound` | process an inbound message: find/create conversation, run triage state machine | editor+ (manually invoked — see §0) |
| POST | `.../escalations/run` | evaluate escalation rules, create notifications for stale conversations | manager |
| POST | `.../notifications` | manually send a notification | manager |
| GET | `.../events` | list automation audit trail (max 100, DESC) | viewer+ |

No NOT_IMPLEMENTED, PARTIAL, or DEAD endpoints found in either controller — this is one of the more
completely-implemented backend surfaces in the whole audit series.

## 4. Frontend

- `apps/web/src/shared/pages/MusicChat.tsx` — the real inbox UI (route confirmed reachable, not
  redirected/dead), internal + support areas, message composer, attachments, cross-module create actions.
- `apps/web/src/modules/musicchat/services/conversations.service.ts` — `musicChatConversationsService`:
  `list/messages/sendMessage/addNote/update/transfer/close/reopen/archive`, all correctly targeting the
  real endpoints above with matching field names (`ApiConversation`/`ApiMessage` interfaces mirror
  `ConversationEntity`/`ConversationMessageEntity` columns exactly: `contact_id, subject, status, channel,
  assigned_to, last_message_at, metadata, sender_id, sender_type, attachments`). **No REAL_MAPPING_GAP
  found in this file** — a rare, fully-clean mapping for this audit series.
- `apps/web/src/modules/musicchat/services/musicchat-automation.service.ts` +
  `hooks/useMusicChatAutomationSettings.ts` + `hooks/useMusicChatTriageRules.ts` — settings CRUD, correctly
  targeting `MusicChatAutomationController`.
- `apps/web/src/modules/musicchat/pages/MusicChatAutomationSettings.tsx` +
  `components/{TriageMenuBuilder,MenuQueueAccordionItem,EscalationRulesEditor,EscalationRuleAccordionItem}.tsx`
  — admin UI for the menu/escalation config, reachable at `/admin/musicchat/automacoes` (not orphaned).

Business-level conversation fields displayed in the UI (customer name/phone/instagram/email, queue, sector,
protocol, SLA percent/state, tags, CRM summary) are **not physical columns** — they are derived by
`mapConversation()`/`mapMessage()` reading sub-keys out of the generic `metadata` jsonb column
(`metadata.contact`, `metadata.crm_summary`, `metadata.sla_percent`, `metadata.service_status`,
`metadata.queue_id`, `metadata.sector_id`, `metadata.tags`, etc.) — the same "logical schema inside jsonb"
architecture pattern already seen system-wide (marketing builder payload, licensing metadata, etc.), not a
gap in itself since read/write are symmetric and consistent both directions.

## 5. Create / Edit field mapping

`CreateConversationDto` → `createConversation()` → `ConversationEntity`: `contact_id`, `subject`, `channel`
(defaults `'internal'`), `assigned_to`, plus `queue_id`/`sector_id`/`service_status`/`tags` folded into
`metadata` — all correctly mapped, symmetric with read side. `CreateMessageDto` (`body`, `attachments`) →
`addMessage()` → `ConversationMessageEntity` — correct, with a real business rule enforced
(`ForbiddenException` if `conv.status === 'closed'`). `CreateNoteDto` (`body`) → `addNote()` — correct.
`UpdateMusicChatAutomationSettingsDto` (21 optional fields, `class-validator` `@ValidateNested` on the 3
array-of-object fields) → `updateSettings()` — correct, partial-update semantics, recomputes
`main_menu_message` when `menu_options` changes and no explicit override is given.

No DTO/entity field-name mismatch found anywhere in this module — 0 instances of the
`ValidationPipe({whitelist:true, forbidNonWhitelisted:true})`-triggered silent-strip/hard-reject pattern
that caused critical bugs in `contracts`, `leads`, `marketing` (System A), and `monitoring` (Takedowns).

## 6. Persistence

`CONVERSATIONS_PERSISTED: YES` (real TypeORM entity, real table, confirmed INSERT/UPDATE/SELECT paths).
`MESSAGES_PERSISTED: YES` (same). `HISTORY_RESTORED: YES` — `GET /conversations/:id/messages` returns full
paginated history (`ORDER BY created_at ASC`, default limit 50 — same systemic `PaginationDto`-style
truncation found in every module this session; a conversation with >50 messages silently drops older ones
unless the frontend explicitly paginates, which was not confirmed in the read portion of `MusicChat.tsx`).

## 7. Realtime — REALTIME_GAP (reverse-direction, notable finding)

`RealtimeService` (`apps/api/src/core/realtime/realtime.service.ts`) is a genuinely real Supabase Realtime
broadcast publisher (service-role key, RLS-authorized private `tenant:<id>`/`user:<id>` channels — replaces
a legacy Socket.IO gateway that cannot survive Vercel's stateless function model). `ConversationsService`
correctly injects and calls it at all 7 state-changing operations: `conversation:created`, `updated`,
`message`, `assigned`, `transferred`, `closed`, `reopened` — a real publisher, confirmed.

On the frontend, `useWsEvent()` (`apps/web/src/shared/hooks/useWsEvent.ts`) subscribes to the **same real
transport** — confirmed via `useWebSocket.ts`/`ws-client.ts`: "Supabase Realtime channels... tenant + user
broadcast topics", not a legacy socket. So the transport is unified and real end-to-end — unlike most other
modules this session (which only ever used the internal `EventEmitter2` bus with no Supabase bridge at
all).

**However**: the single, centralized, app-wide realtime subscriber (`useRealtimeSync.ts`, mounted once at
session root via `RealtimeLayer.tsx`) only subscribes to `artist.*`, `catalog.*`, `contract.*`,
`crm.lead.*`, `finance.*`, `audit.entry.created` — **none of the 7 `conversation:*` events are subscribed to
anywhere in the frontend** (confirmed by exhaustive grep of `useWsEvent` usage across `apps/web/src`: 8
files total, none inside `MusicChat.tsx` or any `modules/musicchat/**` file). This is the **mirror image**
of the realtime gap pattern found elsewhere this session (there: frontend subscribes to nothing the backend
publishes; here: backend publishes correctly to a real, working transport, but the frontend never listens).
Practical effect: if Agent A is viewing a conversation and Agent B (or the automation engine) adds a
message/reassigns/closes it, Agent A's UI does not live-update — it requires a manual refetch/reload.
Classified `REALTIME_GAP` (publisher real, transport real, zero consumer for this event family).

## 8. Attachments — FILE_STORAGE_GAP

`MusicChat.tsx` `handleFileChange()` (line ~726-743): builds attachment objects via
`url: URL.createObjectURL(file)` — a purely client-side, ephemeral **blob: URL**, never uploaded to any
storage backend (no Supabase Storage call, no multipart upload, no signed-URL request found anywhere in
this file or `conversations.service.ts`). This blob URL is what gets sent as the message's `attachments`
array to `POST /conversations/:id/messages` and stored verbatim in the `attachments` jsonb column. A
`blob:` URL is only valid within the browser tab/session that created it — it is meaningless to any other
user, any other session, or the same user after a page reload. Effect: attachments visibly "work" during
the live composing session (the sender sees their own preview) but are **not real, shared, or durable
files** — a `FILE_STORAGE_GAP` / silent-non-persistence bug, consistent in spirit with the "fake upload"
pattern flagged in other modules this session, though here the backend itself behaves honestly (it stores
whatever URL string it's given; the deception is entirely on the frontend's choice of URL).

## 9. Active Consumer Test (per §27 of the prompt)

**Internal/manual conversation flow — PROVEN chain (ACTIVE):**
Reachable frontend action (`MusicChat.tsx`, `/chat` route, "internal" area, compose + send) → active API
call (`musicChatConversationsService.sendMessage()` → `POST /conversations/:id/messages`) → implemented
backend (`ConversationsService.addMessage()`, real INSERT + real `RealtimeService.sendToTenant()` call) →
real result (row persisted in `conversation_messages`, `conversations.last_message_at` updated). **Proven.**

**Automation/triage flow — PROVEN chain, but entry point is not externally reachable (PARTIAL):**
`POST .../automation/inbound` → `MusicChatAutomationService.handleInboundMessage()` (real state machine:
new → waiting_menu_option → routed, with template responses, escalation-rule scheduling) → real
persistence (`conversations`, `conversation_messages`, `musicchat_automation_events`,
`musicchat_automation_notifications`) → real in-app notification enqueue (`NotificationsService.enqueue()`
when `channel==='in_app'`). The chain itself is real end-to-end, but **there is no reachable frontend
action or external webhook that calls this endpoint automatically** — it is a fully-built automation
engine with no live trigger, which is precisely why the module is classified PARTIAL rather than ACTIVE.

**Admin settings flow — PROVEN chain (ACTIVE):**
`/admin/musicchat/automacoes` → `useMusicChatAutomationSettings` → `GET/PATCH .../settings` →
`MusicChatAutomationService.getSettings/updateSettings()` → real persistence. **Proven.**

## 10. AI / RAG / provider

`AI_PROVIDER_USED: NONE`. `RAG_STATUS: NOT_IMPLEMENTED`. `PROMPT_STORAGE: N/A` (the "templates"/menu
messages in `musicchat_automation_settings` are hardcoded/configured business copy, not LLM prompts — no
prompt-engineering surface exists). `STREAMING_STATUS: N/A` (no SSE/WebSocket streaming of generated text
exists; the only streaming-adjacent concept is the confirmed-real Supabase Realtime broadcast covered in
§7, which is explicitly a different mechanism per the prompt's own instruction not to conflate the two).
`TOKEN_USAGE_GAP: N/A`, `QUOTA_GAP: N/A`, `MODERATION_STATUS: N/A` — none of these apply; the module has no
AI surface to require them, so none are invented as missing requirements, consistent with the prompt's
explicit instruction not to fabricate a requirement from absence.

`CREDENTIALS_TO_ADD_NOW: 0` — no AI provider credential is needed for this module's current, real scope
(customer-support inbox + triage automation). Cross-referenced against `integration-inventory.json`/
`credential-readiness.json` from `integrations.md`: neither lists an AI/LLM provider as a MusicChat
dependency; no action required here.

## 11. Permissions & tenant isolation

Every `ConversationsController`/`MusicChatAutomationController` endpoint carries `@RequireRole(...)`
(viewer/editor/manager tiers, appropriately scoped — settings mutation and escalation triggers require
`manager`, read operations allow `viewer`). Every `ConversationsService`/`MusicChatAutomationService` method
that touches `conversations`/`conversation_messages`/`conversation_notes`/`musicchat_automation_*` includes
an explicit `tenant_id` predicate in its query/update (confirmed across all 19 read/write methods read in
full this module — `listConversations`, `findConversationById`, `createConversation`, `updateConversation`,
`softDeleteConversation`, `listMessages`, `addMessage`, `listNotes`, `addNote`, `assign`, `transfer`,
`close`, `reopen`, `getSettings`, `updateSettings`, `handleInboundMessage`, `runEscalation`,
`sendNotification`, `listEvents`). `AUTHORIZATION_GAPS: 0`. `TENANT_ISOLATION_GAPS: 0`.

## 12. Errors, mocks, logging/PII

`ERROR_HANDLING_GAP: 0` — real exceptions thrown for real invalid states (`NotFoundException` for missing
conversation, `ForbiddenException` for messaging a closed conversation); `recordEvent()` in the automation
service defensively catches its own persistence failure and logs a warning rather than crashing the parent
operation (audit-trail-is-best-effort, a deliberate and reasonable choice, not a hidden gap).
`MOCK_DATA_GAP: 0` in the backend (no fabricated success, no silent fallback-to-empty). One frontend
`MOCK_DATA_GAP`-adjacent issue already covered as `FILE_STORAGE_GAP` in §8.
`SECRET_LOGGING_GAP: 0` / `PII_LOGGING_GAP: 0` — the only `logger.warn` call logs the exception's `String(error)`
and the automation event type, not message bodies or contact PII; message bodies/customer PII (name, phone,
instagram, email) are stored in normal DB columns/jsonb, never written to application logs anywhere in the
files read this module.

## 13. Gap taxonomy summary

| Gap type | Count | Detail |
|---|---|---|
| FRONTEND_CONSUMER_GAP | 0 | both routes reachable, both wired to real services |
| BACKEND_IMPLEMENTATION_GAP | 0 | all 21 endpoints (15+6) fully implemented |
| PROVIDER_GAP | 0 | N/A — no AI provider required by current scope |
| CREDENTIAL_GAP | 0 | none needed now |
| PROMPT_MAPPING_GAP | 0 | N/A |
| CONVERSATION_MAPPING_GAP | 0 | clean field mapping confirmed |
| MESSAGE_MAPPING_GAP | 0 | clean field mapping confirmed |
| PERSISTENCE_GAP | 0 | confirmed persisted end-to-end |
| RAG_GAP | 0 | N/A, correctly not implemented |
| STREAMING_GAP | 0 | N/A |
| REALTIME_GAP | **1** | backend publishes real Supabase Realtime events for all 7 conversation state changes; frontend never subscribes (§7) |
| TOKEN_USAGE_GAP | 0 | N/A |
| QUOTA_GAP | 0 | N/A |
| FILE_STORAGE_GAP | **1** | attachments use client-only `blob:` URLs, never uploaded to real storage (§8) |
| ERROR_HANDLING_GAP | 0 | — |
| MOCK_DATA_GAP | 0 (backend) | — |
| SECRET_LOGGING_GAP | 0 | — |
| PII_LOGGING_GAP | 0 | — |
| AUTHORIZATION_GAP | 0 | — |
| TENANT_ISOLATION_GAP | 0 | — |
| EXTERNAL_CHANNEL_INGESTION_GAP | **1** | no webhook/ingestion exists for whatsapp/instagram/facebook/tiktok/email despite full schema/UI support (§0) |
| TRUNCATION_GAP | 1 | `listMessages`/`listConversations` default `limit=50`, systemic pattern |

`UNMAPPED_FIELDS: 0`. `UNKNOWN_FIELD_CLASSIFICATIONS: 0`.

## Contadores finais (Zero-Gap)

```
MODULE_STATUS: COMPLETE
MUSICCHAT_RUNTIME_STATUS: PARTIAL
API_V2_MIGRATION_REQUIREMENT: PARTIAL_REQUIRED
TABLES_AUDITED: 6
BACKEND_ENDPOINTS_AUDITED: 21
FRONTEND_ENTRYPOINTS_AUDITED: 2 (MusicChat.tsx /chat, MusicChatAutomationSettings.tsx /admin/musicchat/automacoes)
AI_PROVIDER_USED: NONE
RAG_STATUS: NOT_IMPLEMENTED
STREAMING_STATUS: N/A
CONVERSATIONS_PERSISTED: YES
MESSAGES_PERSISTED: YES
HISTORY_RESTORED: YES
REALTIME_PUBLISHER_REAL: YES
REALTIME_CONSUMER_PRESENT: NO
REALTIME_GAP: 1
FILE_STORAGE_GAP: 1
EXTERNAL_CHANNEL_INGESTION_GAP: 1
CREDENTIALS_TO_ADD_NOW: 0
AUTHORIZATION_GAPS: 0
TENANT_ISOLATION_GAPS: 0
SECRET_LOGGING_GAP: 0
PII_LOGGING_GAP: 0
MOCK_DATA_GAP: 0
UNMAPPED_FIELDS: 0
UNKNOWN_FIELD_CLASSIFICATIONS: 0
```

NEXT_MODULE: projects
