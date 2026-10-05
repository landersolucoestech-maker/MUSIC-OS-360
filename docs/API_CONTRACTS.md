# API Contracts — Priority Flows (Music OS 360)

> **Contracts** document for the API consumed by the frontend (NestJS + TypeORM). It does not
> implement endpoints or change logic. The controllers and DTOs under `apps/api/src/modules/**` are
> authoritative; this file summarises them and must be corrected when they change.
> Naming authority: `docs/naming/canonical-naming-map.json` and `docs/engineering/backend.md`.
>
> **Global conventions** (apply to every flow unless noted otherwise):
> - **Base URL:** `/{API_BASE_URL}/api/v1`
> - **Authentication:** JWT Bearer (`Authorization: Bearer <token>`) — `@ApiBearerAuth`, global `JwtAuthGuard`.
> - **Tenant isolation:** `@CurrentTenant()` injects `{ id }`; every query is filtered by `tenant_id` (+ RLS in Postgres). The client does **not** send `tenant_id` in the body.
> - **RBAC:** `@RequireRole('viewer' | 'editor' | 'manager' | 'admin' | 'owner')` (hierarchical).
> - **Common errors:** `401` (missing/invalid token), `403` (RBAC/tenant), `404` (not found in the tenant), `400` (validation), `503` (database unavailable).
> - **Default pagination:** `?limit=&offset=` (or `page=&pageSize=` in some modules) → `{ data, total, limit, offset }`.
> - **Status legend:** `existing` (real route in the backend), `partial` (route exists but a field/behavior is missing), `missing` (must be created).

---

## 1. Marketing — Campaigns

**Purpose:** create/edit/manage campaigns (including the multi-step paid-traffic builder) and their lifecycle (draft → validation → publication → pause → archiving).

**Real controllers:** `apps/api/src/modules/marketing/marketing-campaign-builder.controller.ts` (`@Controller('marketing/campaigns')`) and `campaign-builder.controller.ts` (`@Controller('marketing/campaign-builder')`).

| Route | Method | RBAC | Status |
|---|---|---|---|
| `/marketing/campaigns` | GET | viewer | existing |
| `/marketing/campaigns/:id` | GET | viewer | existing |
| `/marketing/campaigns/draft` | POST | editor | existing |
| `/marketing/campaigns/:id` | PATCH | editor | existing |
| `/marketing/campaigns/:id/validate` | POST | viewer | existing |
| `/marketing/campaigns/:id/blueprint` | POST | viewer | existing |
| `/marketing/campaigns/:id/publish` | POST | editor | existing |
| `/marketing/campaigns/:id/pause` | POST | editor | existing |
| `/marketing/campaigns/:id/archive` | POST | editor | existing |
| `/marketing/campaign-builder/config` | GET | viewer | existing |

- **Path/query:** `:id` (uuid). `GET /marketing/campaigns` accepts filters (`status`, `type`) + pagination.
- **Request (draft/patch):** `{ name, targetType: 'music_project'|'artist'|'company', platforms: ContentChannel[], objective, budget, startDate, endDate, audience, creatives[], placements[], contentIds[], notes }`.
- **Response:** `MarketingCampaign` `{ id, name, targetType, targetName, platforms, status, budget, metrics, startDate, endDate, contentIds, createdAt, updatedAt }`.
- **Errors:** 400 (step/budget/period validation), 404, 403.
- **Events emitted:** `campaign.started` (publish), `campaign.ended` (archive/closure).
- **Entities/tables:** `campaigns`, `campaign_assets`, `campaign_tasks`.
- **Current status:** `existing`; the web campaigns pages consume these routes through `apps/web/src/modules/marketing/services/marketing.service.ts`.
- **Vocabulary:** canonical `targetType` values are `music_project`, `artist`, `company` (`MARKETING_TARGETS` in `apps/api/src/modules/marketing/marketing-vocabulary.ts`). The deprecated Portuguese spellings (for example `projeto_musical`) are accepted on input only, mapped to `music_project` (and `artista` to `artist`, `empresa` to `company`), and responses are canonical only. See `docs/naming/canonical-naming-map.json`.

---

## 2. Content Calendar

**Purpose:** schedule/publish content; business rule Company (may publish through a connected account) vs Artist (internal scheduling only).

**Real controller:** `apps/api/src/modules/marketing/marketing-contents.controller.ts` (`@Controller('marketing/contents')`).

| Route | Method | RBAC | Status |
|---|---|---|---|
| `/marketing/contents` | GET | viewer | existing |
| `/marketing/contents/:id` | GET | viewer | existing |
| `/marketing/contents` | POST | editor | existing |
| `/marketing/contents/:id` | PATCH | editor | existing |
| `/marketing/contents/:id` | DELETE | editor | existing |

- **Path/query:** `:id` (uuid). GET accepts filters (`channel`, `type`, `status`, period) + pagination.
- **Request (POST/PATCH):** `{ title, targetType: 'music_project'|'artist'|'company', targetName, type, channel, status?, publishDate, publishTime, copy, files[], notes, owner, campaignId, releaseId, format, metadata }`. Multi-channel selection and the approval state travel inside `metadata` (`metadata.channels`, `metadata.approval`); a top-level `channels` property is rejected by the DTO (`apps/api/src/modules/marketing/dto/marketing-contents.dto.ts`). `status` is one of `draft|scheduled|published|cancelled|failed`.
- **Response:** `MarketingContent` `{ id, title, targetType, type, channel, channels?, status, publishDate, publishTime, files[], copy, createdAt, updatedAt }`.
- **Errors:** 400 (invalid date/time, incompatible platform), 404, 403.
- **Events emitted:** when an associated asset is approved → `marketing.asset_available_for_content` (asset flow).
- **Entities/tables:** `marketing_content_posts`.
- **Current status:** `existing`; the content calendar (`apps/web/src/modules/marketing/pages/Calendar.tsx`) consumes `/marketing/contents`.
- **Wiring notes:** canonical status is `scheduled` (legacy `agendado` is mapped on input only); `late` is derived from the schedule and never stored. Not verified here: the server-side rule "only `company` content may be published through a connected account".

---

## 3. Core assets for Content/Scheduling

**Purpose:** expose the core asset model linked to project/task (cover, WAV/master, videos) for consumption by Content/Scheduling and the UI; reviewable classification.

**Real controller:** `apps/api/src/modules/assets/assets.controller.ts` (delivered in Slices 1–3).

| Route | Method | RBAC | Status |
|---|---|---|---|
| `/projects/:projectId/assets` | GET | viewer | existing |
| `/tasks/:taskId/assets` | GET | viewer | existing |
| `/assets/:id` | GET | viewer | existing |
| `/assets/:id/classify` | POST | editor | existing |

- **Path/query:** `:projectId`/`:taskId`/`:id` (uuid).
- **Response (enriched link list — `LinkedAssetView`):**
  `[{ linkId, assetId, role, sourceEvent, linkedBy, linkedAt, name, assetType, mimeType, status, fileUrl }]`.
- **Response (`GET /assets/:id`):** `{ asset: { id, name, asset_type, mime_type, status, source, source_id, current_version_id, metadata }, versions: AssetVersion[] }`.
- **Request (`POST /assets/:id/classify`):** `{ assetType: string }` → manual review.
- **Response (classify):** `{ assetType, confidence: 1, method: 'manual' }`.
- **Errors:** 400 (`assetType` missing), 404, 403.
- **Events emitted (in the originating automatic flow):** `asset.linked_to_project`, `asset.linked_to_task`; classification is recorded in `asset_usage_logs` (`classified`).
- **Entities/tables:** `assets`, `asset_versions`, `project_assets`, `task_assets`, `asset_usage_logs` (additive core layer).
- **Current status:** `existing` (backend ready and tested; **not yet consumed by the frontend**).
- **Wiring notes:** Content/Scheduling must list `GET /projects/:projectId/assets` filtering by `assetType` (e.g. `cover_art`, `music_video`, `reel`; the legacy Portuguese `videoclipe` is accepted on input and mapped to `music_video`) and `status='active'`. `fileUrl` currently holds the storage key (R2) — future delivery through a signed URL.

---

## 4. Skill-runs (execution history)

**Purpose:** read-only traceability of internal skill executions (asset-linking, asset-classification, release-readiness). Internal infrastructure — display only as "Execution History" (`Histórico de Execuções`), never as a technical module.

**Real controller:** `apps/api/src/modules/assets/assets.controller.ts`.

| Route | Method | RBAC | Status |
|---|---|---|---|
| `/skill-runs` | GET | manager | existing |
| `/skill-runs/:id` | GET | manager | existing |

- **Query:** `skillName?`, `status?` (`pending|running|success|failed|cancelled`), `limit` (1–100, default 25), `offset` (≥0).
- **Response (list):** `{ data: SkillRun[], total, limit, offset }`, where `SkillRun = { id, tenant_id, user_id, skill_name, entity_type, entity_id, correlation_id, status, input_payload, output_payload, error_message, started_at, finished_at, created_at }`.
- **Response (`:id`):** `{ run: SkillRun, logs: SkillRunLog[] }`, `SkillRunLog = { id, skill_run_id, level, message, payload, created_at }`.
- **Errors:** 404, 403.
- **Events emitted (in the originating execution):** `skill.started`, `skill.completed`, `skill.failed`.
- **Entities/tables:** `skill_runs`, `skill_run_logs`.
- **Current status:** `existing` (not yet consumed by the frontend).
- **Wiring notes:** use in a future operational view "Execution History" (`Histórico de Execuções`) (do not expose terms such as SkillRunner/Registry). Minimum RBAC `manager`.

---

## 5. Release Readiness

**Purpose:** evaluate (read-only) the mandatory requirements before releasing a release for distribution (cover, WAV master, ISRC, phonogram, conditional work, metadata).

**Real controller:** `apps/api/src/modules/assets/assets.controller.ts`.

| Route | Method | RBAC | Status |
|---|---|---|---|
| `/release-readiness` | GET | viewer | existing |

- **Query:** `projectId?` (uuid), `phonogramId?` (uuid).
- **Response:** `{ ready: boolean, requirements: [{ id, label, status: 'met'|'missing'|'not_applicable', blocking, detail? }], missing: string[] }`.
  - `requirements`: `cover_art`, `wav_master`, `phonogram`, `isrc`, `metadata`, `work` (conditional).
- **Errors:** 403; (no 404 — returns the evaluation even with missing entities, marking them `missing`).
- **Events emitted:** execution produces `skill.*` (skill `release-readiness`); does **not** emit `release.ready_for_distribution` (reserved for when a consumer exists).
- **Entities/tables:** `project_assets`/`assets` (cover/master), `phonograms` (isrc/registration/metadata), `works` (conditional work).
- **Current status:** `existing` (not yet consumed by the frontend).
- **Wiring notes:** display as a checklist of blockers on the distribution/release screen. "Cover approved" today = an active linked `cover_art` asset; cross-checking with `marketing_asset_approvals` is a future refinement.

---

## 6. Audit trail using `/audit-logs`

**Purpose:** append-only audit trail (all `@Audit`-decorated actions) for the tenant audit trail and, through `/audit-logs/admin`, the SaaS admin panel.

**Real controller:** `apps/api/src/modules/audit-log/audit-log.controller.ts` (`@Controller('audit-logs')`).

| Route | Method | RBAC | Status |
|---|---|---|---|
| `/audit-logs` | GET | viewer | existing |
| `/audit-logs/admin` | GET | super_admin | existing (all tenants) |
| `/audit-logs/:id` | GET | admin | existing |

- **Query (`QueryAuditLogDto`):** `action?`, `userId?`, `entity?`, `entityId?` (uuid), `actorRole?`, `correlationId?`, `fromDate?`/`toDate?` (ISO) + pagination (`PaginationDto`).
- **Response (lista):** `{ data: AuditLog[], total, ... }`, `AuditLog = { id, tenant_id, action, entity, entity_id, actor_id, actor_role, correlation_id, before?, after?, created_at }`.
- **Response (`:id`):** detail with `before`/`after` (diff) — restricted to `admin`/`owner`.
- **Errors:** 403 (detail requires admin), 404.
- **Events emitted:** n/a (read-only; the log is populated by the `@Audit` interceptor).
- **Entities/tables:** `audit_logs`.
- **Current status:** `existing`. The admin screen reads `GET /audit-logs/admin` (`apps/web/src/modules/admin/services/admin-audit.service.ts`); the settings audit trail reads `GET /audit-logs` (`apps/web/src/modules/settings/hooks/useAuditTrail.ts`).
- **Wiring notes:** detail with the before/after diff is restricted to admin/owner.

---

## 7. Real OAuth integrations

**Purpose:** connect corporate accounts (Meta/Instagram, TikTok, YouTube, Spotify, Google Ads) via OAuth driven by the backend. Tokens never cross the browser boundary: the backend exchanges the authorization code, encrypts the credentials in `oauth_connections` and exposes only status and disconnect to the frontend (`apps/web/src/modules/integrations/hooks/useMarketingOAuth.ts`).

**Real controller:** `apps/api/src/modules/integrations/integrations.controller.ts` (`@Controller('integrations')`).

| Route | Method | RBAC | Status |
|---|---|---|---|
| `/integrations/oauth/init` | POST | editor | existing |
| `/integrations/oauth/exchange` | POST | public, protected by the single-use `exchange_token` | existing |
| `/integrations/oauth/status` | GET | viewer | existing |
| `/integrations/oauth/disconnect` | DELETE | admin | existing |
| `/integrations/spotify/callback` | GET (public) / POST (editor) | callback | existing |
| `/integrations/instagram/callback` | POST | callback | existing |
| `/integrations/tiktok/callback` | POST | callback | existing |
| `/integrations/google-ads/callback` | POST | callback | existing |

- **Request (`oauth/init`):** `{ platform }` (allow-list in `OAuthInitDto`, `apps/api/src/modules/integrations/dto/integrations.dto.ts`) → **Response:** `{ exchange_token }` (single-use, 10-minute lifetime, bound to the authenticated tenant and user).
- **Request (`oauth/exchange`):** `{ platform, code, exchange_token }` → **Response:** `{ connected: true, platform }`. The redirect URI is built server-side from `APP_URL`; the client never supplies it.
- **Per-platform callbacks:** receive `code`/`state` from the provider and persist the connection.
- **Errors:** 400 (invalid state, missing code), 401/403, 502 (provider failure).
- **Events emitted:** none required (may emit an integration event on connect — future).
- **Entities/tables:** `integrations`, `oauth_connections`.
- **Current status:** `existing`; the real flow depends on per-provider OAuth credentials supplied through the environment.
- **Flow:** `oauth/init` → provider popup → callback page → `oauth/exchange`; connection state is read from `oauth/status`.

---

## Readiness summary

| Flow | Backend | Frontend | Main action |
|---|---|---|---|
| 1. Campaigns | existing | HTTP | none |
| 2. Content Calendar | existing | HTTP | none |
| 3. Core assets | existing | no screen | consume in the Content/Scheduling flows |
| 4. Skill-runs | existing | no screen | "Execution History" (`Histórico de Execuções`) view |
| 5. Release Readiness | existing | no screen | distribution checklist |
| 6. Audit trail | existing | HTTP | none |
| 7. OAuth Integrations | existing | backend-driven | depends on provider credentials |

> Contracts only: this file documents routes and shapes; it implements nothing.
