# Contratos de API — Fluxos Prioritários (Music OS 360)

> Documento de **contratos** para conectar o frontend validado ao backend real
> (NestJS + TypeORM). Não implementa endpoints nem altera lógica. Baseado no que
> **já existe** no backend e no que **será necessário** para a fiação futura.
>
> **Convenções globais** (valem para todos os fluxos, salvo nota em contrário):
> - **Base URL:** `/{API_BASE_URL}/api/v1`
> - **Autenticação:** JWT Bearer (`Authorization: Bearer <token>`) — `@ApiBearerAuth`, `AuthGuard` global.
> - **Tenant isolation:** `@CurrentTenant()` injeta `{ id }`; toda query é filtrada por `tenant_id` (+ RLS no Postgres). O cliente **não** envia `tenant_id` no body.
> - **RBAC:** `@RequireRole('viewer' | 'editor' | 'manager' | 'admin' | 'owner')` (hierárquico).
> - **Erros comuns:** `401` (sem/token inválido), `403` (RBAC/tenant), `404` (não encontrado no tenant), `400` (validação), `503` (banco indisponível).
> - **Paginação padrão:** `?limit=&offset=` (ou `page=&pageSize=` em alguns módulos) → `{ data, total, limit, offset }`.
> - **Legenda de status:** `existente` (rota real no backend), `parcial` (rota existe mas falta campo/comportamento), `faltante` (precisa ser criado).

---

## 1. Marketing — Campanhas

**Finalidade:** criar/editar/gerir campanhas (inclui builder de tráfego pago multi-etapas) e seu ciclo (rascunho → validação → publicação → pausa → arquivamento).

**Controllers reais:** `apps/api/src/modules/marketing/marketing-campaign-builder.controller.ts` (`@Controller('marketing/campaigns')`) e `campaign-builder.controller.ts` (`@Controller('marketing/campaign-builder')`).

| Rota | Método | RBAC | Status |
|---|---|---|---|
| `/marketing/campaigns` | GET | viewer | existente |
| `/marketing/campaigns/:id` | GET | viewer | existente |
| `/marketing/campaigns/draft` | POST | editor | existente |
| `/marketing/campaigns/:id` | PATCH | editor | existente |
| `/marketing/campaigns/:id/validate` | POST | viewer | existente |
| `/marketing/campaigns/:id/blueprint` | POST | viewer | existente |
| `/marketing/campaigns/:id/publish` | POST | editor | existente |
| `/marketing/campaigns/:id/pause` | POST | editor | existente |
| `/marketing/campaigns/:id/archive` | POST | editor | existente |
| `/marketing/campaign-builder/config` | GET | viewer | existente |

- **Path/query:** `:id` (uuid). `GET /marketing/campaigns` aceita filtros (`status`, `type`) + paginação.
- **Request (draft/patch):** `{ name, targetType: 'empresa'|'artista', platforms: ContentChannel[], objective, budget, startDate, endDate, audience, creatives[], placements[], contentIds[], notes }`.
- **Response:** `MarketingCampaign` `{ id, name, targetType, targetName, platforms, status, budget, metrics, startDate, endDate, contentIds, createdAt, updatedAt }`.
- **Erros:** 400 (validação de etapa/budget/período), 404, 403.
- **Eventos emitidos:** `campaign.started` (publish), `campaign.ended` (archive/encerramento).
- **Entidades/tabelas:** `campaigns`, `campaign_assets`, `campaign_tasks`.
- **Status atual:** `parcial`.
- **Observações para fiação:** o frontend já adota **contexto exclusivamente Empresa/Artista** e **seleção multiplataforma** (`publishChannels[]`). O backend persiste `targetType` (inclui `projeto_musical` legado) e `platforms` — alinhar para: (a) restringir `targetType` a `empresa|artista`; (b) garantir `platforms: ContentChannel[]` multi (Instagram, Facebook, TikTok, YouTube, X/Twitter, Threads). Hoje o front usa serviço in-memory (padrão B) — trocar por estes endpoints.

---

## 2. Calendário de Conteúdo

**Finalidade:** agendar/publicar conteúdos; regra de negócio Empresa (pode publicar via conta integrada) vs Artista (apenas agendamento interno).

**Controller real:** `apps/api/src/modules/marketing/marketing-contents.controller.ts` (`@Controller('marketing/contents')`).

| Rota | Método | RBAC | Status |
|---|---|---|---|
| `/marketing/contents` | GET | viewer | existente |
| `/marketing/contents/:id` | GET | viewer | existente |
| `/marketing/contents` | POST | editor | existente |
| `/marketing/contents/:id` | PATCH | editor | existente |
| `/marketing/contents/:id` | DELETE | editor | existente |

- **Path/query:** `:id` (uuid). GET aceita filtros (`channel`, `type`, `status`, período) + paginação.
- **Request (POST/PATCH):** `{ title, targetType: 'empresa'|'artista', targetName, type, channel, channels?: ContentChannel[], status, publishDate, publishTime, copy, files[], notes, integratedAccountId? }`.
- **Response:** `MarketingContent` `{ id, title, targetType, type, channel, channels?, status, publishDate, publishTime, files[], copy, createdAt, updatedAt }`.
- **Erros:** 400 (data/hora inválida, plataforma incompatível), 404, 403.
- **Eventos emitidos:** ao aprovar ativo associado → `marketing.asset_available_for_content` (fluxo de assets).
- **Entidades/tabelas:** `marketing_content_posts`.
- **Status atual:** `parcial`.
- **Observações para fiação:** o front já implementa **multiplataforma** (`channels[]`) e a **regra Empresa publica / Artista apenas agenda**. Backend hoje tem `channel` **single** em `marketing_content_posts` → adicionar `channels[]` (coluna/tabela) + enforcement server-side: `targetType !== 'empresa'` ⇒ `status` forçado a `agendado` e sem conta integrada. Front usa padrão B (in-memory) — migrar para `/marketing/contents`.

---

## 3. Assets centrais para Conteúdo/Agendamento

**Finalidade:** expor o modelo central de assets vinculados a projeto/tarefa (capa, WAV/master, vídeos) para consumo por Conteúdo/Agendamento e UI; classificação revisável.

**Controller real:** `apps/api/src/modules/assets/assets.controller.ts` (entregue nas Fatias 1–3).

| Rota | Método | RBAC | Status |
|---|---|---|---|
| `/projects/:projectId/assets` | GET | viewer | existente |
| `/tasks/:taskId/assets` | GET | viewer | existente |
| `/assets/:id` | GET | viewer | existente |
| `/assets/:id/classify` | POST | editor | existente |

- **Path/query:** `:projectId`/`:taskId`/`:id` (uuid).
- **Response (lista de vínculos enriquecida — `LinkedAssetView`):**
  `[{ linkId, assetId, role, sourceEvent, linkedBy, linkedAt, name, assetType, mimeType, status, fileUrl }]`.
- **Response (`GET /assets/:id`):** `{ asset: { id, name, asset_type, mime_type, status, source, source_id, current_version_id, metadata }, versions: AssetVersion[] }`.
- **Request (`POST /assets/:id/classify`):** `{ assetType: string }` → revisão manual.
- **Response (classify):** `{ assetType, confidence: 1, method: 'manual' }`.
- **Erros:** 400 (`assetType` ausente), 404, 403.
- **Eventos emitidos (no fluxo automático de origem):** `asset.linked_to_project`, `asset.linked_to_task`; classificação registra em `asset_usage_logs` (`classified`).
- **Entidades/tabelas:** `assets`, `asset_versions`, `project_assets`, `task_assets`, `asset_usage_logs` (camada central aditiva).
- **Status atual:** `existente` (backend pronto e testado; **sem consumo no frontend ainda**).
- **Observações para fiação:** Conteúdo/Agendamento deve listar `GET /projects/:projectId/assets` filtrando por `assetType` (ex.: `cover_art`, `videoclipe`, `reel`) e `status='active'`. `fileUrl` hoje guarda a chave de storage (R2) — futura entrega via URL assinada.

---

## 4. Skill-runs (histórico de execuções)

**Finalidade:** rastreabilidade read-only das execuções de skills internas (asset-linking, asset-classification, release-readiness). Infra interna — exibir apenas como "Histórico de Execuções", nunca como módulo técnico.

**Controller real:** `apps/api/src/modules/assets/assets.controller.ts`.

| Rota | Método | RBAC | Status |
|---|---|---|---|
| `/skill-runs` | GET | manager | existente |
| `/skill-runs/:id` | GET | manager | existente |

- **Query:** `skillName?`, `status?` (`pending|running|success|failed|cancelled`), `limit` (1–100, default 25), `offset` (≥0).
- **Response (lista):** `{ data: SkillRun[], total, limit, offset }`, onde `SkillRun = { id, tenant_id, user_id, skill_name, entity_type, entity_id, correlation_id, status, input_payload, output_payload, error_message, started_at, finished_at, created_at }`.
- **Response (`:id`):** `{ run: SkillRun, logs: SkillRunLog[] }`, `SkillRunLog = { id, skill_run_id, level, message, payload, created_at }`.
- **Erros:** 404, 403.
- **Eventos emitidos (na execução de origem):** `skill.started`, `skill.completed`, `skill.failed`.
- **Entidades/tabelas:** `skill_runs`, `skill_run_logs`.
- **Status atual:** `existente` (sem consumo no frontend ainda).
- **Observações para fiação:** usar em uma futura visão operacional "Histórico de Execuções" (não expor termos como SkillRunner/Registry). RBAC mínimo `manager`.

---

## 5. Release Readiness

**Finalidade:** avaliar (read-only) os requisitos obrigatórios antes de liberar um lançamento para distribuição (capa, WAV master, ISRC, fonograma, obra condicional, metadados).

**Controller real:** `apps/api/src/modules/assets/assets.controller.ts`.

| Rota | Método | RBAC | Status |
|---|---|---|---|
| `/release-readiness` | GET | viewer | existente |

- **Query:** `projectId?` (uuid), `phonogramId?` (uuid).
- **Response:** `{ ready: boolean, requirements: [{ id, label, status: 'met'|'missing'|'not_applicable', blocking, detail? }], missing: string[] }`.
  - `requirements`: `cover_art`, `wav_master`, `phonogram`, `isrc`, `metadata`, `work` (condicional).
- **Erros:** 403; (sem 404 — retorna avaliação mesmo com entidades ausentes, marcando `missing`).
- **Eventos emitidos:** execução gera `skill.*` (skill `release-readiness`); **não** emite `release.ready_for_distribution` (reservado para quando houver consumidor).
- **Entidades/tabelas:** `project_assets`/`assets` (capa/master), `phonograms` (isrc/registro/metadados), `works` (obra condicional).
- **Status atual:** `existente` (sem consumo no frontend ainda).
- **Observações para fiação:** exibir como checklist de bloqueios na tela de distribuição/lançamento. "Capa aprovada" hoje = asset `cover_art` ativo vinculado; cruzar com `marketing_asset_approvals` é refinamento futuro.

---

## 6. AdminAudit usando `/audit-logs`

**Finalidade:** trilha de auditoria append-only (todas as ações `@Audit`-decoradas) para a tela AdminAudit (hoje em mock).

**Controller real:** `apps/api/src/modules/audit-log/audit-log.controller.ts` (`@Controller('audit-logs')`).

| Rota | Método | RBAC | Status |
|---|---|---|---|
| `/audit-logs` | GET | viewer | existente |
| `/audit-logs/:id` | GET | admin | existente |

- **Query (`QueryAuditLogDto`):** `action?`, `userId?`, `entity?`, `entityId?` (uuid), `actorRole?`, `correlationId?`, `fromDate?`/`toDate?` (ISO) + paginação (`PaginationDto`).
- **Response (lista):** `{ data: AuditLog[], total, ... }`, `AuditLog = { id, tenant_id, action, entity, entity_id, actor_id, actor_role, correlation_id, before?, after?, created_at }`.
- **Response (`:id`):** detalhe com `before`/`after` (diff) — restrito a `admin`/`owner`.
- **Erros:** 403 (detalhe exige admin), 404.
- **Eventos emitidos:** n/a (somente leitura; o log é populado pelo interceptor `@Audit`).
- **Entidades/tabelas:** `audit_logs`.
- **Status atual:** `existente` (frontend `AdminAudit` ainda usa `MOCK_AUDIT_LOGS`; `useActivityHistory` do dashboard já consome real).
- **Observações para fiação:** trocar `MOCK_AUDIT_LOGS` por `GET /audit-logs` com os filtros acima; o detalhe com diff só para admin/owner.

---

## 7. Integrações OAuth reais

**Finalidade:** conectar contas corporativas (Meta/Instagram, TikTok, YouTube, Spotify, Google Ads) via OAuth real, substituindo o mock atual (`useMarketingOAuth`, sessionStorage).

**Controller real:** `apps/api/src/modules/integrations/integrations.controller.ts` (`@Controller('integrations')`).

| Rota | Método | RBAC | Status |
|---|---|---|---|
| `/integrations/oauth/init` | POST | editor | existente |
| `/integrations/oauth/exchange` | POST | editor | existente |
| `/integrations/spotify/callback` | GET/POST | (callback) | existente |
| `/integrations/instagram/callback` | POST | (callback) | existente |
| `/integrations/tiktok/callback` | POST | (callback) | existente |
| `/integrations/google-ads/callback` | POST | (callback) | existente |

- **Request (`oauth/init`):** `{ platform: 'meta_business'|'corp_tiktok'|'corp_youtube'|'corp_spotify'|'google_ads'|... , scopes?: string[], redirectUri? }` → **Response:** `{ authorizationUrl, state }`.
- **Request (`oauth/exchange`):** `{ platform, code, state }` → **Response:** `{ connected: true, accountName, accountId, scopes, expiresAt }`.
- **Callbacks por plataforma:** recebem `code`/`state` do provedor e persistem a conexão.
- **Erros:** 400 (state inválido, code ausente), 401/403, 502 (falha no provedor).
- **Eventos emitidos:** n/a obrigatório (pode emitir evento de integração ao conectar — futuro).
- **Entidades/tabelas:** `integrations`, `oauth_connections`.
- **Status atual:** `parcial` — rotas existem; **fluxo real depende de credenciais/segredos OAuth por provedor** (não disponíveis no ambiente atual). O front usa mock (`useMarketingOAuth`) em dev.
- **Observações para fiação:** substituir o handshake mock por: `oauth/init` → popup → callback → `oauth/exchange`; ler conexões reais (não sessionStorage). A regra de produto (contas corporativas = publicação; artistas via cadastro automático) já está refletida no front.

---

## Resumo de prontidão

| Fluxo | Backend | Frontend | Ação principal |
|---|---|---|---|
| 1. Campanhas | parcial | mock (B) | alinhar `targetType` Empresa/Artista + `platforms[]`; migrar B→HTTP |
| 2. Calendário de Conteúdo | parcial | mock (B) | adicionar `channels[]` + regra server-side; migrar B→HTTP |
| 3. Assets centrais | existente | sem tela | consumir nos fluxos de Conteúdo/Agendamento |
| 4. Skill-runs | existente | sem tela | visão "Histórico de Execuções" |
| 5. Release Readiness | existente | sem tela | checklist de distribuição |
| 6. AdminAudit | existente | mock | trocar mock por `/audit-logs` |
| 7. OAuth Integrações | parcial | mock | handshake real (depende de credenciais) |

> Nada implementado/alterado aqui — apenas contratos. A fiação real (TypeORM/NestJS,
> Domain Events, BullMQ, RBAC, tenant isolation, logs, persistência) ocorre após a
> validação dos fluxos no frontend.
