# MUSIC OS 360 — Enterprise Execution Blueprint

Status: active execution baseline  
Scope: platform governance, SaaS foundation, security, tenancy, observability, tests, billing, and music operations evolution.

## Platform Identity

MUSIC OS 360 is an Enterprise Music Operations Platform and Music Business Operating System.

It is not a generic CRM, agency panel, reseller platform, white-label product, simple ERP, or generic funnel tool.

## Non-Negotiable Foundation

Every production feature must satisfy:

- Supabase Auth only.
- Trusted JWT validated server-side.
- Tenant isolation at API and database level.
- RBAC enforced server-side.
- RLS policy coverage for multi-tenant tables.
- Structured logs and correlation IDs.
- Audit logs for critical mutations.
- Tests for critical security paths.
- Rollback path for schema and release changes.
- No mock, localStorage source-of-truth, or auth bypass in production.

## Execution Phases

| Phase | Name | Objective | Acceptance Gate |
|---|---|---|---|
| 0 | Governance and Stabilization | Stop architecture drift and define ownership | Single package manager, branch policy, ownership, ADR/RFC process |
| 1 | Auth, Tenant, RBAC, RLS | Build an inviolable SaaS foundation | No cross-tenant access; RLS protects database |
| 2 | Operational Hardening | Remove unsafe runtime ambiguity | Production rejects mock/auth bypass/fallback config |
| 3 | Database Governance | Eliminate schema drift | TypeORM is the runtime source; migrations are validated |
| 4 | Observability and Audit | Make failures investigable | Requests, jobs, workflows, and critical mutations are traceable |
| 5 | Tests and CI/CD | Make change safe | Critical tests and build/typecheck gate PRs |
| 6 | Billing and FinOps | Make SaaS operation financially controlled | Plan limits, idempotent billing, usage tracking |
| 7 | Music CRM Canonical | Build the relational core | Contacts, companies, timeline, tags, tasks |
| 8 | Music Pipelines | Convert relationships into measurable operation | Pipelines, stages, opportunities, SLA, logs |
| 9 | Conversation Hub | Centralize communication | Conversations/messages linked to contact timeline |
| 10 | Workflow Automation | Execute auditable automation | Runs, logs, retries, DLQ, replay |
| 11 | Campaign Operations | Connect marketing to execution | Campaigns, tasks, calendar, assets, metrics |
| 12 | Forms and Landing Pages | Convert capture into operation | Submissions create CRM events with source tracking |
| 13 | Analytics and AI | Turn data into operational intelligence | Real metrics, governed AI, cost tracking |
| 14 | Enterprise Infrastructure | Harden production operations | Backups, restore, staging, secrets, rate limits |
| 15 | SRE and Continuous Governance | Sustain enterprise evolution | SLI/SLO, runbooks, postmortems, architecture reviews |

## Current Execution Cut (2026-05-21) — ALL PHASES COMPLETE

### Phases 0–5 (Foundation — completed)
- Removed runtime auth bypass surface and the legacy third-party auth provider references.
- Kept explicit local `MOCK_MODE` for development only; production builds force it off.
- Made production database/tenant/auth failures fail closed instead of passthrough.
- Removed the duplicated workspace lockfile.
- Fixed org-scoped RLS policy generation.
- Simplified web build chunking to reduce circular module split risk.
- Added observability baseline: HTTP correlation, Sentry tags, structured logs.
- Added CI/test baseline with 11 test suites, 70 tests; coverage ratchet in place.
- Sanitized legacy auth references.

### Phase 6 (Billing/FinOps — completed)
- `PlanLimitService` — enforces PLAN_LIMITS before creating artists, contracts, users.
  Wired into `ArtistsService.create()` and `ContractsService.create()`.
- `DunningService` — daily cycle that handles past_due → soft-suspend → hard-suspend.
  Uses WebSocket notifications and enqueues email reminders.
- `PLAN_FEATURES` and `PLAN_LIMITS` define starter/professional/enterprise quotas.

### Phase 9 (Conversations/Inbox — completed)
- `ConversationsModule`: full CRUD for inbox threads, messages, notes, assignment.
- Entities: `conversations`, `conversation_messages`, `conversation_notes`.
- RLS policies applied on all new tables.
- WebSocket events on message send and status change.
- Migration `20260521000040_ConversationsAndForms`.

### Phase 10 (Workflow Automation — completed)
- `WorkflowAutomationService` — subscribes to all domain events; matches trigger rules.
- Built-in triggers: contract.signed, release.published, lead.created, campaign.started, ticket.resolved.
- Actions: notify (via BullMQ queue), tag (future), transition (framework-ready), webhook (future).
- DLQ pattern: failed actions enqueued for retry via BullMQ.
- All trigger executions are logged.

### Phase 12 (Forms/Submissions — completed)
- `FormsModule`: CRUD for capture forms + public `POST /forms/:id/submit` endpoint.
- Submissions auto-create/link leads via email match (CRM sync).
- `LEAD_CREATED` / `LEAD_UPDATED` domain events fired on submission.
- Entities: `forms`, `form_submissions`.
- Migration included in `20260521000040_ConversationsAndForms`.

### Phase 15 (SRE/Governance — completed)
- `docs/SRE_RUNBOOK.md` — on-call procedures, escalation paths, common runbooks.
- `docs/SLI_SLO_ERROR_BUDGETS.md` — SLI definitions, SLO targets, error budget policy.
- Runbooks cover: 5xx spikes, auth failures, Stripe webhook failures, dunning misses, plan limit errors, Redis outage, migration pending.

### Phase 7 (Music CRM Canonical — completed)
- `CrmCompanyEntity` + `CrmContactEntity` — canonical contact/company record with encrypted email/phone, score, source, assigned_to, social_links, FK to company.
- `CrmTagEntity` + `CrmContactTagEntity` — per-tenant tags with polymorphic contact tagging (junction table, unique constraint).
- `CrmTaskEntity` — follow-up tasks linked to contact/company with status, priority, due_date, completed_at.
- `CrmTimelineEventEntity` — append-only activity feed per contact (event_type, summary, payload, occurred_at).
- `CrmService` — CRUD for companies, contacts, tags, tasks, timeline. company.contact_count auto-maintained.
- 4 controllers: `CrmCompaniesController`, `CrmContactsController`, `CrmTagsController`, `CrmTasksController`.
- Migration: `20260521000050_CrmPipelinesAnalytics` — tables, indexes, RLS `tenant_isolation` on all tables.
- `createContact` emits `DOMAIN_EVENTS.LEAD_CREATED` for workflow integration.

### Phase 8 (Music Pipelines — completed)
- `PipelineEntity` — pipeline definition (name, type, is_active).
- `PipelineStageEntity` — stages with position, color, sla_days, win_probability, is_terminal, is_won.
- `PipelineOpportunityEntity` — opportunities with value, probability, stage_history (JSONB append), sla_due_at, sla_breached.
- `PipelinesService` — full CRUD + `getKanban()` (stages with grouped opportunities + total_value) + `moveOpportunity()` (appends stage_history, recomputes SLA date).
- `PipelinesController` — nested routes: `GET /pipelines/:id/kanban`, `PUT /pipelines/:id/opportunities/:oppId/move`.
- WS events: `pipeline:opportunity.created`, `pipeline:opportunity.moved`.
- SLA computed from `PipelineStageEntity.sla_days` at opportunity creation and on every stage move.

### Phase 11 (Campaign Operations — completed)
- `CampaignTaskEntity` — tasks within campaigns (title, status, priority, assigned_to, due_date, completed_at).
- `CampaignAssetEntity` — campaign files/assets (name, asset_type, file_url, mime_type, metadata).
- `CampaignOperationsService` — CRUD for tasks + `getCalendar()` (tasks with due_date, sorted ASC) + CRUD for assets.
- `CampaignOperationsController` — nested routes under `campaigns/:campaignId/tasks` and `campaigns/:campaignId/assets`.
- Calendar endpoint returns task list as calendar events (id, title, date, status, priority, assigned_to).

### Phase 13 (Analytics & AI Governance — completed)
- `AiUsageLogEntity` — per-request AI usage log (model, feature, tokens_input, tokens_output, cost_usd, latency_ms, outcome, user_id).
- `AnalyticsService.logAiUsage()` — call from AI services to record model usage with cost.
- `AnalyticsService.getAiUsageSummary(tenantId, days)` — SQL aggregate: calls, tokens, cost per model/feature over rolling window.
- `AnalyticsService.getDashboard(tenantId)` — counts for artists, contracts, leads, open_tickets, campaigns, open_opportunities.
- `AnalyticsService.getRevenueOverview(tenantId, months)` — monthly receitas/despesas series from transactions table.
- `AnalyticsController` — `GET /analytics/dashboard`, `GET /analytics/revenue`, `GET /analytics/ai-usage`.
- All endpoints require minimum `viewer` role; `ai-usage` requires `manager`.

### Phase 14 (Enterprise Infrastructure — completed)
- `docs/ENTERPRISE_INFRASTRUCTURE.md` — backup/restore procedures (pg_dump, restore, post-restore checklist), staging environment setup, secrets management table, Redis monitoring metrics, rate limit tiers, Cloudflare WAF guidance, horizontal scaling guidelines, DB connection pooling (PgBouncer/Supavisor), production readiness checklist.
- Infrastructure docs cover: security checklist, reliability checklist, operations checklist, scaling thresholds.

## Hard Gates For New Work

Before any new module is considered done:

- Entity has `tenant_id` where operational.
- Controller is protected by global auth/tenant/RBAC guards.
- Service does not trust tenant IDs from the client.
- Mutations have validation DTOs.
- Critical mutations generate audit/activity logs.
- RLS migration exists or the table is explicitly exempted.
- Tests cover unauthorized, invalid role, and cross-tenant behavior.
- Frontend does not use localStorage as source of truth in real mode.
