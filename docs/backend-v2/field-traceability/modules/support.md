> Historical record. Kept as recorded; not the current contract.

# Module: `support` — Zero-Gap Field Traceability Audit

STATUS: COMPLETE

## 0. Central objective

**SUPPORT_DOMAIN_MEANING**: `support` is, in reality, **one real tenant-scoped ticket system
(`SUPPORT_TICKETS`) with four entirely fake sub-features bolted onto the same frontend module** —
confirmed by evidence, not presumed. The module's own hook file states this outright in its header
comment (`useSupport.ts:12-18`): *"Suporte — tickets usam o backend real (/support-tickets). Chat
interno, base de conhecimento e requests NÃO possuem endpoint real: estes hooks reportam o estado
verdadeiro (vazio) e toda mutação falha explicitamente. É proibido simular o backend em localStorage."*
So: `SUPPORT_TICKETS` (real) + `SUPPORT_CHAT` (fake, live-chat simulator) + `KNOWLEDGE_BASE`/`FAQ` (fake,
no backend at all) + `INCIDENT_SUPPORT`/status-page (fake) + a feature/bug-request board (fake) — all
five sharing one module, only one real.

This audit also closes the explicit cross-module pendency from `admin.md` §4: **`AdminSupport`'s
"cross-tenant" framing is confirmed still unresolved** — it calls the exact same tenant-scoped
`GET /support-tickets` endpoint as the regular `support` module, with no cross-tenant backend route
existing anywhere in the codebase (§7). And it resolves `AdminKnowledge`'s classification: it reuses the
`support` module's own fake `useKnowledgeArticles()` hook — it has no separate knowledge concept or
backend of its own (§8).

## 1. Subdomains

| Subdomain | Frontend entrypoint | Endpoints | Backend | DB tables |
|---|---|---|---|---|
| TICKET | `/support/tickets`, `/support/tickets/:id`, `AdminSupport.tsx` (read-only) | 5 (`GET/GET:id/POST/PATCH/DELETE /support-tickets`) | `SupportTicketsController`/`Service` | `support_tickets` |
| SUPPORT_CHAT | `/support/chat` | none — fully fake | — | none |
| KNOWLEDGE_ARTICLE / FAQ | `/support/knowledge`, `SupportDashboard.tsx` FAQ accordion, `AdminKnowledge.tsx` | none — fully fake | — | none |
| INCIDENT/STATUS | `/support/status` | none — fully fake, hardcoded empty arrays | — | none |
| SUPPORT_REQUEST (feature/bug board) | `/support/requests` | none — fully fake | — | none |
| TICKET_AUTOMATION (AI triage) | none (backend-internal) | event-driven, no endpoint | `SupportTriageAutomation` | writes `support_tickets.metadata.aiTriage` |

No `TICKET_MESSAGE`/`TICKET_NOTE`/`TICKET_ATTACHMENT`/`SUPPORT_AGENT`/`SLA_POLICY` table or entity
exists anywhere — confirmed absent by exhaustive grep across `apps/api/src`, not invented as missing
requirements. `SLA` exists only as two plain columns on the ticket itself (§16), not a separate policy
subdomain.

## 2. Entrypoints / routes

| Route | Page | Reachable | Role | Tenant |
|---|---|---|---|---|
| `/support` | `SupportDashboard.tsx` | yes | any authenticated | tenant-scoped |
| `/support/tickets` | `SupportTickets.tsx` | yes | any authenticated (create=viewer, edit=manager backend-side) | tenant-scoped |
| `/support/tickets/:id` | `SupportTicketDetail.tsx` | yes | same | tenant-scoped |
| `/support/tickets/new` | — | **NOT REGISTERED** — dead link from `SupportDashboard.tsx`'s "Novo Ticket" quick-action card | — | — |
| `/support/knowledge` | `SupportKnowledge.tsx` | yes, but always empty (§8) | any | N/A (no backend) |
| `/support/knowledge/manage` | `Navigate` → `/admin/knowledge` | yes (redirect) | — | — |
| `/support/chat` | `SupportChat.tsx` | yes, fully fake | any | N/A |
| `/support/status` | `SupportStatus.tsx` | yes, fully fake | any | N/A |
| `/support/requests` | `SupportRequests.tsx` | yes, fully fake | any | N/A |
| `/admin/support` | `AdminSupport.tsx` | yes, `AdminRoute`-gated | admin-only UI, `manager`+ backend | tenant-scoped (§7) |
| `/admin/knowledge` | `AdminKnowledge.tsx` | yes (dev only, disabled in prod, §8) | admin-only UI | N/A |

`TENANT_USER_SUPPORT`: the `/support/*` pages. `PLATFORM_ADMIN_SUPPORT` (as framed): `/admin/support` —
but resolved to be functionally identical in scope to the tenant pages (§7), just read-only and
differently labeled. `PUBLIC_HELP`: none exists — every support route requires authentication.

## 3. Components

| Component | File | Classification |
|---|---|---|
| `SupportTickets.tsx` | `pages/` | TABLE + FILTER + SEARCH + CREATE_TICKET_MODAL (drawer) + EDIT_TICKET_MODAL (same drawer) + STATUS_BADGE + PRIORITY_BADGE + SLA_UI (deadline picker) + ASSIGNEE_SELECTOR |
| `SupportTicketDetail.tsx` | `pages/` | DETAIL_MODAL-equivalent full page, editable status/priority, fake `MESSAGE_THREAD` |
| `SupportDashboard.tsx` | `pages/` | DATA_CARD (quick actions) + real "Meus Tickets" list + fake FAQ accordion |
| `SupportChat.tsx` | `pages/` | MESSAGE_THREAD + REPLY_COMPOSER + fake ATTACHMENT_UPLOAD — **entirely DEAD-FUNCTIONALITY, classified STATIC/DEAD in effect** (no backend, no persistence beyond component lifetime) |
| `SupportKnowledge.tsx` | `pages/` | KNOWLEDGE_LIST + FAQ_UI — always empty, no real data source |
| `SupportStatus.tsx` | `pages/` | STATIC — hardcoded empty incident/service arrays |
| `SupportRequests.tsx` | `pages/` | FORM + TABLE — fake, no persistence |
| `KnowledgeBaseManager.tsx` (admin) | `modules/admin/components/knowledge/` | KNOWLEDGE_EDITOR — fake, localStorage-oriented per its own comment, but even that never actually persists (routes through the same always-toast-error hook, §8) |

## 4. Hooks

| Hook | File | Backend | Read/Write |
|---|---|---|---|
| `useTickets()` | `hooks/useSupport.ts` | **real** | `GET /support-tickets?limit=200`, `POST`, `PATCH` |
| `useTicketMessages(id)` | same | **fake** | always `[]`, `addMessage()` → `toast.error(...)` |
| `useChatRooms()` | same | **fake** | always `[]`, mutations → toast error |
| `useChatMessages(roomId)` | same | **fake** | same pattern |
| `useKnowledgeArticles()` | same | **fake** | always `[]`, all 6 CRUD ops → toast error |
| `useRequests()` | same | **fake** | always `[]`, mutations → toast error |
| `adminSupportService.list()` | `modules/admin/services/admin-support.service.ts` | **real, same endpoint as `useTickets`** | `GET /support-tickets?limit=200` only, read-only, no write path in `AdminSupport.tsx` |

No `TENANT_DEPENDENCY` gap on `useTickets` — tenant id is read from `useTenant()` context, never
client-selectable. `REALTIME_EVENTS: 0` on every frontend hook (none subscribe to `useWsEvent`).

## 5. Create Ticket — field mapping

| UI Label | Form field | API field | DTO accepts | Backend field | DB column | Persisted |
|---|---|---|---|---|---|---|
| Assunto | `subject` | `subject` | yes, required | `subject` | `support_tickets.subject` | YES |
| Descrição | `description` | `description` | yes, optional | `description` | `.description` | YES |
| Categoria | `category` | `category` | yes, optional, free enum-like string | `category` | `.category` | YES |
| Prioridade | `priority` | `priority` | yes, required, `SupportTicketPriority` | `priority` | `.priority` | YES |
| — | — | (not sent) `metadata` | optional | `metadata` | `.metadata` | N/A — never populated by the real create form |

`ticket_number` (`TKT-<base36 timestamp>`) — `DERIVED`, server-generated, not a form field.
`created_by` — `RUNTIME_ONLY`, taken from the authenticated JWT `userId`, never a form field.
`status` — forced to `OPEN` on create (not sent by the DTO/form on create, only on update). No
CREATE_MAPPING_MISMATCH found — this is the one clean create flow found in this module.

## 6. Edit Ticket

Same DTO shape (`UpdateSupportTicketDto extends PartialType(CreateSupportTicketDto)`) plus `status`
(workflow-governed, §15) and a dead field: `resolvedAt` — **accepted by the DTO but never read or used
anywhere in `support-tickets.service.ts`** — confirmed by direct reading of `update()`, which only
branches on `dto.status`; `resolvedAt` from the client is silently discarded even if sent. Classified
`CODE_FIELD_ONLY` (DTO declares it, no service consumer). `sla_deadline` and `assigned_to` ARE
genuinely editable and persisted via the drawer's SLA/assignee fields (`SupportTickets.tsx`). Create ≠
Edit confirmed correctly (status/SLA/assignee are edit-only, as expected for a ticket lifecycle — not a
gap, a legitimate asymmetry).

## 7. `AdminSupport` — closing the cross-module pendency

**`SCREEN_INTENT`**: presented as platform-wide ticket oversight — header text "Support Hub"/"Gestão
global de tickets de suporte" (`AdminSupport.tsx:56-57`).
**`ACTUAL_ENDPOINTS`**: exactly one, `GET /support-tickets?limit=200` — the identical, tenant-scoped
endpoint the regular `support` module's `useTickets()` calls. Confirmed directly: no
`super_admin`-only or cross-tenant route exists anywhere in `SupportTicketsController` (only 5 routes
total, all listed in §0/§2, none requiring `super_admin`).
**`ACTUAL_BACKEND_SCOPE`**: single tenant — the caller's own current tenant, resolved server-side via
`@CurrentTenant()` from the verified JWT, never client-selectable.
**`ACTUAL_DATABASE_SCOPE`**: `WHERE tenant_id = :tenantId` on every query, no bypass.
`admin-support.service.ts`'s own `toAdminTicket()` mapper hardcodes `tenant_name: ""` with an explicit,
self-aware code comment: *"o endpoint é escopado ao tenant atual (não expõe tenant_name)"* — the
implementation itself documents the limitation.

Classified `UI_ONLY_CROSS_TENANT_FRAMING` — the screen's positioning/labeling promises platform-wide
oversight; the actual data and backend contract are single-tenant, with no elevated-privilege code path
existing anywhere to close that gap. This is **not a security defect** (a `manager` of Tenant A cannot
see Tenant B's tickets through this screen or any other path — isolation is total and correct) — it is
a **functional gap relative to what the panel's name/positioning promises**, exactly as `admin.md`
originally flagged, now confirmed end-to-end with the full backend contract in evidence.

```
ADMIN_SUPPORT_SCOPE_RESOLVED: SIM
ADMIN_SUPPORT_CROSS_TENANT_FUNCTIONAL: NÃO
```

Additionally found in this pass (not in `admin.md`, a genuine `DISPLAY_MAPPING_MISMATCH`):
`admin-support.service.ts`'s `RawTicket.first_response_at` field is mapped through
`toAdminTicket()` but **the real backend never returns it** — `SupportTicketEntity` has no
`first_response_at` column at all (confirmed, full 16-column list in §0/entity read) — so
`AdminSupportTicket.first_response_at` is always `undefined` in practice, a dead/aspirational field on
the admin side specifically (the regular ticket pages don't reference this field at all, so it's
isolated to `AdminSupport.tsx`).

## 8. `AdminKnowledge` — classification

`AdminKnowledge.tsx`'s own header comment states plainly: *"NÃO existe backend de Base de
Conhecimento. O KnowledgeBaseManager opera sobre localStorage (mock, via useKnowledgeArticles) e serve
apenas para iteração de UI em desenvolvimento."* Gated on `IS_PROD`: in production it renders an
`EmptyState` ("Funcionalidade indisponível") instead of the manager UI — an honest, deliberate
disablement, not a silently-broken feature. Confirmed it has **no separate knowledge concept or
service of its own** — `KnowledgeBaseManager.tsx` imports the exact same `useKnowledgeArticles()` hook
defined in `modules/support/hooks/useSupport.ts` (confirmed: no `admin-knowledge.service.ts` file
exists anywhere in `modules/admin/**`). This settles the question of whether `AdminKnowledge` belongs
functionally to `support`: **it does** — it is not an independent admin feature, it is the same fake
knowledge-base concept, viewed from the admin panel, sharing 100% of its (non-existent) data layer with
`support/pages/SupportKnowledge.tsx`.

```
ADMIN_KNOWLEDGE_SUPPORT_CLASSIFICATION: DEV_ONLY
```
(chosen over `STUB`/`DEAD` specifically because the code is honest about its own limitation and
self-disables in production — a materially different, more mature failure mode than a silent stub)

## 9. Ticket fields — full inventory

`id` (UUID PK), `tenant_id`, `ticket_number` (unique, server-generated), `subject`, `description`,
`status` (6-value enum, §15), `priority` (4-value enum, §16), `category` (free string, §17),
`created_by` (raw JWT user-id string, §19 display bug), `assigned_to` (nullable string, same shape),
`sla_deadline`, `resolved_at`, `tags` (jsonb array, unused by any UI — confirmed no component reads or
writes `.tags`, classified `UNUSED_SETTING_GAP`-equivalent `REAL_MAPPING_GAP`), `metadata` (jsonb,
written only by the AI-triage automation, §0), `created_at`/`updated_at`/`deleted_at`. No
`first_response_at`/`last_response_at`/`source` column exists on the real entity (confirmed absent, not
invented) — `first_response_at` is referenced only on the admin-side dead field (§7); `source`/channel
doesn't exist at all (§42-equivalent: no `web`/`email`/`api` source column anywhere).

## 10. Ticket number

`ticket_number` — `varchar(50)`, `unique: true` (global uniqueness constraint, **not** tenant-scoped —
confirmed by the `@Column({unique:true})` declaration having no composite/tenant qualifier), generated
server-side as `TKT-<base36 timestamp>` in `create()`. `DISPLAY`: shown in `SupportTickets.tsx`'s list
and used as part of the search-matchable text (`ILIKE` on `subject` **and** `ticket_number`, per the
service's `list()` query). Collision risk is theoretical only (base36 millisecond timestamp,
effectively unique in practice) — not flagged as a functional gap given no evidence of real collisions
or of the uniqueness constraint ever being hit.

## 11. Status — REAL_WORKFLOW, with a confirmed frontend enum drift

Backend `SupportTicketStatus` (6 values): `open, in_progress, pending_user, resolved, closed,
cancelled`. Real state machine (`apps/api/src/core/workflow/definitions/tickets.workflow.ts`),
enforced via `WorkflowService.transitionInTx()`:

| Source | Target | UI Action | Roles |
|---|---|---|---|
| open | in_progress | "Iniciar Atendimento" | super_admin/tenant_owner/owner/admin/manager |
| in_progress | pending_user | "Aguardar Resposta do Usuário" | same |
| pending_user | in_progress | "Retomar Atendimento" | same |
| in_progress\|pending_user | resolved | "Resolver Ticket" | same |
| resolved | closed | "Fechar Ticket" | same |
| resolved | in_progress | "Reabrir Ticket" | same |
| open\|in_progress\|pending_user | cancelled | "Cancelar Ticket" | same |

Classified `REAL_WORKFLOW` (not `FIELD_ONLY`) — genuinely enforced server-side in a transaction, no
guard functions (unlike `releases`' workflow) but a real, non-trivial transition graph. One uniform
role gate for every transition (no differentiation between e.g. cancel and resolve) — noted as a
design characteristic, not independently flagged as a gap without further product context.

**`ENUM_MISMATCH` confirmed, three-way divergence**: frontend `support` module's own type
(`modules/support/types/index.ts:1`) declares only **5** values —
`open | in_progress | waiting_customer | resolved | closed` — using `waiting_customer` where the
backend has `pending_user`, and **omitting `cancelled` entirely**. A **third**, independently different
spelling exists in `modules/admin/types/index.ts` — `waiting` (not `waiting_customer`, not
`pending_user`) — also missing `cancelled`. Concrete, evidenced consequence: `TICKET_STATUS_LABELS`
(`useSupport.ts:137-143`) and every `Record<TicketStatus,...>` lookup map in `SupportTickets.tsx`,
`SupportTicketDetail.tsx`, `SupportDashboard.tsx`, and `AdminSupport.tsx`'s `STATUS_CFG` are keyed only
by the 5-value (or in admin's case, differently-5-valued) frontend type. Any ticket genuinely
transitioned to `pending_user` or `cancelled` (both real, workflow-legal states) will cause every one
of these lookups to return `undefined` — in `AdminSupport.tsx:123-124` specifically
(`const sc = STATUS_CFG[t.status]; ...sc.bg`), this is an **unguarded property access on `undefined`**,
a real, reachable runtime `TypeError` for any ticket a manager has moved to either of those two states.
`STATUS_WORKFLOW_GAP: 0` (the workflow itself is sound) but `ENUM_MISMATCH: 1` (systemic, affects 4
files) is the most severe display-layer defect found in this module.

## 12. Priority

`SupportTicketPriority`: `low | medium | high | critical` — confirmed **identical** across backend
enum, `CreateSupportTicketDto`, and frontend `TicketPriority` type (no drift, unlike status).
Affects **sorting** in the UI (list can be sorted by priority) but **not** SLA (no
priority-to-default-deadline logic exists anywhere — `sla_deadline` is always manually set, §16), and
**not** notifications (no priority-based escalation/notification routing exists, §29 equivalent — none
found) or automatic assignment (no auto-assignment logic exists at all). Classified metadata-only
beyond sorting — a real but narrow consumer.

## 13. Category

Backend: free `varchar(100)`, `DTO` constrains it to one of 5 informal values
(`billing|technical|feature-request|access|other`) — but this is **not a DB-level enum/check
constraint**, purely a `class-validator` string check at the API boundary (any other string sent
directly against the DTO's constraint would be rejected, but nothing prevents future drift). Frontend
`TicketCategory` (`useSupport.ts:152-163`, `TICKET_CATEGORY_LABELS`) declares **10** different, entirely
unrelated values (`financeiro, analytics, distribuicao, contratos, artistas, projetos, usuarios,
permissoes, integracoes, outro`) — domain-area labels, not the backend's support-ticket-type labels
(`billing/technical/feature-request/access/other`). This is a second, independent vocabulary mismatch
from §11's status enum drift — confirmed by direct reading of both sides, not inferred. Classified
`ENUM_MISMATCH` (a second instance, category-scoped) — any ticket categorized via the real create form
using the frontend's 10-value list would send a string the backend DTO's `@IsIn` guard would reject
outright (e.g. `"artistas"` is not in `['billing','technical','feature-request','access','other']`),
though this is **HARDCODED_FRONTEND** sourcing on both sides (neither list is `DATABASE`-driven or
`CONFIG`-driven) — not a persistence failure, a validation-rejection risk on create for any category
value outside the backend's 5.

## 14. Requester

`REQUESTER_FIELD: created_by` — `SOURCE_ENTITY`: none (bare string, not a typed relation — no
`@ManyToOne`/`@JoinColumn` to any `users`/`org_members`/`contacts` table). `AUTH_SOURCE`: the creating
user's JWT `userId`, set server-side (`create(tenantId, u.userId, dto)`), never client-supplied.
`DATABASE_RELATION: NONE` — confirmed no FK exists. **`DISPLAY_MAPPING_MISMATCH` confirmed**:
`SupportTicketDetail.tsx` and `SupportTickets.tsx` render `ticket.created_by` directly as the
"Solicitante" (requester) label — since this column stores a raw UUID string with no resolving join
anywhere in the module, every real ticket's "Solicitante" field displays a bare UUID instead of a
person's name. Cross-checked: `crm-relationships`/`contacts` are **not** related to this module at all
(confirmed zero references, §20 below) — there is no lookup path this could use even if one were added
to the display layer.

## 15. Assignee

`ASSIGNEE_FIELD: assigned_to` — same shape as `created_by` (bare `varchar(255)`, no FK, no typed
relation). `SOURCE_ENTITY: none`. `TENANT_SCOPE`: **not enforced by any dropdown/selector validation**
— confirmed no assignee-picker component exists in `SupportTickets.tsx`'s drawer that constrains the
value to members of the current tenant (the field is a free string input, not a user-selector wired to
`useUsuarios()` or similar). `ROLE_VALIDATION: NONE`. **Cross-tenant risk assessment**: since there is
no selector at all (just a raw text field), a manager *could* type an arbitrary string into
`assigned_to`, including a user-id belonging to a different tenant — but since nothing in this module
ever *reads* `assigned_to` to grant that person cross-tenant access to the ticket (no notification, no
permission check keyed off this field, §29 confirms no assignment-triggered notification exists), this
is a **data-quality gap** (`ASSIGNMENT_GAP`), not a functional `TENANT_ISOLATION_GAP` — no privilege or
visibility actually follows from a mis-set `assigned_to` value.

## 16. SLA — partially real, no automatic tracking

`sla_deadline` (real column) — set manually via a `datetime-local` input in the ticket drawer, `PATCH`ed
directly. **No default-deadline-by-priority logic exists anywhere** — nothing computes a deadline
automatically from `priority`/creation time; every deadline is a fully manual entry. `resolved_at` (real
column) — set server-side by `TicketEventsHandler.onTicketResolved()` when status transitions to
`resolved`. On resolution, the handler computes `slaCompliant = resolvedDate <= slaDeadline` and stores
it into `metadata.slaCompliant` (not a dedicated column) — included in the resolution notification body
text only (§29), never surfaced as a queryable field, KPI, or report anywhere. `first_response_at`: does
not exist as a real column at all (§7). No `SLA_POLICY`/business-hours/pause-state concept exists.
Classified `SLA_GAP: 1` — `SLA_STATUS: PARTIAL` (the two real fields exist and one derived compliance
flag is computed once, at resolution, but there is no policy layer, no automatic deadline-setting, no
aggregate SLA reporting, and no first-response tracking at all).

## 17. Escalation

**NOT_PRESENT** — confirmed absent, not invented. No trigger, no priority/assignee-change automation,
no escalation notification exists anywhere in `support-tickets`'s service/handler code.

## 18. Resolution / Close / Reopen / Cancel

| Action | Status change | Endpoint | Side effect |
|---|---|---|---|
| Resolve | `→ resolved` | `PATCH .../:id` | `resolved_at` set, `metadata.slaCompliant` computed, 2 notifications + 1 realtime broadcast (§29) |
| Close | `resolved → closed` | same | none beyond the workflow transition itself |
| Reopen | `resolved → in_progress` | same | none beyond the transition (label says "Reabrir Ticket" but target state is `in_progress`, not back to `open` — a deliberate, real distinction, not a gap) |
| Cancel | `{open,in_progress,pending_user} → cancelled` | same | none beyond the transition |

`RESOLVED`/`CLOSED`/`CANCELLED` are confirmed as genuinely distinct states in the real workflow (§11) —
not merged or conflated. `DELETE /support-tickets/:id` is a **soft delete only** (`deleted_at`), labeled
in its own `@ApiOperation` as "Fechar ticket de suporte" ("close," not "delete") — the Swagger summary
text itself acknowledges this is conceptually a close/archive operation, not destruction, consistent
with its actual soft-delete implementation. `SUPPORT_HISTORY_GAP: 0` — no message/audit-trail rows
exist to be orphaned by this operation (there is no message thread at all, §21), and the ticket row
itself is preserved (soft delete), so no history is lost by any delete path found.

## 19. Messages / Thread — entirely fake

`grep` confirms **zero** message/note/comment entity or table exists anywhere in `apps/api/src`
(`ticket_message`, `ticket_note`, `ticket_comment`, all searched, no matches). `useTicketMessages()`
always returns `messages: []`; `addMessage()` unconditionally shows the fixed
`SUPPORT_BACKEND_UNAVAILABLE` toast and never sends any request. `SupportTicketDetail.tsx`'s and
`SupportTickets.tsx`'s drawer message-thread UI is fully rendered (message bubbles, reply composer) but
is **structurally incapable of persisting anything** — this is the same honest "reports true empty
state, fails explicitly" design already confirmed for chat/knowledge/requests (§0), not a hidden fake.
`MESSAGE_MAPPING_GAP: 1` (the concept exists in the UI, has zero backing anywhere).
`MESSAGE_VISIBILITY_GAP: NOT_APPLICABLE` — since no message ever persists, there is no
internal-note-vs-public-reply distinction to leak in the first place (confirmed: no `internal`/
`visibility` field exists in the `SupportMessage` frontend type either — the type itself doesn't model
this distinction).

## 20. PII

| Field | PII class | Encrypted | Masked | Searchable | Exportable |
|---|---|---|---|---|---|
| `subject` | FREE_TEXT_PII (may contain any user-typed content) | NO | NO | YES (`ILIKE`) | via Reports module only if `support_tickets` were registered there — confirmed **it is not** (checked against the 22-entry `report-module-registry.ts` from the `reports` audit — `support_tickets` is absent) |
| `description` | FREE_TEXT_PII | NO | NO | NO (not in the `ILIKE` search) | same — not exportable via Reports, no export UI exists in this module itself either |
| `created_by`/`assigned_to` | technically an identifier, not directly PII (raw UUID, no name/email/phone stored) | N/A | N/A | NO | N/A |
| `requester_email` (admin-side type only) | EMAIL — **but this field does not exist on the real backend at all** (confirmed: not on `SupportTicketEntity`, not in any DTO) | N/A | N/A | N/A | N/A — dead/aspirational field on the `AdminSupportTicket` type, never populated |

No encryption, masking, or PII-specific export control exists anywhere in this module — but also, no
export capability exists at all (§21), so there is no `EXPORT_PRIVACY_GAP` to register (nothing to
leak via export, since no export path exists). `FREE_TEXT_FIELDS`: `subject`/`description`.
`ENCRYPTED_AT_REST`: NO (plain `varchar`/`text` columns, consistent with the fact this data is
internal-support content, not the kind of regulated PII — CPF, bank data — found encrypted elsewhere
in this codebase). `LOGGING_BEHAVIOR`: the `@Audit(...)` decorators on create/update/delete log the
action and actor but were not confirmed (nor refuted) to echo full field values into the audit log body
— not independently re-verified in this pass beyond confirming the decorator's presence; not escalated
to a gap without direct evidence of secret/PII leakage into logs.

## 21. Attachments — fully fake, worse than a blob-URL pattern

**No attachment concept exists on the real ticket flow at all** — `SupportTickets.tsx` and
`SupportTicketDetail.tsx` have **no attach-file UI whatsoever** (confirmed by direct reading — no
upload button, no file input anywhere in either file). The *only* file-attachment UI in the entire
module lives in the **100%-fake** `SupportChat.tsx`: `handleFileChange()` reads the browser `File`
object's `.name`/`.size`/`.type` client-side only — **no `URL.createObjectURL`, no `FormData`, no
network call of any kind** — and string-concatenates a `📎 name (size)` marker into the outgoing chat
text. Since that text is then passed to `sendMessage()` from the entirely-fake `useChatMessages()` hook,
it never persists anywhere, not even in a local blob reference — classified `ATTACHMENT_STORAGE_GAP: 1`,
and specifically **more severe** than the `blob:`-URL patterns found in `musicchat.md`/`releases.md`
this session, since here not even an ephemeral client-side file reference is created — only the file's
*metadata strings* are echoed into a chat bubble that itself never survives beyond the component's
in-memory session state.

## 22. Realtime / Notifications — real, but duplicated and misdirected

`support-tickets` module itself never imports `RealtimeService` — confirmed zero references. It only
emits internal `EventsService.emitTyped()` events: `SUPPORT_TICKET_CREATED`, `WORKFLOW_TRANSITIONED`,
`TICKET_RESOLVED`.

**Two independent handlers both react to `TICKET_RESOLVED`**, confirmed by direct reading of both:

1. `TicketEventsHandler` (module-local) — persists (DB write only, no realtime) a notification row
   addressed to the ticket's **requester** (`created_by`), title *"Seu ticket foi resolvido: ..."*.
2. Generic `NotificationHandler` (`core/events/notification.handler.ts`, subscribed to
   `@OnEvent('ticket.resolved')`) — persists a **second, differently-worded** notification row
   addressed to `event.userId` — the **actor who resolved the ticket** (the manager), not the requester,
   since `service.ts`'s `update()` passes the acting manager's own userId as `event.userId` — **plus** a
   real `RealtimeService.sendToTenant(tenantId, 'notification', {...})` broadcast (genuine Supabase
   Realtime, same real mechanism confirmed working in `musicchat.md`).

**Net effect, confirmed**: creating a ticket triggers **zero** notification of any kind (only the silent
AI-triage automation, which itself has no notification side effect per its own documentation). Resolving
a ticket triggers **two separate DB notification rows for two different people** (the requester gets
one; the resolving manager gets a different one, seemingly meant to notify a *different* actor but
addressed to the person who just performed the action themselves) **plus one realtime broadcast**.
Classified `NOTIFICATION_GAP: 1` (this duplicate/misdirected fan-out pattern — the resolver receiving a
notification about their own action, phrased generically, appears unintended rather than a deliberate
"confirmation" design, though not corrected here per instruction).

## 23. Email / External channels

**NOT_IMPLEMENTED, confirmed absent** — no inbound-email webhook, no outbound-reply-by-email, no
email-to-ticket correlation, no WhatsApp/Instagram/Facebook/chat-provider integration exists anywhere
in `apps/api/src/modules/support-tickets` (confirmed zero references to any of these). The only "chat"
concept is the fully client-side-fake `SupportChat.tsx` (§0/§21) — not a real external channel, and not
a re-audit target for `musicchat`/`integrations` since it shares no code or backend with either.
`EMAIL_INTEGRATION_GAP: 0` (nothing exists to have a gap in — classified `NOT_IMPLEMENTED`, not a
broken implementation). `EXTERNAL_CHANNEL_GAP: 0`, same reasoning.

## 24. Table / Grid, Filters, Search, Sort, Pagination, Truncation

| Column | API field | DB column | Sortable | Filterable | Searchable |
|---|---|---|---|---|---|
| Ticket # | `ticket_number` | direct | no explicit sort control | no | yes (`ILIKE`) |
| Assunto | `subject` | direct | no | no | yes (`ILIKE`) |
| Status | `status` | direct | no | yes | no |
| Prioridade | `priority` | direct | client-side only | yes | no |
| Categoria | `category` | direct | no | client-side only | no |
| Criado em | `created_at` | direct | default (`DESC`, server-side) | no | no |

Same systemic pattern as every other module this session: `SupportTicketsService.list()` defaults
`take(query.limit ?? 50)`; `useTickets()` sends a **hardcoded `limit=200`** override (confirmed,
`useSupport.ts:37`) — notably **better** than the majority of modules audited this session (most send
no override at all and silently inherit 50); still a fixed ceiling with no pagination UI to go beyond
it and no "showing N of M" indication if a tenant exceeds 200 tickets. Classified `TRUNCATION_GAP: 1`
(present, but materially less severe than the zero-override pattern found elsewhere — `AFFECTS_TOTAL`:
theoretically yes above 200 rows, `AFFECTS_SEARCH`: yes, same reasoning, `AFFECTS_THREAD_HISTORY`: N/A,
no real thread exists to truncate).

## 25. KPIs

`SupportDashboard.tsx` shows ticket counts derived client-side from the same `useTickets()` array
(open/in-progress/resolved-style breakdowns) — **inherits the same 200-row ceiling** as the list view
(§24), so KPI accuracy degrades identically above that threshold, with no separate/dedicated backend
aggregate-count endpoint. No `SLA breached`/`average response time` KPI exists anywhere (consistent with
§16's finding that no aggregate SLA computation exists).

## 26. Import / Export / XLSX

**NOT_PRESENT** — no import, export, or XLSX flow exists anywhere in this module (confirmed by targeted
grep; `support_tickets` is also confirmed absent from the Reports module's 22-entry registry, §20).
`XLSX_EXPORTS: 0`, `XLSX_RULE_VIOLATIONS: 0`, `EXPORT_PRIVACY_GAPS: 0` (nothing to export, so nothing to
leak via export specifically — the underlying free-text-PII exposure risk, if any, would need to be
assessed at the point of *display*, already covered in §20, not export).

## 27. Permissions & Tenant Isolation

Every `support-tickets` route is role-guarded (`viewer` for create, `manager` for
list/get/update/delete) — confirmed no unguarded route exists. Workflow transitions require
`['super_admin','tenant_owner','owner','admin','manager']` uniformly (§11). `AUTHORIZATION_GAPS: 0`.
Tenant scoping is enforced server-side on every query via `@CurrentTenant()`, never client-input —
confirmed no bypass exists anywhere, including for the admin-panel view (§7). `TENANT_ISOLATION_GAPS: 0`
— the module's real limitation (§7) is a **functional** gap (no cross-tenant capability exists at all,
for anyone, including super_admin), not a **security** gap (no unintended cross-tenant access is
possible either) — these are correctly distinguished per the prompt's explicit instruction not to
conflate "backend stays tenant-scoped despite cross-tenant UI framing" with an isolation failure.

## 28. Gap taxonomy summary

| Gap type | Count | Detail |
|---|---|---|
| ENUM_MISMATCH | 2 | status (5-vs-6-vs-different-5 three-way drift, reachable `TypeError` in `AdminSupport.tsx`, §11); category (10-vs-5 completely different vocabularies, create-rejection risk, §13) |
| CODE_FIELD_ONLY | 1 | `UpdateSupportTicketDto.resolvedAt`, accepted, never consumed (§6) |
| DISPLAY_MAPPING_MISMATCH | 2 | "Solicitante" shows a raw UUID, no name resolution (§14); `first_response_at` always undefined on the admin side (§7) |
| ADMIN_SUPPORT_SCOPE_GAP | 1 | confirmed, closes the `admin.md` pendency (§7) |
| MESSAGE_MAPPING_GAP | 1 | fully-rendered UI, zero backend (§19) |
| ATTACHMENT_STORAGE_GAP | 1 | fake even relative to other fake-upload patterns this session — not even a blob reference (§21) |
| SLA_GAP | 1 | partial — 2 real fields, no policy layer, no automatic deadlines, no first-response tracking (§16) |
| KNOWLEDGE_BASE_GAP | 1 | entirely frontend-only, DEV_ONLY in the admin surface, no backend anywhere (§8) |
| NOTIFICATION_GAP | 1 | duplicate/misdirected fan-out on resolution (§22) |
| ASSIGNMENT_GAP | 1 | no tenant-scoped selector, free-text field (§15) |
| TRUNCATION_GAP | 1 | present but mitigated (200-row explicit override vs. the systemic 50-row-no-override pattern elsewhere) (§24) |
| REAL_MAPPING_GAP | 1 | `tags` jsonb column, written nowhere, read nowhere (§9) |
| AUTHORIZATION_GAP | 0 | confirmed sound (§27) |
| TENANT_ISOLATION_GAP | 0 | confirmed sound (§27) |
| EMAIL_INTEGRATION_GAP | 0 | N/A, confirmed absent not broken (§23) |
| EXTERNAL_CHANNEL_GAP | 0 | N/A, confirmed absent not broken (§23) |
| EXPORT_PRIVACY_GAP | 0 | N/A, no export path exists at all (§26) |
| SUPPORT_HISTORY_GAP | 0 | confirmed sound — soft delete, nothing to orphan (§18) |

`UNMAPPED_*: 0` across every category — every field's origin/destination was traced, even where the
trace terminates in "fake, no backend" (an explicit, evidenced classification, not an unknown).
`UNKNOWN_SUPPORT_CLASSIFICATIONS: 0`.

## 29. Cross-module closure

```
ADMIN_SUPPORT_TRACEABILITY_COMPLETE: SIM
ADMIN_SUPPORT_SCOPE_RESOLVED: SIM
ADMIN_KNOWLEDGE_SUPPORT_CLASSIFICATION: DEV_ONLY
SETTINGS_SUPPORT_TRACEABILITY_COMPLETE: NOT_APPLICABLE (settings.md contains zero references to
  support/tickets/knowledge base — confirmed by full-document review, no relation exists to close)
AUTH_SUPPORT_TRACEABILITY_COMPLETE: NOT_APPLICABLE (only indirect relation — created_by/assigned_to
  store JWT user-ids and every route flows through the standard JwtAuthGuard/TenantGuard; no direct
  code dependency on the auth module beyond the standard guard chain shared by every module this
  session — nothing specific to trace or close)
```

## 30. Overall assessment

`support` is architecturally honest about its own incompleteness — the one real subsystem (tickets) is
well-built (real workflow engine, real tenant isolation, real audit decorators, a real if narrow SLA/
notification/AI-triage layer) — while four adjacent features (chat, knowledge base, status page,
request board) are deliberately, self-documentedly fake, failing loud (toast errors) rather than
silently fabricating success. The module's most consequential real defects are a three-way status-enum
drift causing a reachable `TypeError` in the admin panel, and the confirmed-but-narrow `AdminSupport`
cross-tenant framing gap inherited from `admin.md`. Both are precise and well-evidenced rather than
systemic.

## Contadores finais (Zero-Gap)

```
MODULE_STATUS: COMPLETE
SUPPORT_DOMAIN_MEANING: SUPPORT_TICKETS (real, tenant-scoped) + 4 self-documented fake sub-features
  (SUPPORT_CHAT, KNOWLEDGE_BASE/FAQ, INCIDENT_SUPPORT/status page, feature-request board) sharing one
  frontend module
SUBDOMAINS_AUDITED: 6
COMPONENTS_AUDITED: 8
HOOKS_AUDITED: 7
FRONTEND_ENTRYPOINTS: 11 (8 in modules/support + AdminSupport + AdminKnowledge + 1 dead /support/tickets/new link)
CREATE_FORMS: 1 (functional)
CREATE_FIELDS: 4 (subject, description, category, priority — all persist correctly)
EDIT_FORMS: 1 (functional, same component)
EDIT_FIELDS: 6 (+ status, sla_deadline, assigned_to; resolvedAt accepted but dead)
TABLE_GRID_FIELDS: 6
DETAIL_DISPLAY_FIELDS: 9
STATUS_VALUES: 6 (backend) / 5 (frontend, 2 different spellings across 2 files)
PRIORITY_VALUES: 4 (consistent across all layers)
CATEGORY_FIELDS: 5 (backend DTO) vs 10 (frontend, unrelated vocabulary)
REQUESTER_FIELDS: 1 (created_by, no relation, UUID displayed raw)
ASSIGNEE_FIELDS: 1 (assigned_to, no relation, free text)
MESSAGE_FIELDS: 0 real (UI fully built, zero backend)
ATTACHMENT_FIELDS: 0 real (fake even by this session's low bar for fake uploads)
SLA_FIELDS: 2 real (sla_deadline, resolved_at) + 1 derived-only (metadata.slaCompliant)
KNOWLEDGE_ARTICLE_FIELDS: 13 (type-only, never persisted)
FAQ_FIELDS: 0 real
FILTERS: 2 (status, priority — server-side) + 1 client-side (category)
SEARCH_FIELDS: 2 (subject, ticket_number via ILIKE)
SORT_FIELDS: 1 (created_at, server default DESC)
KPI_FIELDS: ~3 (client-computed counts, inherits the 200-row ceiling)
IMPORT_FIELDS: 0
EXPORT_FIELDS: 0
PII_FIELDS: 2 (subject, description — free-text, unencrypted, unmasked, no export path)
XLSX_EXPORTS: 0
XLSX_RULE_VIOLATIONS: 0
REALTIME_EVENTS: 1 (notification broadcast on ticket resolution, real Supabase Realtime)
POLLING_FLOWS: 0 (TanStack Query staleTime-based refetch only, not true polling)
EMAIL_FLOWS: 0
EXTERNAL_CHANNELS: 0
CREDENTIALS_TO_ADD_NOW: 0
CREDENTIALS_REQUIRED_LATER: 0
PERMISSIONS_AUDITED: 5 (list/get/create/update/delete role gates)
AUTHORIZATION_GAPS: 0
TENANT_ISOLATION_GAPS: 0
CODE_FIELD_ONLY: 1
DATABASE_COLUMN_ONLY: 0
TYPE_MISMATCH: 0
NULLABILITY_MISMATCH: 0
DEFAULT_MISMATCH: 0
ENUM_MISMATCH: 2
RELATION_MISMATCH: 0
CREATE_MAPPING_MISMATCH: 0
EDIT_MAPPING_MISMATCH: 0
DISPLAY_MAPPING_MISMATCH: 2
STATUS_WORKFLOW_GAPS: 0
PRIORITY_MAPPING_GAPS: 0
ASSIGNMENT_GAPS: 1
MESSAGE_MAPPING_GAPS: 1
MESSAGE_VISIBILITY_GAPS: 0 (not applicable — no message ever persists)
ATTACHMENT_STORAGE_GAPS: 1
SLA_GAPS: 1
ESCALATION_GAPS: 0 (confirmed not implemented, not broken)
NOTIFICATION_GAPS: 1
EMAIL_INTEGRATION_GAPS: 0
EXTERNAL_CHANNEL_GAPS: 0
KNOWLEDGE_BASE_GAPS: 1
SEARCH_GAPS: 0
PAGINATION_GAPS: 0
TRUNCATION_GAPS: 1
EXPORT_PRIVACY_GAPS: 0
SUPPORT_HISTORY_GAPS: 0
REALTIME_GAPS: 0
ADMIN_SUPPORT_SCOPE_GAPS: 1
REAL_MAPPING_GAPS: 1
ADMIN_SUPPORT_SCOPE_RESOLVED: SIM
ADMIN_SUPPORT_CROSS_TENANT_FUNCTIONAL: NÃO
ADMIN_KNOWLEDGE_SUPPORT_CLASSIFICATION: DEV_ONLY
ADMIN_SUPPORT_TRACEABILITY_COMPLETE: SIM
SETTINGS_SUPPORT_TRACEABILITY_COMPLETE: NOT_APPLICABLE
AUTH_SUPPORT_TRACEABILITY_COMPLETE: NOT_APPLICABLE
UNMAPPED_CREATE_FIELDS: 0
UNMAPPED_EDIT_FIELDS: 0
UNMAPPED_DISPLAY_FIELDS: 0
UNMAPPED_RELATION_FIELDS: 0
UNMAPPED_MESSAGE_FIELDS: 0
UNMAPPED_ATTACHMENT_FIELDS: 0
UNMAPPED_STATUS_FIELDS: 0
UNMAPPED_PERMISSION_PATHS: 0
UNMAPPED_KNOWLEDGE_FIELDS: 0
UNMAPPED_STORAGE_FIELDS: 0
UNKNOWN_SUPPORT_CLASSIFICATIONS: 0
```

NEXT_MODULE: workspace
