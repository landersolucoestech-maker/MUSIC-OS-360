> Historical record. Kept as recorded; not the current contract.

# Progress tracker — Prompt 96 (field-level zero-gap audit)

Resumable checkpoint. STATUS: BLOQUEADO at the boundary below — continue from here in the next
prompt. Not a final deliverable on its own — see doc81 for the narrative.

## DONE (real, exhaustive, evidenced — not sampled)

- [x] DB column metadata extraction — 142 tables / 2382 columns (public schema), mechanical from
      `current-database-inventory.json`. `database-backend-column-mapping.json`.
- [x] Backend column mapping extraction — 129 `@Entity` classes, every `@Column`/`@PrimaryColumn`/
      `@PrimaryGeneratedColumn`/`@CreateDateColumn`/`@UpdateDateColumn`/`@JoinColumn`/`@JoinTable`
      decorator mechanically parsed (property↔column, declared type, declared nullable).
- [x] Raw-SQL / DTO column usage for the 13 non-entity or partially-entity tables
      (financial_transactions, rbac_decision_logs, rbac_error_logs, tenant_invitations, artists,
      employees, financial_categories, leave_requests, payroll_entries, + the 10 confirmed
      no-consumer LIVE_ONLY tables) — real grep evidence, file paths recorded, not guessed.
- [x] CODE_FIELD_ONLY computed exhaustively: 29 real findings (21 are dead leftover
      `FinancialCategoryEntity` fields from the pre-migration schema in `entities.ts` — confirms/
      reinforces doc80's dead-code finding; 8 are genuine individual entity/live-DB drifts —
      `notifications.updated_at`, `uploads.updated_at`, `campaign_assets.file_size/mime_type`,
      `rights_holders.email_encrypted/phone_encrypted`, `takedowns.url/obra_id/artista_id/resposta`).
- [x] TYPE_MISMATCH computed exhaustively: 25 real findings, all `type: 'timestamp'` declared in
      code vs live `timestamptz` column (billing/audiovisual/artist-goals domain — see
      field-mismatches.json for the full list).
- [x] NULLABILITY_MISMATCH computed exhaustively: 0.
- [x] Every one of the 2232 standalone (non-partition) columns has a real classification, 0 UNKNOWN:
      DIRECT 1942, DIRECT_VIA_DTO_OR_RAW_QUERY 67, NO_TABLE_CONSUMER 126, DIRECT_RAW_SQL 59,
      UNUSED_SCHEMA_FIELD 30, RENAMED 3, SYSTEM_TOOLING 3, RELATION_ONLY 2.

## Module-by-module log (Fase 2 — one module per prompt execution)

### MODULE: accounting
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/accounting.md`
Summary: 5 pages, 22 components, 11 hooks/stores audited in full. 2 clean domains (Transacao form
→ `transactions`, 28 fields all DIRECT; NotaFiscal form → `invoices`, 38 fields all DIRECT). 5
REAL_MAPPING_GAP found (entityLinks/P&L allocation never persisted; `/financial-categories/rules*`
endpoints don't exist on backend — whole custom-rules CRUD broken; CategoriasFinanceiras.tsx page
100% disconnected from real backend, localStorage-only; Transacao attachment upload not implemented;
Contabilidade "P&L por Projeto" tab doesn't actually group by projeto_id). 1 XLSX_RULE_VIOLATION
(3-sheet export, dead/unreachable code). UNMAPPED_*: 0. UNKNOWN_FIELD_CLASSIFICATIONS: 0.
NEXT_MODULE: admin

### MODULE: admin
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/admin.md`
Summary: 9 pages, 21 components, 3 cross-cutting hooks (useAudit/useIsAdmin/useAuth) + 5 real
services audited in full. Sharp real/fake split: AdminDashboard/AdminClients/AdminPlans/
AdminSubscriptions have clean, verified, fully-real backend integration (billing.controller.ts);
AdminAudit/AdminSupport are real but tenant-scoped only (not cross-tenant despite framing, "Tenant"
column always blank); AdminSettings.tsx (8 tabs, 770 lines) is **entirely non-functional** (every
save is a fake toast, Webhooks/Chaves API permanently empty with dead "new" buttons, Integrações
only mutates local state, Usuários list permanently empty with no invite/create flow at all);
AdminKnowledge is honestly self-disclosed dev-only mock, disabled in prod. 6 REAL_MAPPING_GAP found.
AUTHORIZATION_GAPS: 0 (backend @RequireRole('super_admin') verified on all real admin routes,
matches frontend SuperAdminRoute guard — clean). UNMAPPED_*: 0. UNKNOWN_FIELD_CLASSIFICATIONS: 0.
NEXT_MODULE: artist

### MODULE: artist
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/artist.md`
Summary: full domain audit (2 module pages + ArtistaVisao360Modal 3170-line hub + 4 hooks +
backend artists.controller/service/DTOs/platform-profiles providers) plus the `artist`-specific
section of the cross-module `Auditoria.tsx` tool (closes the item deferred in admin.md §7). Major
finding: TWO parallel create/edit implementations — ArtistaFormModal.tsx (real, UI-reachable) vs.
ArtistaCadastro.tsx (routed at /artistas/novo and /artistas/:id/editar, grep-confirmed zero links
anywhere — orphaned but functional). Correction to Phase 1: ~41 of the 78 real `artists` columns
are schema-present but the application actually persists their values into the generic `metadata`
jsonb column instead (confirmed via report-form-contracts.ts ARTISTS_CONTRACT + artists.service.ts)
— documented architecture, not a bug, but Phase 1's DIRECT_VIA_DTO_OR_RAW_QUERY label for those 41
columns is superseded by this more precise finding. Encryption (email/telefone/cpf_cnpj/
manager_contato → AES-256-GCM) verified clean. Real Spotify/YouTube platform-metrics sync verified
(2 platform credentials required later, platform-owned, not blocking). 3 REAL_MAPPING_GAP.
AUTHORIZATION_GAPS: 0, TENANT_ISOLATION_GAPS: 0. UNMAPPED_*: 0. UNKNOWN_FIELD_CLASSIFICATIONS: 0.
NEXT_MODULE: audiovisual

### MODULE: audiovisual
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/audiovisual.md`
Summary: full domain audit — 9 real backend sub-domains (audiovisual_projects/briefings/
deliverables/shots/production_days/team_members/assets/tasks/approvals, 187 columns, 100% DIRECT)
vs. frontend that only reaches 1 of them (projects). Major finding: 16 of 20 defined hooks (8 of 9
backend domains — briefing, deliverables, storyboard/shots, shooting schedule, crew, tasks,
approvals, file assets) have zero UI consumer anywhere, confirmed by repo-wide grep, despite real
business logic server-side (e.g. automatic per-stage task generation, 8-stage pipeline
draft->...->published with real transition-validation rules). Second major finding: the status
filter bar (AudiovisualFilterBar.tsx) uses Portuguese option values against English-stored data —
confirmed always-zero-results bug in live, reachable code. Also: artist_id/release_id/campaign_id/
event_id exposed as API filters but never written by any form; orphaned /audiovisual/projects/new
route (same pattern as artist.md). 7 REAL_MAPPING_GAP, 1 STORAGE_GAP, 1 WORKFLOW_GAP, 1
APPROVAL_GAP. AUTHORIZATION_GAPS: 0, TENANT_ISOLATION_GAPS: 0 (backend auth verified clean across
all 9 controllers). UNMAPPED_*: 0. UNKNOWN_FIELD_CLASSIFICATIONS: 0.
NEXT_MODULE: auth

### MODULE: auth
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/auth.md`
Closes pendency: `artist.md` :: `ArtistaSignupPublic.tsx` — now `AUDITED_IN_AUTH`.
Summary: full audit of AuthContext.tsx, 6 frontend pages, backend auth module (auth-context/
auth-password/onboarding/workspace-provisioning services, auth.controller, dev-auth.controller),
JwtAuthGuard (JWKS/ES256 prod + HS256 dev), TenantGuard, realtime auth integration, role hierarchy.
CRITICAL finding: `ArtistaSignupPublic.tsx` posts to `POST /public/artists`, which does not exist
anywhere in the backend (exhaustive grep confirmed) — the entire public artist self-signup wizard
is 100% non-functional, every submission 404s silently. TenantGuard verified as a strong, correct
multi-tenancy implementation (X-Tenant-ID header never trusted, only cross-checked against the
JWT-resolved tenant). Real signup flow (Register.tsx -> auto workspace provisioning) verified
clean, no gap. 1 REALTIME_AUTH_GAP (signOut() doesn't call disconnectRealtimeChannels()).
AUTHORIZATION_GAPS: 0, AUTHENTICATION_GAPS: 0, TENANT_ISOLATION_GAPS: 0. UNMAPPED_*: 0.
UNKNOWN_AUTH_CLASSIFICATIONS: 0.
NEXT_MODULE: catalog

### MODULE: catalog
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/catalog.md`
Summary: full domain audit — works/obras (47 cols) + phonograms/fonogramas (59 cols) both 100%
DIRECT and real (controllers, DTOs, services all clean, tenant-scoped, role-gated); plus the
`registry` backend module (rights-holders, external-identifiers, society accounts/submissions/sync
— 6 controllers, 91 columns across 6 tables) confirmed to have **zero frontend consumer anywhere**,
including explicit exclusion from the generic reports/export "Central de Relatórios" tool
(NOT_REPORTABLE). ABRAMUS integration found half-real: search/credentials/register-work are real;
import-from-search, duplicate local-lookup, and sync-all are hardcoded stubs that always fail (no
backend route exists for any of them). Critical evidenced bugs: `works.artista_id` hardcoded to
null on every create/edit (silently wipes existing links on save); `FonogramaFormModal`'s audio
upload is 100% fake (only filename/size captured, no real file ever transmitted, `audio_file_id`
column never written); `GET /works`/`GET /phonograms` default to `limit=50` server-side and the
frontend never paginates past it, so tenants with >50 obras/fonogramas silently lose visibility of
older records (affects the main list page AND the Auditoria.tsx completeness checker, which reuses
the same calls). No sum=100% validation for splits (work_participants / phonograms.participacao);
no ISRC/ISWC format or uniqueness validation at any layer. 9 REAL_MAPPING_GAP, 2
SPLIT_VALIDATION_GAP, 1 STORAGE_GAP, 1 IDENTIFIER_GAP, 4 EXTERNAL_INTEGRATION_GAP (ABRAMUS stubs).
AUTHORIZATION_GAPS: 0, TENANT_ISOLATION_GAPS: 0. UNMAPPED_*: 0. UNKNOWN_FIELD_CLASSIFICATIONS: 0.
NEXT_MODULE: contracts

### MODULE: contracts
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/contracts.md`
Summary: full domain audit — `contracts` (25 cols), `contract_templates` (11 cols),
`contract_service_types` (32 cols), `contact-contracts` sub-resource, DocuSign/Autentique
signature integrations, workflow (9 reachable states + 1 dead enum value `ATIVO`), contract→
accounting automation. CRITICAL: `POST /contract-templates`'s DTO (English: title/type/content,
fixed type enum) is completely disconnected from what `TemplatesContratos.tsx` actually sends
(pt-BR: nome/tipo_servico/conteudo/...) — with global `whitelist+forbidNonWhitelisted` validation,
every real template creation attempt returns HTTP 400, blocking the entry point of the primary
`ContratoWizard` flow (Step 1 needs an existing template). `ContratoWizard` also never uses the
official `parties` DTO field — it JSON-serializes full party PII (CPF/CNPJ/RG/email/phone/address)
into the plain-text `observacoes` column instead, which is then exported verbatim (unencrypted) via
the generic XLSX export. E-signature sending is 100% non-functional for all 3 providers by design
(`signing.adapter.ts` stub always rejects) — yet the backend has a real, complete, unused Autentique
integration (configure/send/webhook) with zero frontend consumers; DocuSign backend only implements
OAuth connect, no envelope/signature capability exists. Contract→accounting propagation on signing
IS real (provisional transaction + artist status + CRM tasks + workflow queue), but practically
unreachable for wizard-created contracts since the sign-transition guard requires `arquivo_url`,
which only the secondary (catalog-only-reachable) `ContratoFormModal` can set. `contact-contracts`
backend uses an in-memory Map, not Postgres. `CategoryRegistry.tsx`/`VariableRegistry.tsx` are both
100% localStorage, never backend-synced. 9 REAL_MAPPING_GAP, 2 SIGNATURE_GAP, 1 DOCUSIGN_GAP,
1 EXTERNAL_INTEGRATION_GAP, 1 WORKFLOW_GAP, 1 PARTY_MAPPING_GAP, 1 TEMPLATE_GAP,
1 FINANCIAL_TERM_GAP, 1 ENUM_MISMATCH, 1 RELATION_MISMATCH, 1 DOCUMENT_GENERATION_GAP,
1 AUTHORIZATION_GAP (Autentique webhook missing `@Public()`). TENANT_ISOLATION_GAPS: 0.
UNMAPPED_*: 0. UNKNOWN_FIELD_CLASSIFICATIONS: 0.
NEXT_MODULE: crm-relationships

### MODULE: crm-relationships
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/crm-relationships.md`
Summary: full domain audit — confirmed (via the codebase's own comments) that there is no physical
`contacts` table: "Contato = Cliente" is a documented domain decision, both concepts share the
`clients` table (39 cols). The legacy `/contacts` facade is dead (zero frontend consumers, though
correctly implemented); the real UI (`ContatoFormModal`/`ContatosPanel`, embedded in `leads`
module's `LeadsPage.tsx` since `/crm` hard-redirects there) always calls `/clients` directly.
CRITICAL: ~15 real physical `clients` columns (foto, perfil, funcao, razao_social/nome_fantasia
distinct, logradouro/numero/complemento/bairro, status_contato, prioridade_contato,
responsavel_email/telefone/cargo, interacoes jsonb) are captured by the create/edit form but never
reach the backend — the mapping function never sets them (nor the generic `metadata` field that
would carry them), and the backend DTO doesn't declare them either (would 400 if sent). PII fields
that DO persist (email/phone/document) are correctly AES-256-GCM encrypted end-to-end — contrast
with contracts.md's plaintext-PII finding. A real presigned-upload-to-R2 attachment backend exists
but is never called (UI only uses local blob URLs). A rich alternate "Contact" component suite
(ContactComponents.tsx, 317 lines/13 components) plus 4 Zustand stores are confirmed dead code.
Auditoria.tsx's CRM tab has a broken deep-link (`/crm?edit=` dropped by a static redirect) and two
field-name-mismatch checks that always false-flag as incomplete. Artist↔CRM relationship is a clean
live reference (no data copy); Contracts↔CRM has both patterns (contract-level FK is a real live
reference, but wizard-level party data is a disconnected copy, already documented in contracts.md).
4 REAL_MAPPING_GAP, 2 CREATE_MAPPING_MISMATCH, 1 STORAGE_GAP, 1 IMPORT_MAPPING_GAP,
1 DUPLICATE_HANDLING_GAP, 1 SEARCH_GAP. AUTHORIZATION_GAPS: 0, TENANT_ISOLATION_GAPS: 0.
UNMAPPED_*: 0. UNKNOWN_FIELD_CLASSIFICATIONS: 0.
NEXT_MODULE: dashboard

### MODULE: dashboard
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/dashboard.md`
Summary: pure frontend cross-domain aggregator audit (no dedicated dashboard backend beyond a real
`analytics` module) — traced 8 widgets to their real sources across `artist`/`contracts`/
`accounting`/`events`/`crm-relationships`/`releases`/`projects`/audit-logs without reopening any
already-completed module. CRITICAL cross-cutting finding: the 4 top KPI StatCards + the "Artistas
em Destaque" ranking are all computed client-side over arrays fetched with no `limit` override,
structurally hitting the same `PaginationDto.limit=50` backend default already confirmed in 5 prior
modules — none are `TOTAL_REAL` for tenants with >50 records. "Receita Total" is mislabeled (it's
actually a rolling 30-day window, not an all-time total), while a real, more accurate P&L
calculation (`financeiroMetrics`) is computed every render but never displayed anywhere. A real,
well-engineered `AnalyticsController` exists (`GET /analytics/dashboard` — 21 tenant-scoped SQL
aggregates immune to the 50-row truncation; `GET /analytics/revenue` — a real month-bucketed time
series) but `/analytics/revenue` has zero frontend consumers and the Dashboard has zero charts
despite it. REALTIME_GAP confirmed by reading source: 14 `useWsEvent()` subscriptions in the
Activity Feed never receive anything — the backend's domain-event system (`EventEmitter2`) has no
bridge to Supabase Realtime broadcast. Two large dead-code blocks confirmed inert
(`computeFromMockStorage()`, ~150 lines; an 11-listener legacy `CustomEvent` block). Cross-domain
consistency check found 3 of 4 compared KPI-pair formulas diverge between the displayed
client-side/truncated version and the backend's own untruncated SQL version (calculated but
unused). TENANT_ISOLATION_GAPS: 0. UNMAPPED_*: 0. UNKNOWN_DASHBOARD_CLASSIFICATIONS: 0.
NEXT_MODULE: events

### MODULE: events
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/events.md`
Summary: full domain audit — `events` (23 cols, single physical table, no separate venues/
recurrence/reminder/attachment tables exist). CRITICAL cross-cutting finding: `Agenda.tsx` and
`SchedulerViewModal.tsx` read a fictional field set (`data_inicio`, `tipo_evento`,
`horario_inicio`/`horario_fim`, `cidade`, `estado`/`uf`, `capacidade_publico`, `contato_telefone`,
`contato_email`, `tipo_local`, `checklist`) that matches neither the real `events` columns nor
`CreateEventDto`/`UpdateEventDto` — confirmed effects: the calendar renders every event at "now"
(date fallback always triggers), every event is forced all-day, the type filter never matches, and
the detail modal shows "—" for fields that actually have data. The create/edit form
(`SchedulerFormModal.tsx`) is unaffected — it uses a correct defensive fallback chain and a
`buildPayload()` matching the real DTO exactly, with one isolated exception: `capacity` is accepted
by the DTO and sent by the form but silently dropped by `EventsService.dtoToEntity()`. Participants
are written correctly to `events.participantes` (jsonb) but read back from the wrong path
(`evento.metadata.participants`, always empty), so display falls back to a single primary artist
and silently loses other participants. XLSX import/export (client-side only) both key off the same
fictional field names — import would 400 on every row under the global
`whitelist+forbidNonWhitelisted` ValidationPipe; export produces mostly-blank columns. No
recurrence, reminders, attachments, external-calendar integration, or automatic event→accounting
propagation exist in any layer (all `NOT_IMPLEMENTED`, confirmed via DB schema + full-file reads).
Auditoria.tsx's "Agenda" tab requires `row.data_inicio`, guaranteeing a 100% false-positive on every
event, and its `/agenda?edit=` deep link is very likely dead (no query-param handling found in
`Agenda.tsx`). Same `PaginationDto.limit=50` silent truncation confirmed as in prior modules. Two
dead-code artifacts (`events.store.ts`, `eventService`) confirmed via grep. 4
DISPLAY_MAPPING_MISMATCH, 1 CREATE_MAPPING_MISMATCH, 2 REAL_MAPPING_GAP, 1 TRUNCATION_GAP, 1
RECURRENCE_GAP, 1 REMINDER_GAP, 1 STORAGE_GAP, 1 CALENDAR_INTEGRATION_GAP, 1
FINANCIAL_INTEGRATION_GAP, 1 TIMEZONE_GAP (informative), 1 PARTICIPANT_GAP, 1 RELATION_MISMATCH.
AUTHORIZATION_GAPS: 0, TENANT_ISOLATION_GAPS: 0. UNMAPPED_*: 0. UNKNOWN_FIELD_CLASSIFICATIONS: 0.
NEXT_MODULE: integrations

### MODULE: integrations
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/integrations.md`
Artifacts: `docs/backend-v2/field-traceability/integrations/integration-inventory.json`,
`docs/backend-v2/field-traceability/integrations/credential-readiness.json`
Summary: 32 providers audited (payments, e-signature, music streaming, social/marketing,
distribution, rights registry, audio recognition, storage, email, observability, analytics, AI).
Backend (`apps/api/src/modules/integrations/**` + `billing`/`uploads`) is the most maturely
engineered module found in this entire audit series: shared `IntegrationBaseService`
(AES-256-GCM credential/token encryption, HMAC-signed OAuth state, circuit-breaker-guarded
`resilientFetch`) + shared `WebhookService` (real idempotency via `webhook_events.external_id`
UNIQUE, pre-processing persistence, HMAC/shared-secret validation); Stripe webhook uses the real
Stripe SDK `constructEvent` with preserved raw body. Gaps concentrate in frontend consumption and
unresearched external APIs, not backend engineering. CRITICAL: `signing.adapter.ts` always
returns a hardcoded "unavailable" provider for every signing provider including "autentique" (the
one with a complete, hardened real backend) — `SendForSigningDialog.tsx`, the only real UI entry
point for e-signature, is structurally broken for all 3 offered providers. Stripe billing is
split the same way: `POST /billing/checkout`/`POST /billing/portal` are real and complete, but
`useStripeCheckout`/`useStripePortal` are explicit disabled stubs and `useStripeStatus` always
returns hardcoded `disabled`. ACRCloud's current backend contract
(`RecognizeAudioDto`/`ACRCloudResult`) is structurally different from what the real frontend hook
expects (already flagged in doc36/37 as a future-v2 resolution, confirmed here still live and
unfixed in current code). ACRCloud and ABRAMUS are the only 2 providers using plain `fetch()` with
no timeout/retry/circuit-breaker, breaking from the otherwise consistent resilience pattern; only
Spotify and Instagram/Meta have any token-refresh mechanism (Instagram's is proactive, daily
cron + Vercel Cron fallback) — TikTok/GoogleAds/DocuSign/StripeConnect persist unused refresh
tokens. The 6 digital distributors remain exactly where docs 25/30/31 left them (honest
static-catalog placeholder, Decision D1 unexecuted); a separate, well-built generic backend
framework for distributor/society submission exists but has exactly 2 registered providers today,
both explicit `Unconfigured*` placeholders, with zero frontend consumers. ECAD/UBC are UI_ONLY
(frontend hooks/dialogs, zero backend). No `FAKE_INTEGRATION_GAP` found anywhere — every
unconfigured path fails explicitly rather than simulating success. `CREDENTIALS_TO_ADD_NOW: 0`.
TENANT_INTEGRATION_ISOLATION_GAPS: 0. UNMAPPED_PROVIDERS: 0. UNKNOWN_INTEGRATION_CLASSIFICATIONS: 0.
NEXT_MODULE: inventory

### MODULE: inventory
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/inventory.md`
Summary: much smaller module than prior audits — a single physical table (`inventory_items`, 19
cols), a single clean CRUD controller/service, one frontend page + 2 modals + 1 hook. No
`stock_movements`/`warehouses`/`locations`/`reservations`/`loans`/`maintenance_records`/
`suppliers`/`barcodes` tables exist anywhere (confirmed via Fase 1 mapping + exhaustive grep for
cross-module consumers, zero found in projects/audiovisual/events) — the `status` field
(`disponivel`/`em_uso`/`manutencao`/`descartado`/`reservado`) is the only trace of a
reservation/loan/maintenance concept, with no dedicated fields/tables/workflows behind it.
CRITICAL: 3 independently-defined status vocabularies (backend DTO, frontend Zod schema, shared
TS type) all diverge — the real, reachable create/edit form offers "Emprestado"/"Danificado",
neither accepted by the backend (`@IsIn` → HTTP 400 on submit), while "Reservado" (backend-accepted)
is never offered in the UI. `InventarioFormModal`'s edit-mode pre-fill reads
`localCompra`/`numeroNotaFiscal`/`dataEntrada` (camelCase) against a real API that returns
`local_compra`/`numero_nota_fiscal`/`data_entrada` (snake_case) — these 3 real persisted fields
always render empty when editing, though CREATE correctly maps them; the same 3 fields are also
never shown in the read-only detail modal. The table's "Entrada" column has the same
camelCase-vs-snake_case bug, always showing "—"; the generic Central de Relatórios export engine
is unaffected (correctly uses real column names). Stock model is a pure QUANTITY_SNAPSHOT (single
integer column, last-write-wins on edit, no ledger, no optimistic lock) — quantity changes leave
no structured audit trail beyond a generic activity-log action name. No accounting integration
exists despite purchase-suggesting fields (`valor_unitario`/`local_compra`/`numero_nota_fiscal`);
no supplier/CRM relation (correctly not invented); no barcode/QR/serial identification anywhere.
Same `PaginationDto.limit=50` silent truncation as every prior module. Auditoria.tsx checks
`row.valor` (wrong field, real is `valor_unitario`) and its `/inventario?edit=` deep link is dead
(no query-param handling in `Inventario.tsx`). 2 dead-code files confirmed via grep. 1
EDIT_MAPPING_MISMATCH, 2 DISPLAY_MAPPING_MISMATCH, 1 ENUM_MISMATCH, 1 DEFAULT_MISMATCH, 2
REAL_MAPPING_GAP, 1 TRUNCATION_GAP, 1 DUPLICATE_HANDLING_GAP, 1 STOCK_CONCURRENCY_GAP, 1
INVENTORY_HISTORY_GAP, 1 IDEMPOTENCY_GAP, 1 FINANCIAL_INTEGRATION_GAP, 1 aggregated
MOVEMENT/RESERVATION/LOAN/MAINTENANCE_GAP, 1 STORAGE_GAP. AUTHORIZATION_GAPS: 0,
TENANT_ISOLATION_GAPS: 0. UNMAPPED_*: 0. UNKNOWN_FIELD_CLASSIFICATIONS: 0.
NEXT_MODULE: leads

### MODULE: leads
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/leads.md`
Summary: confirmed the `LEAD != CONTACT/CLIENT` boundary from `crm-relationships.md` — `leads` is
a real, distinct table (34 cols) with its own workflow (9-state enum, role-gated transitions). The
`/leads` route is a combined "CRM" page whose "Contatos" tab is 100% composed of already-audited
`crm-relationships` components, not re-audited. CRITICAL: `LeadInteractionsService.create()` (the
dedicated `/lead-interactions` endpoint) spreads a camelCase DTO (`leadId`/`type`/`notes`) directly
onto an entity with snake_case properties (`lead_id`/`tipo`/`descricao`) with zero mapping —
`lead_id` (NOT NULL) is never populated, so every real call would fail on a DB constraint; inert
today only because the UI's real "interaction history" is an entirely separate, working mechanism
(a manual array embedded in `leads.payload_servico.interacoes[]`), fully disconnected from the
dedicated table/controller/permissions system. Lead→client conversion is a real, non-trivial
automated flow (status→'fechado' triggers `LEAD_CONVERTED` via the same non-durable in-process
EventEmitter2 bus already flagged unreliable in `events.md`/`dashboard.md`) that also
undocumentedly auto-creates an `ArtistEntity` for every conversion regardless of lead type, never
checks for an existing client (always creates a duplicate), copies almost no contact data to the
new client, and runs as 3 independently-try/caught operations outside the original DB transaction
(crash-between-steps leaves the lead permanently stuck, no retry). `whatsapp` is sent by the real
create/edit form but not declared on `CreateLeadDto` (likely 400 under the global
`forbidNonWhitelisted` pipe); 7 physical columns (`origem_lead`, `probabilidade_fechamento`,
`responsavel`, `prioridade`, `temperatura`, `proximo_follow_up`, `valor_estimado`) are documented-
architecture duplicates never written by the real flow (values live in `dados_internos_crm` jsonb
instead) — same pattern as `artists`' 41-column metadata routing. Scope finding: a fully-designed
generic Pipeline/Kanban system (`pipelines`/`pipeline_stages`/`pipeline_opportunities`, 41 cols)
exists only as unused TypeORM entity declarations — zero controller/service/frontend consumer
anywhere. Status enum itself is verified fully correct and consistent (positive finding, contrast
with `inventory.md`'s 3-way mismatch same session). Uploads are 100% decorative
(`URL.createObjectURL`, matches `lead_uploads` table's confirmed `NO_TABLE_CONSUMER` status); no
import exists; export correctly delegates to the shared Central de Relatórios engine (whose own
comments already document the 2-level-nested jsonb blocks as unsupported). Hardcoded `?limit=200`
truncation on the list hook. 3 of 4 Zustand stores confirmed dead via grep. 2
CREATE_MAPPING_MISMATCH, 1 RELATION_MISMATCH (undocumented Artist auto-creation), 1
CONVERSION_MAPPING_GAP, 1 CONVERSION_ATOMICITY_GAP, 2 DUPLICATE_HANDLING_GAP, 2 SEARCH_GAP, 1
STORAGE_GAP, 1 TRUNCATION_GAP, 1 dead-schema finding (pipelines). AUTHORIZATION_GAPS: 0,
TENANT_ISOLATION_GAPS: 0. UNMAPPED_*: 0. UNKNOWN_FIELD_CLASSIFICATIONS: 0.
NEXT_MODULE: licensing

### MODULE: licensing
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/licensing.md`
LICENSING_DOMAIN_MEANING: SYNC_LICENSING (predominant, the create modal's own title is literally
"Nova Licença de Sync") + MASTER_USE_LICENSING + MECHANICAL_LICENSING as secondary categories
sharing the same form/table — determined by evidence, not folder naming. Small, self-contained
module: 1 physical table (`licenses`, 27 cols), no satellite tables, no workflow service, no jobs,
no external integrations. CRITICAL: Auditoria.tsx requires `row.cliente` (severity "obrigatorio"),
but `licenses.cliente` (free text) is never written by the real create/edit flow (only `cliente_id`
is) — every license ever created via the real UI is flagged incomplete. RELATION_MISMATCH:
`obra_musical`/`artista`/`artista_id`/`cliente` appear designed to snapshot the licensed work/
artist/client at negotiation time but are never written — the view modal always re-reads the
CURRENT state live, so a license's displayed title/artist can silently change retroactively if the
underlying work/artist is edited later. `report-form-contracts.ts` carries a stale, now-incorrect
comment claiming `amount`/`currency`/`percentage` "never persist" (current code proves otherwise,
with its own comment confirming a symmetric mapping) — but the real, current consequence is that
`percentage`/`remuneration_type` are excluded from the export contract, making PERCENTAGE-type
remuneration invisible in any report; the same contract's `searchableColumns` still reference the 3
confirmed-dead denormalized columns. `status` has no workflow/transition validation and "expirada"
is entirely manual (no job, no lazy calculation, no notification) — a license past its `data_fim`
stays "Ativa" indefinitely. No relation to `contracts` (no `contrato_id`) or `accounting` (no event
emission) despite both being conceptually required for real sync licensing; no rights-holder/
clearance modeling at all. Dead "Rádio" filter option; KPI "Valor Total" understates
percentage-only remuneration; minor accent-slugify data divergence for "Mecânica". Same
`PaginationDto.limit=50` truncation as every prior module; 2 dead Zustand stores confirmed via
grep. AUTHORIZATION_GAPS: 0, TENANT_ISOLATION_GAPS: 0. UNMAPPED_*: 0.
UNKNOWN_FIELD_CLASSIFICATIONS: 0.
NEXT_MODULE: marketing

### MODULE: marketing
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/marketing.md`
Summary: largest, most architecturally fragmented module this session — 13 physical tables,
backend split across `campaigns/` + `marketing/` (33 files), ~103 frontend files. CRITICAL: two
entirely separate, parallel campaign systems write to the same `campaigns` table. System A
(`CampaignsController`, `/campaigns`) has an English DTO spread directly onto a Portuguese,
column-identical entity with zero translation — `POST /campaigns` would fail on a NOT NULL
constraint — confirmed unreachable by any real frontend consumer (dead/orphaned, along with its
sibling `CampaignOperationsController` and the `campaign_tasks`/`campaign_assets` tables). System B
(`MarketingCampaignBuilderController`, `/marketing/campaigns/draft`) is the real, active system —
it writes to the SAME table with `tipo` hardcoded to `'marketing_builder'` and almost all real data
(objective/promotedEntity/platforms/audience/utm) living only in `metadata.marketingBuilder.
payload` jsonb; its English-uppercase status vocabulary is entirely incompatible with System A's
Portuguese-lowercase one, both written to the same physical `status` column. `campaigns.artista_id`
is never populated by the real flow (link lives only in the jsonb payload). Reinforced the Phase 1
`campaign_assets.file_size`/`.mime_type` CODE_FIELD_ONLY finding — now confirmed the whole
subsystem it belongs to is itself orphaned. Content scheduling (`marketing_content_posts`) is a
genuinely real BullMQ-backed queue (delay, retries, job tracking) whose actual provider-publish
step always throws an explicit, honest stub error — same "never fake success" discipline as
`integrations.md`. CONFIRMED FABRICATED metric: `Campanhas.tsx`'s "Gasto Total" falls back to
`budget * 0.41` (an arbitrary coefficient) whenever real cost/conversion data is unset, displayed
identically to genuine data — no ad-platform metrics are ever synced despite Meta/Google/TikTok/
YouTube having real OAuth connections (confirmed in `integrations.md`) for other purposes. Closed 3
cross-module pendencies: **artist↔marketing** (campaign linkage via `targetId`/`promotedEntityId`
works; the equivalent content linkage is structurally broken — `marketing_content_posts` has no
`target_id` column at all, so the Artist 360 profile's Marketing→Conteúdos tab is permanently
empty); **audiovisual↔marketing** (`audiovisual_projects.campaign_id` confirmed targets
`campaigns.id`, a real filterable logical FK); **leads↔marketing attribution** (confirmed NO_MODEL
— `leads` has no `campaign_id`/`utm_*`, the campaign side's `utm` field is free-form and never
correlated). A real, non-trivial cross-domain automation was confirmed:
`MarketingProjectsService.createFromCompletedProject()` auto-creates a marketing workspace + cover-
art task when a `projects`-module project completes. No `Auditoria.tsx` section exists for
marketing (confirmed absent). 1 ENUM_MISMATCH (critical), 3 RELATION_MISMATCH, 1
CREATE_MAPPING_MISMATCH, 1 EDIT_MAPPING_MISMATCH, 1 PUBLICATION_GAP, 1
METRIC_SOURCE_OF_TRUTH_GAP (fabricated data), 1 METRIC_MAPPING_GAP, 1 ATTRIBUTION_GAP, 1
FINANCIAL_INTEGRATION_GAP, 1 TRUNCATION_GAP. AUTHORIZATION_GAPS: 0, TENANT_ISOLATION_GAPS: 0.
UNMAPPED_*: 0. UNKNOWN_FIELD_CLASSIFICATIONS: 0.
NEXT_MODULE: monitoring

### MODULE: monitoring
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/monitoring.md`
MONITORING_DOMAIN_MEANING: CATALOG_MONITORING + ARTIST_MONITORING (unauthorized-use detection, ECAD
royalty reconciliation, DMCA-style takedowns) — determined by evidence, NOT application
observability (that vertical is already fully covered architecturally by Pino/OTel/Sentry/
Prometheus, docs 52/68, with zero tenant-facing surface here). CRITICAL routing discovery:
`/monitoramento` unconditionally redirects to `/rights-monitoring` (`catalog.routes.tsx`), making
`Monitoramento.tsx` — a real, mostly well-built component wired to genuine data
(`useDeteccoes()`/`content_detections`, `GET /ecad-reports`) with honest empty-states — structurally
unreachable. The page users actually land on, `RightsMonitoring.tsx`, imports directly from
`rights-source.ts`, whose own comment states the backend has no real endpoints yet for public
executions/broadcast/cue sheets/setlists — all 5 exported arrays are hardcoded empty
(`RIGHTS_DATA_IS_MOCK=false`, honest absence not fake data) — the reachable Rights Monitoring
experience shows zero data across all 6 tabs, permanently, by design. CRITICAL, operationally-
confirmed bug building on an existing Phase 1 finding: `TakedownEntity` declares 4 `@Column`
properties (`url`/`obra_id`/`artista_id`/`resposta`) absent from the live table (already flagged
`CODE_FIELD_ONLY`) — this audit found the exact trigger: `TakedownsService.create()`
unconditionally sets `url: dto.url_infracao ?? null` on every call, so every real `POST /takedowns`
from the reachable `/takedowns` UI fails with a SQL error (the frontend's own mapping is correct;
the bug is entirely backend-side). `content_detections` is correctly mapped end-to-end but has zero
reachable UI creation path (the only form lives inside the dead page); ACRCloud (real, confirmed in
`integrations.md`) is never connected to it. No alerts/rules/incidents/notifications exist in any
form. Confirmed NO fabricated data anywhere in this module (contrast with `marketing.md`'s
`budget*0.41`) — every empty/zero state is honestly labeled, consistent with the "never simulate
success" discipline seen system-wide. No `Auditoria.tsx` section exists for this domain (confirmed
absent). 4 CODE_FIELD_ONLY, 1 RELATION_MISMATCH, 1 CREATE_MAPPING_MISMATCH, 1
EDIT_MAPPING_MISMATCH, 1 EXTERNAL_INTEGRATION_GAP, 2 REAL_MAPPING_GAP (dead route + no creation
path), 1 MOCK_DATA_GAP (honest empty), 1 TRUNCATION_GAP. AUTHORIZATION_GAPS: 0,
TENANT_ISOLATION_GAPS: 0. UNMAPPED_*: 0. UNKNOWN_MONITORING_CLASSIFICATIONS: 0.
NEXT_MODULE: musicchat

### MODULE: musicchat
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/musicchat.md`
MUSICCHAT_RUNTIME_STATUS: PARTIAL — resolved by direct evidence, not by reusing any prior historical
decision. MusicChat is NOT an AI/LLM chat assistant (exhaustive keyword search for openai/anthropic/
llm/embedding/vector/gemini/groq/mistral/ollama/rag/completion returned zero matches anywhere in the
codebase) — it is a real customer-support omnichannel inbox (`conversations`/`conversation_messages`/
`conversation_notes`, a general-purpose messaging domain also used by `leads`) plus a triage/escalation
automation layer (`musicchat_automation_settings/events/notifications`). Both frontend routes are
reachable (`/chat`, `/admin/musicchat/automacoes`); both backend controllers (21 endpoints combined)
are fully implemented with **zero** DTO/entity field-name mismatches — a rare, fully-clean mapping for
this audit series, unlike the critical create-bugs found in `contracts`/`leads`/`marketing`/
`monitoring`. Classified PARTIAL (not ACTIVE) specifically because the schema/UI fully model 5 external
channels (whatsapp/instagram/facebook/tiktok/email) but **no webhook/ingestion endpoint exists
anywhere** to actually receive an external message — `POST .../automation/inbound` has no automatic
trigger (confirmed: zero "webhook" matches in the module). NOTABLE POSITIVE FINDING: `RealtimeService`
is a genuinely real Supabase Realtime broadcast publisher (replacing a legacy Socket.IO gateway
incompatible with Vercel's stateless functions) and `ConversationsService` correctly calls it at all 7
state-changing operations; the frontend's `useWsEvent`/`useWebSocket` hooks are confirmed built on the
**same real transport** — the first fully-real, Supabase-bridged realtime chain confirmed in this
entire audit series. REALTIME_GAP (reverse-direction, novel this session): despite the real publisher
and real transport, the centralized app-wide subscriber (`useRealtimeSync.ts`) never subscribes to any
`conversation:*` event — backend publishes correctly, nobody listens. FILE_STORAGE_GAP: `MusicChat.tsx`
attachments use `URL.createObjectURL(file)` (client-only, ephemeral `blob:` URL), never uploaded to real
storage — persisted verbatim in the `attachments` jsonb column, meaningless after reload/to other users.
0 authorization gaps, 0 tenant-isolation gaps (all 19 service methods carry explicit `tenant_id`
predicates, all 21 endpoints carry tiered `@RequireRole`), 0 secret/PII logging risk, 0 fabricated data.
AI/RAG section resolved fully N/A by evidence (AI_PROVIDER_USED=NONE, RAG_STATUS=NOT_IMPLEMENTED,
CREDENTIALS_TO_ADD_NOW=0). API_V2_MIGRATION_REQUIREMENT: PARTIAL_REQUIRED — recorded explicitly so the
non-existent external-channel ingestion concept is not silently promoted to an API v2 requirement; the
real conversations/messages/notes/automation-settings surface should migrate. 1 REALTIME_GAP, 1
FILE_STORAGE_GAP, 1 EXTERNAL_CHANNEL_INGESTION_GAP, 1 TRUNCATION_GAP (systemic limit=50).
AUTHORIZATION_GAPS: 0, TENANT_ISOLATION_GAPS: 0. UNMAPPED_FIELDS: 0. UNKNOWN_FIELD_CLASSIFICATIONS: 0.
NEXT_MODULE: projects

### MODULE: projects
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/projects.md`
PROJECT_DOMAIN_MEANING: two truths, both evidenced — the schema's intent (per
`FinancialOperationalBridges` migration's own docstring) is a UNIVERSAL_FINANCIAL_PROJECT that
marketing/audiovisual can optionally link to; the only reachable real UI (`ProjetoFormModal.tsx`)
treats it exclusively as a MUSIC_RELEASE_PROJECT (album/EP/single with a rich per-track composer/
performer/producer sub-form). CRITICAL, code-evidenced finding: `ProjectPlanningAutomation` (a real
AI feature that generates an operational plan on project completion, saved to
`projects.metadata.aiPlan`) issues raw SQL selecting `nome`/`data_fim` — both stale/non-existent
columns (`nome` was renamed to `titulo` by migration `20260718000013`, confirmed via the migration's
own `ALTER TABLE ... RENAME COLUMN`; `data_fim` never existed on `projects` at all). Every real
project completion fires this query, which throws a SQL error — the AI planning feature is 100%
broken, silently, on every invocation (failure is isolated so completion itself still succeeds).
`artista_id`/`orcamento` are real DTO/entity fields never set by the only reachable create/edit
form — confirmed to break two real downstream consumers: `Projetos.tsx`'s own "Artista" filter can
never match anything, and Artist 360's "Projetos" count/list is permanently zero for every artist.
Confirmed a REAL_WORKFLOW (5-state machine, role-gated, server-enforced via `WorkflowService
.transitionInTx`) for status — but the raw Edit-form Status select offers only 4 of 5 real values
(missing `revisao`) and doesn't restrict input to legal transitions, unlike the ViewModal's
correctly-gated `WorkflowTransitionPanel` (`WORKFLOW_GAP: PARTIAL`). `FILE_STORAGE_GAP`: the
audio-upload control is a hardcoded no-op stub (`uploadFile` always returns `null`) — worse than the
`blob:`-URL pattern found in `musicchat.md`, not even an ephemeral reference is kept.
`project_assets` (real table/entity) is fully orphaned — zero controller/service/consumer anywhere.
Confirmed from the `projects` side the exact `accounting.md` "P&L por Projeto" finding:
`transactions.projeto_id` is real, populated, but logical-only (no physical FK, same pattern as
`works.projeto_id`/`shares.artista_projeto_id`) and simply never read by that report tab. Resolved
two real cross-module FK questions with direct evidence: `audiovisual_projects`/
`marketing_projects.financial_project_id` are both real composite FKs → `projects(tenant_id, id)`
but never written by any frontend form in either module; `marketing_content_posts.project_id`
(flagged ambiguous, left open in `marketing.md #13`) is conclusively resolved to mean
`marketing_project_id` (marketing's own internal concept), not this module's `projects` table —
closing that pendency. `TRUNCATION_GAP`: `useProjetos()` sends zero filter/pagination params;
backend defaults `limit=50` — every client-side filter, search, and all 4 KPI cards operate on a
silently-truncated dataset for any tenant with >50 projects, with no "showing N of M" indication.
Confirmed Create=Edit field-set equivalence holds exactly (verified, not presumed). 2 dead frontend
files (`hooks/projects.store.ts`, `services/projects.service.ts`, zero consumers). 1
DISPLAY_MAPPING_MISMATCH, 1 WORKFLOW_GAP, 1 FILE_STORAGE_GAP, 1 PROGRESS_CALCULATION_GAP (confirmed
NOT_IMPLEMENTED, not invented), 1 FINANCIAL_INTEGRATION_GAP, 1 PROJECT_ACCOUNTING_GROUPING_GAP, 1
TRUNCATION_GAP, 5 REAL_MAPPING_GAP. AUTHORIZATION_GAPS: 0, TENANT_ISOLATION_GAPS: 0. UNMAPPED_*: 0.
UNKNOWN_FIELD_CLASSIFICATIONS: 0.
NEXT_MODULE: releases

### MODULE: releases
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/releases.md`
RELEASE_DOMAIN_MEANING: RELEASE_AS_DISTRIBUTION_OBJECT — a music single/EP/album pipeline entity
(status vocabulary `draft→...→distributed→released→archived`), explicitly distinct from "release as
phonogram grouping" (no direct relation to `phonograms` exists) and from "release as operational
project" (`projects` is a wholly separate entity). **CRITICAL, code-evidenced finding — the most
severe found in this entire audit series**: `LancamentoFormModal.tsx` unconditionally injects an
`internal_status` field into every `POST /releases`/`PATCH /releases/:id` payload, but that field is
declared in neither `CreateReleaseDto`/`UpdateReleaseDto` nor on `ReleaseEntity` — the global
`ValidationPipe({whitelist:true, forbidNonWhitelisted:true})` rejects the ENTIRE request with HTTP 400
before it reaches the controller. The module's own mapper file documents this exact rule in its own
header comment and correctly avoids it; the violation is introduced 3 lines later in the calling
component. **Net effect: every "Novo Lançamento" create and every edit submitted via the real UI is
rejected and never reaches the database** — the entire module's primary CRUD flow is 100%
non-functional today. Root cause traced: the frontend's 7-value display-status model
(`resolveReleaseStatus()`) depends on a 3-tier priority read of `platform_status`→`internal_status`→
`status`, neither of the first two ever having been added to the backend contract — a deliberate,
unfinished product feature, not a typo. Compounding second bug in the same flow: the post-create
follow-up call force-sets `status:"distributed"` directly from `DRAFT`, a transition not present in
the real workflow graph (only `DRAFT→METADATA_PENDING` is legal), so it would independently fail even
if the first bug were fixed. SECOND independently critical bug found:
`ReleaseEventsHandler.onReleaseApproved()` persists an "artist notification" with
`user_id: artistId` (an `artists.id` value) — but `NotificationEntity.user_id` is semantically a
`users.id`; no artist-to-user link exists anywhere in this schema, so the notification is permanently
unreachable by any real user's query — a silent dead write. `release_works` (real join table) is
confirmed schema-only and never populated, independently from both the `catalog` side (already
documented) and the `releases` side (the Work-picker is a one-time autofill convenience only, never
sent in any payload). Tracklist has no relational model at all — tracks live entirely in
`releases.metadata.faixas` jsonb (order = array index, no position column), per-track ISRC
disconnected from `phonograms.isrc`, per-track audio never uploaded. Genuine POSITIVE contrast: cover
artwork upload (`capa_url`) IS a real, working end-to-end Cloudflare R2 upload, unlike `projects`'
hardcoded-stub audio upload or `musicchat`'s ephemeral `blob:` URLs. Revalidated all 6 distributor
providers (ONErpm/DistroKid/Symphonic/SoundOn/MusicPro/SomVibe) — confirmed exactly matching
`integrations.md`: 6 referenced, 0 active, 6 STUB, "connected" state a never-written `localStorage`
key. Closed 3 real cross-module FKs with direct evidence: `audiovisual_projects.release_id` (real,
used as a genuine query filter), `transaction_allocations.release_id` +
`performance_metric_entries.release_id` (both real FKs, direct accounting relation, not via project
bridge) — and disproved a plausible-looking one: marketing's `Metricas.tsx` "releaseId" is confirmed a
synthetic derived field, not a real column. `TRUNCATION_GAP`: same `limit=50`-no-override pattern as
every prior module. 1 CREATE_MAPPING_MISMATCH (critical), 1 EDIT_MAPPING_MISMATCH (critical, same root
cause), 1 WORKFLOW_GAP, 2 DISPLAY_MAPPING_MISMATCH, 1 WORK_MAPPING_GAP, 1 TRACKLIST_MAPPING_GAP, 1
IDENTIFIER_GAP, 1 DEFAULT_MISMATCH, 2 REAL_MAPPING_GAP, 1 ARTWORK_STORAGE_GAP, 6
DISTRIBUTION_IMPLEMENTATION_GAP, 1 TAKEDOWN_GAP, 1 TRUNCATION_GAP, 1 RELEASE_ATOMICITY_GAP (latent).
AUTHORIZATION_GAPS: 0, TENANT_ISOLATION_GAPS: 0. UNMAPPED_*: 0. UNKNOWN_FIELD_CLASSIFICATIONS: 0.
NEXT_MODULE: reports

### MODULE: reports
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/reports.md`
Inventory: `docs/backend-v2/field-traceability/reports/report-inventory.json`
REPORTS_DOMAIN_MEANING: EXPORT_CENTER — determined by direct evidence, not presumed. A single
frontend page (`Relatorios.tsx`, own comment: "consome EXCLUSIVAMENTE a API... o backend é a única
fonte da verdade") over a closed, 22-table registry (`report-module-registry.ts`), each with an
explicit field contract (`report-form-contracts.ts`, actively consumed, guarded by a permanent spec
test) — plus exactly 1 computed report (`accounting_summary`, "Contabilidade" = P&L by artist). No
saved reports, scheduled reports, report templates, CSV, or PDF exist anywhere in the codebase
(confirmed absent, not undiscovered). **Assessed as the single most rigorously engineered module found
in this entire audit series**: full column/filter/sort allowlisting with parameterized SQL throughout
(zero query-injection risk), real formula-injection neutralization on every exported cell, and — a
first this session — **zero TRUNCATION_GAP**: exports bypass every other module's paginated list
endpoints entirely, querying physical tables directly with a fail-closed 50,000-row ceiling (413 error,
never a silent partial file) instead of the silent `limit=50` truncation pattern found in virtually
every other module audited this session. Tenant isolation confirmed at 4 independent defense-in-depth
layers. One genuine `EXPORT_PRIVACY_GAP` found: `artists`' email/telefone/cpf_cnpj get real
column-level encryption (decrypted only at authorized export), but `banco/conta/chave_pix/
titular_conta` (bank data, same entity) are stored as plain unencrypted jsonb metadata and exported in
plaintext at the identical permission tier — no apparent product reason for the two different
sensitivity treatments on equivalently-sensitive fields. Resolved `contracts.observacoes` per
instruction: `CONTRACT_OBSERVACOES_EXPORTED: SIM`, `PII_RISK_INHERITED_FROM_CONTRACTS: SIM` (inherited
unchanged, plaintext, no additional masking). Revalidated the accounting.md-flagged 3-sheet
`exportFieldList` in `TransacaoFormModal.tsx`: confirmed exactly 3 worksheets, confirmed genuinely dead
(never wired to any button), and confirmed it does **not** functionally belong to the Reports module
(uses `xlsx` directly, not `ExportEngineService`) — recorded as an isolated `XLSX_RULE_VIOLATION` on
that one artifact without inflating the Reports module's own (fully compliant) count. Closed the
P&L-by-project question definitively: the module's only computed report groups correctly **by artist**
(real FK join), never attempts a project-grouped P&L at all, so `accounting.md`'s "P&L por Projeto"
bug is never inherited into any export because no such export exists. Confirmed the `campaigns` table
(site of `marketing.md`'s dual-system/fabricated-metric findings) is entirely absent from the registry
— unreachable through Reports. Two minor gaps: `searchableColumns` is computed but never consumed by
the query builder (dormant on both sides); date filtering supports exact-match equality only, no true
range operator. 1 FILTER_MAPPING_MISMATCH, 1 DATE_RANGE_MISMATCH, 1 REPORT_SOURCE_GAP, 1
EXPORT_PRIVACY_GAP, 1 XLSX_RULE_VIOLATION (external artifact). TRUNCATION_GAPS: 0,
EXPORT_COMPLETENESS_GAPS: 0, REPORT_QUERY_SECURITY_GAPS: 0, AUTHORIZATION_GAPS: 0,
TENANT_ISOLATION_GAPS: 0. UNMAPPED_*: 0. UNKNOWN_REPORT_CLASSIFICATIONS: 0.
NEXT_MODULE: rh

### MODULE: rh
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/hr.md`
RH_DOMAIN_MEANING: internal HR/employee records management (funcionários, folha de pagamento, férias/
ausências, documentos) — Employee is structurally distinct from platform User/OrgMember, confirmed no
FK exists between them. **CRITICAL — ties with (and arguably exceeds) `releases.md` for the most
severely broken CRUD surface found this session**: FOUR independent create-flow breaks, one per
sub-resource, all confirmed by direct DTO-vs-submitted-payload comparison. (1) Employee create/update:
`CreateEmployeeDto` requires `nome` and whitelists 13 fields; `FuncionarioFormModal.tsx` never sends
`nome` and sends 8 unwhitelisted fields (`nome_completo/rg/data_nascimento/endereco/setor/salario_base/
observacoes/vinculo_usuario_id`) — every create/edit rejected with 400. (2) Payroll create: DTO wants
`employee_id`/`competencia`, form sends `funcionario_id`/`mes_referencia` — same rejection. (3)
Leave-request create: same pattern (`employee_id` vs `funcionario_id`/`dias_totais`). (4) The
"Documentos" tab is wired to the **wrong endpoint entirely** (`documentos_funcionario` →
`/hr/employees`) — lists every employee mislabeled as a document, and uploads fail metadata creation
the same way as (1), even though the underlying file genuinely reaches Cloudflare R2 first (an
orphaned-upload pattern). **SECOND, independent critical finding**: even reading the employee list is
broken — migration `20260712000003_HrFormFieldColumns.ts` added 8 real physical columns
(`nome_completo/rg/data_nascimento/endereco/setor/salario_base/observacoes/vinculo_usuario_id`) that
`EmployeeEntity` never declares, so `GET /hr/employees` never returns them — the list table renders
blank name/sector/salary/user-link for every row, and search/the "Setor" filter are consequently both
completely non-functional. The same physical/entity drift recurs independently on `payroll_entries`
and `leave_requests` (16 orphaned columns total across 3 tables), despite the originating migration's
own docstring stating the service was supposed to mirror form fields into these legacy columns — never
implemented. No `PATCH`/`DELETE` route exists for payroll at all; leave-requests has exactly one
status-changing route (hardcoded to `aprovado`, no reject path) — yet the UI wires up working
edit/delete/reject actions that call nonexistent routes (404). `ENUM_MISMATCH` confirmed on
`EmployeeStatus` (3 of 5 values diverge frontend/backend). No workflow engine exists for employees or
leave requests. Payroll net-salary math is 100% client-computed, zero server validation. **Positive,
independently-confirmed findings**: tenant isolation is sound (explicit `tenant_id` predicate on every
query), authorization is appropriately tiered, and PII encryption (email/telefone/cpf) mirrors the same
deliberate, correct pattern found in `reports.md` for artists/clients — these security axes are
structurally sound even though the functional CRUD built on top is broken. 3 CREATE_MAPPING_MISMATCH
(critical), 1 EDIT_MAPPING_MISMATCH (critical), 8 DATABASE_COLUMN_ONLY, 4 REAL_MAPPING_GAP, 1
ENUM_MISMATCH, 1 WORKFLOW_GAP, 1 DISPLAY_MAPPING_MISMATCH, 1 STORAGE_GAP, 1 TRUNCATION_GAP.
AUTHORIZATION_GAPS: 0, TENANT_ISOLATION_GAPS: 0. UNMAPPED_*: 0. UNKNOWN_FIELD_CLASSIFICATIONS: 0.
NEXT_MODULE: settings

### MODULE: settings
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/settings.md`
SETTINGS_DOMAIN_MEANING: multi-surface configuration hub (tenant profile/branding, user preferences,
notifications, security, access, integrations, localization, billing, feature configuration, public
registration) — **no single backend `settings` module exists**; the frontend aggregates several
independently-real backend modules (`company-settings`, `notifications`, `billing`, RBAC) plus one
deliberately-stubbed local concept (operational lists). Notification preferences confirmed a dead loop
from both ends independently: the real, validated, audited backend
(`GET/PATCH /notifications/settings`, tenant-scoped, 14 keys) has zero frontend callers anywhere; the
UI's "Automações" tab instead reads/writes a pure-`localStorage` hook, 4 of whose switches are
hardcoded `<Switch checked={true}>` with no handler at all (permanently on, non-interactive) —
separately, the one real email-sending path never checks `notification_settings.enabled` before
dispatching either. Branding logo upload confirmed broken end-to-end: real, genuinely good client-side
validation (MIME + magic-byte sniffing) POSTs to `/workspaces/{id}/logo`, a route that **does not
exist anywhere on the backend** (the service file's own comment admits this is aspirational) — the
storage target already exists and is already read/written by `company-settings.service.ts`, nothing
wires an actual upload into it. Business-critical `LOCAL_STORAGE_GAP` confirmed: the organization's
public-registration slug (real, unique DB columns exist) is only ever set in one specific admin's
browser `localStorage`, never sent to any backend endpoint — compounding with a second, independent,
**inverse-direction** finding: the "Cadastro Público" tab's buttons are disabled with a stale "backend
not active yet" message even though `public-registration.controller.ts`/`leads.service.ts` already
implement this feature live server-side. Billing found fragmented across **three** inconsistent UI
surfaces: the main tab calls a nonexistent `GET /billing/invoices` (only the super_admin
`/billing/admin/invoices` exists, so invoices are silently, permanently empty); a standalone
`Billing.tsx` hardcodes plan pricing directly, contradicting the codebase's own "never hardcode plans"
governance comment; a third card shows an entirely fake, hardcoded payment-method display with
toast-only action buttons instead of the real Stripe checkout/portal calls that already exist and work
correctly one file over. Feature flags (`FeatureGate`, 13 gated pages) confirmed enforced **client-side
only** — zero backend guard checks plan entitlement anywhere; separately, every gated page's own
"upgrade" button links to `/settings/billing`, a route that **isn't registered anywhere** — a systemic
dead link. Localization (timezone/currency/language) is genuinely persisted server-side but has zero
UI to set it and zero downstream consumer anywhere in the product. **Positive, distinguishing finding**:
the "operational lists" stub is a deliberate, self-aware no-op (extensively documented in its own code
comment, explaining a prior crash that forced this fail-silent design) — not a disguised fake-success
bug, unlike several patterns found elsewhere this session. Tenant isolation and authorization confirmed
sound throughout at the backend layer for every real endpoint found. 15 SETTINGS_PERSISTENCE_GAP, 1
NOTIFICATION_SETTINGS_GAP (systemic), 5 FAKE_SETTINGS_SAVE_GAP, 1 LOCAL_STORAGE_GAP, 6
SECURITY_SETTINGS_GAP, 4 REAL_MAPPING_GAP, 4 SETTINGS_CONSUMER_GAP, 1 BRANDING_GAP, 5
UNUSED_SETTING_GAP, 1 FEATURE_ENFORCEMENT_GAP (systemic). AUTHORIZATION_GAPS: 0,
TENANT_ISOLATION_GAPS: 0. UNMAPPED_*: 0. UNKNOWN_SETTING_CLASSIFICATIONS: 0.
NEXT_MODULE: support

### MODULE: support
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/support.md`
SUPPORT_DOMAIN_MEANING: one real, tenant-scoped ticket system (`SUPPORT_TICKETS`) with **four
entirely fake sub-features** bolted onto the same frontend module (`SUPPORT_CHAT`,
`KNOWLEDGE_BASE`/FAQ, `INCIDENT_SUPPORT`/status page, a feature/bug-request board) — confirmed by the
module's own hook file header comment, which states outright that non-ticket features have no real
endpoint and every mutation must fail explicitly (toast error) rather than simulate a backend in
localStorage — a deliberate, self-documented honesty pattern distinct from most fake-feature findings
elsewhere this session. **Closed the `admin.md` cross-module pendency on `AdminSupport`** with full
end-to-end evidence: confirmed the "Support Hub"/platform-wide framing is backed by exactly one
endpoint (`GET /support-tickets?limit=200`), the *identical* tenant-scoped route the regular module
itself uses — no `super_admin`-only or cross-tenant route exists anywhere. Classified
`UI_ONLY_CROSS_TENANT_FRAMING` — a functional gap relative to what the panel promises, explicitly
**not** a security defect (isolation is total and correct, no elevated-privilege path exists anywhere
for anyone). **Closed `AdminKnowledge`'s classification** (`DEV_ONLY`): confirmed it has no
independent knowledge concept — it reuses the same fake `useKnowledgeArticles()` hook from `support`,
and self-disables via an `IS_PROD` gate in production rather than ever exposing the mock to real users.
**Most severe new finding**: a three-way ticket-status `ENUM_MISMATCH` — backend has 6 real states
(including `pending_user`/`cancelled`), the `support` module's own frontend type has only 5 (using
`waiting_customer` instead, omitting `cancelled`), and the `admin` module has a **third**, independently
different 5-value spelling (`waiting`) — confirmed a reachable, unguarded `TypeError` in
`AdminSupport.tsx` for any ticket genuinely moved to either missing state. A second, independent
`ENUM_MISMATCH` on category (backend DTO allows 5 support-type values; frontend declares 10 unrelated
domain-area values) creates a create-time rejection risk. Attachments confirmed fake, and specifically
**more** fake than any other pattern found this session — the chat simulator's file handler doesn't
even create an ephemeral blob reference, just echoes filename/size text into a message that itself
never persists; the real ticket flow has no attachment UI at all. Underneath the fake layers, a
genuinely well-engineered real subsystem: real workflow engine (7 role-gated transitions, enforced in a
DB transaction), 0 authorization gaps, 0 tenant-isolation gaps, a real (if narrow) SLA layer, and a real
AI-triage automation. Found a duplicate/misdirected notification pattern on ticket resolution (two
separate DB rows for two different recipients — the requester via one handler, the *resolving manager
themselves* via a second, generic handler — plus one real Supabase Realtime broadcast). Confirmed the
"Solicitante" field displays a raw UUID with no name-resolution join anywhere (no relation to
`crm-relationships`/contacts exists to even use for that). 2 ENUM_MISMATCH, 1 CODE_FIELD_ONLY, 2
DISPLAY_MAPPING_MISMATCH, 1 ADMIN_SUPPORT_SCOPE_GAP, 1 MESSAGE_MAPPING_GAP, 1
ATTACHMENT_STORAGE_GAP, 1 SLA_GAP, 1 KNOWLEDGE_BASE_GAP, 1 NOTIFICATION_GAP, 1 ASSIGNMENT_GAP, 1
TRUNCATION_GAP (mitigated — explicit `limit=200` override, unlike the systemic zero-override pattern
elsewhere), 1 REAL_MAPPING_GAP. AUTHORIZATION_GAPS: 0, TENANT_ISOLATION_GAPS: 0. UNMAPPED_*: 0.
UNKNOWN_SUPPORT_CLASSIFICATIONS: 0.
NEXT_MODULE: workspace

### MODULE: workspace
STATUS: COMPLETE
Report: `docs/backend-v2/field-traceability/modules/workspace.md`
WORKSPACE_DOMAIN_MEANING: "workspace" is purely the UI/DTO-facing name for the `tenants` database
table — the app-scoping isolation unit. **WORKSPACE_TENANT_RELATIONSHIP: SAME_ENTITY**, confirmed by
direct read of `WorkspaceProvisioningService.provision()` (`ProvisionWorkspaceDto.workspaceName`/
`workspaceSlug` write directly into `tenants.name`/`tenants.slug`). `organizations` is a genuinely
distinct legal/billing parent (CNPJ, billing_status, industry) via `tenants.org_id` FK — 1:1 in
practice through provisioning, not schema-enforced. **Precise, non-obvious finding on the canonical
identifier**: the JWT claim used everywhere for tenant resolution is *named* `org_id`, but its real
runtime value (written by provisioning: `app_metadata: {org_id: membership.tenant_id, ...}`) is always
a `tenants.id` — a confusing naming artifact from an earlier design, not a semantic pointer to
`organizations`; self-consistent with `TenantBootstrapResolver`'s 3-way OR match query.
`CANONICAL_TENANT_IDENTIFIER: tenants.id`. Confirmed provisioning is genuinely atomic and idempotent —
the cleanest create-flow found in the entire audit series (0 `CREATE_MAPPING_MISMATCH`): single
transaction, two advisory locks (per-user, per-slug), existing-membership short-circuit, Supabase
metadata sync deliberately sequenced before commit so no split-state is reachable. Confirmed
`TenantGuard` — the authorization chokepoint for the whole system — never trusts the client-supplied
`X-Tenant-ID` header as authority, only as a fail-closed consistency check against the JWT-resolved
tenant; membership is independently re-validated from `org_members` on every request. **This closes
the multi-tenant identity chain every other module in this 24-module series depended on and assumed
correct** — now confirmed with direct evidence. Confirmed no workspace-switcher exists anywhere
(one JWT session = one tenant claim, set once, never offered as a selectable list) — a confirmed
architectural characteristic, not a gap, even though the schema itself doesn't prevent multi-tenant
membership per user. Confirmed the dual role model (`role` string + `role_id` FK) is disciplined and
gap-free at the membership level, with last-owner protection enforced on both demotion and removal.
Found a **third** independent instance of the "fragmented duplicate UI surface" pattern
`settings.md` already documented twice (billing, password-change): `/usuarios` can send invites but has
zero UI for pending-invitation visibility/resend/cancel, while `Configuracoes.tsx`'s "Usuários" tab has
the complete surface via the same backend. **Closed the `settings.md` public-registration-slug
pendency**: confirmed the slug is semantically workspace/tenant-owned (`tenants.slug`), resolving that
module's finding's domain-ownership question conclusively. Found one genuine, *bounded* (not
unbounded) `SESSION_STALENESS_GAP`: a 60-second distributed-cache TTL on tenant/membership resolution
means a just-deactivated membership could retain brief continued access — self-healing, not a
permanent bypass, not counted as a tenant-isolation failure. Confirmed the one genuinely cross-tenant
admin surface (`/billing/admin/tenants`, `super_admin`-gated) is properly backend-authorized, distinct
from the UI-only-framed `AdminAudit`/`AdminSupport` pattern found elsewhere — and confirmed no
tenant-creation capability exists in any admin panel, consistent with `admin.md`. 1
DISPLAY_MAPPING_MISMATCH, 1 PUBLIC_SLUG_GAP (inherited, now resolved), 1 SESSION_STALENESS_GAP.
AUTHORIZATION_GAPS: 0, TENANT_ISOLATION_GAPS: 0, PROVISIONING_ATOMICITY_GAPS: 0,
PROVISIONING_IDEMPOTENCY_GAPS: 0, LAST_OWNER_PROTECTION_GAPS: 0, STORAGE_TENANT_ISOLATION_GAPS: 0.
UNMAPPED_*: 0. UNKNOWN_WORKSPACE_CLASSIFICATIONS: 0.

NEXT_MODULE: NONE

## PHASE 2 MODULE AUDIT — COMPLETE

```
PHASE_2_MODULE_AUDIT_COMPLETE: SIM
```

All 24 modules registered across this audit series (`accounting`, `admin`, `artist`, `audiovisual`,
`auth`, `catalog`, `contracts`, `crm-relationships`, `dashboard`, `events`, `integrations`,
`inventory`, `leads`, `licensing`, `marketing`, `monitoring`, `musicchat`, `projects`, `releases`,
`reports`, `rh`, `settings`, `support`, `workspace`) are `STATUS: COMPLETE` in
`field-traceability.json` — `modulesPending` is now empty (verified programmatically before this
closure was recorded), `modulesCompleted` holds all 24. Every module's report exists at
`docs/backend-v2/field-traceability/modules/<name>.md`, zero `UNMAPPED_*`/`UNKNOWN_*` fields remain
outstanding in any of them, and every cross-module pendency raised during the series (`AdminSupport`
cross-tenant framing, `AdminKnowledge` classification, the public-registration-slug ownership question,
the `release_works`/`marketing_content_posts.project_id`/audiovisual `financial_project_id` relations,
among others) was traced to a documented, evidenced resolution in the module where it was closed.

This closure means only: every module has been audited, every field classified, every known gap
recorded, zero unknowns remain. It does **not** mean the backend has been reconstructed, gaps have been
corrected, API v2 is ready, database v2 is ready, or any cutover is authorized. No such activity was
started as part of this closure.

```
NEXT_PHASE: GAP_RESOLUTION_NOT_STARTED
```

## NOT DONE — remaining modules

None. All modules registered in this audit series are `COMPLETE`.

Plus, after all modules: Realtime + Storage dedicated cross-cutting pass, then consolidation into
field-traceability.json final counters + doc81 final version + auxiliary docs (forms.md,
tables-grids.md, import-export.md, relations.md, financial.md, realtime-storage.md).

## Resume plan

One module per execution, full depth, no sampling (per explicit user instruction — do not batch
multiple modules or reduce rigor to go faster). Each module's real DB-side counterpart is already
available in `database-backend-column-mapping.json` — use it as the target when mapping frontend
fields → database columns (no need to re-derive DB-side facts). Follow the same method used for
`accounting`: read actual page/component/hook/service/mapper/schema files, trace real HTTP
endpoints to real backend controllers, verify (don't assume) that called endpoints actually exist.

---

## PHASE 3 / STEP 1 — CANONICAL GAP CONSOLIDATION

```
PHASE_2_MODULE_AUDIT_COMPLETE: SIM
GAP_RESOLUTION_PHASE: STARTED
GAP_CONSOLIDATION: COMPLETE
GAPS_RESOLVED_THIS_PROMPT: 0
```

All gaps scattered across the 24 module reports have been consolidated into a single canonical,
deduplicated (by root cause, never by textual similarity), dependency-ordered register. No gap was
corrected. No schema, database, Supabase, `.env`, or credential was changed.

**Counters:** RAW_GAP_OCCURRENCES=199, CANONICAL_GAPS=167, DEDUPLICATED_OCCURRENCES=32,
DEDUP_RATIO=0.161. Severity: S0=0, S1_HIGH=26, S2_MEDIUM=76, S3_LOW=38, S4_INFORMATIONAL=27.
Waves: WAVE_0_DECISIONS=8, WAVE_1_FOUNDATIONS=0, WAVE_2_SCHEMA_AND_CONTRACT=29,
WAVE_3_CORE_DOMAIN_FIXES=53, WAVE_4_CROSS_DOMAIN_FIXES=14, WAVE_5_INTEGRATIONS=12,
WAVE_6_SECONDARY_FUNCTIONALITY=22, WAVE_7_CLEANUP=15, WAVE_NONE=14.
DEPENDENCY_EDGES=16, DEPENDENCY_CYCLES=0. USER_DECISIONS_REQUIRED=8 (registered in
`decision-register.json`, not yet asked to the user). CREDENTIAL_DEPENDENT_GAPS=3,
CREDENTIALS_TO_ADD_NOW=0.

**Artifacts created:**
- `docs/backend-v2/gap-resolution/00-canonical-gap-register.md`
- `docs/backend-v2/gap-resolution/canonical-gap-register.json`
- `docs/backend-v2/gap-resolution/decision-register.json`
- `docs/backend-v2/gap-resolution/resolution-order.json`

```
NEXT_GAP_RESOLUTION_STEP: RESOLVE_WAVE_0_DECISIONS
```

WAVE_0_DECISIONS has 8 items, so the next safe step is a dedicated, explicit decisions step (asking
the user to choose among the recorded options in `decision-register.json`) — not WAVE_1 (empty) and
not WAVE_2. **This step was not started as part of this consolidation.**

---

## PHASE 3 / WAVE 0 — DECISION DEC-001 RESOLVED

```
GAP_RESOLUTION_PHASE: STARTED
WAVE_0_DECISIONS_STATUS: IN_PROGRESS
DECISIONS_RESOLVED: 1
DECISIONS_PENDING: 7
LAST_RESOLVED_DECISION: DEC-001
```

`DEC-001` resolved: **UNIVERSAL_FINANCIAL_PROJECT**. `projects` is the canonical universal
financial/operational project entity; `projects.id` is the canonical identifier of that dimension. The
existing music-release project flow (`/projetos`, `ProjetoFormModal.tsx`, `project_tracks`,
`project_track_participants`) is a **specialization** (`MUSIC_RELEASE_PROJECT`) of that entity, not its
exclusive semantic definition — music-release-specific fields must not become universal requirements of
every `project` in the future schema/API v2. `DUAL_MODEL` was **not** selected; this decision does
**not** authorize creating `project_category`/`project_kind`/`project_domain`/`project_subtype` or any
new discriminator column now. `financial_project_id` (audiovisual/marketing → projects) and
`transactions.projeto_id` → projects are preserved as semantically valid relations. Full record:
`docs/backend-v2/gap-resolution/decision-register.json` (`DEC-001`).

This decision being resolved does **not** mean `projects`/`ProjetoFormModal.tsx` was corrected,
`GAP-0033` or `GAP-0013` were fixed, or any schema v2/API v2 work was done — all of that remains
pending in its own step. `GAP-0001` was updated (`userDecisionRequired: false`,
`blocksSchemaV2Design: false`, `blocksApiV2Implementation: false`, `resolutionWave` moved from
`WAVE_0_DECISIONS` to `WAVE_3_CORE_DOMAIN_FIXES`) but its `status` remains `OPEN` — the remaining
field-exposure work (`artista_id`/`orcamento` in `ProjetoFormModal.tsx`) is unimplemented.

Updated counters (recomputed from the JSON artifacts, not hardcoded): `OPEN_GAPS=140` (unchanged —
`GAP-0001` was already `OPEN` and remains `OPEN`), `USER_DECISIONS_REQUIRED=7` (gaps, was 8),
`BLOCKS_SCHEMA_V2_DESIGN=1` (was 2), `BLOCKS_API_V2_IMPLEMENTATION=0` (was 1), `WAVE_0_DECISIONS=7`
(was 8), `WAVE_3_CORE_DOMAIN_FIXES=54` (was 53). `DEPENDENCY_CYCLES=0`, `UNKNOWN_DEPENDENCIES=0`
(revalidated). `decision-register.json`, `canonical-gap-register.json`, `resolution-order.json` all
`VALID_JSON: SIM`.

```
NEXT_GAP_RESOLUTION_STEP: RESOLVE_DEC_007
```

Per the already-registered canonical order in `resolution-order.json` (wave → dependency → priority,
not sequential decision-ID numbering), the true next `WAVE_0_DECISIONS` item is **`DEC-007`**
(`GAP-0007`, priority 70), not `DEC-002` — `WAVE_0_DECISIONS` was always priority-ordered, and
`GAP-0007` outranked `GAP-0002` (priority 55) before `DEC-001` was resolved too. **This step was not
started.**

---

## PHASE 3 / WAVE 0 — DECISION DEC-007 RESOLVED

```
GAP_RESOLUTION_PHASE: STARTED
WAVE_0_DECISIONS_STATUS: IN_PROGRESS
DECISIONS_RESOLVED: 2
DECISIONS_PENDING: 6
LAST_RESOLVED_DECISION: DEC-007
```

`DEC-007` resolved: **RELATIONAL_TRACKLIST_MODEL**. `releases.metadata.faixas` is **not** the canonical
source of truth for a release's tracklist. A release track must have explicit relational identity and
reference a concrete `phonogram`, enabling: `Release → Release Track → Phonogram → Work → Rights/Shares`.
Domain semantics registered: `Work` = abstract composition, `Phonogram` = concrete recording, `Release
Track` = ordered occurrence of a specific recording within a release. `release → work` alone (via
`release_works`) is not sufficient — rights traceability to `works` is preserved via the phonogram's own
already-real relation (`phonograms.obra_id → works.id`), not a direct release↔work link.

**Architectural caveat, registered explicitly**: `RELATIONAL_TRACKLIST_MODEL` does **not** mean the
current `release_works(release_id, work_id)` shape is accepted as final — it lacks `phonogram_id`,
`position`/`order`, and track-level identity. `FINAL_RELATIONAL_SCHEMA_STATUS: TO_BE_DESIGNED` (new
`release_tracks` table vs. evolving `release_works` — that choice belongs to the schema-gap resolution
step, not this decision). Minimum requirements registered for that future design: `release_id`,
`phonogram_id`, `position`/`order`. The 5-step wizard and its currently-collected fields are preserved
functionally (`PRESERVES_CURRENT_WIZARD_INTENT: true`); only the persistence destination changes.
`metadata.faixas` existing content is classified `NON_CANONICAL_METADATA` (candidate
`LEGACY_DATA`/`MIGRATION_SOURCE` — exact treatment left to the migration step). Full record:
`docs/backend-v2/gap-resolution/decision-register.json` (`DEC-007`).

**Documental correction applied**: `DEC-007.reason` incorrectly cited `GAP-0053` (an unrelated
`contracts` gap — `ContractStatus.ATIVO` unreachable) as the split-sheet gap. Corrected to `GAP-0041`
(catalog: `CreateWorkDto.authors`/`.shares` validated but never persisted — the real split-sheet gap).
`GAP-0053` itself was not modified.

This decision being resolved does **not** mean `release_tracks` was created, `release_works` or
`metadata.faixas` were modified, or `GAP-0129`/`GAP-0130` were fixed — all remain pending in their own
steps. `GAP-0007` was updated (`userDecisionRequired: false`, `blocksSchemaV2Design: false`,
`resolutionWave` moved from `WAVE_0_DECISIONS` to `WAVE_2_SCHEMA_AND_CONTRACT`) but its `status` remains
`OPEN` — the final relational schema is undesigned and unimplemented.

Updated counters (recomputed from the JSON artifacts, not hardcoded): `OPEN_GAPS=140` (unchanged),
`USER_DECISIONS_REQUIRED=6` (gaps, was 7), **`BLOCKS_SCHEMA_V2_DESIGN=0`** (was 1 — `GAP-0007` was the
last remaining schema-v2 blocker; verified programmatically, not forced),
`BLOCKS_API_V2_IMPLEMENTATION=0` (unchanged), `BLOCKS_CUTOVER=1` (unchanged — `GAP-0039`, unrelated to
`DEC-001`/`DEC-007`), `WAVE_0_DECISIONS=6` (was 7), `WAVE_2_SCHEMA_AND_CONTRACT=30` (was 29).
`DEPENDENCY_CYCLES=0`, `UNKNOWN_DEPENDENCIES=0` (revalidated). `decision-register.json`,
`canonical-gap-register.json`, `resolution-order.json` all `VALID_JSON: SIM`.

`BLOCKS_SCHEMA_V2_DESIGN: 0` does **not** authorize starting schema v2 design — 6 `WAVE_0_DECISIONS`
items remain, and the established sequence is to resolve all Wave 0 decisions before starting any
subsequent wave.

```
NEXT_GAP_RESOLUTION_STEP: RESOLVE_DEC_004
```

Per the canonical order in `resolution-order.json` (wave → dependency → priority), the next
`WAVE_0_DECISIONS` item is **`DEC-004`** (`GAP-0004`, priority 60), not `DEC-002`. **This step was not
started.**

---

## PHASE 3 / WAVE 0 — DECISION DEC-004 RESOLVED

```
GAP_RESOLUTION_PHASE: STARTED
WAVE_0_DECISIONS_STATUS: IN_PROGRESS
DECISIONS_RESOLVED: 3
DECISIONS_PENDING: 5
LAST_RESOLVED_DECISION: DEC-004
```

`DEC-004` resolved: **UNIFIED_CONFIGURABLE_CONTRACT_COMPONENT**. Contracts will use one canonical
shared form/state implementation with `WIZARD` (full flow, currently `ContratoWizard.tsx` — template,
dynamic parties, manifest variables, signatories, preview, full workflow) and `QUICK` (abbreviated flow,
currently triggered by `RegistroMusicas.tsx` in `catalog` after registering a Work/Phonogram) modes,
sharing the same state model, read mapping, write mapping, and field semantics. Principle: no two
independent components may read/write the same `Contract` with divergent field contracts —
`ContratoWizard.tsx` + `ContratoFormModal.tsx` as two separate create/edit implementations is **not**
canonical. Both real entrypoints are preserved (`PRIMARY_CONTRACTS_ENTRYPOINT: PRESERVED`,
`CATALOG_QUICK_CONTRACT_ENTRYPOINT: PRESERVED`) — this decision does not authorize removing catalog
functionality; the cross-module trigger must eventually point at the canonical component's `QUICK` mode.
The decision is conceptual — it does not decide the final file identity (refactored Wizard, new shared
component, or other equivalent reorganization).

**Explicit non-canonization, registered per instruction**: this decision does **not** canonize the
current `metadata`-adjacent `observacoes` model — Wizard writes a structured JSON blob (parties/
variables) into `observacoes`, FormModal writes free text into the same column, a real, unresolved
semantic conflict (`OBSERVACOES_SEMANTIC_CONFLICT: UNRESOLVED_IMPLEMENTATION_GAP`).
`STRUCTURED_PARTIES_STORAGE_MODEL: NOT_DECIDED_BY_DEC_004`. This decision does not legitimize storing
PII inside `observacoes` — `GAP-0049` remains `OPEN`, untouched. `arquivo_url` (missing from the primary
flow, structurally blocks the `aguardando_assinatura → assinado` workflow transition) and `exclusivo`
(real, semantically relevant field, always `false` under the primary flow today) remain real,
unfixed defects — implementation is left to `GAP-0004`'s own resolution step. `SCHEMA_V2_IMPACT:
NONE_DIRECT`. Full record: `docs/backend-v2/gap-resolution/decision-register.json` (`DEC-004`).

This decision provides the premise `GAP-0008` (party sourceId, formally `dependsOn: ["GAP-0004"]`)
needed to eventually be resolved — `GAP-0008` remains `OPEN`, unimplemented; the dependency edge was
preserved in the graph, not removed.

This decision being resolved does **not** mean `ContratoWizard.tsx`/`ContratoFormModal.tsx`/
`RegistroMusicas.tsx` were modified, `arquivo_url`/`exclusivo`/`observacoes` were fixed, or any PII
migration occurred — all remain pending in their own steps. `GAP-0004` was updated
(`userDecisionRequired: false`, `resolutionWave` moved from `WAVE_0_DECISIONS` to
`WAVE_3_CORE_DOMAIN_FIXES`) but its `status` remains `OPEN` — the component consolidation is undesigned
and unimplemented.

Updated counters (recomputed from the JSON artifacts, not hardcoded): `OPEN_GAPS=140` (unchanged),
`USER_DECISIONS_REQUIRED=5` (gaps, was 6), `BLOCKS_SCHEMA_V2_DESIGN=0` (unchanged — `GAP-0004` never
blocked it), `BLOCKS_API_V2_IMPLEMENTATION=0` (unchanged), `BLOCKS_CUTOVER=1` (unchanged — `GAP-0039`,
unrelated), `WAVE_0_DECISIONS=5` (was 6), `WAVE_3_CORE_DOMAIN_FIXES=55` (was 54). `DEPENDENCY_CYCLES=0`,
`UNKNOWN_DEPENDENCIES=0` (revalidated). `decision-register.json`, `canonical-gap-register.json`,
`resolution-order.json` all `VALID_JSON: SIM`.

```
NEXT_GAP_RESOLUTION_STEP: RESOLVE_DEC_002
```

Per the canonical order in `resolution-order.json` (wave → dependency → priority), the next
`WAVE_0_DECISIONS` item is **`DEC-002`** (`GAP-0002`, priority 55) — this time it does coincide with
sequential ID numbering, but only as a byproduct of priority ordering
(`GAP-0002:55 > GAP-0005:45 > GAP-0003:40 > GAP-0006:35 > GAP-0008:30`, the last pushed further down the
full linear order by its dependency on `GAP-0004`), not a resumption of sequential numbering. **This
step was not started.**

---

## PHASE 3 / WAVE 0 — DECISION DEC-002 RESOLVED

```
GAP_RESOLUTION_PHASE: STARTED
WAVE_0_DECISIONS_STATUS: IN_PROGRESS
DECISIONS_RESOLVED: 4
DECISIONS_PENDING: 4
LAST_RESOLVED_DECISION: DEC-002
```

`DEC-002` resolved: **CONTRACT_SERVICE_TYPES_CANONICAL**. `contract_service_types`
(`ContractServiceType`) is the canonical contract-type vocabulary. Classification of the 4 existing
sources: `contract_service_types` = `CANONICAL_SOURCE_OF_TRUTH`; `contract_templates.tipo_servico` =
`LEGACY/DENORMALIZED_REFERENCE_TO_CANONICAL_TYPE` (its future physical form — `service_type_id` vs
`service_type_slug` — is not decided here, only that it cannot remain an independent free-text
vocabulary); `contract_categories` (localStorage) = `DISPLAY_ONLY` (may keep existing as a
grouping/label layer, not a contract-type source of truth); `CONTRACT_TYPES` (hardcoded) =
`DEAD_LEGACY_VOCABULARY` (not removed at this step). `contracts.tipo` can no longer be an independent
vocabulary source — its future semantics are a representation/reference of the canonical
`ContractServiceType`; whether that becomes an FK, a denormalized slug, or is kept for compatibility is
**not** decided by `DEC-002` — left to schema/API v2 resolution. `CANONICAL_REFERENCE_KEY:
TO_BE_DEFINED_DURING_SCHEMA_CONTRACT_RESOLUTION` — this decision resolves WHICH vocabulary is canonical,
not WHICH physical key will be used in FKs; no additional decision was created solely for that technical
choice.

**Direct constraint with `DEC-004`** (`UNIFIED_CONFIGURABLE_CONTRACT_COMPONENT`, already `RESOLVED`):
`WIZARD` and `QUICK` modes must consume the same canonical source — it is prohibited for the future
architecture to keep `WIZARD` reading free-text `tipo_servico` while `QUICK` reads
`contract_service_types`. `QUICK` mode already consumes `contract_service_types` today —
`PRESERVED_AS_CANONICAL_DIRECTION`, no change required. `WIZARD` mode (today derives type from the
template's `tipo_servico`) `NEEDS_FUTURE_CONTRACT_ALIGNMENT`. No component was modified at this step.

**Registered caveats**: making `contract_service_types` canonical does **not** mean its rich fields
(financial terms, `requires_*` conditionals) are already correctly consumed anywhere —
`SERVICE_TYPE_RULE_CONSUMPTION: IMPLEMENTATION_GAPS_REMAIN`. `GAP-0055` (contracts→accounting financial
propagation) remains an independent, unresolved gap (`DEC-002 RESOLVED != GAP-0055 RESOLVED`). Legacy
data: `contract_templates.tipo_servico`/`contracts.tipo` may hold historical free-text values —
`LEGACY_TYPE_RECONCILIATION_REQUIRED: SIM`, `DATA_MIGRATION_REQUIRED: POSSÍVEL`,
`LEGACY_MAPPING_STATUS: REQUIRES_DATA_RECONCILIATION_DURING_MIGRATION_PREPARATION`. Rule registered for
that future step: if every persisted value maps deterministically, no additional human decision is
needed; if ambiguous values are found, only those specific values are escalated to a decision — no
mapping was invented by textual similarity here, no database was queried.

**Documental correction applied**: `DEC-002.reason` incorrectly cited `GAP-0041` (an unrelated `catalog`
gap — Work split-sheet authors/shares) as the contracts financial-propagation gap. Corrected to
`GAP-0055` (the real contracts→accounting financial-propagation gap). `GAP-0041` itself was not
modified.

This decision being resolved does **not** mean `ContratoWizard.tsx`, the `QUICK` mode,
`contract_templates`, `contracts.tipo`, or `contract_service_types` were modified, any FK was created,
or any legacy data was mapped/migrated — all remain pending in their own steps. `GAP-0002` was updated
(`userDecisionRequired: false`, `resolutionWave` moved from `WAVE_0_DECISIONS` to
`WAVE_2_SCHEMA_AND_CONTRACT`) but its `status` remains `OPEN`.

Updated counters (recomputed from the JSON artifacts, not hardcoded): `OPEN_GAPS=140` (unchanged),
`USER_DECISIONS_REQUIRED=4` (gaps, was 5), `BLOCKS_SCHEMA_V2_DESIGN=0` (unchanged), 
`BLOCKS_API_V2_IMPLEMENTATION=0` (unchanged), `BLOCKS_CUTOVER=1` (unchanged — `GAP-0039`, unrelated),
`WAVE_0_DECISIONS=4` (was 5), `WAVE_2_SCHEMA_AND_CONTRACT=31` (was 30). `DEPENDENCY_CYCLES=0`,
`UNKNOWN_DEPENDENCIES=0` (revalidated). `decision-register.json`, `canonical-gap-register.json`,
`resolution-order.json` all `VALID_JSON: SIM`.

```
NEXT_GAP_RESOLUTION_STEP: RESOLVE_DEC_005
```

Per the canonical order in `resolution-order.json` (wave → dependency → priority), the next
`WAVE_0_DECISIONS` item is **`DEC-005`** (`GAP-0005`, priority 45) — not `DEC-003`, despite `DEC-003`
having a lower sequential number; `WAVE_0_DECISIONS` remains priority-ordered
(`GAP-0005:45 > GAP-0003:40 > GAP-0006:35 > GAP-0008:30`, the last pushed further down the full linear
order by its dependency on `GAP-0004`). **This step was not started.**

---

## URGENT CANONICAL CORRECTION — DEC-001 DOMAIN DEFINITION CORRECTED (Product Owner authority)

```
CORRECTION_TARGET: DEC-001
PREVIOUS_SELECTED_OPTION: UNIVERSAL_FINANCIAL_PROJECT (INVALIDATED)
CORRECTED_SELECTED_OPTION: MUSICAL_PROJECT_CANONICAL_HUB
DECISION_STATUS: RESOLVED (unchanged — corrected, not reopened to PENDING)
```

The Product Owner explicitly corrected the previously-registered domain definition of `projects`.
**Corrected canonical definition**: `projects` is the canonical **Musical Project/Song** entity — not a
generic financial/operational hub. `projects.id` is the cross-domain identifier used to link records
belonging to the same musical project/song: `Work/Obra`, `Phonogram`, `Release`, `Accounting
Transaction`, `Audiovisual`, `Marketing`, and other related domains. The existence of real cross-domain
relations (`financial_project_id`, `transactions.projeto_id`) does **not** make `projects` a financial
entity — those relations exist because other domains' activity *belongs to* a specific song, not because
`projects` is itself financial.

**What changes**: the `UNIVERSAL_FINANCIAL_PROJECT` interpretation is invalidated.
**What does not change**: `projects.id` remains the correct cross-domain linkage key; all previously
identified real relations (`financial_project_id`, `transactions.projeto_id`, `works.projeto_id`) remain
valid — only their semantic justification is corrected. `financial_project_id` (on
`audiovisual_projects`/`marketing_projects`) is now classified `LEGACY_NAMING` — the column is real and
the relation valid, but the name implies a financial purpose when its real function is linking the
record to its parent musical project. **Not renamed at this step.**

**Musical-project fields confirmed today** (frontend + API + DB, reused from `projects.md`, not
re-audited): `projects` — `titulo`, `genero`, `tipo`, `status`, `artista_id` (real, unwritten by the
only reachable form), `orcamento` (real, unwritten), `descricao`, `observacoes`; nested `project_tracks`
— título/solo-feat/original-remix/instrumental/duração/gênero/idioma/letra/`audioUrl` (upload stub);
`project_track_participants` — compositor/intérprete/produtor per track (real, populated). Matches the
Product Owner's examples (título, gênero, compositor/autor, intérprete) directly.

**Cross-domain relations matrix** (reused from `projects.md`/`releases.md`/`catalog.md`/`accounting.md`,
not re-audited module-by-module):

| Domain | Current column | Target | Status |
|---|---|---|---|
| Work/Obra | `works.projeto_id` | `projects.id` | `ALREADY_CORRECT` (real, logical, confirmed populated via `ObraFormModal.tsx`) |
| Phonogram | none direct | `projects.id` (transitive via `phonograms.obra_id → works.id → works.projeto_id`) | `ALREADY_CORRECT` transitively — no new gap needed |
| Release | **none** — `ReleaseEntity` has no `project_id`/`projeto_id` | `projects.id` | `MISSING_RELATION` — only a one-time manual form-prefill convenience (`projetoToLancamentoSeed`), never persisted. **New gap `GAP-0168` created.** |
| Accounting Transaction | `transactions.projeto_id` | `projects.id` | `ALREADY_CORRECT` (real, logical, populated; not read/grouped by the P&L display — `GAP-0013`) |
| Audiovisual | `audiovisual_projects.financial_project_id` | `projects.id` | `ALREADY_CORRECT` relation (real FK) + `LEGACY_NAMING` (column name) + missing at UI-write level (`GAP-0033`) |
| Marketing | `marketing_projects.financial_project_id` | `projects.id` | `ALREADY_CORRECT` relation (real FK) + `LEGACY_NAMING` (column name) + missing at UI-write level (`GAP-0033`) |

**`GAP-0001` revalidated**: the recommendation to expose `artista_id`/`orcamento` in
`ProjetoFormModal.tsx` **remains valid** — both fields fit naturally as attributes of the musical project
itself (its lead artist; its production budget), not because `projects` was a financial hub. `GAP-0001`
remains `OPEN`/`WAVE_3_CORE_DOMAIN_FIXES`, unchanged by this correction (no artificial pending decision
created — `DEC-001` stays `RESOLVED`). **`GAP-0033`/`GAP-0013` revalidated**: underlying technical
findings unchanged; only semantic language corrected (`correctedSemanticNote` field added to each in
`canonical-gap-register.json`).

**New gap created**: `GAP-0168` — "releases: no persisted relation to the originating musical project
(projects.id)". `blocksSchemaV2Design: SIM` (a genuinely new schema-v2 blocker — releases v2 schema must
account for this relation), `dependsOn: ["GAP-0001"]`, `resolutionWave: WAVE_2_SCHEMA_AND_CONTRACT`,
`status: OPEN`. Verified not a duplicate of `GAP-0007`/`GAP-0133` (different relations) or
`GAP-0001`/`GAP-0013`/`GAP-0033` (none cover the `releases ↔ projects` relation).

`DEC-007` (`RELATIONAL_TRACKLIST_MODEL`) was **not reopened** — still valid. Future conceptual chain may
involve `Musical Project → Release → Release Track → Phonogram → Work` without conflating these
entities.

Updated counters (recomputed, not hardcoded): `CANONICAL_GAPS=168` (was 167), `RAW_GAP_OCCURRENCES=200`
(was 199), `DEPENDENCY_EDGES=17` (was 16), `OPEN_GAPS=141` (was 140), `BLOCKS_SCHEMA_V2_DESIGN=1` (was
0 — `GAP-0168`, a genuine new blocker, not a `DEC-001` reopening), `BLOCKS_API_V2_IMPLEMENTATION=0`
(unchanged), `BLOCKS_CUTOVER=1` (unchanged — `GAP-0039`). `DECISIONS_RESOLVED_TOTAL=4`,
`DECISIONS_PENDING=4` — **unchanged**, no artificial pending decision created. `DEPENDENCY_CYCLES=0`,
`UNKNOWN_DEPENDENCIES=0` revalidated. `decision-register.json`, `canonical-gap-register.json`,
`resolution-order.json` all `VALID_JSON: SIM`.

Full previous (invalidated) resolution preserved verbatim in `decision-register.json`
(`DEC-001.supersededDecision`, `INVALIDATED_BY_PRODUCT_OWNER_DOMAIN_CORRECTION`) — nothing was silently
erased.

```
DEC_005_ANALYSIS_STATUS: PARKED_UNCHANGED
NEXT_GAP_RESOLUTION_STEP: RESOLVE_DEC_005
```

**This is a purely documental correction** — no frontend, backend, `api-v2`, schema, migration,
database, or Supabase change was made. `DEC-005` was not registered. No other decision was started.
