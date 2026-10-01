> Historical record. Kept as recorded; not the current contract.

# 37 — Contrato Canônico Final Aprovado do Frontend

Versão final do contrato canônico, incorporando exclusivamente as resoluções do [`35-canonical-contract-incomplete-resolution.md`](./35-canonical-contract-incomplete-resolution.md) e [`36-canonical-contract-conflict-resolution.md`](./36-canonical-contract-conflict-resolution.md) sobre o [`34-canonical-frontend-contract.md`](./34-canonical-frontend-contract.md) (não alterado). Nenhum arquivo foi alterado, em `apps/web` ou `apps/api`. Nenhuma arquitetura foi definida, nenhum endpoint/tabela/migration foi criado. Nenhum contrato além dos 2 já resolvidos (docs 35/36) foi reinterpretado — as seções A.1 a A.19, A.21 e A.22 e a seção B (Realtime) do doc34 são reproduzidas sem nenhuma mudança de conteúdo.

## O que mudou em relação ao doc34

Somente a seção A.20 (antes "DEFERRED — pendência real") foi atualizada, incorporando:
1. `POST /ai/generate` — doc35, Caso 1: `STATUS: RESOLVED` (path/auth/tenant/role resolvidos; request/response já compatíveis).
2. `POST /integrations/acrcloud/recognize` — doc35 Caso 2 (`CONFLICTING`) + doc36 (resolução do conflito): `STATUS: RESOLVED` via `FRONTEND_CONTRACT_WINS` — o contrato final é o já definido pelo frontend (`FingerprintInput`/`FingerprintResult`), o comportamento do backend legacy (`RecognizeAudioDto`/`ACRCloudResult`) fica registrado como requisito antigo não reproduzido.

Nenhuma outra seção foi tocada.

---

## A. Endpoints por domínio

As seções A.1 a A.19 são idênticas ao doc34 (`AUTH_REQUIRED: SIM`/`TENANT_REQUIRED: SIM` herdados do cliente `api` salvo exceção já registrada; `STATUS: CONTRACT_COMPLETE` em todas): A.1 Auth/Sessão/Onboarding · A.2 Billing (usuário) + Stripe Client · A.3 Admin: Billing/Tenants/Plans · A.4 Support Tickets · A.5 Leads · A.6 Company Settings/Logo · A.7 Storage genérico (45 tabelas) · A.8 Integrações de Marketing/Streaming (10 provedores) · A.9 Users/RBAC · A.10 Audit Logs/Activity/Notifications/Dashboard · A.11 Marketing (projetos/campanhas/conteúdos/briefings/tarefas/assets/IA) · A.12 CRM/Clients · A.13 Artist (perfis de plataforma) · A.14 Audiovisual · A.15 Accounting/Financial Categories · A.16 Entidades via `TABLE_ENDPOINT`/`storage.ts` · A.17 MusicChat/Conversations (domínio real de atendimento, distinto do "MusicChat" das Exceções) · A.18 Uploads (R2) e Reports · A.19 OAuth Bridge (init/exchange) e Popup. Ver doc34 para o detalhe completo de cada uma — não reproduzido aqui por instrução explícita de não reabrir contratos já aprovados.

### A.20 — IA / ACRCloud (antes DEFERRED — agora resolvido)

```text
DOMAIN: ai-generation
CONSUMER: shared/hooks/useAI.ts, modules/contracts/services/semantic-parser.service.ts, modules/integrations/hooks/useACRCloud.ts, modules/marketing/ai/providers/providerRouter.ts

POST /ai/generate
  AUTH_REQUIRED: SIM | TENANT_REQUIRED: SIM | ROLE: editor+
  REQUEST: { prompt: string; type?: string; systemPrompt?: string; jsonMode?: boolean; maxTokens?: number } (o que useAI.ts/semantic-parser.service.ts já enviam — {prompt,type} — é subconjunto válido)
  RESPONSE: { content: string }
  RESOLUÇÃO: doc35 Caso 1 — path corrigido de "/api/v1/ai/generate" (fetch relativo quebrado) para "/ai/generate" (via api-client.ts, mesmo destino final já usado corretamente por providerRouter.ts); auth/tenant/role herdados do padrão canônico
  STATUS: CONTRACT_COMPLETE

POST /integrations/acrcloud/recognize
  AUTH_REQUIRED: SIM | TENANT_REQUIRED: SIM | ROLE: editor+
  REQUEST: { input: { audio_data: string; duration_seconds?: number; source_type?: MonitoringSourceType; source_name?: string } }
  RESPONSE: { matched: boolean; matches: FingerprintMatch[]; best_match?: FingerprintMatch|null; processing_time_ms: number; fingerprint_id: string; detected_at: string }
  RESOLUÇÃO: doc35 Caso 2 (CONFLICTING) + doc36 — FRONTEND_CONTRACT_WINS: contrato final é o tipo já definido no frontend (FingerprintInput/FingerprintResult, shared/integrations/contracts/music-monitoring.contract.ts); o contrato do backend legacy (RecognizeAudioDto{audioBase64}/ACRCloudResult{title?,artist?,album?,isrc?,confidence?} — resultado único plano) é um REQUISITO ANTIGO, registrado e NÃO reproduzido na API v2
  STATUS: CONTRACT_COMPLETE

POST /ai/generate (via providerRouter.ts)
  já contado acima — mesmo endpoint, era CONTRACT_COMPLETE desde o doc34 (não é um 3º endpoint)
```

A seção A.21 (Terceiros — ViaCEP/IBGE/Nominatim/attachment.url) e A.22 (Testes) permanecem `NÃO APLICÁVEL` a `CONTRACT_COMPLETE`/`INCOMPLETE`, idênticas ao doc34 — não são endpoints de `apps/api`.

---

## B. Eventos Realtime (22 únicos — preservados integralmente do doc33/doc34, não reauditados)

```text
TRANSPORT: SUPABASE_REALTIME | CHANNEL: tenant:${orgId}+user:${userId} | EVENT: artist.created | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: artist.updated | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: artist.deleted | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: catalog.music.registered | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: catalog.phonogram.registered | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: contract.created | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: contract.updated | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: contract.signed | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: crm.lead.captured | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: crm.lead.converted | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: finance.transaction.created | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: finance.transaction.updated | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: finance.calculated | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: audit.entry.created | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: notification:new | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: billing:plan_upgraded | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: billing:trial_ending | DIRECTION: SUBSCRIBE (sem consumidor) | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: billing:payment_failed | DIRECTION: SUBSCRIBE (sem consumidor) | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: billing:cancelled | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: data:changed | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM
TRANSPORT: BROWSER_EVENT (postMessage) | CHANNEL: N/A | EVENT: musicos360_oauth_success | DIRECTION: BOTH | TENANT_SCOPED: NÃO APLICÁVEL | AUTH_REQUIRED: NÃO
TRANSPORT: BROWSER_EVENT (storage nativo) | CHANNEL: N/A | EVENT: storage (musicos360_distributor_connections) | DIRECTION: SUBSCRIBE | TENANT_SCOPED: NÃO APLICÁVEL | AUTH_REQUIRED: NÃO
```

Payloads/consumidores/detalhe completo: doc33 (não reauditado).

---

## C. Exceções Funcionais (preservadas sem alteração)

```text
Supabase Auth:
mantido diretamente no frontend

Supabase Realtime:
pode permanecer direto conforme decisão já documentada

Distribuidoras:
integração futura via API oficial por tenant quando disponível

MusicChat:
fora do escopo inicial da API v2

PENDING_TABLES:
nenhum exige API v2 no estado atual

Mocks:
nenhum exige API v2

Memory:
nenhum exige API v2

Storage local:
6 casos exigem API v2 (BACKEND_REQUIRED, docs 19-24) — persistem como requisito já registrado, não uma exceção nova

Serviços externos:
nenhuma integração OAuth exige mudança (doc30/31) — client_id público é comportamento correto, não uma exposição de segredo
```

Fontes inalteradas: doc17 (Supabase Auth/Realtime), doc25 (Distribuidoras — Decisão D1 aprovada), doc26 (MusicChat — DEFER_FROM_API_V2), doc32 (PENDING_TABLES), doc28 (Mocks), doc29 (Memory), doc19-24 (Storage local — os 6 casos BACKEND_REQUIRED, não relacionados aos 2 endpoints resolvidos nesta etapa, permanecem como requisito futuro já registrado), doc30/31 (Serviços externos).

---

## Resumo

```text
HTTP_CALL_SITES:
270

UNIQUE_HTTP_ENDPOINTS:
250

CONTRACT_COMPLETE:
250

CONTRACT_INCOMPLETE:
0

CONTRACT_CONFLICTING:
0

REALTIME_EVENTS:
22

UNRESOLVED_REQUESTS:
0

UNRESOLVED_RESPONSES:
0

UNRESOLVED_ERRORS:
0

UNRESOLVED_PERMISSIONS:
0

UNRESOLVED_REALTIME_EVENTS:
0

REQUIRES_HUMAN_DECISION:
0
```

Os 248 endpoints já `CONTRACT_COMPLETE` no doc34 permanecem inalterados. Os 2 antes `CONTRACT_INCOMPLETE`/`CONTRACT_CONFLICTING` (`POST /ai/generate` e `POST /integrations/acrcloud/recognize`) fecharam como `CONTRACT_COMPLETE` nesta etapa, incorporando exatamente as resoluções do doc35 (path/auth/tenant/role) e doc36 (`FRONTEND_CONTRACT_WINS` para request/response do ACRCloud). `REQUIRES_HUMAN_DECISION: 0` porque nenhum dos 2 casos exigiu decisão humana (doc35 Caso 1 = RESOLVED direto; doc36 = FRONTEND_CONTRACT_WINS, sem necessidade de decisão).

## Cobertura

Contrato canônico final: 250/250 endpoints únicos `CONTRACT_COMPLETE`, 22/22 eventos realtime preservados, 9 exceções funcionais preservadas sem alteração. Nenhum contrato além dos 2 explicitamente resolvidos nos docs 35/36 foi reinterpretado. Nenhuma arquitetura foi definida. `apps/web`, `apps/api` e o doc34 não foram alterados.
