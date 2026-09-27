# Module `events` — Zero-Gap Audit (Phase 2, Prompt 105)

STATUS: **COMPLETE** — UNMAPPED_*: 0, UNKNOWN_FIELD_CLASSIFICATIONS: 0.

Real scope (following imports/hooks/endpoints, not the `events/` folder):
- Frontend: `apps/web/src/modules/events/**` (`constants/`, `forms/`, `utils/` are empty stubs;
  `services/events.service.ts`/`hooks/events.store.ts` are dead code, see §3). Real route:
  `/agenda` (`apps/web/src/app/routes/operations.routes.tsx:20`).
- Backend: `apps/api/src/modules/events/**` (`EventsController`/`EventsService`, the only real
  backend module for this domain — no separate `agenda`/`booking`/`venues` module exists).
- Table (Phase 1, ground truth): `events` (23 cols, `backendMapping: DIRECT`). No
  `venues`, `event_participants`, `event_attachments`, `reminders` or `recurrence` table exists — all
  of the prompt's investigations (§14 recurrence, §28 reminders, §31 storage, §20 venue as a separate
  entity) result in **NOT_IMPLEMENTED**, confirmed by the total absence of these tables in Phase 1.

---

## 1. Real subdomains identified

| Subdomain | FRONTEND_ENTRYPOINT | ENDPOINTS | BACKEND_CONTROLLER | SERVICE | DATABASE_TABLES |
|---|---|---|---|---|---|
| EVENT | `Agenda.tsx` (calendar/list), `SchedulerFormModal.tsx`, `SchedulerViewModal.tsx` | `GET/POST/PATCH/DELETE /events` | `events.controller.ts` | `events.service.ts` | `events` |
| EVENT_PARTICIPANT | inline in `SchedulerFormModal.tsx`/`SchedulerViewModal.tsx`, via `useScheduleParticipants()` | embedded in `POST/PATCH /events` (field `participantes`) | `events.controller.ts` | `EventsService.dtoToEntity()` | `events.participantes` (jsonb) |
| VENUE/LOCATION (free text, not an entity of its own) | `SchedulerFormModal.tsx` ("Campos de Local" (Location fields) section) | same | same | same | `events.local`, `.contato_local`, `.endereco` |
| BOOKING_CRM (venue via CRM) | `SchedulerFormModal.tsx` (`shouldUseCRMLocal`, show/tv/radio/podcast types) | `GET /clients` (via `useClientes()`) | `clients.controller.ts` (already audited in `crm-relationships.md`) | — | `clients` (read, one-off copy of the data on submit) |

4 real subdomains. `RECURRENCE`, `REMINDER`, `EVENT_FINANCIAL` (automatic propagation),
`ATTACHMENT`, `CALENDAR_EXTERNAL_INTEGRATION` — all **NOT_IMPLEMENTED** (no field, table,
endpoint or code found — see the corresponding sections below).

---

## 2. `Auditoria.tsx` — CROSS_MODULE_AUDITORIA_TSX (events excerpt)

Real tool (the same as in `dashboard.md` etc.): the "Agenda" tab (`module: "eventos"`) in
`apps/web/src/modules/admin/pages/Auditoria.tsx`. It runs on `runner.ts:144-156`.

`AUDITORIA_EVENT_FIELDS`:

| Field | Severity |
|---|---|
| `titulo` | `obrigatorio` |
| `data_inicio` | `obrigatorio` |
| `local` | `recomendado` |
| `artista_id` | `recomendado` |

`AUDITORIA_EVENT_RULES`: the same generic engine (`hasValue()`) already documented in the other modules.
`fix_path`: `/agenda?edit=<id>`.

`AUDITORIA_EVENT_DATABASE_SOURCES`: `storage.list("eventos")` → `GET /events` — the same real
endpoint used by the rest of the module, the raw response of `EventsService.list()` (physical columns:
`titulo, tipo, data, starts_at, data_fim, local, ...` — **not** `data_inicio`).

`AUDITORIA_EVENT_GAPS` (2, both confirmed by reading the code, tied to Gap #1 below):

1. **Required field always "missing"**: the runner checks `row.data_inicio`, but the real
   response of `GET /events` never has that key (the physical column is `data`/`starts_at`) — `hasValue()`
   is always `false` for that field, so **100% of events appear as incomplete** in the
   Audit, even when they have a real, valid start date written in `data`.
2. **Deep link with no handler**: `fix_path` points to `/agenda?edit=<id>`, but `Agenda.tsx` does not
   implement any `useSearchParams`/`useEditQueryParam` (confirmed by a full reading of the
   file, 479 lines) — unlike `Contratos.tsx` (`contracts.md` §2, which handles `?edit=`
   correctly). Clicking "Preencher" (Fill in)/"Abrir" (Open) for an incomplete event only opens the normal Agenda,
   with no modal pre-opened.

`AUDITORIA_TSX_EVENTS_SECTION_COMPLETE: SIM` (yes).

---

## 3. Components (complete classification)

| Component | Classification | Note |
|---|---|---|
| `SchedulerFormModal.tsx` | CREATE_MODAL + EDIT_MODAL | real, 808 lines, the only create/edit form; create/edit mapping **correct and well documented** (see §5) |
| `SchedulerViewModal.tsx` | DETAIL_MODAL | real, but mostly reads fields with names that do not exist in the real API response — see Gap #1 |
| `Agenda.tsx` | CALENDAR + TABLE(via `EntityCalendarView`) + FILTER + SEARCH + IMPORT + EXPORT | real, the module's only page, 479 lines |
| `EntityCalendarView` (shared, not from this module) | CALENDAR | shared component — only the data integration (`calendarEvents`) was audited here, not the component itself |
| `events.store.ts` (hooks/ and store/, same file) | DEAD | Zustand store, zero consumers outside its own file (same pattern already seen in `catalog.md`/`crm-relationships.md`) |
| `services/events.service.ts` (`eventService`) | DEAD | an alternative service object (`list/findById/create/update/delete/listByStatus` via `storage`), **zero consumers** — the real page uses `useEventos()` directly |
| `constants/index.ts`, `forms/index.ts`, `utils/index.ts` | STATIC (stub) | comment only, no real content |

---

## 4. Hooks

| HOOK | FILE | ENDPOINTS | READ/WRITE | RELATIONS | REALTIME | TENANT_DEP |
|---|---|---|---|---|---|---|
| `useEventos` | `hooks/useEventos.ts` | `GET/POST/PATCH/DELETE /events` (via `useDataQuery`/`storage`) | see §5/§9 | `select: "*, artistas(*)"` — **dead**, `EventsService` never joins/maps `artistas` (confirmed by a full reading of the service — the same dead pattern already seen in `catalog.md`, unlike the real pattern confirmed in `contracts.md`) | no | implicit |
| `useScheduleParticipants` | `hooks/useScheduleParticipants.ts` | none of its own — aggregates `useArtistas()`, `useFuncionarios()` (`rh`, not audited), `useUsuarios()` (`settings`, not audited), `useContacts()` (`crm-relationships`, already audited) | builds a unified list `{source, id, label, email, phone, category}` for the participant selector | 4 cross-module sources | no | implicit (inherited from each hook) |

No active hook was left unclassified. The `orderBy: {column: "data_inicio"}` passed by
`useEventos()`/`eventService.list()` is **inert** — `EventsService.list()` (backend) ignores
any `orderBy` it receives and always sorts by `e.data` (hardcoded, `events.service.ts:32`).

---

## 5. CREATE/EDIT Event — `SchedulerFormModal.tsx` (real mapping, mostly correct)

The code itself documents the rule it follows (lines 418-429):
"Backend NestJS ValidationPipe roda com whitelist + forbidNonWhitelisted... Regra de produto 2026-07-12: cada campo do formulário tem coluna própria no DTO/entity"
(the NestJS backend runs ValidationPipe with whitelist + forbidNonWhitelisted; product rule
2026-07-12: every form field has its own column in the DTO/entity). `buildPayload()` produces
exactly the fields accepted by `CreateEventDto`/`UpdateEventDto`.

| FORM_FIELD | TYPE | REQUIRED | API_REQUEST_FIELD | DATABASE_COLUMN | PERSISTED | Note |
|---|---|---|---|---|---|---|
| `titulo` | string | yes | `title` | `events.titulo` | yes | |
| `tipoEvento` (10 pt-BR options) | select | yes | `type` (via `mapTipoToBackendType()`, explicit 17→7 map) | `events.tipo` | yes | 4 of the frontend's 10 categories (`sessoes_estudio`, `ensaios`, `sessoes_fotos`, `producao_conteudo`) have no entry in the map and fall to the default `"other"` — a deliberate/accepted loss of granularity, not a mapping error (see Gap #2) |
| `participantes[]` (via `useScheduleParticipants`, sources artist/employee/user/contact) | RELATION_SELECTOR (multi) | no | `participantes` | `events.participantes` (jsonb) | yes | the first participant with `source==="artist"` also becomes `artistId` |
| `status` (edit only) | select (5 pt-BR options) | no | `status` (via `mapStatusToBackend()`, explicit map) | `events.status` | yes | |
| `dataInicio` + `horarioInicio` | date + time (combined) | `dataInicio` yes, `horarioInicio` no | `startsAt` (combined ISO via `combineDateAndTime()`) | `events.data` **and** `events.starts_at` (deliberate dual-write, see §11) | yes | `horarioInicio` is only a convenience input — never a column of its own, always recombined before sending |
| `dataFim` + `horarioFim` | date + time (combined) | no | `endsAt` (combined ISO) | `events.data_fim` | yes | same |
| `nomeLocal` | string OR Select (CRM) depending on type | no | `venue` | `events.local` | yes | see Gap #4 (dual semantics of the column) |
| `contatoLocal` | string | no | `contato_local` | `events.contato_local` | yes | auto-filled from the CRM when `shouldUseCRMLocal` |
| `endereco` | string | no | `endereco` | `events.endereco` | yes | same |
| `capacidadePublico` ("shows" type only) | number | no | `capacity` | **none** | **NO** | see Gap #3 — the DTO accepts it, `dtoToEntity()` never maps it |
| `valorCache` ("shows" type only) | number | no | `valor_cache` | `events.valor_cache` | yes | |
| `publicoEsperado` ("shows" type only) | number | no | `publico_esperado` | `events.publico_esperado` | yes | |
| `descricao` | textarea | no | `descricao` | `events.descricao` | yes | |
| `observacoes` | textarea | no | `observacoes` | `events.observacoes` | yes | |

`CreateEventDto` fields never sent by this form: `city`, `country` (accepted by the DTO,
with no corresponding physical column — `CODE_FIELD_ONLY` in the backend, never exercised by the real
frontend). `metadata` is also never sent by this form (no formal field falls into a generic jsonb,
consistent with the "regra de produto 2026-07-12" (product rule 2026-07-12)).

CREATE_FIELDS (actually persisted): 12 record-level fields (`titulo`, `tipo`, `participantes`,
derived `artista_id`, `data`/`starts_at`, `data_fim`, `local`, `contato_local`, `endereco`, `valor_cache`,
`publico_esperado`, `descricao`, `observacoes` = 13 populatable physical columns) + `status` only on edit.

---

## 6. EDIT — Create ≠ Edit (confirmed)

The same component (`mode: "create"|"edit"|"view"`), but `buildPayload(data, forUpdate)` only includes
`status` when `forUpdate=true` — `status` is `IMMUTABLE_AFTER_CREATE` in the sense that the create
DTO (`CreateEventDto`) does not even declare that field (it only exists in `UpdateEventDto`); every
event is implicitly born without an explicit `status` in the payload (the `status` column is `NOT NULL` —
since there is no visible default in the DTO or in the service, a database-level `DEFAULT` is presumed, not
verified here since it is outside the change scope). `READ_SOURCE` to populate the edit
form: `getInitialFormData()` uses a robust fallback chain
(`evento?.dataInicio || evento?.data_inicio || evento?.data || evento?.startsAt`) that **already
correctly anticipates** the real API response (it falls through to `evento?.data`) — unlike
`SchedulerViewModal.tsx`/`Agenda.tsx`, which lack this robustness (see Gap #1). `DATABASE_MAPPING`:
identical to create for all fields.

---

## 7. Details — `SchedulerViewModal.tsx` (CRITICAL GAP, see Gap #1)

| DISPLAY_LABEL | DISPLAY_FIELD (read) | Real API_FIELD | Status |
|---|---|---|---|
| Type badge | `evento.tipo_evento` | `tipo` | **always empty/blank** — no fallback |
| "Data Início" (Start date) | `evento.data_inicio` | `data`/`starts_at` | **always "—"** — no fallback |
| "Horário Início" (Start time) | `evento.horario_inicio` | does not exist as a column of its own | **always "—"** — structurally impossible with the current schema |
| "Data Fim" (End date) | `evento.data_fim` | `data_fim` | **correct** (the names match) |
| "Horário Fim" (End time) | `evento.horario_fim` | does not exist | **always "—"** |
| "Local" (Venue) | `evento.local` | `local` | **correct** |
| "Endereço" (Address) | `[evento.endereco, evento.cidade, evento.uf]` | `endereco` (only the 1st part exists) | partially correct — shows only `endereco`, `cidade`/`uf` always absent |
| "Cachê" (Fee) | `evento.valor_cache` | `valor_cache` | **correct** |
| "Capacidade" (Capacity) | `evento.capacidade_publico` | does not exist (neither as a name nor as a column — see Gap #3) | **always hidden** (the section disappears, since the condition `capacidade_publico != null` is never satisfied) |
| "Público Esperado" (Expected audience) | `evento.publico_esperado` | `publico_esperado` | **correct** |
| "Contato — Responsável" (Contact — Responsible person) | `evento.contato_local` | `contato_local` | **correct** |
| "Contato — Telefone/E-mail" (Contact — Phone/Email) | `evento.contato_telefone`/`.contato_email` | do not exist (never declared in the DTO/DB) | **always hidden** — entirely fictitious fields |
| "tipo_local" badge | `evento.tipo_local` | does not exist | **always hidden** — fictitious field |
| "Checklist" | `evento.checklist` | does not exist | **always hidden** — entirely fictitious functionality, with no corresponding DTO/column/edit UI anywhere in the module |
| "Artista" (Artist) section (fallback) | `evento.artistas` | always `undefined` (dead join, §4) | the section never renders via this path — it only works via `participantes[]`/metadata, which is the real path |

`EMPTY_STATE`: `Field()` shows "—" for any empty value — this **masks** Gap #1: the
user sees "—" in Start date/Time/Type and may interpret it as "not filled in", when in
fact the data exists in the database but the component is reading the wrong field name.

---

## 8. Calendar / Agenda (§10 of the prompt) — CRITICAL GAP CONFIRMED

`CALENDAR_COMPONENT`: `EntityCalendarView` (shared), fed by `calendarEvents` derived from
`schedulerEvents`, derived from `filteredEventos` (`Agenda.tsx`).

```
EVENT_SOURCE:        eventos (useEventos(), GET /events)
DATE_START_FIELD (read by the frontend):  evento.data_inicio   → ALWAYS undefined
DATE_END_FIELD (read by the frontend):    evento.data_fim      → correct (the names match)
ALL_DAY_FIELD:        derived — allDay: !evento.horario_inicio → ALWAYS true (horario_inicio
                       never exists), so EVERY event is treated as all-day by the calendar
TITLE_FIELD:           evento.titulo → correct
STATUS_FIELD:          evento.status → correct
RESOURCE_RELATIONS:    summarizeScheduleParticipants(getEventoParticipants(evento)) — via
                       evento.metadata.participants (always empty, since the real participants go
                       to events.participantes, not events.metadata.participants — see Gap #5)
                       with a fallback to evento.artista_id (this one real and functional)
```

Construction of `start`/`end` in `schedulerEvents` (`Agenda.tsx:252-254`):
```js
const start = evento.data_inicio ? new Date(`${evento.data_inicio}T${evento.horario_inicio ?? "00:00"}:00`) : new Date();
```
Since `evento.data_inicio` is **always `undefined`** in the real API response, the ternary condition
**always falls to the `else`**: `start = new Date()` — **every event rendered in the calendar uses the
instant at which the page was loaded as its start date/time**, regardless of the real date
written in the database. `end` follows the same pattern (`evento.data_fim ? ... : undefined` — this specific
case *works*, since `data_fim` is a correct field name).

`FRONTEND_EVENT_FIELD → API_FIELD → DATABASE_FIELD` for the calendar's 3 central fields:
- title: `title` → `titulo` → `events.titulo` — **correct**.
- date: `startDate` → `evento.data_inicio` (nonexistent) → **never reaches the real column** `data`/`starts_at` — **GAP**.
- time: `time` → `evento.horario_inicio` (nonexistent) → **GAP**, always forces `allDay: true`.

---

## 9. Dates and Times / Timezone (§11/§12 of the prompt)

| UI_FIELD | API_FIELD | DATABASE_COLUMN | DATABASE_TYPE | REQUIRED |
|---|---|---|---|---|
| Start date + time | `startsAt` | `data` **and** `starts_at` (dual-write) | `timestamp without time zone` (both) | yes (`data` is `NOT NULL`; if `startsAt` is absent on create, the service uses `new Date()` as a fallback — `events.service.ts:84-91`) |
| End date + time | `endsAt` | `data_fim` | `timestamp without time zone` | no |

`TIMEZONE — mandatory audit (§12)`: the columns are `timestamp **without** time zone` — Postgres
neither stores nor converts time zones in them; the value written is exactly what arrives in the
`Date` serialized by the frontend (`combineDateAndTime()` uses `new Date(...).toISOString()`, which
serializes in UTC) — there is no explicit time-zone conversion layer for the event (e.g. the show venue's
time zone vs. the time zone of the user registering it) in any layer (frontend or backend). Confirmed:
`SOURCE_TIMEZONE` = the local time zone of the browser of whoever fills in the form (`new Date(date); dt.setHours(h,m,0,0)` operates in the browser's local time); `CONVERSION_LAYER` = `.toISOString()` (browser→UTC)
before sending; `STORAGE_TIMEZONE` = implicit UTC (but the column has no tz, so it is only a convention,
not a Postgres guarantee); `DISPLAY_TIMEZONE` = any read back (`formatDate()`) uses the
local time zone of the viewer's browser. For an event with participants/viewers in time zones
different from that of the person who registered it, the displayed time may diverge from the intended real time — **this is not
an active bug today** (presumed single-region system), but it is a real design gap, recorded
as an informational `TIMEZONE_GAP` (no evidence of an incorrect time-zone shift observed, since it
was not possible to test with real data).

---

## 10. All-day events (§13 of the prompt)

There is no real `all_day`/`dia_inteiro` field in the schema. The frontend **infers** all-day from
the absence of `horario_inicio` (`Agenda.tsx:266`, `allDay: !evento.horario_inicio`) — as
demonstrated in Gap #1, `evento.horario_inicio` is always `undefined` in the real API response,
so **every event is treated as all-day by `EntityCalendarView`**, even events created
with a specific time (the time exists inside the `data`/`starts_at` timestamp, it is just not
exposed under the name the frontend is looking for). `ALL_DAY_FIELD: DERIVED (incorrectly,
a side effect of Gap #1)`. `DATABASE_REPRESENTATION`: none — there is no real distinction between
"all day" and "with a time" in the `events` table.

---

## 11. Recurrence (§14 of the prompt)

`RECURRENCE_ENABLED: NÃO` (no). No field (`frequency`, `interval`, `by_day`, `until`, `count`,
`parent_event_id` etc.) exists in `events` (Phase 1: 23 columns, none of them related to
recurrence), in `CreateEventDto`/`UpdateEventDto`, or in any frontend component
(`SchedulerFormModal.tsx` has no repeat field/checkbox). Classification:
**NOT_IMPLEMENTED** — it is neither a partial feature nor "UI-only", it is absent in every layer.

---

## 12. Status / Workflow (§15 of the prompt)

| STATUS_VALUE (backend, DTO) | STATUS_VALUE (frontend, form) | FRONTEND_LABEL |
|---|---|---|
| `scheduled` | `agendado`, `pendente` (both map to `scheduled` — see `mapStatusToBackend`) | "Agendado" / "Pendente" (Scheduled / Pending) |
| `confirmed` | `confirmado` | "Confirmado" (Confirmed) |
| `cancelled` | `cancelado` | "Cancelado" (Cancelled) |
| `completed` | `concluido`, `realizado` | "Concluído" / "Realizado" (Completed / Held) |
| `postponed` | `adiado`, `postponed` | (no pt-BR label in the form — used only internally) |

**There is no real workflow** (no `WorkflowDefinition`/`WorkflowService` for `events`,
unlike `contracts.workflow.ts` already confirmed in `contracts.md`) — `status` is a free field
validated only by `@IsIn(STATUSES)` in the backend, with no transition rules, no guard, no
automatic side effects beyond the generic activity log (`EventsController`'s `@Audit(...)`).
Any status transition is allowed at any time by whoever has `event:update`.
`ALLOWED_TRANSITIONS: all (unrestricted)`. `SIDE_EFFECTS: none` (no `@OnEvent` handler
for `event.*` domain events was found in `apps/api/src` — confirmed by an exhaustive
search).

---

## 13. Event Type (§16 of the prompt)

| TYPE_VALUE (backend enum) | pt-BR frontend values mapped to it |
|---|---|
| `show` | `shows`, `show`, `show_teatro`, `rodeio`, `lancamento` |
| `festival` | `festival` |
| `recording` | `gravacao`, `gravacoes`, `recording` |
| `meeting` | `reuniao`, `reunioes`, `meeting` |
| `interview` | `entrevista`, `entrevistas`, `interview`, `programas_tv`, `radio`, `podcasts` |
| `tour` | `tour`, `turne` |
| `other` | `evento_corporativo` + **any unmapped value** (includes `sessoes_estudio`, `ensaios`, `sessoes_fotos`, `producao_conteudo` — 4 of the form's 10 categories, which fall to the default for lack of an explicit entry in the map) |

`FORM_VARIATION`: `isArtistaRelated`/`showLocalFields`/`isShow`/`shouldUseCRMLocal` (all
computed on `formData.tipoEvento`, the **original pt-BR** value, before mapping to the
English enum) control which form sections appear — 4 distinct visual categories
(location fields, show-only fields, use of the CRM for the location). `FILTER_USAGE`: the
type filter in `Agenda.tsx` (`typeFilter`) compares against `evento.tipo_evento` (Gap #1 — always
`undefined`), so **the type filter in the Agenda never returns results when a specific
type is selected** (every comparison `undefined === "shows"` etc. is `false`) — another
concrete effect of Gap #1, recorded separately because it directly affects an interactive
UI control.

Note: `Agenda.tsx`/`SchedulerFormModal.tsx` also query `useOperationalSettings().
getOptionsByKind("event_type")` (`settings` module, not audited) for a list of types
potentially **customizable per tenant**, falling back to the hardcoded list of 10 values —
if a tenant customizes types via this operational configuration, the new slugs created
would probably also fall to `"other"` in the backend (the same `mapTipoToBackendType()` mechanism,
which does not know custom types) — recorded as an extension of the same behavior, not
verified in depth since it depends on the `settings` module (out of scope).

---

## 14. Participants (§17 of the prompt)

| PARTICIPANT_TYPE | SOURCE_ENTITY | DISPLAY_FIELD | DATABASE_FK_OR_JOIN | CARDINALITY | OPTIONAL |
|---|---|---|---|---|---|
| `artist` | `artists` (via `useArtistas()`, already audited in `artist.md`) | `nome_artistico`/`nome`/`name` | no FK — the id is copied into the `events.participantes` jsonb; the **first** artist participant also writes `events.artista_id` (a loose FK, no constraint declared) | N:N (event↔participants) / N:1 (event↔main artist) | yes |
| `employee` | `funcionarios` (`rh` module, not audited) | `nome`/`nome_completo`/`full_name`/`email` | same (jsonb only) | N:N | yes |
| `user` | `usuarios` (`settings` module, not audited) | `full_name`/`nome`/`email` | same | N:N | yes |
| `contact` | `clients` (via `useContacts()`, `crm-relationships`, already audited — "Contato = Cliente") | `name`/`nome`/`companyName`/`email` | same | N:N | yes |

All 4 participant types are stored **exclusively** inside
`events.participantes` (jsonb, an array of `{source, id, label, email, phone, category}` — a
denormalized copy of the data at the moment of selection, not a live reference) — **without** any real FK,
without a join table. Per-participant `ROLE`/`STATUS`: they do not exist (the structure only stores
identity + source category, neither the role in the event nor attendance confirmation).

`ATTENTION — Gap #5 (read)`: `Agenda.tsx`/`SchedulerViewModal.tsx` read participants via
`evento.metadata.participants` (`meta["participants"]`), **not** via `evento.participantes` (the
real physical column where `SchedulerFormModal` actually writes, per `dtoToEntity()`) — yet
another instance of the same diverging-names pattern as Gap #1, this time affecting the display of
participants: since `events.metadata` is always `{}` (never written by this form —
`buildPayload()` never includes `metadata`), the read via `meta["participants"]` is **always empty**,
and the UI falls back to the single-artist fallback (`getArtistParticipantById(evento.artista_id)`) — which
works, but shows **only the first artist**, losing the other participants
(employee/user/contact or multiple artists) that were in fact saved in `events.participantes`.

---

## 15. Artist ↔ Event (§18 of the prompt — `artist` already completed, not reopened)

```
EVENT_FIELD:      events.artista_id (loose FK, no constraint declared — Phase 1: foreign_key=false)
ARTIST_ENDPOINT:  GET /artists (via useArtistas(), consumed by useScheduleParticipants())
DATABASE_RELATION: events.artista_id → artists.id (FK semantics, not enforced in the schema)
CARDINALITY:      N:1 (an event has at most 1 "main artist"; multiple artists only via
                   events.participantes, without an FK)
CREATE_FLOW:      first participant with source="artist" selected in
                   SchedulerFormModal → artistId in the payload → events.artista_id
EDIT_FLOW:        identical to create
DISPLAY_FLOW:     evento.artistas (dead join, always undefined, §4) OR
                   evento.metadata.participants (always empty, Gap #5) OR
                   the real fallback: getArtistParticipantById(evento.artista_id) — this is the only
                   display path that actually works today
```

`ARTIST_EVENT_TRACEABILITY_COMPLETE: SIM` (yes) (the relation is traceable and deterministic, even with the
display gaps already documented above — the `artista_id` column itself is written and read
correctly via the fallback path).

---

## 16. CRM ↔ Event (§19 of the prompt — `crm-relationships` already completed, not reopened)

```
EVENT_FIELD:      nomeLocal (when shouldUseCRMLocal=true, types shows/programas_tv/radio/podcasts)
CRM_RESOURCE:     clients (Contato = Cliente, filtered to tipo_pessoa="pessoa_juridica" —
                   apps/web/src/modules/events/components/SchedulerFormModal.tsx:213)
DATABASE_RELATION: no FK — the client id is written as a STRING inside the free-text column
                   events.local (see Gap #4); contato_local/endereco receive a one-off copy
                   of clients.telefone/.endereco/.cidade/.estado at the moment of selection
PURPOSE:          allow reusing a CRM company (PJ) contact (e.g. a concert venue already registered as a
                   client) as the event's "local" (venue), avoiding retyping
```

`CRM_EVENT_TRACEABILITY_COMPLETE: SIM` (yes).

---

## 17. Venue / Location (§20/§21/§22 of the prompt)

Venue **is not a separate entity** — it is free text in 3 columns of `events`
(`local`, `contato_local`, `endereco`) or (alternatively, see §16) a `clients` ID embedded
as a string in `local`. `VENUE_NAME`: `local`. `ADDRESS`: `endereco` (a single combined field, with no
`logradouro`/`numero`/`bairro`/`cep` sub-fields like the `clients` schema has). `CITY`/`STATE`/
`COUNTRY`/`POSTAL_CODE`/`LATITUDE`/`LONGITUDE`/`MAP_LINK`/`ROOM_STAGE`/`CAPACITY`: **none of these
fields exists** in the `events` table — confirmed absent in Phase 1. `NORMALIZATION`: none
(free text, no mask/format validation). `DISPLAY_SOURCE`: `SchedulerViewModal` tries to
display `cidade`/`uf` (Gap #1, nonexistent fields) — in practice only `endereco` (a single free text)
is actually displayed. `MAPS/GEOLOCATION (§22)`: no integration found — `EXTERNAL_CALENDAR_
INTEGRATIONS: 0`, `MAPS_INTEGRATIONS: 0` (no call to Google Maps/geocoding in any
layer).

---

## 18. Booking (§23 of the prompt)

There is no "booking" flow with request/approval states distinct from the standard event
CRUD — creating an event of the "shows" type already is, in practice, the booking mechanism (with no
"request" step separate from "confirmation" beyond the generic `status` machine of §12). There is no
`REQUESTER` distinct from the event's creator (`created_by`), there is no `APPROVAL` (no
"approve event" permission found). `CONTRACT_RELATION`: no FK between `events` and `contracts` was
found — see §19 below.

---

## 19. Contracts ↔ Event (§24 of the prompt — `contracts` already completed, not reopened)

**No real relation between `events` and `contracts` was found** in any layer — no
`contract_id`/`contrato_id` field in `events` (Phase 1 confirms its absence), no `event_id` in
`contracts` (Phase 1 of `contracts.md` confirms 25 columns, none referencing events), no
service code linking the two entities. `CONTRACT_EVENT_TRACEABILITY_COMPLETE:
SIM` (yes) (the result of the investigation is deterministic: the relation simply **does not exist** today,
even though the original investigative prompt of `contracts.md` mentions shows/events as a possible
contract context — no real column or code implements this link).

---

## 20. Financial ↔ Event (§25/§26 of the prompt — `accounting` already completed, not reopened)

`events.valor_cache` (the show fee) and `events.publico_esperado` are the only fields of a
financial/operational nature in the table. **There is no automatic propagation to
`transactions`** — an exhaustive search for `@OnEvent` reacting to `event.*` domain events
(the equivalent of `ContractEventsHandler.onContractSigned()` documented in `contracts.md`) found
no handler. Classification: **NOT_IMPLEMENTED** (neither manual via a dedicated UI, nor
automatic) — there is also no button/flow in `SchedulerFormModal`/`SchedulerViewModal`
to "record fee as a transaction" or similar. `Dashboard.tsx` (already audited in `dashboard.md`)
uses `evento.valor_cache` only for a dead cross-domain metric (`artistasMetrics.
receitaTotal`, never displayed) — it is not a real financial integration, it is a client-side calculation already
documented in the previous module. `BUDGET (§26)`: there is no concept of an estimated-vs-actual
budget — only a single value (`valor_cache`), with no "estimated" field separate from
"actual", and no balance calculation.

---

## 21. Tasks / Projects (§27 of the prompt)

No relation between `events` and `projects`/tasks was found — no `projeto_id`/`project_id`
in `events` (Phase 1 confirms its absence), no `event_id` in any known task table.
`PURPOSE`: N/A — nonexistent relation.

---

## 22. Reminders / Notifications (§28/§29 of the prompt)

`REMINDER_TIME`/`REMINDER_TYPE`/`RECIPIENT`/`CHANNEL`: no reminder field, table or service
found for events. Classification: **NOT_IMPLEMENTED**. `NOTIFICATIONS`: the only
related mechanism is the generic activity log (`@Audit('event.created'|'event.updated'|
'event.deleted')`, written to `activity_logs` via the same `AuditInterceptor` already seen in the other
modules) — it is not a notification addressed to a user, it is an audit record consumed
by the Dashboard's Activity Feed (already documented in `dashboard.md`, which in turn already documented the
realtime gap — not repeated here).

---

## 23. Realtime (§30 of the prompt)

No `useWsEvent()` subscription was found in any file of the `events` module
(`Agenda.tsx`, `SchedulerFormModal.tsx`, `SchedulerViewModal.tsx` — confirmed by exhaustive grep).
`REALTIME_EVENTS: 0` in this module specifically — the Dashboard (an already-audited module) is what
subscribes to `artist.created`/etc. cross-domain, but no equivalent event for `event.*`
exists even there. Consistent with `dashboard.md`: even if a subscription existed, it is already
confirmed that there is no real backend→Supabase Realtime bridge for any domain.

---

## 24. Storage / Attachments (§31 of the prompt)

**There is no attachment field, table or endpoint for events** — no column such as
`attachments`/`arquivo_url` in `events` (Phase 1 confirms its absence, unlike `contracts.
arquivo_url` or `clients.attachments`/`client_attachments`), no upload section in
`SchedulerFormModal.tsx`. Classification: **NOT_IMPLEMENTED** (not even a fake/local version
like the one in `catalog.md`/`crm-relationships.md` — the functionality simply does not exist in the UI).

---

## 25. Import / Export / XLSX (§32-§34 of the prompt)

**Real import** (`Agenda.tsx:192-239`, `handleExcelImport`): reads an XLSX file
(`XLSX.read`→`sheet_to_json`), iterates over rows, and for each one with a `titulo` present calls
`addEvento.mutateAsync({...})` **using pt-BR "display" field names**
(`tipo_evento`, `data_inicio`, `data_fim`, `horario_inicio`, `horario_fim`, `local`, `cidade`,
`estado`, `valor_cache`, `capacidade`, `descricao`, `observacoes`) — **the same names already
confirmed incorrect in Gap #1**, and different from the names that `SchedulerFormModal.buildPayload()`
uses (`title`/`type`/`startsAt`/`venue`/`capacity`). Since this payload goes straight to
`addEvento.mutateAsync()` → `storage.create("eventos", payload)` → `POST /events`, and
`CreateEventDto` is subject to a global `ValidationPipe({whitelist:true, forbidNonWhitelisted:true})` (the same
pattern confirmed in all the previous modules): **none of these import fields is recognized
by the DTO** (`tipo_evento`, `data_inicio`, `horario_inicio`, `horario_fim`, `cidade`, `estado`,
`capacidade` do not exist in the DTO; nor do `local`/`valor_cache`/`descricao`/`observacoes` — the
DTO uses `venue`/`valor_cache`(this one does exist)/`descricao`(exists)/`observacoes`(exists), but
`local` should be `venue`) — in practice, **every import row would have most of its fields
rejected with HTTP 400** (only `titulo` would survive, since there is no dual `title`/`titulo` alias in the
create DTO — in fact not even `titulo` is accepted, only `title`! The import uses the key `titulo` in the
object, which does not match `CreateEventDto.title` either). Confirmed: **the events XLSX import
is structurally broken** — every import attempt would result in a 400 error for
essentially every row, since none of the keys of the object built in `handleExcelImport`
corresponds to the keys accepted by `CreateEventDto`.

**Real export** (`Agenda.tsx:159-190`, `handleExcelExport`): generates an XLSX with the columns
`titulo, tipo_evento, status, participantes, data_inicio, horario_inicio, data_fim, horario_fim, local, cidade, estado, valor_cache, valor_ingresso, capacidade, descricao, observacoes`
— read
directly from the `eventos` array (the same raw API response, with the same incorrect field
names as Gap #1) — **most of the exported columns would come out empty** (`tipo_evento`,
`data_inicio`, `horario_inicio`, `horario_fim`, `cidade`, `estado`, `valor_ingresso`, `capacidade`
— all always `undefined`/`""` in the source object), except `titulo`, `status`, `participantes`
(via `summarizeScheduleParticipants`, functional), `data_fim`, `local`, `valor_cache`, `descricao`,
`observacoes` (these with correct names). `XLSX`: `WORKSHEET_COUNT = 1` ("Agenda"),
`XLSX_RULE_VIOLATION: NÃO` (no) — the rule of at most 2 sheets is respected in both the export and the
import (single sheet in both), even though the content is incorrect.

`IMPORT + ENCRYPTION (§32 of the prompt)`: does not apply — no `events` field is encrypted
(no sensitive PII in this module: `contato_local` is a free-text field, not a
`*_encrypted` column as in `clients`).

---

## 26. Event Duplicates (§41 of the prompt)

No deduplication rule (by title+date, artist+date, venue+date, external ID) was
found in any layer — `DATABASE_UNIQUE: NÃO` (no) (no `UNIQUE` constraint in Phase 1 for
`events`), `BACKEND_VALIDATION: NÃO` (no) (`EventsService.create()` never queries existing events
before inserting), `FRONTEND_VALIDATION: NÃO` (no), `IMPORT_VALIDATION: NÃO` (no) (the import loop processes
each row independently, with no cross-row or database check).

---

## 27. Tables/Lists/Cards, Filters, Search, Sort, Pagination (§35-§40 of the prompt)

**Calendar/list** (`EntityCalendarView`, fed by `calendarEvents`): fields displayed per
rendered event = `title` (correct), `dateISO` (Gap #1 — always "today"), `time` (Gap #1 —
always null/allDay), `toneClass` (derived from `status`, correct), `hint` (`título · participantes`,
partially correct — participants suffer from Gap #5).

**FILTERS** (`Agenda.tsx`): 3 — free search (`searchTerm`), `typeFilter` (Gap #1 — never
finds a result when it is not "Todos Tipos" (All Types), since it compares against the nonexistent
`evento.tipo_evento`), `statusFilter` (**functional** — compares `evento.status`, the correct name). `DATABASE_
FIELD_OR_EXPRESSION`: all client-side, over the already-loaded array (the same pattern as the other
modules — no filter becomes a real HTTP query param, even though `QueryEventDto` accepts
`status`/`type`/`artistId` in the backend).

**SEARCH**: `evento.titulo` (correct) + `evento.local` (correct) +
`summarizeScheduleParticipants(...)` (partial, Gap #5) — case-insensitive `.includes()`, 100%
client-side.

**SORT**: no interactive sorting control in the UI (`Agenda.tsx` has no `SortableTableHead`
or equivalent) — the only sorting is the calendar's implicit one (by date) and the backend's
(`ORDER BY e.data DESC`, hardcoded, already cited in §4).

**PAGINATION**: no UI pagination — `Agenda.tsx` loads and renders the whole of `filteredEventos`
in the calendar (no `usePagination`/`TablePagination`). `TOTAL_COUNT_SOURCE`:
`eventos.length` (an array already limited to 50 by the backend, see §28).

---

## 28. Limits and Truncation (§40 of the prompt)

| ENDPOINT_OR_COMPONENT | LIMIT | SERVER_OR_CLIENT | INTENTIONAL | AFFECTS_TOTAL |
|---|---|---|---|---|
| `GET /events` (via `useEventos()`, no override) | 50 (`PaginationDto.limit` default) | SERVER (silent) | NO | **YES** — the same silent truncation pattern already confirmed in 6+ previous modules (`works`, `phonograms`, `contracts`, `contract_templates`, `clients`, the 7 hooks of `dashboard.md`) — here it directly affects the module's main calendar/list: a tenant with more than 50 events never sees the oldest ones in the Agenda, in the metrics (`metricas.total`, `.confirmados`, `.pendentes`, `.proximos7Dias`) or in the XLSX export |

`TRUNCATION_GAP` confirmed — the same structural root cause already documented in the previous modules
(no domain hook in this system passes `limit`/`offset` to the backend).

---

## 29. Delete / Cancel / Archive (§42 of the prompt)

| UI_ACTION | ENDPOINT | DATABASE_BEHAVIOR | RELATED_IMPACT | SOFT_OR_HARD |
|---|---|---|---|---|
| Delete event (`DeleteConfirmModal`, the only removal button in the Agenda) | `DELETE /events/:id` | `UPDATE events SET deleted_at = now()` | none (no child tables) | SOFT |

There is no distinction between "Cancelar" (Cancel — changing `status` to `cancelado`, a normal `PATCH`) and
"Excluir" (Delete — a real soft delete) in the UI — both concepts coexist but use different mechanisms
(`status='cancelado'` is just another free status value, §12; deletion is the standard soft delete).
There is no `ARCHIVE`/`RESTORE` in any layer.

---

## 30. Calendar External Integrations (§43 of the prompt)

No integration with Google Calendar/Outlook/iCal/ICS was found in any layer —
`EXTERNAL_CALENDAR_INTEGRATIONS: 0`. `CREDENTIALS_REQUIRED_LATER: 0` (there is no indication that such an
integration is planned — no `external_calendar_id`/`ics_url`/similar field exists in the
schema).

---

## 31. Permissions and Tenant Isolation (§44/§45 of the prompt)

| PERMISSION | FRONTEND_ENFORCEMENT | BACKEND_ENFORCEMENT |
|---|---|---|
| `event:read` | reading not explicitly gated | `@RequireRole('viewer') @RequirePermission('event:read')` |
| `event:create` | "Novo Evento" (New Event) button via `RequirePermission module="events" action="write"` (a pt-BR/English module name distinct from the backend's `event:*` — only an internal label of the `RequirePermission` component, not a functional mismatch) | `@RequireRole('editor') @RequirePermission('event:create')` |
| `event:update` | no visible gate on the "Editar" (Edit) buttons | `@RequireRole('editor') @RequirePermission('event:update')` |
| `event:delete` | no visible gate on the "Excluir" (Delete) button | `@RequireRole('manager') @RequirePermission('event:delete')` |

`AUTHORIZATION_GAPS: 0` — all real routes are protected; the absence of an early visual gate
on the edit/delete buttons is the same non-blocking observation already recorded in
previous modules (the backend would refuse the operation anyway).

`TENANT_ISOLATION_GAPS: 0`. `EventsService` filters `tenant_id = :tenantId` (via `@CurrentTenant()`)
in `list`/`findById`/`create`/`update`/`softDelete`, consistent with the `TenantGuard` pattern already
audited in `auth.md`. Specific attention requested by the prompt: `participants` (inside the
`events.participantes` jsonb, isolation inherited from the event row itself — no table of its own, no
additional risk); `venues` (free text on the row itself, same isolation); `attachments`/
`reminders`/`calendar sync` (do not exist, §22/§24/§30 — no risk surface);
`event financial relations` (do not exist, §20 — no risk surface).

---

## 32. Consolidated gaps (evidenced, not fixed)

1. **DISPLAY_MAPPING_MISMATCH** (critical severity, cross-cutting) — `Agenda.tsx` and
   `SchedulerViewModal.tsx` read the fields `data_inicio`, `tipo_evento`, `horario_inicio`,
   `horario_fim`, `cidade`, `estado`/`uf`, `capacidade_publico`, `contato_telefone`,
   `contato_email`, `tipo_local`, `checklist` — **none of these names exists in the real response of
   `GET /events`** (the API returns `titulo`, `tipo`, `data`, `starts_at`, `data_fim`, `local`,
   `endereco`, `contato_local`, `valor_cache`, `publico_esperado`, `descricao`, `observacoes`,
   `participantes`, `status`, `artista_id`, `metadata`). Confirmed effects: (a) the calendar
   renders **every event at the date/time the page was loaded**, not at the event's real
   date (`Agenda.tsx:252-254`, the `new Date()` fallback always triggered); (b) every event is treated
   as "all day" (`allDay` always `true`); (c) the type filter (`typeFilter`) never finds
   results when a specific type is selected; (d) the details modal shows "—" for
   Start date, Start/End time, Type, City/State and Capacity even when that data
   exists in the database; (e) the XLSX export generates empty columns for most of the temporal/
   geographic fields. Independently confirmed by the `dashboard` module's own code
   (`dashboard.md`, already audited): `useMetrics.ts` already documents in a comment that it needed a
   double fallback `data_inicio ?? data` "para evitar contagem zerada em HTTP mode" (to avoid a zeroed count in HTTP mode) — evidence that
   this exact problem was already noticed in another context, but never fixed at the source
   (`Agenda.tsx`/`SchedulerViewModal.tsx`, the primary components of the `events` module itself).
   The **create/edit** form (`SchedulerFormModal.tsx`) does not suffer from this gap — it uses a
   correct fallback chain (`getInitialFormData()`) that already falls through to `evento?.data`.
2. **DISPLAY_MAPPING_MISMATCH** (secondary) — `mapTipoToBackendType()` has no entry for 4
   of the form's 10 pt-BR categories (`sessoes_estudio`, `ensaios`, `sessoes_fotos`,
   `producao_conteudo`), all collapsing to the `"other"` enum in the backend — a loss of
   granularity in persistence (it does not prevent use, but the category information is less
   precise in the `tipo` column than in the user's original selection).
3. **CREATE_MAPPING_MISMATCH** — `capacidadePublico` (a real form field,
   "Campos Exclusivos para Shows" (show-only fields) section) is validated, included in the
   payload as `capacity`, accepted by
   `CreateEventDto`, but `EventsService.dtoToEntity()` never maps `capacity` to any
   column — the value is silently discarded after passing validation (the request
   succeeds, only the data is lost).
4. **RELATION_MISMATCH** (design) — the `events.local` column (`character varying`) has dual
   semantics depending on the event type: free text (the venue name, typed) for most
   types, or a `clients` UUID (with no distinct marker/type) when `shouldUseCRMLocal=true`
   (shows/TV/radio/podcast) — there is no way to distinguish the two cases just by reading the column, without
   reconstructing the frontend's `tiposLocalCRM` logic.
5. **PARTICIPANT_GAP** — `Agenda.tsx`/`SchedulerViewModal.tsx` read participants via
   `evento.metadata.participants` (always `{}`/empty — never written by
   `SchedulerFormModal.buildPayload()`), not via `evento.participantes` (the real physical column where
   the data is actually written) — the UI falls back to a single-artist fallback, losing
   employee/user/contact and additional artists that were genuinely persisted.
6. **REAL_MAPPING_GAP** — the XLSX import (`handleExcelImport`) builds objects with keys
   (`titulo`, `tipo_evento`, `data_inicio`, `horario_inicio`, `horario_fim`, `cidade`, `estado`,
   `capacidade`) that do not correspond to any field accepted by `CreateEventDto` — with a global
   `ValidationPipe(whitelist:true, forbidNonWhitelisted:true)`, every imported row
   would result in HTTP 400 (not even `titulo` survives — the DTO only accepts `title`). The import is
   structurally non-functional, even though it exists and can be triggered in the UI.
7. **REAL_MAPPING_GAP** — the XLSX export (`handleExcelExport`) reads the same incorrect field
   names as Gap #1 directly from the events array — most of the exported columns
   (`tipo_evento`, `data_inicio`, `horario_inicio`, `horario_fim`, `cidade`, `estado`,
   `valor_ingresso`, `capacidade`) always come out empty.
8. **TRUNCATION_GAP** — `GET /events` uses `PaginationDto.limit=50` and `useEventos()` never
   overrides it — tenants with more than 50 events lose visibility of the oldest ones in the Agenda,
   metrics and export.
9. **RECURRENCE_GAP** — `NOT_IMPLEMENTED` in every layer (§11).
10. **REMINDER_GAP** — `NOT_IMPLEMENTED` in every layer (§22).
11. **STORAGE_GAP** — `NOT_IMPLEMENTED` (not even a fake version) — no attachment field/flow exists
    (§24).
12. **CALENDAR_INTEGRATION_GAP** — `NOT_IMPLEMENTED` (§30).
13. **FINANCIAL_INTEGRATION_GAP** — `NOT_IMPLEMENTED` (neither automatic nor manual) — `valor_cache`
    never propagates to `transactions` (§20).
14. **TIMEZONE_GAP** (informational) — `timestamp without time zone` columns, with no explicit
    conversion layer between the event's time zone and the viewer's time zone (§9).
15. **DEAD CODE** (not counted as a formal gap) — `events.store.ts` (Zustand, zero consumers),
    `services/events.service.ts`/`eventService` (zero consumers — the real page uses
    `useEventos()` directly), `evento?.artistas` (join never implemented in the backend, always
    `undefined`).

Total: 5 DISPLAY_MAPPING_MISMATCH-family (items 1, 2, 4, 5 — counted as 4 distinct
display/relation mapping findings) + 1 CREATE_MAPPING_MISMATCH + 2 REAL_MAPPING_GAP (import/export) +
1 TRUNCATION_GAP + 1 RECURRENCE_GAP + 1 REMINDER_GAP + 1 STORAGE_GAP + 1 CALENDAR_INTEGRATION_GAP +
1 FINANCIAL_INTEGRATION_GAP + 1 TIMEZONE_GAP (informational) = **15 gaps**.

---

## Final counters (Zero-Gap)

```
SUBDOMAINS_AUDITED: 4
COMPONENTS_AUDITED: 7
HOOKS_AUDITED: 2
CREATE_FORMS: 1
CREATE_FIELDS: 13 (physical columns populatable by the real form, record level)
EDIT_FORMS: 1
EDIT_FIELDS: 14 (13 + status)
MODALS_DRAWERS_WIZARDS: 2 (SchedulerFormModal, SchedulerViewModal)
CALENDAR_COMPONENTS: 1 (EntityCalendarView, data integration audited; the component itself is shared)
TABLE_GRID_CARD_FIELDS: 6 (fields per event rendered in the calendar: title, dateISO, time,
                           toneClass, hint, status)
DETAIL_DISPLAY_FIELDS: 15 (SchedulerViewModal — see §7)
EVENT_TYPES: 10 (pt-BR frontend) mapped to 7 (backend enum)
WORKFLOW_STATUSES: 5 (backend enum: scheduled/confirmed/cancelled/completed/postponed) — no
                    real workflow (§12)
DATE_TIME_FIELDS: 2 physical columns (data/starts_at dual-write, data_fim) + 2 UI fields
                   (horarioInicio/horarioFim, recombined before sending, no column of their own)
TIMEZONE_SENSITIVE_FIELDS: 2 (data/starts_at, data_fim — timestamp without time zone)
RECURRENCE_FIELDS: 0
PARTICIPANT_FIELDS: 6 per participant (source, id, label, email, phone, category) × 4 sources
RELATION_FIELDS: 2 (events.artista_id → artists.id; events.local as an optional loose reference to
                    clients.id)
VENUE_LOCATION_FIELDS: 3 (local, contato_local, endereco)
FINANCIAL_FIELDS: 2 (valor_cache, publico_esperado) — no propagation
REMINDER_FIELDS: 0
FILTERS: 3
SEARCH_FIELDS: 3 (titulo, local, participants summary)
SORT_FIELDS: 0 (no interactive control; hardcoded backend sorting)
IMPORT_FIELDS: 12 (built by the import, structurally rejected — see Gap #6)
EXPORT_FIELDS: 16 (columns of the exported XLSX, mostly empty — see Gap #7)
XLSX_EXPORTS: 1 (Agenda)
XLSX_RULE_VIOLATIONS: 0
REALTIME_EVENTS: 0
STORAGE_FIELDS: 0
EXTERNAL_CALENDAR_INTEGRATIONS: 0
CREDENTIALS_REQUIRED_LATER: 0
PERMISSIONS_AUDITED: 4 (event:read/create/update/delete)
AUTHORIZATION_GAPS: 0
TENANT_ISOLATION_GAPS: 0

CODE_FIELD_ONLY: 2 (CreateEventDto.city/.country — accepted, never sent by the real form, no column)
DATABASE_COLUMN_ONLY: 0
TYPE_MISMATCH: 0
NULLABILITY_MISMATCH: 0
DEFAULT_MISMATCH: 0
ENUM_MISMATCH: 0 (the pt-BR→enum mapping exists and is deterministic, even though it is lossy — see Gap #2)
RELATION_MISMATCH: 1
CREATE_MAPPING_MISMATCH: 1
EDIT_MAPPING_MISMATCH: 1 (the same — same component/same capacity gap)
DISPLAY_MAPPING_MISMATCH: 4 (Gaps #1, #2, #4, #5)
DATE_TIME_GAPS: 0 (formally — the date problems are classified as DISPLAY_MAPPING_MISMATCH, since the root cause is the field name, not the type/format of the date itself)
TIMEZONE_GAPS: 1
RECURRENCE_GAPS: 1
WORKFLOW_GAPS: 0 (the absence of a workflow is a documented characteristic, not an inconsistency —
                  there is no partial/broken workflow, it simply does not exist)
PARTICIPANT_GAPS: 1
FINANCIAL_INTEGRATION_GAPS: 1
REMINDER_GAPS: 1
CALENDAR_INTEGRATION_GAPS: 1
STORAGE_GAPS: 1
REALTIME_GAPS: 0 (does not apply — no realtime subscription exists in this module to be "broken")
PAGINATION_GAPS: 0
TRUNCATION_GAPS: 1
REAL_MAPPING_GAPS: 2

ARTIST_EVENT_TRACEABILITY_COMPLETE: YES
CRM_EVENT_TRACEABILITY_COMPLETE: YES
CONTRACT_EVENT_TRACEABILITY_COMPLETE: YES
ACCOUNTING_EVENT_TRACEABILITY_COMPLETE: YES
AUDITORIA_TSX_EVENTS_SECTION_COMPLETE: YES

UNMAPPED_CREATE_FIELDS: 0
UNMAPPED_EDIT_FIELDS: 0
UNMAPPED_DISPLAY_FIELDS: 0
UNMAPPED_RELATION_FIELDS: 0
UNMAPPED_DATE_TIME_FIELDS: 0
UNMAPPED_PARTICIPANT_FIELDS: 0
UNMAPPED_FINANCIAL_FIELDS: 0
UNMAPPED_IMPORT_FIELDS: 0
UNMAPPED_EXPORT_FIELDS: 0
UNMAPPED_STORAGE_FIELDS: 0
UNKNOWN_FIELD_CLASSIFICATIONS: 0
```

NEXT_MODULE: `integrations`
